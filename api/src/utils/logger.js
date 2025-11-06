const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat,
  }),
];

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  // General log file
  transports.push(
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'app.log'),
      level: 'info',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  // Security events log
  transports.push(
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'security.log'),
      level: 'warn',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'exceptions.log'),
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'rejections.log'),
      format: fileFormat,
    }),
  ],
});

// Create specialized loggers for different purposes
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf((info) => {
      return JSON.stringify({
        ...info,
        category: 'SECURITY',
        environment: process.env.NODE_ENV,
      });
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'security.log'),
      maxsize: 10485760,
      maxFiles: 20,
    }),
  ],
});

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf((info) => {
      return JSON.stringify({
        ...info,
        category: 'AUDIT',
        environment: process.env.NODE_ENV,
      });
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'audit.log'),
      maxsize: 10485760,
      maxFiles: 50, // Keep more audit logs
    }),
  ],
});

// Helper functions for structured logging
const logWithContext = (level, message, context = {}) => {
  const logEntry = {
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    ...context,
  };
  
  logger.log(level, logEntry);
};

// Security event logging
const logSecurityEvent = (event, details = {}) => {
  securityLogger.info({
    event,
    details,
    timestamp: new Date().toISOString(),
    severity: details.severity || 'medium',
  });
};

// Audit event logging
const logAuditEvent = (action, details = {}) => {
  auditLogger.info({
    action,
    details,
    timestamp: new Date().toISOString(),
    user: details.user || 'system',
    resource: details.resource,
    outcome: details.outcome || 'success',
  });
};

// Performance logging
const logPerformance = (operation, duration, details = {}) => {
  logger.info({
    message: `Performance: ${operation}`,
    operation,
    duration,
    ...details,
    category: 'PERFORMANCE',
  });
};

// API request logging
const logApiRequest = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    institutionId: req.user?.institutionId,
    category: 'API_REQUEST',
  };

  // Log different levels based on status code
  if (res.statusCode >= 500) {
    logger.error('API Request Error', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('API Request Warning', logData);
  } else {
    logger.info('API Request', logData);
  }
};

// Error logging with stack trace
const logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
    category: 'ERROR',
  });
};

// Business event logging
const logBusinessEvent = (event, details = {}) => {
  logger.info({
    message: `Business Event: ${event}`,
    event,
    details,
    category: 'BUSINESS',
  });
};

// Compliance logging (for regulatory requirements)
const logComplianceEvent = (event, details = {}) => {
  auditLogger.info({
    event,
    details,
    timestamp: new Date().toISOString(),
    category: 'COMPLIANCE',
    regulatoryContext: details.regulation || 'GENERAL',
  });
};

// Data access logging (for GDPR compliance)
const logDataAccess = (action, dataType, subject, accessor, purpose) => {
  auditLogger.info({
    action: 'DATA_ACCESS',
    dataType,
    subject,
    accessor,
    purpose,
    timestamp: new Date().toISOString(),
    category: 'DATA_PROTECTION',
  });
};

// Consent logging
const logConsentEvent = (action, consentId, customerId, institutionId, details = {}) => {
  auditLogger.info({
    action: `CONSENT_${action.toUpperCase()}`,
    consentId,
    customerId,
    institutionId,
    details,
    timestamp: new Date().toISOString(),
    category: 'CONSENT_MANAGEMENT',
  });
};

// mTLS certificate events
const logCertificateEvent = (event, institutionId, details = {}) => {
  securityLogger.info({
    event: `CERTIFICATE_${event.toUpperCase()}`,
    institutionId,
    details,
    timestamp: new Date().toISOString(),
    category: 'CERTIFICATE_MANAGEMENT',
  });
};

// Rate limiting events
const logRateLimitEvent = (ip, endpoint, limit, current) => {
  securityLogger.warn({
    event: 'RATE_LIMIT_EXCEEDED',
    ip,
    endpoint,
    limit,
    current,
    timestamp: new Date().toISOString(),
    category: 'RATE_LIMITING',
  });
};

// Authentication events
const logAuthEvent = (event, details = {}) => {
  securityLogger.info({
    event: `AUTH_${event.toUpperCase()}`,
    details,
    timestamp: new Date().toISOString(),
    category: 'AUTHENTICATION',
  });
};

// Create log directory if it doesn't exist
const fs = require('fs');
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Export logger and helper functions
module.exports = logger;

// Add helper functions to the logger instance
logger.securityLogger = securityLogger;
logger.auditLogger = auditLogger;
logger.logWithContext = logWithContext;
logger.logSecurityEvent = logSecurityEvent;
logger.logAuditEvent = logAuditEvent;
logger.logPerformance = logPerformance;
logger.logApiRequest = logApiRequest;
logger.logError = logError;
logger.logBusinessEvent = logBusinessEvent;
logger.logComplianceEvent = logComplianceEvent;
logger.logDataAccess = logDataAccess;
logger.logConsentEvent = logConsentEvent;
logger.logCertificateEvent = logCertificateEvent;
logger.logRateLimitEvent = logRateLimitEvent;
logger.logAuthEvent = logAuthEvent;