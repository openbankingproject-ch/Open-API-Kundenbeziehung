const express = require('express');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { validateRequest } = require('../middleware/validation');
const { requireConsent } = require('../middleware/auth');

const router = express.Router();

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

// Mock customer database (use real database in production)
const customers = new Map();

// Initialize with sample data
const initializeSampleData = () => {
  const sampleCustomer = {
    sharedCustomerHash: crypto.createHash('sha256').update('Hans Müller 1985-03-15 CH').digest('hex'),
    basicData: {
      lastName: 'Müller',
      givenName: 'Hans Peter',
      birthDate: '1985-03-15',
      nationality: ['CH'],
      gender: 'male',
      maritalStatus: 'married',
      language: 'de'
    },
    contactInformation: {
      primaryEmail: 'hans.mueller@example.ch',
      mobilePhone: '+41791234567',
      preferredContactMethod: 'email',
      communicationLanguage: 'de'
    },
    addressData: {
      residentialAddress: {
        street: 'Bahnhofstrasse 1',
        postalCode: '8001',
        city: 'Zürich',
        region: 'ZH',
        country: 'CH',
        addressType: 'residential'
      }
    },
    identification: {
      identificationMethod: 'video_identification',
      documentType: 'id_card',
      documentNumber: 'E12345678',
      issuingAuthority: 'Stadt Zürich',
      issueDate: '2020-01-15',
      expiryDate: '2030-01-15',
      issuingCountry: 'CH',
      levelOfAssurance: 'high',
      verificationDate: '2024-01-10T10:00:00Z',
      verificationMethod: 'video_ident_with_document'
    },
    kycData: {
      occupation: 'Software Engineer',
      employer: 'Tech AG',
      employmentType: 'employed',
      annualIncome: {
        amount: 120000,
        currency: 'CHF'
      },
      totalAssets: {
        amount: 250000,
        currency: 'CHF'
      },
      sourceOfFunds: 'salary',
      pepStatus: false
    },
    complianceData: {
      fatcaStatus: 'non_us_person',
      crsReportable: false,
      taxResidencies: [
        {
          country: 'CH',
          isPrimary: true,
          tinNumber: '756.1234.5678.90'
        }
      ],
      sanctionsScreening: {
        sanctionsList: 'clear',
        pepCheck: 'clear',
        adverseMedia: 'clear',
        lastScreeningDate: '2024-01-10T10:00:00Z'
      },
      amlRiskRating: 'low'
    },
    metadata: {
      originator: 'CH-BANK-002',
      createdAt: '2024-01-10T10:00:00Z',
      lastUpdated: '2024-01-10T10:00:00Z',
      version: '1.0',
      dataClassification: 'confidential',
      verificationStatus: 'verified'
    }
  };
  
  customers.set(sampleCustomer.sharedCustomerHash, sampleCustomer);
  logger.info('Sample customer data initialized');
};

// Initialize sample data
initializeSampleData();

/**
 * Generate shared customer hash
 */
const generateSharedCustomerHash = (basicData) => {
  const hashInput = `${basicData.lastName} ${basicData.givenName} ${basicData.birthDate} ${basicData.nationality.join(',')}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex');
};

/**
 * Check customer existence (Enhanced with Banking MVP)
 * POST /customer/check
 */
router.post('/check', validateRequest('customerCheck'), async (req, res) => {
  try {
    const { sharedCustomerHash, basicData } = req.body;

    logger.info('Banking MVP - Customer check request', {
      sharedCustomerHash,
      institutionId: req.user?.institutionId || 'demo',
      ip: req.ip
    });

    // Use service layer if available, fallback to legacy implementation
    if (serviceManager) {
      const customerService = serviceManager.getService('customer');

      const checkResult = await customerService.checkCustomer(
        { sharedCustomerHash, basicData },
        {
          institutionId: req.user?.institutionId || 'demo',
          userId: req.user?.id || 'demo-user',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      if (checkResult.success) {
        logger.info('Banking MVP - Customer check successful (service layer)', {
          sharedCustomerHash,
          match: checkResult.match,
          processInstance: checkResult.processInstance
        });

        return res.json({
          match: checkResult.match,
          identificationDate: checkResult.identificationDate,
          levelOfAssurance: checkResult.levelOfAssurance,
          validUntil: checkResult.validUntil,
          processedBy: 'banking_mvp_service_layer',
          framework: 'core_framework_v1'
        });
      } else {
        logger.error('Banking MVP - Customer check failed (service layer)', checkResult);
        return res.status(400).json({
          error: checkResult.error,
          message: checkResult.message || 'Customer check failed',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Legacy fallback implementation
    logger.warn('Using legacy customer check - service layer not available');
    
    // Verify hash matches provided basic data
    const calculatedHash = generateSharedCustomerHash(basicData);
    if (calculatedHash !== sharedCustomerHash) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Shared customer hash does not match provided basic data',
        timestamp: new Date().toISOString()
      });
    }

    const customer = customers.get(sharedCustomerHash);
    
    if (!customer) {
      logger.info('Customer not found (legacy)', { sharedCustomerHash });
      return res.json({
        match: false,
        processedBy: 'legacy_implementation'
      });
    }

    // Verify basic data matches
    const dataMatches = 
      customer.basicData.lastName === basicData.lastName &&
      customer.basicData.givenName === basicData.givenName &&
      customer.basicData.birthDate === basicData.birthDate &&
      JSON.stringify(customer.basicData.nationality.sort()) === JSON.stringify(basicData.nationality.sort());

    if (!dataMatches) {
      logger.warn('Customer data mismatch (legacy)', { sharedCustomerHash });
      return res.json({
        match: false,
        processedBy: 'legacy_implementation'
      });
    }

    // Check identification validity (24 months for banking)
    const identificationDate = new Date(customer.identification.verificationDate);
    const validityPeriod = 24 * 30 * 24 * 60 * 60 * 1000; // 24 months in milliseconds
    const validUntil = new Date(identificationDate.getTime() + validityPeriod);
    const isValid = validUntil > new Date();

    logger.info('Customer check successful (legacy)', {
      sharedCustomerHash,
      match: true,
      valid: isValid
    });

    res.json({
      match: true,
      identificationDate: customer.identification.verificationDate,
      levelOfAssurance: customer.identification.levelOfAssurance,
      validUntil: validUntil.toISOString(),
      processedBy: 'legacy_implementation'
    });

  } catch (error) {
    logger.error('Error in customer check:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to check customer',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Request full customer dataset (Enhanced with Banking MVP)
 * POST /customer/data
 */
router.post('/data',
  validateRequest('fullDataRequest'),
  async (req, res) => {
    try {
      const { sharedCustomerHash, purpose, consentToken } = req.body;

      logger.info('Banking MVP - Full customer data request', {
        sharedCustomerHash,
        purpose,
        institutionId: req.user?.institutionId || 'demo',
        userId: req.user?.id || 'demo-user'
      });

      // Use service layer if available, fallback to legacy implementation
      if (serviceManager) {
        const customerService = serviceManager.getService('customer');

        const dataResult = await customerService.requestFullCustomerData(
          { sharedCustomerHash, purpose, consentToken },
          {
            institutionId: req.user?.institutionId || 'demo',
            userId: req.user?.id || 'demo-user',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            permissions: req.user?.consent?.dataCategories || []
          }
        );

        if (dataResult.success) {
          logger.info('Banking MVP - Customer data request successful (service layer)', {
            sharedCustomerHash,
            categoriesProvided: Object.keys(dataResult.customerData || {}),
            processInstance: dataResult.processInstance
          });

          return res.json({
            customerData: dataResult.customerData,
            processedBy: 'banking_mvp_service_layer',
            framework: 'core_framework_v1',
            auditRecorded: dataResult.auditRecorded,
            metadata: {
              accessedAt: new Date().toISOString(),
              accessedBy: req.user?.institutionId || 'demo',
              userId: req.user?.id || 'demo-user',
              purpose,
              consentToken
            }
          });
        } else {
          logger.error('Banking MVP - Customer data request failed (service layer)', dataResult);
          return res.status(dataResult.error === 'NOT_FOUND' ? 404 : 400).json({
            error: dataResult.error,
            message: dataResult.message || 'Customer data request failed',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Legacy fallback implementation
      logger.warn('Using legacy customer data request - service layer not available');
      
      const customer = customers.get(sharedCustomerHash);
      
      if (!customer) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Customer not found',
          timestamp: new Date().toISOString()
        });
      }

      // Verify consent allows access to this customer
      if (req.user?.consent?.customerId && req.user.consent.customerId !== sharedCustomerHash) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Consent does not cover this customer',
          timestamp: new Date().toISOString()
        });
      }

      // Filter data based on consent permissions
      // In development mode without auth, allow all categories
      const allowedCategories = req.user?.consent?.dataCategories || ['basicData', 'contactInformation', 'addressData', 'identification', 'kycData', 'complianceData', 'riskProfile'];
      const responseData = {};

      if (allowedCategories.includes('basicData')) {
        responseData.basicData = customer.basicData;
      }

      if (allowedCategories.includes('contactInformation')) {
        responseData.contactInformation = customer.contactInformation;
      }

      if (allowedCategories.includes('addressData')) {
        responseData.addressData = customer.addressData;
      }

      if (allowedCategories.includes('identification')) {
        responseData.identification = {
          ...customer.identification,
          // Generate temporary signed URL for document image
          documentImageUrl: customer.identification.documentNumber ? 
            `${process.env.API_BASE_URL}/documents/${customer.identification.documentNumber}?token=${generateDocumentToken(customer.identification.documentNumber)}` : 
            undefined
        };
      }

      if (allowedCategories.includes('kycData')) {
        responseData.kycData = customer.kycData;
      }

      if (allowedCategories.includes('complianceData')) {
        responseData.complianceData = customer.complianceData;
      }

      if (allowedCategories.includes('riskProfile')) {
        responseData.riskProfile = customer.riskProfile;
      }

      // Always include metadata
      responseData.metadata = {
        ...customer.metadata,
        accessedAt: new Date().toISOString(),
        accessedBy: req.user?.institutionId || 'demo',
        userId: req.user?.id || 'demo-user',
        purpose,
        processedBy: 'legacy_implementation'
      };

      logger.info('Customer data provided (legacy)', {
        sharedCustomerHash,
        categories: allowedCategories,
        institutionId: req.user?.institutionId || 'demo'
      });

      res.json({
        customerData: responseData,
        processedBy: 'legacy_implementation'
      });

    } catch (error) {
      logger.error('Error providing customer data:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to provide customer data',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Legacy endpoint for backward compatibility
 * POST /customer/fullRequest
 */
router.post('/fullRequest', 
  validateRequest('fullDataRequest'),
  requireConsent('accountOpening'),
  async (req, res) => {
    // Redirect to new endpoint
    req.url = '/data';
    return router.handle(req, res);
  }
);

/**
 * Generate temporary document access token
 */
const generateDocumentToken = (documentId) => {
  const payload = {
    documentId,
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10 minutes
    purpose: 'document_access'
  };
  
  // In production, use proper JWT signing
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

/**
 * Update customer data (for providing institutions)
 * PUT /customer/:sharedCustomerHash
 */
router.put('/:sharedCustomerHash', validateRequest('updateCustomer'), (req, res) => {
  try {
    const { sharedCustomerHash } = req.params;
    const updates = req.body;

    const customer = customers.get(sharedCustomerHash);

    if (!customer) {
      // If customer doesn't exist, create it (for demo purposes)
      const newCustomer = {
        sharedCustomerHash,
        ...updates,
        identification: {
            verificationDate: new Date().toISOString(),
            levelOfAssurance: 'low'
        },
        metadata: {
          originator: req.user?.institutionId || 'demo-institution',
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        }
      };

      customers.set(sharedCustomerHash, newCustomer);

      // Also update service layer storage if available (dual-write pattern)
      if (serviceManager) {
        const customerService = serviceManager.getService('customer');
        if (customerService && customerService.customers) {
          customerService.customers.set(sharedCustomerHash, newCustomer);
          logger.info('Customer dual-write successful', {
            sharedCustomerHash,
            legacyMapSize: customers.size,
            serviceLayerSize: customerService.customers.size
          });
        } else {
          logger.warn('Service layer customer storage not available for dual-write');
        }
      } else {
        logger.warn('Service manager not available for dual-write');
      }

      return res.status(201).json({
        message: 'Customer created successfully',
        sharedCustomerHash,
        timestamp: new Date().toISOString()
      });
    }

    // Only allow updates from the originating institution (skip check in development without auth)
    if (req.user && customer.metadata.originator !== req.user.institutionId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only originating institution can update customer data',
        timestamp: new Date().toISOString()
      });
    }

    // Merge updates with existing data
    const updatedCustomer = {
      ...customer,
      ...updates,
      metadata: {
        ...customer.metadata,
        lastUpdated: new Date().toISOString(),
        updatedBy: req.user?.id || 'demo-user',
        version: (parseFloat(customer.metadata.version || '1.0') + 0.1).toFixed(1)
      }
    };

    customers.set(sharedCustomerHash, updatedCustomer);

    // Also update service layer storage if available (dual-write pattern)
    if (serviceManager) {
      const customerService = serviceManager.getService('customer');
      if (customerService && customerService.customers) {
        customerService.customers.set(sharedCustomerHash, updatedCustomer);
        logger.info('Customer update dual-write successful', {
          sharedCustomerHash,
          legacyMapSize: customers.size,
          serviceLayerSize: customerService.customers.size
        });
      }
    }

    logger.info('Customer data updated', {
      sharedCustomerHash,
      updatedBy: req.user?.id || 'demo-user',
      institutionId: req.user?.institutionId || 'demo'
    });

    res.json({
      sharedCustomerHash,
      version: updatedCustomer.metadata.version,
      lastUpdated: updatedCustomer.metadata.lastUpdated
    });

  } catch (error) {
    logger.error('Error updating customer data:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update customer data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get basic customer identity data (Granular endpoint for Stufe 4)
 * POST /customer/basic
 * Requires Bearer token with scope: identity:read
 */
router.post('/basic',
  requireConsent('identity:read'),
  async (req, res) => {
    try {
      const { customerId, sharedCustomerHash } = req.body;
      const hashToUse = customerId || sharedCustomerHash;

      logger.info('Granular request: Basic identity data', {
        customerId: hashToUse,
        institutionId: req.user?.institutionId || 'demo',
        scope: 'identity:read'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with identity:read scope required',
          timestamp: new Date().toISOString()
        });
      }

      // Use service layer if available
      if (serviceManager) {
        const customerService = serviceManager.getService('customer');
        const result = await customerService.getBasicData(hashToUse, {
          institutionId: req.user.institutionId || 'demo',
          userId: req.user.id || 'demo-user'
        });

        if (result.success) {
          return res.json({
            success: true,
            data: result.data,
            processedBy: 'service_layer'
          });
        }
      }

      // Legacy fallback
      const customer = customers.get(hashToUse);

      if (!customer) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Customer not found',
          timestamp: new Date().toISOString()
        });
      }

      // Return only basic identity data
      res.json({
        success: true,
        data: {
          lastName: customer.basicData.lastName,
          givenName: customer.basicData.givenName,
          birthDate: customer.basicData.birthDate,
          nationality: customer.basicData.nationality,
          gender: customer.basicData.gender,
          maritalStatus: customer.basicData.maritalStatus,
          language: customer.basicData.language
        },
        processedBy: 'legacy_implementation'
      });

    } catch (error) {
      logger.error('Error fetching basic customer data:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch basic customer data',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get customer address data (Granular endpoint for Stufe 4)
 * POST /customer/address
 * Requires Bearer token with scope: address:read
 */
router.post('/address',
  requireConsent('address:read'),
  async (req, res) => {
    try {
      const { customerId, sharedCustomerHash } = req.body;
      const hashToUse = customerId || sharedCustomerHash;

      logger.info('Granular request: Address data', {
        customerId: hashToUse,
        institutionId: req.user?.institutionId || 'demo',
        scope: 'address:read'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with address:read scope required',
          timestamp: new Date().toISOString()
        });
      }

      // Use service layer if available
      if (serviceManager) {
        const customerService = serviceManager.getService('customer');
        const result = await customerService.getAddressData(hashToUse, {
          institutionId: req.user.institutionId || 'demo',
          userId: req.user.id || 'demo-user'
        });

        if (result.success) {
          return res.json({
            success: true,
            data: result.data,
            processedBy: 'service_layer'
          });
        }
      }

      // Legacy fallback
      const customer = customers.get(hashToUse);

      if (!customer) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Customer not found',
          timestamp: new Date().toISOString()
        });
      }

      // Return only address data
      res.json({
        success: true,
        data: {
          residentialAddress: customer.addressData.residentialAddress,
          correspondenceAddress: customer.addressData.correspondenceAddress || null,
          previousAddresses: customer.addressData.previousAddresses || []
        },
        processedBy: 'legacy_implementation'
      });

    } catch (error) {
      logger.error('Error fetching address data:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch address data',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get customer contact information (Granular endpoint for Stufe 4)
 * POST /customer/contact
 * Requires Bearer token with scope: contact:read
 */
router.post('/contact',
  requireConsent('contact:read'),
  async (req, res) => {
    try {
      const { customerId, sharedCustomerHash } = req.body;
      const hashToUse = customerId || sharedCustomerHash;

      logger.info('Granular request: Contact information', {
        customerId: hashToUse,
        institutionId: req.user?.institutionId || 'demo',
        scope: 'contact:read'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with contact:read scope required',
          timestamp: new Date().toISOString()
        });
      }

      // Use service layer if available
      if (serviceManager) {
        const customerService = serviceManager.getService('customer');
        const result = await customerService.getContactData(hashToUse, {
          institutionId: req.user.institutionId || 'demo',
          userId: req.user.id || 'demo-user'
        });

        if (result.success) {
          return res.json({
            success: true,
            data: result.data,
            processedBy: 'service_layer'
          });
        }
      }

      // Legacy fallback
      const customer = customers.get(hashToUse);

      if (!customer) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Customer not found',
          timestamp: new Date().toISOString()
        });
      }

      // Return only contact information
      res.json({
        success: true,
        data: {
          primaryEmail: customer.contactInformation.primaryEmail,
          secondaryEmail: customer.contactInformation.secondaryEmail || null,
          mobilePhone: customer.contactInformation.mobilePhone,
          landlinePhone: customer.contactInformation.landlinePhone || null,
          preferredContactMethod: customer.contactInformation.preferredContactMethod,
          communicationLanguage: customer.contactInformation.communicationLanguage,
          emailVerified: customer.contactInformation.emailVerified !== false,
          phoneVerified: customer.contactInformation.phoneVerified !== false
        },
        processedBy: 'legacy_implementation'
      });

    } catch (error) {
      logger.error('Error fetching contact information:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch contact information',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get customer KYC attributes (Granular endpoint)
 * POST /customer/kyc
 * Requires Bearer token with appropriate scopes
 */
router.post('/kyc',
  requireConsent('kyc:read'),
  async (req, res) => {
    try {
      const { customerId, sharedCustomerHash } = req.body;
      const hashToUse = customerId || sharedCustomerHash;

      logger.info('Granular request: KYC attributes', {
        customerId: hashToUse,
        institutionId: req.user?.institutionId || 'demo',
        scope: 'kyc:read'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with kyc:read scope required',
          timestamp: new Date().toISOString()
        });
      }

      // Use service layer if available
      if (serviceManager) {
        const customerService = serviceManager.getService('customer');
        const result = await customerService.getKYCData(hashToUse, {
          institutionId: req.user.institutionId || 'demo',
          userId: req.user.id || 'demo-user'
        });

        if (result.success) {
          return res.json({
            success: true,
            data: result.data,
            processedBy: 'service_layer'
          });
        }
      }

      // Legacy fallback
      const customer = customers.get(hashToUse);

      if (!customer) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Customer not found',
          timestamp: new Date().toISOString()
        });
      }

      // Return KYC attributes without documents
      res.json({
        success: true,
        data: {
          occupation: customer.kycData?.occupation,
          employer: customer.kycData?.employer,
          employmentType: customer.kycData?.employmentType,
          sourceOfFunds: customer.kycData?.sourceOfFunds,
          pepStatus: customer.kycData?.pepStatus,
          pepDetails: customer.kycData?.pepDetails || null,
          amlRiskRating: customer.complianceData?.amlRiskRating,
          fatcaStatus: customer.complianceData?.fatcaStatus,
          crsReportable: customer.complianceData?.crsReportable,
          taxResidencies: customer.complianceData?.taxResidencies,
          sanctionsScreening: customer.complianceData?.sanctionsScreening
        },
        processedBy: 'legacy_implementation'
      });

    } catch (error) {
      logger.error('Error fetching KYC attributes:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch KYC attributes',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Submit customer identification (Stufe 6 - Wrapper endpoint)
 * POST /customer/identification
 * Requires Bearer token with scope: identification:read_enhanced
 */
router.post('/identification',
  requireConsent('identification:read_enhanced'),
  async (req, res) => {
    try {
      const { processId, documentType, documentNumber, issueDate, expiryDate, issuingCountry, verificationMethod, verificationStatus } = req.body;

      logger.info('Identification submission', {
        processId,
        documentType,
        verificationMethod,
        institutionId: req.user?.institutionId || 'demo',
        scope: 'identification:read_enhanced'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with identification:read_enhanced scope required',
          timestamp: new Date().toISOString()
        });
      }

      // Simulate identification verification
      const identificationData = {
        documentType,
        documentNumber,
        issueDate,
        expiryDate,
        issuingCountry,
        verificationMethod: verificationMethod || 'nfc_mrz_biometric',
        verificationStatus: verificationStatus || 'verified',
        confidenceScore: 0.98,
        verifiedAt: new Date().toISOString(),
        verifiedBy: req.user.institutionId || 'demo'
      };

      logger.info('Identification verified', {
        processId,
        documentType,
        verificationStatus: identificationData.verificationStatus,
        confidenceScore: identificationData.confidenceScore
      });

      res.json({
        success: true,
        processId,
        verificationStatus: identificationData.verificationStatus,
        confidenceScore: identificationData.confidenceScore,
        message: 'Identity verified successfully',
        data: identificationData
      });

    } catch (error) {
      logger.error('Error in identification verification:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify identification',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get/Submit customer financial profile (Stufe 5 - MiFID II)
 * POST /customer/financial-profile
 * Requires Bearer token with scope: financial_profile:read
 */
router.post('/financial-profile',
  requireConsent('financial_profile:read'),
  async (req, res) => {
    try {
      const { processId, customerId, sharedCustomerHash, annualIncome, netWorth, employmentStatus, investmentExperience, riskTolerance, investmentObjectives } = req.body;
      const hashToUse = customerId || sharedCustomerHash;

      logger.info('Financial profile request', {
        processId,
        customerId: hashToUse,
        institutionId: req.user?.institutionId || 'demo',
        scope: 'financial_profile:read',
        isSubmission: !!annualIncome // Check if this is a submission or retrieval
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with financial_profile:read scope required',
          timestamp: new Date().toISOString()
        });
      }

      // If this is a data submission (has annualIncome), store it
      if (annualIncome) {
        const customer = customers.get(hashToUse);

        if (!customer) {
          return res.status(404).json({
            error: 'NOT_FOUND',
            message: 'Customer not found',
            timestamp: new Date().toISOString()
          });
        }

        // Store financial profile
        customer.financialProfile = {
          annualIncome,
          netWorth,
          employmentStatus,
          investmentExperience,
          riskTolerance,
          investmentObjectives,
          submittedAt: new Date().toISOString(),
          submittedBy: req.user.institutionId || 'demo'
        };

        // Calculate MiFID II suitability assessment
        let suitabilityScore = 0;
        let riskCategory = 'conservative';

        // Simple suitability logic
        if (investmentExperience === 'extensive') suitabilityScore += 3;
        else if (investmentExperience === 'moderate') suitabilityScore += 2;
        else if (investmentExperience === 'limited') suitabilityScore += 1;

        if (riskTolerance === 'high') {
          suitabilityScore += 3;
          riskCategory = 'aggressive';
        } else if (riskTolerance === 'medium') {
          suitabilityScore += 2;
          riskCategory = 'balanced';
        } else {
          suitabilityScore += 1;
          riskCategory = 'conservative';
        }

        customer.financialProfile.mifidAssessment = {
          suitabilityScore,
          riskCategory,
          suitable: suitabilityScore >= 3,
          assessmentDate: new Date().toISOString()
        };

        customers.set(hashToUse, customer);

        logger.info('Financial profile stored', {
          processId,
          customerId: hashToUse,
          suitabilityScore,
          riskCategory
        });

        return res.json({
          success: true,
          processId,
          message: 'Financial profile recorded',
          mifidAssessment: customer.financialProfile.mifidAssessment,
          recommendedProducts: customer.financialProfile.mifidAssessment.suitable ?
            ['investment', 'premiumAccount', 'creditCard'] :
            ['basicAccount']
        });
      }

      // Otherwise, retrieve existing financial profile
      const customer = customers.get(hashToUse);

      if (!customer) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Customer not found',
          timestamp: new Date().toISOString()
        });
      }

      if (!customer.financialProfile) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Financial profile not yet submitted',
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: customer.financialProfile,
        processedBy: 'legacy_implementation'
      });

    } catch (error) {
      logger.error('Error handling financial profile:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to handle financial profile',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
module.exports.setServiceManager = setServiceManager;
module.exports.setCoreFramework = setCoreFramework;