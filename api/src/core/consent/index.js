/**
 * Universal Consent Management Engine
 * 
 * Provides consent management capabilities that work across any industry
 * while allowing for industry-specific extensions and customizations.
 */

const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

/**
 * Universal Consent Engine
 */
class ConsentEngine {
  constructor(config = {}) {
    this.config = {
      defaultExpiryHours: 24,
      enableNotifications: true,
      enableQrCodes: true,
      storage: 'memory', // memory, redis, database
      baseUrl: process.env.CONSENT_BASE_URL || 'https://consent.api.ch',
      ...config
    };
    
    // In-memory storage (use persistent storage in production)
    this.consents = new Map();
    this.extensionHandlers = new Map();
  }

  async initialize() {
    console.log(' Initializing Universal Consent Engine...');
    
    // Initialize storage backend
    await this.initializeStorage();
    
    // Start cleanup task
    this.startCleanupTask();
    
    console.log(' Universal Consent Engine initialized');
  }

  /**
   * Initialize storage backend
   */
  async initializeStorage() {
    switch (this.config.storage) {
      case 'memory':
        // Already initialized with Map
        break;
      case 'redis':
        // TODO: Initialize Redis connection
        break;
      case 'database':
        // TODO: Initialize database connection
        break;
      default:
        console.warn('Unknown storage backend, using memory');
    }
  }

  /**
   * Register extension-specific consent handler
   */
  registerExtensionHandler(extensionName, handler) {
    this.extensionHandlers.set(extensionName, handler);
    console.log(` Registered consent handler for extension: ${extensionName}`);
  }

  /**
   * Create universal consent request
   */
  async createConsent(request, extensionName = null) {
    try {
      const consentId = uuidv4();
      const createdAt = new Date();
      const expiryDate = new Date(request.expiryDate || Date.now() + (this.config.defaultExpiryHours * 60 * 60 * 1000));
      
      // Build universal consent object
      const consent = {
        // Universal properties
        consentId,
        customerId: request.customerId,
        requestingParticipant: request.requestingParticipant,
        providingParticipant: request.providingParticipant || 'auto-detect',
        
        // Data and purpose
        dataCategories: request.dataCategories,
        purpose: request.purpose,
        permissions: {
          read: true,
          update: false,
          share: false,
          retain: false,
          ...request.permissions
        },
        
        // Context
        context: {
          industry: request.context?.industry,
          ecosystem: request.context?.ecosystem,
          useCase: request.context?.useCase,
          legalBasis: request.context?.legalBasis || 'consent',
          retentionPeriod: request.context?.retentionPeriod || '7y'
        },
        
        // Status and timing
        status: 'pending',
        createdAt,
        expiryDate,
        
        // Contact preferences
        customerContactMethod: request.customerContactMethod || 'email',
        
        // Extension data
        extensionName,
        extensionData: {},
        
        // Audit trail
        audit: {
          requestedBy: request.requestedBy,
          requestedAt: createdAt,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent
        }
      };

      // Generate consent URLs
      const consentUrl = `${this.config.baseUrl}/consent/${consentId}`;
      consent.consentUrl = consentUrl;

      // Generate QR code if enabled
      if (this.config.enableQrCodes) {
        try {
          consent.qrCode = await QRCode.toDataURL(consentUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
        } catch (qrError) {
          console.warn('Failed to generate QR code:', qrError);
        }
      }

      // Apply extension-specific processing
      if (extensionName && this.extensionHandlers.has(extensionName)) {
        const handler = this.extensionHandlers.get(extensionName);
        if (handler.beforeCreate) {
          await handler.beforeCreate(consent, request);
        }
      }

      // Store consent
      await this.storeConsent(consent);

      // Send notification to customer
      if (this.config.enableNotifications) {
        await this.sendConsentNotification(consent);
      }

      // Apply extension post-processing
      if (extensionName && this.extensionHandlers.has(extensionName)) {
        const handler = this.extensionHandlers.get(extensionName);
        if (handler.afterCreate) {
          await handler.afterCreate(consent);
        }
      }

      console.log(` Consent created: ${consentId} for customer: ${consent.customerId}`);

      return {
        consentId,
        status: consent.status,
        consentUrl: consent.consentUrl,
        qrCode: consent.qrCode,
        expiryDate: consent.expiryDate,
        dataCategories: consent.dataCategories,
        purpose: consent.purpose
      };

    } catch (error) {
      console.error('Error creating consent:', error);
      throw error;
    }
  }

  /**
   * Get consent status
   */
  async getStatus(consentId) {
    const consent = await this.getConsent(consentId);
    
    if (!consent) {
      throw new Error('Consent not found');
    }

    // Check expiry
    if (consent.expiryDate < new Date() && consent.status === 'pending') {
      consent.status = 'expired';
      await this.storeConsent(consent);
    }

    return {
      consentId: consent.consentId,
      status: consent.status,
      customerId: consent.customerId,
      dataCategories: consent.dataCategories,
      purpose: consent.purpose,
      permissions: consent.permissions,
      context: consent.context,
      
      // Timestamps
      createdAt: consent.createdAt,
      approvedAt: consent.approvedAt,
      rejectedAt: consent.rejectedAt,
      revokedAt: consent.revokedAt,
      expiryDate: consent.expiryDate,
      
      // Audit info (filtered for privacy)
      audit: {
        requestedBy: consent.audit.requestedBy,
        approvedBy: consent.audit.approvedBy,
        revokedBy: consent.audit.revokedBy
      }
    };
  }

  /**
   * Approve consent (typically called by customer interface)
   */
  async approveConsent(consentId, customerDecision = {}) {
    const consent = await this.getConsent(consentId);
    
    if (!consent) {
      throw new Error('Consent not found');
    }

    if (consent.status !== 'pending') {
      throw new Error(`Consent cannot be approved in status: ${consent.status}`);
    }

    if (consent.expiryDate < new Date()) {
      consent.status = 'expired';
      await this.storeConsent(consent);
      throw new Error('Consent has expired');
    }

    // Apply customer's decision
    if (customerDecision.approved === false) {
      consent.status = 'rejected';
      consent.rejectedAt = new Date();
      consent.audit.rejectedBy = 'customer';
      consent.audit.rejectionReason = customerDecision.reason;
    } else {
      consent.status = 'approved';
      consent.approvedAt = new Date();
      consent.audit.approvedBy = 'customer';
      
      // Apply any customer restrictions
      if (customerDecision.restrictions) {
        consent.permissions = {
          ...consent.permissions,
          ...customerDecision.restrictions
        };
      }
      
      // Apply granular data category selections if provided
      if (customerDecision.selectedCategories) {
        consent.dataCategories = consent.dataCategories.filter(
          category => customerDecision.selectedCategories.includes(category)
        );
      }
    }

    await this.storeConsent(consent);

    // Notify requesting participant
    await this.notifyConsentDecision(consent);

    console.log(` Consent ${consent.status}: ${consentId} by customer`);

    return {
      consentId,
      status: consent.status,
      token: this.generateConsentToken(consentId),
      processedAt: new Date().toISOString(),
      dataCategories: consent.dataCategories,
      permissions: consent.permissions
    };
  }

  /**
   * Revoke consent
   */
  async revoke(consentId, reason = 'user_request', revokedBy = 'customer') {
    const consent = await this.getConsent(consentId);
    
    if (!consent) {
      throw new Error('Consent not found');
    }

    if (!['pending', 'approved'].includes(consent.status)) {
      throw new Error(`Consent cannot be revoked in status: ${consent.status}`);
    }

    consent.status = 'revoked';
    consent.revokedAt = new Date();
    consent.audit.revokedBy = revokedBy;
    consent.audit.revocationReason = reason;

    await this.storeConsent(consent);

    // Notify relevant parties
    await this.notifyConsentRevocation(consent, reason);

    console.log(` Consent revoked: ${consentId} by ${revokedBy}, reason: ${reason}`);

    return {
      consentId,
      status: consent.status,
      revokedAt: consent.revokedAt,
      reason
    };
  }

  /**
   * Validate consent for data access
   */
  async validate(consentToken, purpose, requiredCategories = []) {
    try {
      // Extract consent ID from token (simplified - use proper JWT in production)
      const consentId = this.extractConsentId(consentToken);
      const consent = await this.getConsent(consentId);

      if (!consent) {
        return {
          valid: false,
          error: 'CONSENT_NOT_FOUND',
          message: 'Consent not found or expired'
        };
      }

      // Check status
      if (consent.status !== 'approved') {
        return {
          valid: false,
          error: 'CONSENT_NOT_APPROVED',
          message: `Consent status: ${consent.status}`
        };
      }

      // Check expiry
      if (consent.expiryDate < new Date()) {
        consent.status = 'expired';
        await this.storeConsent(consent);
        return {
          valid: false,
          error: 'CONSENT_EXPIRED',
          message: 'Consent has expired'
        };
      }

      // Check purpose
      if (purpose && consent.purpose !== purpose) {
        return {
          valid: false,
          error: 'PURPOSE_MISMATCH',
          message: `Required purpose: ${purpose}, granted: ${consent.purpose}`
        };
      }

      // Check data categories
      if (requiredCategories.length > 0) {
        const missingCategories = requiredCategories.filter(
          category => !consent.dataCategories.includes(category)
        );
        
        if (missingCategories.length > 0) {
          return {
            valid: false,
            error: 'INSUFFICIENT_DATA_CATEGORIES',
            message: `Missing categories: ${missingCategories.join(', ')}`
          };
        }
      }

      return {
        valid: true,
        consent: {
          consentId: consent.consentId,
          customerId: consent.customerId,
          dataCategories: consent.dataCategories,
          permissions: consent.permissions,
          purpose: consent.purpose,
          context: consent.context
        }
      };

    } catch (error) {
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: error.message
      };
    }
  }

  /**
   * List consents for participant
   */
  async listConsents(participantId, filters = {}) {
    const allConsents = Array.from(this.consents.values());
    
    let filtered = allConsents.filter(consent => 
      consent.requestingParticipant === participantId ||
      consent.providingParticipant === participantId
    );

    // Apply filters
    if (filters.status) {
      filtered = filtered.filter(consent => consent.status === filters.status);
    }
    
    if (filters.customerId) {
      filtered = filtered.filter(consent => consent.customerId === filters.customerId);
    }
    
    if (filters.purpose) {
      filtered = filtered.filter(consent => consent.purpose === filters.purpose);
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      consents: paginated.map(consent => ({
        consentId: consent.consentId,
        customerId: consent.customerId,
        status: consent.status,
        purpose: consent.purpose,
        dataCategories: consent.dataCategories,
        createdAt: consent.createdAt,
        expiryDate: consent.expiryDate,
        approvedAt: consent.approvedAt,
        revokedAt: consent.revokedAt
      })),
      pagination: {
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length
      }
    };
  }

  /**
   * Storage operations
   */
  async storeConsent(consent) {
    this.consents.set(consent.consentId, consent);
  }

  async getConsent(consentId) {
    return this.consents.get(consentId);
  }

  /**
   * Extract consent ID from token (simplified)
   */
  extractConsentId(token) {
    // In production, use proper JWT parsing
    if (token.startsWith('consent:')) {
      return token.substring(8);
    }
    return token;
  }

  /**
   * Generate consent token (simplified)
   */
  generateConsentToken(consentId) {
    // In production, use proper JWT with signature
    return `consent:${consentId}`;
  }

  /**
   * Notification operations (to be implemented by extensions or external services)
   */
  async sendConsentNotification(consent) {
    console.log(`📧 Would send consent notification for ${consent.consentId} to customer ${consent.customerId}`);
    // TODO: Implement actual notification sending
  }

  async notifyConsentDecision(consent) {
    console.log(`📧 Would notify consent decision for ${consent.consentId}: ${consent.status}`);
    // TODO: Implement actual notification sending
  }

  async notifyConsentRevocation(consent, reason) {
    console.log(`📧 Would notify consent revocation for ${consent.consentId}: ${reason}`);
    // TODO: Implement actual notification sending
  }

  /**
   * Cleanup expired consents
   */
  startCleanupTask() {
    setInterval(() => {
      this.cleanupExpiredConsents();
    }, 60 * 60 * 1000); // Run every hour
  }

  async cleanupExpiredConsents() {
    const now = new Date();
    const expiredConsents = [];
    
    for (const [consentId, consent] of this.consents.entries()) {
      if (consent.expiryDate < now && consent.status === 'pending') {
        consent.status = 'expired';
        await this.storeConsent(consent);
        expiredConsents.push(consentId);
      }
    }
    
    if (expiredConsents.length > 0) {
      console.log(`🧹 Marked ${expiredConsents.length} consents as expired`);
    }
  }

  async getHealthStatus() {
    return {
      status: 'healthy',
      consents: {
        total: this.consents.size,
        pending: Array.from(this.consents.values()).filter(c => c.status === 'pending').length,
        approved: Array.from(this.consents.values()).filter(c => c.status === 'approved').length
      },
      extensions: this.extensionHandlers.size
    };
  }

  async shutdown() {
    console.log(' Shutting down Consent Engine...');
    // Clear any timers
    // Close storage connections
    console.log(' Consent Engine shutdown complete');
  }
}

module.exports = ConsentEngine;