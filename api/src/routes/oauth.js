const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { jwtVerify, SignJWT, importJWK, generateKeyPair } = require('jose');
const joi = require('joi');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const mtlsMiddleware = require('../middleware/mtls');

const router = express.Router();

// OAuth/OIDC configuration
const ISSUER = process.env.ISSUER || process.env.BASE_URL || 'https://api.kundenbeziehung.ch';
const AUTHORIZATION_CODE_EXPIRY = 600; // 10 minutes
const ACCESS_TOKEN_EXPIRY = 900; // 15 minutes (FAPI 2.0 short lifetime)
const REFRESH_TOKEN_EXPIRY = 3600; // 1 hour
const ID_TOKEN_EXPIRY = 900; // 15 minutes

// In-memory storage (use Redis/database in production)
const authorizationCodes = new Map();
const accessTokens = new Map();
const refreshTokens = new Map();
const clientRegistry = new Map();

// Service layer references (injected by app.js)
let serviceManager = null;
let coreFramework = null;

/**
 * Set service manager reference
 */
function setServiceManager(manager) {
  serviceManager = manager;
}

/**
 * Set core framework reference
 */
function setCoreFramework(framework) {
  coreFramework = framework;
}

// Load default test clients
const loadDefaultClients = () => {
  const defaultClients = [
    {
      client_id: 'banking-client-001',
      client_name: 'Swiss Bank Demo Client',
      client_secret: process.env.DEMO_CLIENT_SECRET || 'demo-client-secret-change-in-production',
      redirect_uris: [
        'https://demo-bank.ch/callback',
        'http://localhost:3000/callback' // Development only
      ],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'openid profile customer:read customer:write consent:manage',
      token_endpoint_auth_method: 'private_key_jwt',
      require_pushed_authorization_requests: true,
      require_signed_request_object: true
    }
  ];

  defaultClients.forEach(client => {
    clientRegistry.set(client.client_id, {
      ...client,
      created_at: new Date(),
      status: 'active'
    });
  });

  logger.info(`Loaded ${defaultClients.length} default OAuth clients`);
};

// Initialize default clients
loadDefaultClients();

/**
 * Authorization Request Schema (FAPI 2.0 compliant)
 */
const authorizationRequestSchema = joi.object({
  response_type: joi.string().valid('code').required(),
  client_id: joi.string().required(),
  redirect_uri: joi.string().uri().required(),
  scope: joi.string().required(),
  state: joi.string().required(),
  code_challenge: joi.string().required(),
  code_challenge_method: joi.string().valid('S256').required(),
  nonce: joi.string(),
  request_uri: joi.string(),
  request: joi.string(),
  // FAPI 2.0 specific parameters
  purpose: joi.string().valid('accountOpening', 'creditAssessment', 'compliance', 'customerUpdate'),
  claims: joi.string(),
  max_age: joi.number().integer().min(0),
  prompt: joi.string().valid('none', 'login', 'consent', 'select_account')
});

/**
 * Token Request Schema (FAPI 2.0 compliant)
 */
const tokenRequestSchema = joi.object({
  grant_type: joi.string().valid('authorization_code', 'refresh_token').required(),
  client_id: joi.string().required(),
  code: joi.when('grant_type', { is: 'authorization_code', then: joi.required() }),
  redirect_uri: joi.when('grant_type', { is: 'authorization_code', then: joi.required() }),
  code_verifier: joi.when('grant_type', { is: 'authorization_code', then: joi.required() }),
  refresh_token: joi.when('grant_type', { is: 'refresh_token', then: joi.required() }),
  // Client authentication
  client_assertion_type: joi.string().valid('urn:ietf:params:oauth:client-assertion-type:jwt-bearer'),
  client_assertion: joi.string(),
  client_secret: joi.string()
});

/**
 * GET /authorize - OAuth 2.1 Authorization Endpoint (FAPI 2.0)
 * Handles authorization requests with PAR integration
 */
router.get('/authorize', async (req, res) => {
  try {
    logger.info('Authorization request received', {
      clientId: req.query.client_id,
      scope: req.query.scope,
      ip: req.ip
    });

    // Check for request_uri (PAR) first - FAPI 2.0 requirement
    if (req.query.request_uri) {
      return handlePARAuthorization(req, res);
    }

    // Validate authorization request
    const { error, value: validatedRequest } = authorizationRequestSchema.validate(req.query);
    if (error) {
      return res.redirect(`${req.query.redirect_uri}?error=invalid_request&error_description=${encodeURIComponent(error.details[0].message)}&state=${req.query.state || ''}`);
    }

    // Validate client
    const client = clientRegistry.get(validatedRequest.client_id);
    if (!client || client.status !== 'active') {
      return res.redirect(`${validatedRequest.redirect_uri}?error=invalid_client&error_description=Client not found or inactive&state=${validatedRequest.state}`);
    }

    // Validate redirect URI
    if (!client.redirect_uris.includes(validatedRequest.redirect_uri)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri'
      });
    }

    // FAPI 2.0: Require PAR for public clients
    if (client.require_pushed_authorization_requests) {
      return res.redirect(`${validatedRequest.redirect_uri}?error=invalid_request&error_description=PAR required for this client&state=${validatedRequest.state}`);
    }

    // Generate authorization code
    const authCode = generateSecureToken();
    const codeData = {
      client_id: validatedRequest.client_id,
      redirect_uri: validatedRequest.redirect_uri,
      scope: validatedRequest.scope,
      code_challenge: validatedRequest.code_challenge,
      code_challenge_method: validatedRequest.code_challenge_method,
      nonce: validatedRequest.nonce,
      purpose: validatedRequest.purpose,
      created_at: new Date(),
      expires_at: new Date(Date.now() + AUTHORIZATION_CODE_EXPIRY * 1000),
      used: false
    };

    authorizationCodes.set(authCode, codeData);

    // Clean up expired codes
    cleanupExpiredCodes();

    logger.info('Authorization code generated', {
      clientId: validatedRequest.client_id,
      scope: validatedRequest.scope,
      expiresAt: codeData.expires_at
    });

    // Redirect with authorization code
    const redirectUrl = new URL(validatedRequest.redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    redirectUrl.searchParams.set('state', validatedRequest.state);
    
    res.redirect(redirectUrl.toString());

  } catch (error) {
    logger.error('Authorization request failed', {
      error: error.message,
      stack: error.stack,
      clientId: req.query.client_id
    });

    const redirectUri = req.query.redirect_uri;
    const state = req.query.state || '';
    
    if (redirectUri) {
      res.redirect(`${redirectUri}?error=server_error&error_description=Internal server error&state=${state}`);
    } else {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  }
});

/**
 * Handle PAR (Pushed Authorization Request) authorization
 */
async function handlePARAuthorization(req, res) {
  const requestUri = req.query.request_uri;
  
  // Extract request ID from request_uri
  const requestId = requestUri.replace('urn:ietf:params:oauth:request_uri:', '');
  
  try {
    // Retrieve PAR request data
    const parResponse = await fetch(`${req.protocol}://${req.get('host')}/par/${requestId}`, {
      method: 'GET',
      headers: {
        'Authorization': req.headers.authorization || ''
      }
    });

    if (!parResponse.ok) {
      const errorData = await parResponse.json();
      return res.redirect(`${req.query.redirect_uri || 'about:blank'}?error=invalid_request_uri&error_description=${encodeURIComponent(errorData.error_description)}&state=${req.query.state || ''}`);
    }

    const parData = await parResponse.json();
    
    // Generate authorization code using PAR data
    const authCode = generateSecureToken();
    const codeData = {
      client_id: parData.client_id || parData.clientId,
      redirect_uri: parData.redirect_uri,
      scope: parData.scope,
      code_challenge: parData.code_challenge,
      code_challenge_method: parData.code_challenge_method,
      nonce: parData.nonce,
      purpose: parData.purpose,
      created_at: new Date(),
      expires_at: new Date(Date.now() + AUTHORIZATION_CODE_EXPIRY * 1000),
      used: false,
      par_request_id: requestId
    };

    authorizationCodes.set(authCode, codeData);

    logger.info('PAR authorization code generated', {
      clientId: codeData.client_id,
      requestId,
      scope: codeData.scope
    });

    // Redirect with authorization code
    const redirectUrl = new URL(parData.redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (req.query.state) {
      redirectUrl.searchParams.set('state', req.query.state);
    }
    
    res.redirect(redirectUrl.toString());

  } catch (error) {
    logger.error('PAR authorization failed', {
      error: error.message,
      requestId,
      clientId: req.query.client_id
    });

    res.redirect(`${req.query.redirect_uri || 'about:blank'}?error=server_error&error_description=PAR processing failed&state=${req.query.state || ''}`);
  }
}

/**
 * POST /token - OAuth 2.1 Token Endpoint (FAPI 2.0)
 */
router.post('/token', mtlsMiddleware, async (req, res) => {
  try {
    // Validate token request
    const { error, value: validatedRequest } = tokenRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: error.details[0].message
      });
    }

    // Validate client authentication (done by mtlsMiddleware)
    if (!req.client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication required'
      });
    }

    // Verify client_id matches authenticated client
    if (validatedRequest.client_id !== req.client.id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id mismatch'
      });
    }

    if (validatedRequest.grant_type === 'authorization_code') {
      return handleAuthorizationCodeGrant(validatedRequest, req, res);
    } else if (validatedRequest.grant_type === 'refresh_token') {
      return handleRefreshTokenGrant(validatedRequest, req, res);
    }

  } catch (error) {
    logger.error('Token request failed', {
      error: error.message,
      stack: error.stack,
      clientId: req.body.client_id
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

/**
 * Handle authorization code grant
 */
async function handleAuthorizationCodeGrant(validatedRequest, req, res) {
  const { code, redirect_uri, code_verifier, client_id } = validatedRequest;

  // Validate authorization code
  const codeData = authorizationCodes.get(code);
  if (!codeData) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code not found'
    });
  }

  // Check if code is expired
  if (codeData.expires_at < new Date()) {
    authorizationCodes.delete(code);
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code expired'
    });
  }

  // Check if code is already used (single use)
  if (codeData.used) {
    authorizationCodes.delete(code);
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code already used'
    });
  }

  // Validate client_id and redirect_uri
  if (codeData.client_id !== client_id || codeData.redirect_uri !== redirect_uri) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Invalid client_id or redirect_uri'
    });
  }

  // Validate PKCE code verifier
  const codeChallenge = crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest('base64url');

  if (codeChallenge !== codeData.code_challenge) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed'
    });
  }

  // Mark code as used
  codeData.used = true;

  // Generate tokens
  const tokenData = await generateTokens(codeData, req);

  logger.info('Tokens issued via authorization code', {
    clientId: client_id,
    scope: codeData.scope,
    tokenType: tokenData.dpopBound ? 'DPoP' : 'Bearer'
  });

  res.json(tokenData);
}

/**
 * Handle refresh token grant
 */
async function handleRefreshTokenGrant(validatedRequest, req, res) {
  const { refresh_token, client_id } = validatedRequest;

  // Validate refresh token
  const tokenData = refreshTokens.get(refresh_token);
  if (!tokenData) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Refresh token not found'
    });
  }

  // Check if refresh token is expired
  if (tokenData.expires_at < new Date()) {
    refreshTokens.delete(refresh_token);
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Refresh token expired'
    });
  }

  // Validate client_id
  if (tokenData.client_id !== client_id) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Invalid client_id'
    });
  }

  // Generate new tokens
  const newTokenData = await generateTokens(tokenData, req);

  // Revoke old refresh token
  refreshTokens.delete(refresh_token);

  logger.info('Tokens refreshed', {
    clientId: client_id,
    scope: tokenData.scope
  });

  res.json(newTokenData);
}

/**
 * Generate access and refresh tokens (FAPI 2.0 compliant)
 */
async function generateTokens(grantData, req) {
  const { client_id, scope, nonce, purpose } = grantData;
  const client = clientRegistry.get(client_id);

  // Check for DPoP header
  const dpopProof = req.headers.dpop;
  let dpopBound = false;
  let dpopJwk = null;

  if (dpopProof) {
    try {
      // Extract JWK from DPoP proof
      const dpopHeader = jwt.decode(dpopProof, { complete: true })?.header;
      if (dpopHeader?.jwk) {
        dpopJwk = dpopHeader.jwk;
        dpopBound = true;
      }
    } catch (error) {
      logger.warn('Invalid DPoP proof in token request', { error: error.message });
    }
  }

  // Generate access token
  const accessToken = generateSecureToken();
  const accessTokenPayload = {
    iss: ISSUER,
    sub: `user_${client_id}`, // In production, use actual user ID
    aud: ISSUER,
    client_id,
    scope,
    purpose,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
    jti: uuidv4()
  };

  // Add DPoP binding if present
  if (dpopBound && dpopJwk) {
    const jwkThumbprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(dpopJwk))
      .digest('base64url');

    accessTokenPayload.cnf = {
      jkt: jwkThumbprint
    };
  }

  // Sign access token (FAPI 2.0 requires PS256, ES256, or EdDSA)
  const signedAccessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET || 'change-in-production', {
    algorithm: 'PS256',
    header: {
      typ: 'at+jwt' // Explicit access token type
    }
  });

  // Store access token
  accessTokens.set(accessToken, {
    ...accessTokenPayload,
    client_id,
    dpop_jwk: dpopJwk,
    created_at: new Date(),
    expires_at: new Date(Date.now() + ACCESS_TOKEN_EXPIRY * 1000)
  });

  // Generate refresh token
  const refreshToken = generateSecureToken();
  refreshTokens.set(refreshToken, {
    client_id,
    scope,
    purpose,
    created_at: new Date(),
    expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000)
  });

  const tokenResponse = {
    access_token: signedAccessToken,
    refresh_token: refreshToken,
    token_type: dpopBound ? 'DPoP' : 'Bearer',
    expires_in: ACCESS_TOKEN_EXPIRY,
    scope
  };

  // Generate ID token if openid scope is present
  if (scope.includes('openid')) {
    const idTokenPayload = {
      iss: ISSUER,
      sub: `user_${client_id}`,
      aud: client_id,
      exp: Math.floor(Date.now() / 1000) + ID_TOKEN_EXPIRY,
      iat: Math.floor(Date.now() / 1000),
      auth_time: Math.floor(Date.now() / 1000),
      nonce
    };

    tokenResponse.id_token = jwt.sign(idTokenPayload, process.env.JWT_SECRET || 'change-in-production', {
      algorithm: 'PS256'
    });
  }

  return tokenResponse;
}

/**
 * POST /introspect - Token Introspection Endpoint (RFC 7662)
 */
router.post('/introspect', mtlsMiddleware, (req, res) => {
  try {
    const { token, token_type_hint } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'token parameter required'
      });
    }

    // Check access tokens
    const tokenData = Array.from(accessTokens.values()).find(data => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-in-production');
        return decoded.jti && data.jti === decoded.jti;
      } catch {
        return false;
      }
    });

    if (tokenData) {
      const isActive = tokenData.expires_at > new Date();
      
      const introspectionResponse = {
        active: isActive,
        client_id: tokenData.client_id,
        scope: tokenData.scope,
        exp: Math.floor(tokenData.expires_at.getTime() / 1000),
        iat: Math.floor(tokenData.created_at.getTime() / 1000),
        token_type: tokenData.dpop_jwk ? 'DPoP' : 'Bearer'
      };

      if (isActive) {
        introspectionResponse.sub = tokenData.sub;
        introspectionResponse.aud = tokenData.aud;
        introspectionResponse.iss = tokenData.iss;
      }

      return res.json(introspectionResponse);
    }

    // Token not found or invalid
    res.json({ active: false });

  } catch (error) {
    logger.error('Token introspection failed', {
      error: error.message,
      clientId: req.client?.id
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

/**
 * GET /userinfo - UserInfo Endpoint (OIDC)
 */
router.get('/userinfo', authMiddleware.required, (req, res) => {
  try {
    // Validate scope includes profile or openid
    if (!req.user.scopes.includes('openid') && !req.user.scopes.includes('profile')) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: 'openid or profile scope required'
      });
    }

    const userInfo = {
      sub: req.user.id,
      preferred_username: req.user.clientId,
      institution_id: req.user.institutionId,
      updated_at: Math.floor(Date.now() / 1000)
    };

    // Add additional claims based on scope
    if (req.user.scopes.includes('profile')) {
      userInfo.name = `User ${req.user.id}`;
      userInfo.family_name = 'Demo';
      userInfo.given_name = 'User';
    }

    if (req.user.scopes.includes('email')) {
      userInfo.email = `${req.user.id}@demo.example`;
      userInfo.email_verified = true;
    }

    logger.debug('UserInfo response', {
      userId: req.user.id,
      scopes: req.user.scopes
    });

    res.json(userInfo);

  } catch (error) {
    logger.error('UserInfo request failed', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

/**
 * POST /oauth/authenticate - Customer Authentication (Step 2a)
 * Authenticates the customer before consent granting
 * NO Bearer token required (pre-authorization step)
 */
router.post('/oauth/authenticate', async (req, res) => {
  try {
    const { processId, customerId, authenticationMethod, credentials } = req.body;

    logger.info('Customer authentication request', {
      processId,
      customerId,
      authenticationMethod,
      ip: req.ip
    });

    // Simulate authentication based on method
    let authenticated = false;
    let sessionId = null;

    switch (authenticationMethod) {
      case 'swisseid':
        // Simulate Swiss E-ID authentication
        authenticated = true;
        sessionId = 'swisseid_' + generateSecureToken(16);
        logger.info('Swiss E-ID authentication simulated', { processId });
        break;

      case 'credentials':
        // Simulate username/password + 2FA authentication
        if (credentials && credentials.twoFactorCode) {
          authenticated = true;
          sessionId = 'session_' + generateSecureToken(16);
          logger.info('Credentials + 2FA authentication simulated', { processId });
        } else {
          return res.status(401).json({
            error: 'AUTHENTICATION_FAILED',
            message: '2FA code required',
            timestamp: new Date().toISOString()
          });
        }
        break;

      case 'biometric':
        // Simulate biometric authentication
        authenticated = true;
        sessionId = 'biometric_' + generateSecureToken(16);
        logger.info('Biometric authentication simulated', { processId });
        break;

      default:
        return res.status(400).json({
          error: 'INVALID_METHOD',
          message: 'Invalid authentication method',
          timestamp: new Date().toISOString()
        });
    }

    if (!authenticated) {
      return res.status(401).json({
        error: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString()
      });
    }

    // Store authentication session
    const authSession = {
      sessionId,
      processId,
      customerId,
      authenticationMethod,
      authenticatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    };

    // TODO: Store in session storage (Redis in production)

    res.json({
      success: true,
      authenticated: true,
      sessionId,
      message: 'Authentication successful',
      expiresAt: authSession.expiresAt
    });

  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /oauth/authorize/consent - Consent Granting (Step 2b)
 * Captures the customer's consent decision
 * NO Bearer token required (pre-authorization step)
 */
router.post('/oauth/authorize/consent', async (req, res) => {
  try {
    const { processId, customerId, authorizedScopes, consentGiven, timestamp } = req.body;

    logger.info('Consent decision received', {
      processId,
      customerId,
      consentGiven,
      scopes: authorizedScopes?.length,
      ip: req.ip
    });

    if (!consentGiven) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'User denied consent',
        timestamp: new Date().toISOString()
      });
    }

    // Generate authorization code
    const authorizationCode = 'auth_' + generateSecureToken(32);
    const codeExpiresAt = new Date(Date.now() + AUTHORIZATION_CODE_EXPIRY * 1000);

    // Store authorization code with consent information
    const codeData = {
      processId,
      customerId,
      authorizedScopes,
      code: authorizationCode,
      created_at: new Date(),
      expires_at: codeExpiresAt,
      used: false,
      // PKCE parameters (would be validated during token exchange)
      code_challenge: 'simulated_challenge', // In real implementation, get from session
      code_challenge_method: 'S256'
    };

    authorizationCodes.set(authorizationCode, codeData);

    logger.info('Authorization code issued', {
      processId,
      code: authorizationCode.substring(0, 10) + '...',
      expiresIn: AUTHORIZATION_CODE_EXPIRY
    });

    res.json({
      success: true,
      authorizationCode,
      expiresIn: AUTHORIZATION_CODE_EXPIRY,
      message: 'Consent granted, authorization code issued',
      processId
    });

  } catch (error) {
    logger.error('Consent processing error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to process consent',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /oauth/revoke - Token Revocation (RFC 7009)
 * Revokes access tokens or refresh tokens
 */
router.post('/oauth/revoke', async (req, res) => {
  try {
    const { token, token_type_hint, client_id } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Token parameter is required'
      });
    }

    logger.info('Token revocation request', {
      client_id,
      token_type_hint,
      token: token.substring(0, 10) + '...',
      ip: req.ip
    });

    let revoked = false;

    // Try to revoke as access token
    if (!token_type_hint || token_type_hint === 'access_token') {
      if (accessTokens.has(token)) {
        accessTokens.delete(token);
        revoked = true;
        logger.info('Access token revoked', { token: token.substring(0, 10) + '...' });
      }
    }

    // Try to revoke as refresh token
    if (!revoked && (!token_type_hint || token_type_hint === 'refresh_token')) {
      if (refreshTokens.has(token)) {
        const refreshTokenData = refreshTokens.get(token);
        refreshTokens.delete(token);

        // Also revoke associated access token if present
        if (refreshTokenData.access_token && accessTokens.has(refreshTokenData.access_token)) {
          accessTokens.delete(refreshTokenData.access_token);
          logger.info('Associated access token revoked');
        }

        revoked = true;
        logger.info('Refresh token revoked', { token: token.substring(0, 10) + '...' });
      }
    }

    // RFC 7009: The revocation endpoint responds with HTTP 200 even if token is invalid
    // This prevents token scanning attacks
    res.status(200).json({
      success: true,
      message: revoked ? 'Token revoked successfully' : 'Token not found or already revoked'
    });

  } catch (error) {
    logger.error('Token revocation error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

/**
 * Generate secure random token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Clean up expired authorization codes
 */
function cleanupExpiredCodes() {
  const now = new Date();
  for (const [code, codeData] of authorizationCodes.entries()) {
    if (codeData.expires_at < now) {
      authorizationCodes.delete(code);
    }
  }
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens() {
  const now = new Date();
  
  // Clean up access tokens
  for (const [token, tokenData] of accessTokens.entries()) {
    if (tokenData.expires_at < now) {
      accessTokens.delete(token);
    }
  }
  
  // Clean up refresh tokens
  for (const [token, tokenData] of refreshTokens.entries()) {
    if (tokenData.expires_at < now) {
      refreshTokens.delete(token);
    }
  }
}

// Clean up expired tokens every 5 minutes
setInterval(() => {
  cleanupExpiredCodes();
  cleanupExpiredTokens();
}, 5 * 60 * 1000);

module.exports = router;
module.exports.setServiceManager = setServiceManager;
module.exports.setCoreFramework = setCoreFramework;