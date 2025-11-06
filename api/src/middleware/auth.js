const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');
const { jwtVerify, importJWK } = require('jose');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'open-api-kundenbeziehung';

/**
 * Verify JWT token and extract claims (FAPI 2.0 compliant)
 */
const verifyToken = async (token) => {
  try {
    // FAPI 2.0 requires PS256, ES256, or EdDSA algorithms only
    const allowedAlgorithms = ['PS256', 'ES256', 'EdDSA'];
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      algorithms: allowedAlgorithms
    });
    
    // Validate required claims
    if (!decoded.sub || !decoded.iat || !decoded.exp) {
      throw new Error('Invalid token structure');
    }
    
    // Check if token is expired
    if (decoded.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    
    // FAPI 2.0: Validate algorithm used
    const header = jwt.decode(token, { complete: true })?.header;
    if (!header || !allowedAlgorithms.includes(header.alg)) {
      throw new Error(`Invalid algorithm: ${header?.alg}. FAPI 2.0 requires PS256, ES256, or EdDSA`);
    }
    
    return decoded;
  } catch (error) {
    logger.warn('Token verification failed:', error.message);
    throw error;
  }
};

/**
 * Extract Bearer token from Authorization header
 */
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Extract DPoP proof from DPoP header
 */
const extractDPoPProof = (req) => {
  return req.headers.dpop || null;
};

/**
 * Validate DPoP proof (FAPI 2.0)
 */
const validateDPoPProof = async (dpopProof, accessToken, httpMethod, httpUri) => {
  try {
    if (!dpopProof) {
      throw new Error('DPoP proof required');
    }

    // Parse DPoP proof JWT header to get public key
    const header = jwt.decode(dpopProof, { complete: true })?.header;
    if (!header || !header.jwk) {
      throw new Error('Invalid DPoP proof: missing JWK in header');
    }

    // Verify DPoP proof signature using public key from header
    const publicKey = await importJWK(header.jwk);
    const { payload } = await jwtVerify(dpopProof, publicKey, {
      algorithms: ['PS256', 'ES256', 'EdDSA']
    });

    // Validate DPoP proof claims
    const now = Math.floor(Date.now() / 1000);
    
    // Check required claims
    if (!payload.jti || !payload.htm || !payload.htu || !payload.iat) {
      throw new Error('Invalid DPoP proof: missing required claims');
    }

    // Check HTTP method matches
    if (payload.htm !== httpMethod.toUpperCase()) {
      throw new Error('DPoP proof HTTP method mismatch');
    }

    // Check HTTP URI matches (without query/fragment)
    const expectedUri = new URL(httpUri);
    expectedUri.search = '';
    expectedUri.hash = '';
    if (payload.htu !== expectedUri.toString()) {
      throw new Error('DPoP proof HTTP URI mismatch');
    }

    // Check timestamp (allow 60 seconds clock skew)
    if (payload.iat > now + 60 || payload.iat < now - 60) {
      throw new Error('DPoP proof timestamp out of acceptable range');
    }

    // If access token provided, validate binding
    if (accessToken && payload.ath) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(accessToken)
        .digest('base64url');
      
      if (payload.ath !== tokenHash) {
        throw new Error('DPoP proof access token hash mismatch');
      }
    }

    return {
      jti: payload.jti,
      jwk: header.jwk,
      iat: payload.iat
    };

  } catch (error) {
    logger.warn('DPoP proof validation failed:', error.message);
    throw error;
  }
};

/**
 * Validate consent claims in JWT token
 */
const validateConsentClaims = (decoded, requiredPurpose) => {
  const consentClaim = decoded.consent;
  
  if (!consentClaim) {
    return false;
  }
  
  // Check if consent is granted
  if (!consentClaim.granted) {
    return false;
  }
  
  // Check purpose if specified
  if (requiredPurpose && consentClaim.purpose !== requiredPurpose) {
    return false;
  }
  
  // Check expiry
  if (consentClaim.expiresAt && new Date(consentClaim.expiresAt) < new Date()) {
    return false;
  }
  
  return true;
};

/**
 * Required authentication middleware (FAPI 2.0 with DPoP support)
 */
const required = async (req, res, next) => {
  try {
    // Test mode bypass (development only)
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-mode'] === 'true') {
      logger.debug('Test mode authentication bypass activated');
      req.user = {
        id: 'test-user',
        clientId: 'test-client',
        institutionId: req.headers['x-institution-id'] || 'CH-TEST-001',
        scopes: ['customer:read', 'customer:write', 'consent:manage', 'identification:read', 'checks:read'],
        consent: {
          granted: true,
          purpose: 'testing',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          dataCategories: ['basicData', 'contactInformation', 'addressData', 'identification', 'kycData', 'complianceData']
        },
        dpopBound: false,
        testMode: true
      };
      return next();
    }

    const token = extractBearerToken(req);
    const dpopProof = extractDPoPProof(req);

    if (!token) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }
    
    const decoded = await verifyToken(token);
    
    // Check for DPoP binding if token is DPoP-bound
    if (decoded.cnf?.jkt || dpopProof) {
      if (!dpopProof) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'DPoP proof required for DPoP-bound token',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const httpUri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const dpopResult = await validateDPoPProof(dpopProof, token, req.method, httpUri);
        
        // Validate JWK thumbprint if token has cnf claim
        if (decoded.cnf?.jkt) {
          const thumbprint = crypto
            .createHash('sha256')
            .update(JSON.stringify(dpopResult.jwk))
            .digest('base64url');
          
          if (decoded.cnf.jkt !== thumbprint) {
            throw new Error('DPoP JWK thumbprint mismatch');
          }
        }
        
        req.dpop = dpopResult;
      } catch (dpopError) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: `DPoP validation failed: ${dpopError.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Attach user info to request
    req.user = {
      id: decoded.sub,
      clientId: decoded.client_id,
      institutionId: decoded.institution_id,
      scopes: decoded.scope ? decoded.scope.split(' ') : [],
      consent: decoded.consent,
      dpopBound: !!(decoded.cnf?.jkt || dpopProof)
    };
    
    // Log authentication
    logger.debug('Authentication successful', {
      userId: req.user.id,
      clientId: req.user.clientId,
      institutionId: req.user.institutionId,
      dpopBound: req.user.dpopBound,
      ip: req.ip
    });
    
    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional authentication middleware
 */
const optional = async (req, res, next) => {
  try {
    // Test mode bypass (development only)
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-mode'] === 'true') {
      logger.debug('Test mode authentication bypass activated (optional)');
      req.user = {
        id: 'test-user',
        clientId: 'test-client',
        institutionId: req.headers['x-institution-id'] || 'CH-TEST-001',
        scopes: ['customer:read', 'customer:write', 'consent:manage', 'identification:read', 'checks:read'],
        consent: {
          granted: true,
          purpose: 'testing',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          dataCategories: ['basicData', 'contactInformation', 'addressData', 'identification', 'kycData', 'complianceData']
        },
        dpopBound: false,
        testMode: true
      };
      return next();
    }

    const token = extractBearerToken(req);

    if (token) {
      const decoded = await verifyToken(token);
      req.user = {
        id: decoded.sub,
        clientId: decoded.client_id,
        institutionId: decoded.institution_id,
        scopes: decoded.scope ? decoded.scope.split(' ') : [],
        consent: decoded.consent
      };
    }

    next();
  } catch (error) {
    // For optional auth, continue without user context
    logger.debug('Optional authentication failed, continuing without user context', {
      error: error.message,
      ip: req.ip
    });
    next();
  }
};

/**
 * Require specific scope
 */
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!req.user.scopes.includes(requiredScope)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Scope '${requiredScope}' required`,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

/**
 * Require valid consent for specific purpose
 */
const requireConsent = (purpose) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }

    // Skip consent validation in test mode
    if (req.user.testMode) {
      logger.debug('Test mode consent validation bypass activated');
      return next();
    }

    if (!validateConsentClaims(req.user, purpose)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Valid consent required for this operation',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * Generate JWT token for testing purposes (FAPI 2.0 compliant)
 */
const generateTestToken = (payload, algorithm = 'PS256') => {
  // FAPI 2.0 requires shorter token lifetimes for enhanced security
  const defaultPayload = {
    iss: JWT_ISSUER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes (shorter for FAPI 2.0)
    sub: 'test-user',
    client_id: 'test-client',
    institution_id: 'CH-BANK-001',
    scope: 'customer:read customer:write consent:manage',
    consent: {
      granted: true,
      purpose: 'accountOpening',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      dataCategories: ['basicData', 'identification', 'kycData']
    }
  };
  
  // Use FAPI 2.0 approved algorithm
  return jwt.sign({ ...defaultPayload, ...payload }, JWT_SECRET, { 
    algorithm,
    header: {
      typ: 'JWT',
      alg: algorithm
    }
  });
};

module.exports = {
  required,
  optional,
  requireScope,
  requireConsent,
  verifyToken,
  generateTestToken,
  validateConsentClaims,
  validateDPoPProof,
  extractDPoPProof,
  extractBearerToken
};