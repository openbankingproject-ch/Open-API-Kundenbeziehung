const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const logger = require('../utils/logger');
const { validateRequest } = require('../middleware/validation');
const { requireScope } = require('../middleware/auth');

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

// In-memory storage for demo (use database in production)
const consents = new Map();

/**
 * Create consent request (Enhanced with Banking MVP)
 * POST /consent
 */
router.post('/', validateRequest('createConsent'), async (req, res) => {
  try {
    const {
      customerId,
      requestingInstitution,
      providingInstitution,
      dataCategories,
      purpose,
      expiryDate,
      customerContactMethod
    } = req.body;

    logger.info('Banking MVP - Consent request', {
      customerId,
      requestingInstitution,
      purpose,
      institutionId: req.user?.institutionId
    });

    // Use service layer if available, fallback to legacy implementation
    if (serviceManager) {
      const consentService = serviceManager.getService('consent');
      
      const consentResult = await consentService.createConsent(
        {
          customerId,
          requestingInstitution,
          providingInstitution,
          dataCategories,
          purpose,
          expiryDate,
          customerContactMethod
        },
        {
          institutionId: req.user?.institutionId || 'anonymous',
          userId: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          testMode: req.user?.testMode
        }
      );

      if (consentResult.success) {
        logger.info('Banking MVP - Consent created successfully (service layer)', {
          consentId: consentResult.consentId,
          customerId,
          purpose
        });

        return res.status(201).json({
          consentId: consentResult.consentId,
          status: consentResult.status,
          consentUrl: consentResult.consentUrl,
          qrCode: consentResult.qrCode,
          expiryDate: consentResult.expiryDate,
          dataCategories: consentResult.dataCategories,
          purpose: consentResult.purpose,
          processedBy: 'banking_mvp_service_layer',
          framework: 'core_framework_v1'
        });
      } else {
        logger.error('Banking MVP - Consent creation failed (service layer)', consentResult);
        return res.status(400).json({
          error: consentResult.error,
          message: consentResult.message || 'Consent creation failed',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Legacy fallback implementation
    logger.warn('Using legacy consent creation - service layer not available');
    
    const consentId = uuidv4();
    const consentUrl = `${process.env.CONSENT_BASE_URL || 'https://consent.openbanking.ch'}/consent/${consentId}`;
    
    // Generate QR code for mobile consent
    const qrCode = await QRCode.toDataURL(consentUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    const consent = {
      consentId,
      customerId,
      requestingInstitution,
      providingInstitution: providingInstitution || 'auto-detect',
      dataCategories,
      purpose,
      expiryDate: new Date(expiryDate),
      customerContactMethod,
      status: 'pending',
      createdAt: new Date(),
      consentUrl,
      qrCode,
      requestedBy: req.user?.institutionId || 'anonymous'
    };

    consents.set(consentId, consent);

    logger.info('Consent request created (legacy)', {
      consentId,
      customerId,
      requestingInstitution,
      purpose,
      userId: req.user?.id
    });

    // In production, trigger customer notification here
    // await notificationService.sendConsentRequest(consent);

    res.status(201).json({
      consentId,
      status: 'pending',
      consentUrl,
      qrCode,
      expiryDate: consent.expiryDate
    });

  } catch (error) {
    logger.error('Error creating consent request:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create consent request',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get consent status
 * GET /consent/:consentId
 */
router.get('/:consentId', (req, res) => {
  try {
    const { consentId } = req.params;
    const consent = consents.get(consentId);

    if (!consent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Consent not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user has permission to view this consent
    if (req.user && 
        req.user.institutionId !== consent.requestingInstitution && 
        req.user.institutionId !== consent.providingInstitution) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this consent',
        timestamp: new Date().toISOString()
      });
    }

    // Check if consent has expired
    if (consent.expiryDate < new Date()) {
      consent.status = 'expired';
      consents.set(consentId, consent);
    }

    const response = {
      consentId: consent.consentId,
      status: consent.status,
      dataCategories: consent.dataCategories,
      purpose: consent.purpose,
      expiryDate: consent.expiryDate
    };

    if (consent.status === 'approved') {
      response.approvedAt = consent.approvedAt;
    }

    if (consent.status === 'revoked') {
      response.revokedAt = consent.revokedAt;
    }

    res.json(response);

  } catch (error) {
    logger.error('Error retrieving consent status:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve consent status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Revoke consent
 * DELETE /consent/:consentId
 */
router.delete('/:consentId', requireScope('consent:manage'), (req, res) => {
  try {
    const { consentId } = req.params;
    const consent = consents.get(consentId);

    if (!consent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Consent not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user has permission to revoke this consent
    if (req.user.institutionId !== consent.requestingInstitution) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only requesting institution can revoke consent',
        timestamp: new Date().toISOString()
      });
    }

    // Can only revoke pending or approved consents
    if (!['pending', 'approved'].includes(consent.status)) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Consent cannot be revoked in current status',
        timestamp: new Date().toISOString()
      });
    }

    consent.status = 'revoked';
    consent.revokedAt = new Date();
    consent.revokedBy = req.user.id;
    consents.set(consentId, consent);

    logger.info('Consent revoked', {
      consentId,
      customerId: consent.customerId,
      revokedBy: req.user.id,
      institutionId: req.user.institutionId
    });

    res.status(204).send();

  } catch (error) {
    logger.error('Error revoking consent:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to revoke consent',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Customer consent approval endpoint (for simulation)
 * POST /consent/:consentId/approve
 */
router.post('/:consentId/approve', (req, res) => {
  try {
    const { consentId } = req.params;
    const { customerApproval, restrictions } = req.body;
    const consent = consents.get(consentId);

    if (!consent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Consent not found',
        timestamp: new Date().toISOString()
      });
    }

    if (consent.status !== 'pending') {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Consent is not in pending status',
        timestamp: new Date().toISOString()
      });
    }

    if (consent.expiryDate < new Date()) {
      consent.status = 'expired';
      consents.set(consentId, consent);
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Consent has expired',
        timestamp: new Date().toISOString()
      });
    }

    if (customerApproval) {
      consent.status = 'approved';
      consent.approvedAt = new Date();
      consent.restrictions = restrictions || {};
    } else {
      consent.status = 'rejected';
      consent.rejectedAt = new Date();
    }

    consents.set(consentId, consent);

    logger.info('Customer consent decision', {
      consentId,
      customerId: consent.customerId,
      approved: customerApproval,
      restrictions
    });

    res.json({
      consentId,
      status: consent.status,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error processing consent approval:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to process consent approval',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * List consents for institution (admin endpoint)
 * GET /consent
 */
router.get('/', requireScope('consent:read'), (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    const { status, customerId, limit = 50, offset = 0 } = req.query;

    const institutionConsents = Array.from(consents.values())
      .filter(consent => 
        consent.requestingInstitution === institutionId || 
        consent.providingInstitution === institutionId
      )
      .filter(consent => !status || consent.status === status)
      .filter(consent => !customerId || consent.customerId === customerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map(consent => ({
        consentId: consent.consentId,
        customerId: consent.customerId,
        status: consent.status,
        purpose: consent.purpose,
        dataCategories: consent.dataCategories,
        createdAt: consent.createdAt,
        expiryDate: consent.expiryDate,
        approvedAt: consent.approvedAt,
        revokedAt: consent.revokedAt
      }));

    res.json({
      consents: institutionConsents,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: institutionConsents.length
      }
    });

  } catch (error) {
    logger.error('Error listing consents:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list consents',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
module.exports.setServiceManager = setServiceManager;
module.exports.setCoreFramework = setCoreFramework;