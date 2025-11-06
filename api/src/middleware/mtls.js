const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { jwtVerify, importJWK, importX509 } = require('jose');
const logger = require('../utils/logger');

// Trusted institution certificates registry
const TRUSTED_CERTIFICATES = new Map();

/**
 * Load trusted certificates from directory
 */
const loadTrustedCertificates = () => {
  const certsDir = process.env.TRUSTED_CERTS_DIR || './certs/trusted';
  
  try {
    if (fs.existsSync(certsDir)) {
      const certFiles = fs.readdirSync(certsDir).filter(file => file.endsWith('.pem'));
      
      certFiles.forEach(file => {
        const certPath = path.join(certsDir, file);
        const certContent = fs.readFileSync(certPath, 'utf8');
        const institutionId = file.replace('.pem', '');
        
        TRUSTED_CERTIFICATES.set(institutionId, {
          certificate: certContent,
          fingerprint: generateFingerprint(certContent),
          loadedAt: new Date()
        });
        
        logger.info(`Loaded certificate for institution: ${institutionId}`);
      });
    } else {
      logger.warn(`Trusted certificates directory not found: ${certsDir}`);
    }
  } catch (error) {
    logger.error('Error loading trusted certificates:', error);
  }
};

/**
 * Generate certificate fingerprint
 */
const generateFingerprint = (certificate) => {
  return crypto
    .createHash('sha256')
    .update(certificate)
    .digest('hex')
    .toUpperCase()
    .match(/.{2}/g)
    .join(':');
};

/**
 * Extract certificate from request
 */
const extractClientCertificate = (req) => {
  // In production, this would come from TLS handshake
  // For development/testing, we check headers or custom fields
  
  if (req.socket && req.socket.getPeerCertificate) {
    const cert = req.socket.getPeerCertificate();
    if (cert && Object.keys(cert).length > 0) {
      return cert;
    }
  }
  
  // Development mode: check for certificate in headers
  if (process.env.NODE_ENV !== 'production') {
    const certHeader = req.headers['x-client-certificate'];
    if (certHeader) {
      try {
        return JSON.parse(Buffer.from(certHeader, 'base64').toString());
      } catch (error) {
        logger.warn('Invalid client certificate header format');
      }
    }
  }
  
  return null;
};

/**
 * Validate client certificate (FAPI 2.0 enhanced)
 */
const validateClientCertificate = (cert, institutionId) => {
  if (!cert) {
    return { valid: false, reason: 'No client certificate provided' };
  }
  
  // Check if institution is trusted
  const trustedCert = TRUSTED_CERTIFICATES.get(institutionId);
  if (!trustedCert) {
    return { valid: false, reason: 'Institution not in trusted registry' };
  }
  
  // FAPI 2.0: Enhanced certificate validation
  if (cert.subject && cert.subject.CN) {
    const commonName = cert.subject.CN;
    if (!commonName.includes(institutionId)) {
      return { valid: false, reason: 'Certificate common name mismatch' };
    }
  }
  
  // Check certificate validity period
  if (cert.valid_from && cert.valid_to) {
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);
    
    if (now < validFrom || now > validTo) {
      return { valid: false, reason: 'Certificate not within validity period' };
    }
  }
  
  // FAPI 2.0: Validate minimum key strength
  if (cert.modulus && cert.modulus.length < 256) { // RSA 2048-bit minimum
    return { valid: false, reason: 'Certificate key strength insufficient (RSA 2048-bit minimum)' };
  }
  
  // Validate fingerprint if available
  if (cert.fingerprint) {
    const expectedFingerprint = trustedCert.fingerprint;
    if (cert.fingerprint !== expectedFingerprint) {
      return { valid: false, reason: 'Certificate fingerprint mismatch' };
    }
  }
  
  return { valid: true };
};

/**
 * Validate private_key_jwt client authentication (FAPI 2.0)
 */
const validatePrivateKeyJWT = async (jwtAssertion, clientId) => {
  try {
    if (!jwtAssertion) {
      throw new Error('No JWT assertion provided');
    }

    // Get client's registered public key/certificate
    const trustedCert = TRUSTED_CERTIFICATES.get(clientId);
    if (!trustedCert) {
      throw new Error('Client not in trusted registry');
    }

    // Import public key from certificate
    const publicKey = await importX509(trustedCert.certificate, ['PS256', 'ES256', 'EdDSA']);
    
    // Verify JWT signature and get payload
    const { payload } = await jwtVerify(jwtAssertion, publicKey, {
      algorithms: ['PS256', 'ES256', 'EdDSA'] // FAPI 2.0 approved algorithms
    });

    // Validate required claims
    const now = Math.floor(Date.now() / 1000);
    
    if (!payload.iss || !payload.sub || !payload.aud || !payload.jti || !payload.exp || !payload.iat) {
      throw new Error('Missing required claims in JWT assertion');
    }

    // Validate issuer and subject match client_id
    if (payload.iss !== clientId || payload.sub !== clientId) {
      throw new Error('JWT assertion issuer/subject mismatch');
    }

    // Validate audience (should be token endpoint)
    const expectedAudience = process.env.TOKEN_ENDPOINT || `${process.env.BASE_URL}/token`;
    if (!Array.isArray(payload.aud) ? payload.aud !== expectedAudience : !payload.aud.includes(expectedAudience)) {
      throw new Error('JWT assertion audience mismatch');
    }

    // Validate expiration (max 60 minutes as per FAPI 2.0)
    if (payload.exp > now + (60 * 60)) {
      throw new Error('JWT assertion expiration too far in future (max 60 minutes)');
    }

    if (payload.exp <= now) {
      throw new Error('JWT assertion expired');
    }

    // Validate issued at time (allow 60 seconds clock skew)
    if (payload.iat > now + 60 || payload.iat < now - 60) {
      throw new Error('JWT assertion timestamp out of acceptable range');
    }

    return {
      valid: true,
      clientId: payload.sub,
      jti: payload.jti,
      exp: payload.exp
    };

  } catch (error) {
    logger.warn('Private key JWT validation failed:', error.message);
    return {
      valid: false,
      reason: error.message
    };
  }
};

/**
 * Client authentication middleware (mTLS or private_key_jwt for FAPI 2.0)
 */
const mtlsMiddleware = async (req, res, next) => {
  try {
    // Test mode bypass (development only)
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-mode'] === 'true') {
      logger.debug('Test mode client authentication bypass activated');
      req.client = {
        id: req.headers['x-institution-id'] || 'test-client',
        authMethod: 'test_mode',
        institutionId: req.headers['x-institution-id'] || 'test-client',
        testMode: true
      };
      return next();
    }

    // Skip client authentication in development if explicitly disabled
    if (process.env.NODE_ENV !== 'production' && process.env.SKIP_CLIENT_AUTH === 'true') {
      logger.debug('Skipping client authentication in development mode');
      req.client = { id: 'dev-client', authMethod: 'none' };
      return next();
    }

    let clientId = null;
    let authMethod = null;
    let authResult = null;

    // Try mTLS first
    const clientCert = extractClientCertificate(req);
    if (clientCert) {
      // Extract client ID from certificate or body
      clientId = req.body?.client_id || req.user?.institutionId;
      if (clientId) {
        const mtlsValidation = validateClientCertificate(clientCert, clientId);
        if (mtlsValidation.valid) {
          authMethod = 'mTLS';
          authResult = {
            institutionId: clientId,
            fingerprint: clientCert.fingerprint,
            subject: clientCert.subject,
            issuer: clientCert.issuer,
            validatedAt: new Date()
          };
        }
      }
    }

    // Try private_key_jwt if mTLS failed or not available
    if (!authMethod) {
      const clientAssertion = req.body?.client_assertion;
      const clientAssertionType = req.body?.client_assertion_type;
      
      if (clientAssertion && clientAssertionType === 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer') {
        clientId = req.body?.client_id;
        if (clientId) {
          const jwtValidation = await validatePrivateKeyJWT(clientAssertion, clientId);
          if (jwtValidation.valid) {
            authMethod = 'private_key_jwt';
            authResult = {
              clientId: jwtValidation.clientId,
              jti: jwtValidation.jti,
              exp: jwtValidation.exp,
              validatedAt: new Date()
            };
          }
        }
      }
    }

    // Require either mTLS or private_key_jwt for FAPI 2.0
    if (!authMethod) {
      logger.warn('Client authentication failed', {
        clientId: clientId || 'unknown',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        reason: 'Neither mTLS nor private_key_jwt authentication successful'
      });
      
      return res.status(401).json({
        error: 'unauthorized_client',
        error_description: 'Client authentication failed. FAPI 2.0 requires mTLS or private_key_jwt',
        timestamp: new Date().toISOString()
      });
    }
    
    // Attach client info to request
    req.client = {
      id: clientId,
      authMethod,
      ...authResult
    };
    
    logger.debug('Client authentication successful', {
      clientId,
      authMethod,
      ip: req.ip
    });
    
    next();
  } catch (error) {
    logger.error('Client authentication middleware error:', error);
    
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Client authentication error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional mTLS middleware
 */
const optionalMtls = (req, res, next) => {
  try {
    const institutionId = req.user?.institutionId;
    if (institutionId) {
      const clientCert = extractClientCertificate(req);
      const validation = validateClientCertificate(clientCert, institutionId);
      
      if (validation.valid) {
        req.clientCertificate = {
          institutionId,
          fingerprint: clientCert.fingerprint,
          subject: clientCert.subject,
          issuer: clientCert.issuer,
          validatedAt: new Date()
        };
        
        req.mtlsValidated = true;
      } else {
        req.mtlsValidated = false;
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional mTLS middleware error:', error);
    req.mtlsValidated = false;
    next();
  }
};

/**
 * Get institution certificate info
 */
const getInstitutionCertificate = (institutionId) => {
  return TRUSTED_CERTIFICATES.get(institutionId);
};

/**
 * Add trusted certificate
 */
const addTrustedCertificate = (institutionId, certificate) => {
  TRUSTED_CERTIFICATES.set(institutionId, {
    certificate,
    fingerprint: generateFingerprint(certificate),
    loadedAt: new Date()
  });
  
  logger.info(`Added trusted certificate for institution: ${institutionId}`);
};

/**
 * Remove trusted certificate
 */
const removeTrustedCertificate = (institutionId) => {
  const removed = TRUSTED_CERTIFICATES.delete(institutionId);
  if (removed) {
    logger.info(`Removed trusted certificate for institution: ${institutionId}`);
  }
  return removed;
};

/**
 * List all trusted institutions
 */
const listTrustedInstitutions = () => {
  return Array.from(TRUSTED_CERTIFICATES.keys());
};

// Initialize trusted certificates on module load
loadTrustedCertificates();

module.exports = mtlsMiddleware;
module.exports.optional = optionalMtls;
module.exports.loadTrustedCertificates = loadTrustedCertificates;
module.exports.addTrustedCertificate = addTrustedCertificate;
module.exports.removeTrustedCertificate = removeTrustedCertificate;
module.exports.listTrustedInstitutions = listTrustedInstitutions;
module.exports.getInstitutionCertificate = getInstitutionCertificate;
module.exports.validatePrivateKeyJWT = validatePrivateKeyJWT;
module.exports.validateClientCertificate = validateClientCertificate;