const logger = require('../utils/logger');

/**
 * Custom error classes for different error types
 */
class APIError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true; // Distinguishes operational errors from programming errors
  }
}

class ValidationError extends APIError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends APIError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ConflictError extends APIError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

class ExternalServiceError extends APIError {
  constructor(message = 'External service error', service = 'unknown') {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // If response has already been sent, delegate to Express default error handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.id || req.headers['x-request-id'] || 'unknown';
  const timestamp = new Date().toISOString();

  // Set default error properties
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = undefined;

  // Handle different error types
  if (err instanceof APIError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    
    if (err instanceof ValidationError) {
      details = err.details;
    }
    
    if (err instanceof ExternalServiceError) {
      details = { service: err.service };
    }
  } else if (err.name === 'ValidationError') {
    // Joi validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.details?.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (err.name === 'MongoError' || err.name === 'MongooseError') {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    message = 'Database operation failed';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 502;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload too large';
  }

  // Log error with appropriate level
  const logContext = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    institutionId: req.user?.institutionId,
    statusCode,
    errorCode,
  };

  if (statusCode >= 500) {
    // Server errors - log as error with full stack trace
    logger.error('Server error occurred', {
      ...logContext,
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    // Log security events for certain error types
    if (errorCode === 'UNAUTHORIZED' || errorCode === 'FORBIDDEN') {
      logger.logSecurityEvent('ACCESS_DENIED', {
        ip: req.ip,
        endpoint: req.originalUrl,
        userId: req.user?.id,
        reason: err.message,
      });
    }
  } else if (statusCode >= 400) {
    // Client errors - log as warning
    logger.warn('Client error occurred', {
      ...logContext,
      message: err.message,
    });

    // Log suspicious activities
    if (statusCode === 401 || statusCode === 403) {
      logger.logSecurityEvent('AUTHENTICATION_FAILURE', {
        ip: req.ip,
        endpoint: req.originalUrl,
        reason: err.message,
      });
    }
  }

  // Prepare error response
  const errorResponse = {
    error: errorCode,
    message,
    timestamp,
    requestId,
  };

  // Add details for validation errors
  if (details) {
    errorResponse.details = details;
  }

  // Add stack trace in development mode for server errors
  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    errorResponse.stack = err.stack;
  }

  // Add correlation ID for external service errors
  if (err instanceof ExternalServiceError && err.correlationId) {
    errorResponse.correlationId = err.correlationId;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    error: error.errorCode,
    message: error.message,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async error wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create standard error responses
 */
const createError = {
  badRequest: (message, details) => new ValidationError(message, details),
  unauthorized: (message) => new AuthenticationError(message),
  forbidden: (message) => new AuthorizationError(message),
  notFound: (message) => new NotFoundError(message),
  conflict: (message) => new ConflictError(message),
  rateLimit: (message) => new RateLimitError(message),
  externalService: (message, service) => new ExternalServiceError(message, service),
  internal: (message) => new APIError(message, 500, 'INTERNAL_ERROR'),
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError,
  
  // Error classes
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
};