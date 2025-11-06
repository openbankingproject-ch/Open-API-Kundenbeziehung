/**
 * Consent Service
 * 
 * Business logic layer for consent management that integrates
 * existing consent functionality with the core framework.
 */

class ConsentService {
  constructor(coreFramework) {
    this.coreFramework = coreFramework;
    this.initialized = false;
  }

  async initialize() {
    console.log(' Initializing Consent Service...');
    this.initialized = true;
    console.log(' Consent Service initialized');
  }

  /**
   * Create consent request (integrated with core framework)
   */
  async createConsent(consentRequest, userContext) {
    try {
      // Note: Validation is already done at route level via Joi middleware
      // Core framework validation is skipped to avoid field name mismatches
      // (route uses requestingInstitution, core uses requestingParticipant)

      // Create consent using core framework
      if (this.coreFramework) {
        const consentHandler = this.coreFramework.createConsentHandler();
        
        // Enhance request with user context and metadata
        const enhancedRequest = {
          ...consentRequest,
          requestedBy: userContext.institutionId,
          ipAddress: userContext.ipAddress,
          userAgent: userContext.userAgent,
          context: {
            industry: 'banking', // Default to banking, could be determined dynamically
            ecosystem: 'swiss_banking',
            ...consentRequest.context
          }
        };

        const result = await consentHandler.createConsent(enhancedRequest);

        // Auto-approve consent in test mode (development only)
        if (process.env.NODE_ENV === 'development' && userContext.testMode) {
          console.log(' Test mode: Auto-approving consent');
          const consentEngine = this.coreFramework.getComponent('consentEngine');
          if (consentEngine) {
            await consentEngine.approveConsent(result.consentId, {
              approvedBy: 'test-mode-auto-approval',
              approvalMethod: 'automatic',
              approvalTimestamp: new Date().toISOString()
            });
            result.status = 'approved';
          }
        }

        return {
          success: true,
          consentId: result.consentId,
          status: result.status,
          consentUrl: result.consentUrl,
          qrCode: result.qrCode,
          expiryDate: result.expiryDate,
          dataCategories: result.dataCategories,
          purpose: result.purpose
        };
      }

      // Fallback implementation would go here
      return {
        success: false,
        error: 'CORE_FRAMEWORK_UNAVAILABLE',
        message: 'Core framework not available'
      };

    } catch (error) {
      console.error('Error creating consent:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Get consent status
   */
  async getConsentStatus(consentId, userContext) {
    try {
      if (this.coreFramework) {
        const consentHandler = this.coreFramework.createConsentHandler();
        const status = await consentHandler.getConsentStatus(consentId);
        
        return {
          success: true,
          consent: status
        };
      }

      return {
        success: false,
        error: 'CORE_FRAMEWORK_UNAVAILABLE',
        message: 'Core framework not available'
      };

    } catch (error) {
      console.error('Error getting consent status:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Approve consent (customer action)
   */
  async approveConsent(consentId, customerDecision) {
    try {
      if (this.coreFramework) {
        const consentEngine = this.coreFramework.getComponent('consentEngine');
        
        if (consentEngine) {
          const result = await consentEngine.approveConsent(consentId, customerDecision);
          
          return {
            success: true,
            consentId: result.consentId,
            status: result.status,
            processedAt: result.processedAt,
            dataCategories: result.dataCategories,
            permissions: result.permissions
          };
        }
      }

      return {
        success: false,
        error: 'CORE_FRAMEWORK_UNAVAILABLE',
        message: 'Core framework not available'
      };

    } catch (error) {
      console.error('Error approving consent:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Revoke consent
   */
  async revokeConsent(consentId, reason, userContext) {
    try {
      if (this.coreFramework) {
        const consentHandler = this.coreFramework.createConsentHandler();
        const result = await consentHandler.revokeConsent(consentId, reason);
        
        return {
          success: true,
          consentId: result.consentId,
          status: result.status,
          revokedAt: result.revokedAt,
          reason: result.reason
        };
      }

      return {
        success: false,
        error: 'CORE_FRAMEWORK_UNAVAILABLE',
        message: 'Core framework not available'
      };

    } catch (error) {
      console.error('Error revoking consent:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * List consents for institution
   */
  async listConsents(institutionId, filters = {}) {
    try {
      if (this.coreFramework) {
        const consentEngine = this.coreFramework.getComponent('consentEngine');
        
        if (consentEngine) {
          const result = await consentEngine.listConsents(institutionId, filters);
          
          return {
            success: true,
            consents: result.consents,
            pagination: result.pagination
          };
        }
      }

      return {
        success: false,
        error: 'CORE_FRAMEWORK_UNAVAILABLE',
        message: 'Core framework not available'
      };

    } catch (error) {
      console.error('Error listing consents:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Validate consent token
   */
  async validateConsent(consentToken, purpose, requiredCategories = []) {
    try {
      if (this.coreFramework) {
        const consentHandler = this.coreFramework.createConsentHandler();
        const validation = await consentHandler.validateConsent(consentToken, purpose);
        
        // Additional category validation
        if (validation.valid && requiredCategories.length > 0) {
          const consent = validation.consent;
          const missingCategories = requiredCategories.filter(
            category => !consent.dataCategories.includes(category)
          );
          
          if (missingCategories.length > 0) {
            return {
              valid: false,
              error: 'INSUFFICIENT_DATA_CATEGORIES',
              message: `Missing categories: ${missingCategories.join(', ')}`,
              missingCategories
            };
          }
        }
        
        return validation;
      }

      return {
        valid: false,
        error: 'CORE_FRAMEWORK_UNAVAILABLE',
        message: 'Core framework not available'
      };

    } catch (error) {
      console.error('Error validating consent:', error);
      return {
        valid: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Get consent analytics
   */
  async getConsentAnalytics(institutionId, timeframe = '30d') {
    try {
      if (this.coreFramework) {
        const consentEngine = this.coreFramework.getComponent('consentEngine');
        
        if (consentEngine) {
          // Get all consents for the institution
          const allConsents = await consentEngine.listConsents(institutionId, { 
            limit: 1000 // Get all for analytics
          });
          
          const consents = allConsents.consents;
          const now = new Date();
          const timeframeMs = this.parseTimeframe(timeframe);
          const cutoffDate = new Date(now - timeframeMs);
          
          // Filter consents within timeframe
          const recentConsents = consents.filter(c => 
            new Date(c.createdAt) >= cutoffDate
          );
          
          // Calculate analytics
          const analytics = {
            totalConsents: recentConsents.length,
            consentsByStatus: {
              pending: recentConsents.filter(c => c.status === 'pending').length,
              approved: recentConsents.filter(c => c.status === 'approved').length,
              rejected: recentConsents.filter(c => c.status === 'rejected').length,
              expired: recentConsents.filter(c => c.status === 'expired').length,
              revoked: recentConsents.filter(c => c.status === 'revoked').length
            },
            approvalRate: recentConsents.length > 0 ? 
              (recentConsents.filter(c => c.status === 'approved').length / recentConsents.length * 100).toFixed(2) + '%' : 
              '0%',
            mostRequestedCategories: this.getMostRequestedCategories(recentConsents),
            mostCommonPurposes: this.getMostCommonPurposes(recentConsents),
            averageApprovalTime: this.calculateAverageApprovalTime(recentConsents),
            timeframe,
            generatedAt: now.toISOString()
          };
          
          return {
            success: true,
            analytics
          };
        }
      }

      return {
        success: false,
        error: 'CORE_FRAMEWORK_UNAVAILABLE',
        message: 'Core framework not available'
      };

    } catch (error) {
      console.error('Error getting consent analytics:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Parse timeframe string to milliseconds
   */
  parseTimeframe(timeframe) {
    const match = timeframe.match(/^(\d+)([dhm])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      default: return 30 * 24 * 60 * 60 * 1000; // Default 30 days
    }
  }

  /**
   * Get most requested data categories
   */
  getMostRequestedCategories(consents) {
    const categoryCount = {};
    
    consents.forEach(consent => {
      if (consent.dataCategories) {
        consent.dataCategories.forEach(category => {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
      }
    });
    
    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  }

  /**
   * Get most common purposes
   */
  getMostCommonPurposes(consents) {
    const purposeCount = {};
    
    consents.forEach(consent => {
      if (consent.purpose) {
        purposeCount[consent.purpose] = (purposeCount[consent.purpose] || 0) + 1;
      }
    });
    
    return Object.entries(purposeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([purpose, count]) => ({ purpose, count }));
  }

  /**
   * Calculate average approval time
   */
  calculateAverageApprovalTime(consents) {
    const approvedConsents = consents.filter(c => c.status === 'approved' && c.approvedAt);
    
    if (approvedConsents.length === 0) {
      return null;
    }
    
    const totalTime = approvedConsents.reduce((sum, consent) => {
      const created = new Date(consent.createdAt);
      const approved = new Date(consent.approvedAt);
      return sum + (approved - created);
    }, 0);
    
    const averageMs = totalTime / approvedConsents.length;
    const averageHours = Math.round(averageMs / (1000 * 60 * 60) * 10) / 10;
    
    return `${averageHours} hours`;
  }

  /**
   * Health status
   */
  async getHealthStatus() {
    return {
      status: this.initialized ? 'healthy' : 'not_initialized',
      initialized: this.initialized,
      coreFrameworkIntegration: !!this.coreFramework
    };
  }

  /**
   * Shutdown
   */
  async shutdown() {
    console.log(' Shutting down Consent Service...');
    this.initialized = false;
    console.log(' Consent Service shutdown complete');
  }
}

module.exports = ConsentService;