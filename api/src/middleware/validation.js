const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation schemas for different endpoints
 */
const schemas = {
  createConsent: Joi.object({
    customerId: Joi.string().min(64).max(64).pattern(/^[a-f0-9]+$/).required()
      .description('SHA-256 hash of customer identifier'),
    requestingInstitution: Joi.string().min(1).max(100).required()
      .description('Institution requesting the data'),
    providingInstitution: Joi.string().min(1).max(100).optional()
      .description('Institution providing the data'),
    dataCategories: Joi.array().items(
      Joi.string().valid(
        'basicData',
        'identification', 
        'contactInformation',
        'addressData',
        'kycData',
        'riskProfile',
        'complianceData',
        'extendedData'
      )
    ).min(1).required().description('Requested data categories'),
    purpose: Joi.string().valid(
      'account_opening',
      'accountOpening',
      'credit_assessment',
      'creditAssessment',
      'compliance',
      'customer_update',
      'customerUpdate',
      'insurance_application',
      'car_insurance_application',
      'mortgage_application',
      'investment_services',
      'wealth_management'
    ).required().description('Purpose of data usage'),
    expiryDate: Joi.date().iso().min('now').required()
      .description('Consent expiry date'),
    customerContactMethod: Joi.string().valid(
      'email',
      'sms', 
      'app',
      'postal'
    ).optional().description('Preferred contact method')
  }),

  customerCheck: Joi.object({
    sharedCustomerHash: Joi.string().min(64).max(64).pattern(/^[a-f0-9]+$/).required()
      .description('SHA-256 hash for customer matching'),
    basicData: Joi.object({
      lastName: Joi.string().min(1).max(100).required()
        .description('Customer last name'),
      givenName: Joi.string().min(1).max(100).required()
        .description('Customer given name(s)'),
      birthDate: Joi.date().iso().max('now').required()
        .description('Date of birth'),
      nationality: Joi.array().items(
        Joi.string().length(2).pattern(/^[A-Z]{2}$/)
      ).min(1).max(5).required().description('Nationality codes (ISO 3166-1)')
    }).required()
  }),

  fullDataRequest: Joi.object({
    sharedCustomerHash: Joi.string().min(64).max(64).pattern(/^[a-f0-9]+$/).required()
      .description('SHA-256 hash of customer'),
    purpose: Joi.string().valid(
      'account_opening',
      'accountOpening',
      'credit_assessment',
      'creditAssessment',
      'compliance',
      'car_insurance_application',
      'insurance_application'
    ).optional().description('Purpose of data request (optional if consent provides it)'),
    consentToken: Joi.string().min(10).optional()
      .description('JWT token with consent proof'),
    consentId: Joi.string().guid().optional()
      .description('Consent ID (alternative to consentToken)'),
    dataCategories: Joi.array().items(
      Joi.string().valid(
        'basicData',
        'identification',
        'contactInformation',
        'addressData',
        'kycData',
        'riskProfile',
        'complianceData',
        'extendedData'
      )
    ).optional().description('Requested data categories (optional if consent specifies them)')
  }).or('consentToken', 'consentId'),

  identificationRequest: Joi.object({
    customerId: Joi.string().min(1).max(255).required()
      .description('Customer identifier'),
    identificationType: Joi.string().valid(
      'eid_verification',
      'document_verification', 
      'biometric_verification'
    ).required().description('Type of identification'),
    documentData: Joi.object({
      documentType: Joi.string().valid('passport', 'id_card', 'driving_license', 'eid').optional(),
      documentImage: Joi.string().base64().optional()
        .description('Base64 encoded document image'),
      nfcData: Joi.string().optional()
        .description('NFC data from eID')
    }).optional(),
    biometricData: Joi.object({
      faceImage: Joi.string().base64().optional()
        .description('Base64 encoded face image'),
      livenessVideo: Joi.string().optional()
        .description('Liveness check video')
    }).optional()
  }),

  comprehensiveCheckRequest: Joi.object({
    customerId: Joi.string().min(1).max(255).required()
      .description('Customer identifier'),
    customerData: Joi.object({
      lastName: Joi.string().min(1).max(100).required(),
      givenName: Joi.string().min(1).max(100).required(),
      birthDate: Joi.date().iso().max('now').required(),
      nationality: Joi.array().items(
        Joi.string().length(2).pattern(/^[A-Z]{2}$/)
      ).min(1).max(5).required()
    }).optional(),
    checkTypes: Joi.array().items(
      Joi.string().valid(
        'sanctions',
        'pep',
        'crime', 
        'adverse_media',
        'credit',
        'zek_iko'
      )
    ).min(1).required().description('Types of checks to perform')
  }),

  signatureRequest: Joi.object({
    customerId: Joi.string().min(1).max(255).required()
      .description('Customer identifier'),
    documents: Joi.array().items(
      Joi.object({
        documentId: Joi.string().min(1).max(255).required(),
        documentName: Joi.string().min(1).max(255).required(),
        documentHash: Joi.string().min(64).max(64).pattern(/^[a-f0-9]+$/).required()
          .description('SHA-256 hash of document'),
        documentUrl: Joi.string().uri().optional()
      })
    ).min(1).required().description('Documents to sign'),
    signatureType: Joi.string().valid('qes', 'aes', 'simple').required()
      .description('Type of signature'),
    notificationMethod: Joi.string().valid('email', 'sms', 'app').optional()
      .description('Notification method')
  }),

  updateCustomer: Joi.object({
    basicData: Joi.object({
      lastName: Joi.string().min(1).max(100).optional(),
      givenName: Joi.string().min(1).max(100).optional(),
      middleName: Joi.string().max(100).optional(),
      title: Joi.string().max(50).optional(),
      birthDate: Joi.date().iso().max('now').optional(),
      birthPlace: Joi.string().max(100).optional(),
      nationality: Joi.array().items(
        Joi.string().length(2).pattern(/^[A-Z]{2}$/)
      ).min(1).max(5).optional(),
      gender: Joi.string().valid('male', 'female', 'other', 'unknown').optional(),
      maritalStatus: Joi.string().valid(
        'single', 'married', 'divorced', 'widowed', 'registered_partnership'
      ).optional(),
      language: Joi.string().length(2).pattern(/^[a-z]{2}$/).optional()
    }).optional(),

    contactInformation: Joi.object({
      primaryEmail: Joi.string().email().max(255).optional(),
      secondaryEmail: Joi.string().email().max(255).optional(),
      mobilePhone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional()
        .description('E.164 format phone number'),
      landlinePhone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
      preferredContactMethod: Joi.string().valid(
        'email', 'sms', 'phone', 'postal', 'app'
      ).optional(),
      communicationLanguage: Joi.string().length(2).pattern(/^[a-z]{2}$/).optional(),
      availabilityHours: Joi.string().max(50).optional()
    }).optional(),

    addressData: Joi.object({
      residentialAddress: Joi.object({
        street: Joi.string().min(1).max(255).required(),
        addressLine2: Joi.string().max(255).optional(),
        postalCode: Joi.string().min(1).max(20).required(),
        city: Joi.string().min(1).max(100).required(),
        region: Joi.string().max(100).optional(),
        country: Joi.string().length(2).pattern(/^[A-Z]{2}$/).required(),
        addressType: Joi.string().valid(
          'residential', 'mailing', 'business', 'temporary'
        ).optional()
      }).optional(),
      mailingAddress: Joi.object({
        street: Joi.string().min(1).max(255).required(),
        addressLine2: Joi.string().max(255).optional(),
        postalCode: Joi.string().min(1).max(20).required(),
        city: Joi.string().min(1).max(100).required(),
        region: Joi.string().max(100).optional(),
        country: Joi.string().length(2).pattern(/^[A-Z]{2}$/).required(),
        addressType: Joi.string().valid(
          'residential', 'mailing', 'business', 'temporary'
        ).optional()
      }).optional()
    }).optional()
  }).min(1)
};

/**
 * Validation middleware factory
 */
const validateRequest = (schemaName, options = {}) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      logger.error(`Validation schema '${schemaName}' not found`);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Validation configuration error',
        timestamp: new Date().toISOString()
      });
    }

    const { allowUnknown = false, stripUnknown = true } = options;
    
    const { error, value } = schema.validate(req.body, {
      allowUnknown,
      stripUnknown,
      abortEarly: false
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Request validation failed', {
        endpoint: req.path,
        method: req.method,
        errors: validationErrors,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    // Replace request body with validated/sanitized data
    req.body = value;
    
    logger.debug('Request validation successful', {
      endpoint: req.path,
      method: req.method,
      schema: schemaName
    });

    next();
  };
};

/**
 * Validate query parameters
 */
const validateQuery = (schema, options = {}) => {
  return (req, res, next) => {
    const { allowUnknown = false, stripUnknown = true } = options;
    
    const { error, value } = schema.validate(req.query, {
      allowUnknown,
      stripUnknown,
      abortEarly: false
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Query parameter validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    req.query = value;
    next();
  };
};

/**
 * Validate path parameters
 */
const validateParams = (schema, options = {}) => {
  return (req, res, next) => {
    const { allowUnknown = false, stripUnknown = true } = options;
    
    const { error, value } = schema.validate(req.params, {
      allowUnknown,
      stripUnknown,
      abortEarly: false
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Path parameter validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    req.params = value;
    next();
  };
};

/**
 * Common query parameter schemas
 */
const commonQuerySchemas = {
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
  }),
  
  consentFilter: Joi.object({
    status: Joi.string().valid('pending', 'approved', 'rejected', 'expired', 'revoked').optional(),
    customerId: Joi.string().min(64).max(64).pattern(/^[a-f0-9]+$/).optional(),
    purpose: Joi.string().valid('accountOpening', 'creditAssessment', 'compliance', 'customerUpdate').optional()
  })
};

/**
 * Common parameter schemas
 */
const commonParamSchemas = {
  uuid: Joi.object({
    id: Joi.string().uuid().required()
  }),
  
  consentId: Joi.object({
    consentId: Joi.string().uuid().required()
  }),
  
  customerHash: Joi.object({
    sharedCustomerHash: Joi.string().min(64).max(64).pattern(/^[a-f0-9]+$/).required()
  })
};

module.exports = {
  validateRequest,
  validateQuery,
  validateParams,
  schemas,
  commonQuerySchemas,
  commonParamSchemas
};