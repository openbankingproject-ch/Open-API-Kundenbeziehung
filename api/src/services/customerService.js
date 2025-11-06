/**
 * Customer Service
 * 
 * Business logic layer for customer operations that integrates
 * existing customer functionality with the core framework.
 */

const crypto = require('crypto');

class CustomerService {
  constructor(coreFramework) {
    this.coreFramework = coreFramework;
    this.customers = new Map(); // In-memory storage (migrate existing data here)
    this.initialized = false;
  }

  async initialize() {
    console.log(' Initializing Customer Service...');
    
    // Import existing customer data (from existing customer.js route)
    await this.migrateExistingCustomerData();
    
    this.initialized = true;
    console.log(' Customer Service initialized');
  }

  /**
   * Migrate existing customer data from the old customer.js implementation
   */
  async migrateExistingCustomerData() {
    // Initialize with sample data (matching existing customer.js)
    const sampleCustomer = {
      sharedCustomerHash: crypto.createHash('sha256').update('Müller Hans Peter 1985-03-15 CH').digest('hex'),
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
        annualIncome: { amount: 120000, currency: 'CHF' },
        totalAssets: { amount: 250000, currency: 'CHF' },
        sourceOfFunds: 'salary',
        pepStatus: false
      },
      complianceData: {
        fatcaStatus: 'non_us_person',
        crsReportable: false,
        taxResidencies: [{
          country: 'CH',
          isPrimary: true,
          tinNumber: '756.1234.5678.90'
        }],
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
        industry: 'banking',
        ecosystem: 'swiss_banking',
        createdAt: '2024-01-10T10:00:00Z',
        lastUpdated: '2024-01-10T10:00:00Z',
        version: '1.0',
        dataClassification: 'confidential',
        verificationStatus: 'verified'
      }
    };
    
    this.customers.set(sampleCustomer.sharedCustomerHash, sampleCustomer);
    console.log(' Sample customer data migrated to Customer Service');
  }

  /**
   * Check if customer exists (enhanced with core framework)
   */
  async checkCustomer(checkRequest, userContext) {
    try {
      const { sharedCustomerHash, basicData } = checkRequest;

      // Validate request using core framework
      if (this.coreFramework) {
        const validationEngine = this.coreFramework.getComponent('validationEngine');
        if (validationEngine) {
          const validation = await validationEngine.validate(checkRequest, 'customerCheck');
          if (!validation.valid) {
            return {
              success: false,
              error: 'VALIDATION_FAILED',
              details: validation.errors
            };
          }
        }
      }

      // Execute customer check process using core framework
      if (this.coreFramework) {
        try {
          const processResult = await this.coreFramework.executeProcess('customer_check', {
            sharedCustomerHash,
            basicData,
            userContext,
            coreComponents: this.coreFramework.components
          });

          // Check if we got a valid structured response from the process orchestrator
          if (processResult.success && processResult.result?.step_3_response_formatting?.formattedResponse) {
            return {
              success: true,
              match: processResult.result.step_3_response_formatting.formattedResponse.match || false,
              identificationDate: processResult.result.step_3_response_formatting.formattedResponse.identificationDate,
              levelOfAssurance: processResult.result.step_3_response_formatting.formattedResponse.levelOfAssurance,
              validUntil: processResult.result.step_3_response_formatting.formattedResponse.validUntil,
              processInstance: processResult.processInstance,
              processedBy: 'core_framework_process_orchestrator'
            };
          }
        } catch (processError) {
          console.log(' Process orchestrator not fully configured, falling back to legacy implementation');
        }
      }

      // Fallback to legacy implementation
      const legacyResult = await this.legacyCheckCustomer(sharedCustomerHash, basicData);
      return {
        ...legacyResult,
        processedBy: 'banking_mvp_service_layer',
        framework: 'core_framework_v1'
      };

    } catch (error) {
      console.error('Error in customer check:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Legacy customer check implementation (from existing customer.js)
   */
  async legacyCheckCustomer(sharedCustomerHash, basicData) {
    // Verify hash matches provided basic data
    const calculatedHash = this.generateSharedCustomerHash(basicData);
    if (calculatedHash !== sharedCustomerHash) {
      return {
        success: false,
        error: 'BAD_REQUEST',
        message: 'Shared customer hash does not match provided basic data'
      };
    }

    const customer = this.customers.get(sharedCustomerHash);

    console.log(`Debug: Looking for customer with hash: ${sharedCustomerHash.substring(0, 16)}...`);
    console.log(`Debug: Customers in map: ${this.customers.size}`);
    console.log(`Debug: Customer found: ${!!customer}`);

    if (!customer) {
      console.log(`Debug: Customer NOT found in map`);
      return {
        success: true,
        match: false,
        exists: false
      };
    }

    // Normalize dates for comparison
    const storedBirthDate = customer.basicData.birthDate instanceof Date
      ? customer.basicData.birthDate.toISOString().split('T')[0]
      : customer.basicData.birthDate;

    const providedBirthDate = basicData.birthDate instanceof Date
      ? basicData.birthDate.toISOString().split('T')[0]
      : basicData.birthDate;

    // Verify basic data matches
    const dataMatches =
      customer.basicData.lastName === basicData.lastName &&
      customer.basicData.givenName === basicData.givenName &&
      storedBirthDate === providedBirthDate &&
      JSON.stringify(customer.basicData.nationality.sort()) === JSON.stringify(basicData.nationality.sort());

    if (!dataMatches) {
      return {
        success: true,
        match: false,
        exists: false
      };
    }

    // Check identification validity (24 months for banking)
    const identificationDate = new Date(customer.identification.verificationDate);
    const validityPeriod = 24 * 30 * 24 * 60 * 60 * 1000; // 24 months
    const validUntil = new Date(identificationDate.getTime() + validityPeriod);
    const isValid = validUntil > new Date();

    return {
      success: true,
      match: true,
      exists: true, // Alias for match (for backward compatibility)
      identificationDate: customer.identification.verificationDate,
      levelOfAssurance: customer.identification.levelOfAssurance,
      validUntil: validUntil.toISOString(),
      valid: isValid,
      originator: customer.metadata.originator
    };
  }

  /**
   * Request full customer dataset (enhanced with core framework)
   */
  async requestFullCustomerData(dataRequest, userContext) {
    try {
      const { sharedCustomerHash, purpose, consentToken } = dataRequest;

      // Validate consent using core framework
      if (this.coreFramework) {
        const consentEngine = this.coreFramework.getComponent('consentEngine');
        if (consentEngine) {
          const consentValidation = await consentEngine.validate(consentToken, purpose);
          if (!consentValidation.valid) {
            return {
              success: false,
              error: 'CONSENT_INVALID',
              message: consentValidation.message || 'Invalid consent'
            };
          }

          // Execute data request process
          const processResult = await this.coreFramework.executeProcess('customer_data_request', {
            customerId: sharedCustomerHash,
            purpose,
            consentToken,
            permissions: consentValidation.consent?.permissions,
            dataCategories: consentValidation.consent?.dataCategories,
            userContext,
            coreComponents: this.coreFramework.components
          });

          if (processResult.success) {
            return {
              success: true,
              customerData: processResult.result.step_3_data_filtering?.filteredData,
              processInstance: processResult.processInstance,
              auditRecorded: processResult.result.step_4_audit_access?.auditRecorded
            };
          }
        }
      }

      // Fallback to legacy implementation
      return await this.legacyRequestCustomerData(sharedCustomerHash, purpose, consentToken, userContext);

    } catch (error) {
      console.error('Error in customer data request:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Legacy customer data request (from existing customer.js)
   */
  async legacyRequestCustomerData(sharedCustomerHash, purpose, consentToken, userContext) {
    const customer = this.customers.get(sharedCustomerHash);
    
    if (!customer) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: 'Customer not found'
      };
    }

    // Mock consent validation (should be replaced with real consent validation)
    const mockConsent = {
      granted: true,
      dataCategories: ['basicData', 'contactInformation', 'addressData', 'identification', 'kycData', 'complianceData'],
      purpose: purpose
    };

    // Filter data based on mock consent
    const responseData = {};
    
    if (mockConsent.dataCategories.includes('basicData')) {
      responseData.basicData = customer.basicData;
    }
    if (mockConsent.dataCategories.includes('contactInformation')) {
      responseData.contactInformation = customer.contactInformation;
    }
    if (mockConsent.dataCategories.includes('addressData')) {
      responseData.addressData = customer.addressData;
    }
    if (mockConsent.dataCategories.includes('identification')) {
      responseData.identification = customer.identification;
    }
    if (mockConsent.dataCategories.includes('kycData')) {
      responseData.kycData = customer.kycData;
    }
    if (mockConsent.dataCategories.includes('complianceData')) {
      responseData.complianceData = customer.complianceData;
    }

    // Always include metadata
    responseData.metadata = {
      ...customer.metadata,
      accessedAt: new Date().toISOString(),
      accessedBy: userContext.institutionId,
      purpose
    };

    return {
      success: true,
      customerData: responseData
    };
  }

  /**
   * Update customer data (enhanced with core framework)
   */
  async updateCustomerData(sharedCustomerHash, updates, userContext) {
    try {
      const customer = this.customers.get(sharedCustomerHash);
      
      if (!customer) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'Customer not found'
        };
      }

      // Only allow updates from the originating institution
      if (customer.metadata.originator !== userContext.institutionId) {
        return {
          success: false,
          error: 'FORBIDDEN',
          message: 'Only originating institution can update customer data'
        };
      }

      // Transform updates to universal format using core framework
      let universalUpdates = updates;
      if (this.coreFramework) {
        const dataModels = this.coreFramework.getComponent('dataModels');
        if (dataModels && customer.metadata.industry) {
          universalUpdates = dataModels.transformToUniversal(updates, customer.metadata.industry);
        }
      }

      // Merge updates with existing data
      const updatedCustomer = {
        ...customer,
        ...universalUpdates,
        metadata: {
          ...customer.metadata,
          lastUpdated: new Date().toISOString(),
          updatedBy: userContext.userId,
          version: (parseFloat(customer.metadata.version) + 0.1).toFixed(1)
        }
      };

      this.customers.set(sharedCustomerHash, updatedCustomer);

      console.log('Customer data updated:', {
        sharedCustomerHash,
        updatedBy: userContext.userId,
        institutionId: userContext.institutionId
      });

      return {
        success: true,
        sharedCustomerHash,
        version: updatedCustomer.metadata.version,
        lastUpdated: updatedCustomer.metadata.lastUpdated
      };

    } catch (error) {
      console.error('Error updating customer data:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Generate shared customer hash (from existing implementation)
   */
  generateSharedCustomerHash(basicData) {
    // Normalize birthDate to ISO format string (YYYY-MM-DD)
    const birthDateStr = basicData.birthDate instanceof Date
      ? basicData.birthDate.toISOString().split('T')[0]
      : basicData.birthDate;

    const hashInput = `${basicData.lastName} ${basicData.givenName} ${birthDateStr} ${basicData.nationality.join(',')}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Transform customer data to universal format
   */
  transformToUniversal(customerData, sourceIndustry = 'banking') {
    if (!this.coreFramework) {
      return customerData;
    }

    const dataModels = this.coreFramework.getComponent('dataModels');
    if (dataModels) {
      return dataModels.transformToUniversal(customerData, sourceIndustry);
    }

    return customerData;
  }

  /**
   * Get customer statistics
   */
  getCustomerStats() {
    const customers = Array.from(this.customers.values());
    
    return {
      totalCustomers: customers.length,
      verifiedCustomers: customers.filter(c => c.metadata.verificationStatus === 'verified').length,
      industries: [...new Set(customers.map(c => c.metadata.industry))],
      ecosystems: [...new Set(customers.map(c => c.metadata.ecosystem))],
      lastUpdated: customers.length > 0 ? 
        Math.max(...customers.map(c => new Date(c.metadata.lastUpdated))) : null
    };
  }

  /**
   * Health status
   */
  async getHealthStatus() {
    const stats = this.getCustomerStats();
    
    return {
      status: this.initialized ? 'healthy' : 'not_initialized',
      initialized: this.initialized,
      customers: stats,
      coreFrameworkIntegration: !!this.coreFramework
    };
  }

  /**
   * Shutdown
   */
  async shutdown() {
    console.log(' Shutting down Customer Service...');
    // Could save customer data to persistent storage here
    this.initialized = false;
    console.log(' Customer Service shutdown complete');
  }
}

module.exports = CustomerService;