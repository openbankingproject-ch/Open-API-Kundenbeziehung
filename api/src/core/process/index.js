/**
 * Universal Process Orchestration Engine
 * 
 * Implements the generic 10-step reference process that can be customized
 * for any industry or use case while maintaining consistency and auditability.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Process Orchestrator
 * Manages execution of multi-step processes with industry extensions
 */
class ProcessOrchestrator {
  constructor(config = {}) {
    this.config = {
      enableAuditTrail: true,
      maxStepTimeout: 30000, // 30 seconds
      maxRetries: 3,
      parallelSteps: true,
      ...config
    };
    
    this.processes = new Map(); // Active process instances
    this.processDefinitions = new Map(); // Process definitions
    this.stepHandlers = new Map(); // Step implementation handlers
    this.extensionHandlers = new Map(); // Extension-specific handlers
    
    // Initialize universal process definitions
    this.initializeUniversalProcesses();
  }

  async initialize() {
    console.log(' Initializing Process Orchestration Engine...');
    
    // Register universal step handlers
    this.registerUniversalStepHandlers();
    
    console.log(' Process Orchestration Engine initialized');
  }

  /**
   * Initialize universal process definitions
   */
  initializeUniversalProcesses() {
    // Universal 10-Step Customer Onboarding Reference Process
    // Based on Conclusion 03: Referenzprozess
    this.processDefinitions.set('referenzprozess_complete', {
      processId: 'referenzprozess_complete',
      name: 'Universal 10-Step Customer Onboarding Reference Process',
      version: '1.0',
      description: 'Complete 10-step reference process for customer relationship establishment across any industry',
      
      phases: [
        { phaseId: 'phase_1', name: 'Setup und Produktauswahl', steps: ['step_1', 'step_2'] },
        { phaseId: 'phase_2', name: 'Datenerfassung', steps: ['step_3', 'step_4', 'step_5'] },
        { phaseId: 'phase_3', name: 'Verifikation und Compliance', steps: ['step_6', 'step_7'] },
        { phaseId: 'phase_4', name: 'Vertragsabschluss', steps: ['step_8', 'step_9', 'step_10'] }
      ],
      
      steps: [
        {
          stepId: 'step_1_initialisierung',
          name: 'Initialisierung',
          phase: 'phase_1',
          type: 'initialization',
          description: 'Information des Kunden und initiale Consent-Abgabe',
          owner: 'customer',
          purpose: 'Information des Kunden und initiale Consent-Abgabe',
          levelOfAssurance: 'self-declared',
          required: true,
          timeout: 30000,
          retries: 1,
          inputs: ['serviceSelection', 'countrySelection', 'initialConsent'],
          outputs: ['cookieConsent', 'initialConsentStatus', 'selectedCountry', 'selectedServices']
        },
        
        {
          stepId: 'step_2_produktauswahl',
          name: 'Produktauswahl',
          phase: 'phase_1',
          type: 'configuration',
          description: 'Bedürfnisbefriedigung und Produktkonfiguration',
          owner: 'customer',
          purpose: 'Bedürfnisbefriedigung',
          levelOfAssurance: 'self-declared',
          required: false, // Out of scope for MVP
          timeout: 60000,
          retries: 1,
          inputs: ['availableProducts', 'customerProfile'],
          outputs: ['selectedProducts', 'productConfiguration', 'suitabilityAssessment']
        },
        
        {
          stepId: 'step_3_selbstdeklaration',
          name: 'Selbstdeklaration',
          phase: 'phase_2',
          type: 'data_collection',
          description: 'Information bzgl. FATCA, MIFID, Compliance',
          owner: 'customer',
          purpose: 'Information bzgl. FATCA, MIFID, Compliance',
          levelOfAssurance: 'self-declared',
          required: true,
          timeout: 300000, // 5 minutes
          retries: 2,
          inputs: ['taxResidency', 'usPerson', 'fatcaData'],
          outputs: ['economicOwnership', 'taxDomicile', 'usPersonStatus', 'fatcaSelfDeclaration', 'sourceOfFunds']
        },
        
        {
          stepId: 'step_4_basisdaten',
          name: 'Erhebung Basisdaten',
          phase: 'phase_2',
          type: 'data_collection',
          description: 'Erfassung von Kontaktangaben und Personalien (Core Identity)',
          owner: 'customer',
          purpose: 'Erfassung von Kontaktangaben und Personalien',
          levelOfAssurance: 'self-declared',
          required: true,
          timeout: 300000, // 5 minutes
          retries: 2,
          inputs: ['personalData', 'contactData', 'addressData'],
          outputs: ['name', 'birthData', 'nationality', 'address', 'contactDetails', 'basicKycData']
        },
        
        {
          stepId: 'step_5_erweiterte_daten',
          name: 'Erweiterte Daten',
          phase: 'phase_2',
          type: 'data_collection',
          description: 'Risiko-/Potenzialermittlung des Kunden (Ecosystem-spezifisch)',
          owner: 'customer',
          purpose: 'Risiko-/Potenzialermittlung des Kunden',
          levelOfAssurance: 'self-declared',
          required: false, // Out of scope for MVP
          timeout: 600000, // 10 minutes
          retries: 2,
          inputs: ['financialData', 'professionalData', 'investmentProfile'],
          outputs: ['totalWealth', 'income', 'profession', 'riskProfile', 'investmentExperience']
        },
        
        {
          stepId: 'step_6_identifikation',
          name: 'Identifikation',
          phase: 'phase_3',
          type: 'verification',
          description: 'Identifikation der Vertragspartei (QEAA/EAA Level)',
          owner: 'provider',
          purpose: 'Identifikation der Vertragspartei',
          levelOfAssurance: 'QEAA', // Qualified Entity-Assured-Assurance
          required: true,
          timeout: 1800000, // 30 minutes for video ident
          retries: 3,
          inputs: ['identityDocument', 'biometricData', 'addressProof'],
          outputs: ['identityVerified', 'documentData', 'biometricMatch', 'auditTrail']
        },
        
        {
          stepId: 'step_7_background_checks',
          name: 'Background Checks',
          phase: 'phase_3',
          type: 'compliance',
          description: 'Know-Your-Customer (KYC) und Compliance',
          owner: 'provider',
          purpose: 'Know-Your-Customer (KYC) und Compliance',
          levelOfAssurance: 'QEAA',
          required: true,
          timeout: 120000, // 2 minutes
          retries: 2,
          inputs: ['customerData', 'sanctionsLists', 'pepLists'],
          outputs: ['sanctionsCheck', 'pepCheck', 'crimeCheck', 'adverseMediaCheck', 'complianceStatus']
        },
        
        {
          stepId: 'step_8_vertragsabschluss',
          name: 'Vertragsabschluss',
          phase: 'phase_4',
          type: 'legal',
          description: 'Akzeptanz Geschäftsbedingungen',
          owner: 'customer',
          purpose: 'Akzeptanz Geschäftsbedingungen',
          levelOfAssurance: 'self-declared',
          required: true,
          timeout: 600000, // 10 minutes
          retries: 1,
          inputs: ['termsAndConditions', 'privacyPolicy', 'productConditions'],
          outputs: ['agbAcceptance', 'privacyConsent', 'marketingConsent', 'additionalAgreements']
        },
        
        {
          stepId: 'step_9_signatur',
          name: 'Signatur',
          phase: 'phase_4',
          type: 'signature',
          description: 'Vertragsunterzeichnung',
          owner: 'customer',
          purpose: 'Vertragsunterzeichnung',
          levelOfAssurance: 'QEAA',
          required: true,
          timeout: 300000, // 5 minutes
          retries: 2,
          inputs: ['contractDocument', 'signatureMethod'],
          outputs: ['signature', 'signatureTimestamp', 'signatureMethod', 'certificateChain']
        },
        
        {
          stepId: 'step_10_metadaten_verteilung',
          name: 'Metadaten und Verteilung',
          phase: 'phase_4',
          type: 'system_processing',
          description: 'Erfassung, Verarbeitung und Systemintegration',
          owner: 'system',
          purpose: 'Erfassung, Verarbeitung und finale Verteilung',
          levelOfAssurance: 'system',
          required: true,
          timeout: 60000,
          retries: 3,
          inputs: ['customerData', 'signedContract', 'complianceResults'],
          outputs: ['accountProvisioned', 'servicesActivated', 'documentArchived', 'customerNotified']
        }
      ],
      
      // Process-level configuration
      configuration: {
        maxExecutionTime: 7200000, // 2 hours for complete onboarding
        enableRollback: true,
        auditLevel: 'full',
        securityLevel: 'high',
        complianceRequired: true,
        dataProtectionMode: 'gdpr_compliant'
      }
    });

    // Simplified Customer Check Process
    this.processDefinitions.set('customer_check', {
      processId: 'customer_check',
      name: 'Customer Existence Check',
      version: '1.0',
      description: 'Simplified process to check if customer exists',
      
      steps: [
        {
          stepId: 'step_1_validate_input',
          name: 'Input Validation',
          type: 'validation',
          required: true,
          inputs: ['sharedCustomerHash', 'basicData'],
          outputs: ['validationResult']
        },
        
        {
          stepId: 'step_2_customer_lookup',
          name: 'Customer Database Lookup',
          type: 'external_call',
          required: true,
          inputs: ['sharedCustomerHash', 'basicData'],
          outputs: ['customerExists', 'identificationDate', 'levelOfAssurance']
        },
        
        {
          stepId: 'step_3_response_formatting',
          name: 'Format Response',
          type: 'transformation',
          required: true,
          inputs: ['customerExists', 'identificationDate', 'levelOfAssurance'],
          outputs: ['formattedResponse']
        }
      ]
    });

    // Customer Data Request Process
    this.processDefinitions.set('customer_data_request', {
      processId: 'customer_data_request',
      name: 'Customer Data Request',
      version: '1.0',
      description: 'Process to request and retrieve customer data with consent',
      
      steps: [
        {
          stepId: 'step_1_consent_validation',
          name: 'Validate Consent',
          type: 'validation',
          required: true,
          inputs: ['consentToken', 'purpose', 'dataCategories'],
          outputs: ['consentValid', 'permissions']
        },
        
        {
          stepId: 'step_2_data_retrieval',
          name: 'Retrieve Customer Data',
          type: 'external_call',
          required: true,
          inputs: ['customerId', 'permissions', 'dataCategories'],
          outputs: ['customerData']
        },
        
        {
          stepId: 'step_3_data_filtering',
          name: 'Filter Data by Permissions',
          type: 'transformation',
          required: true,
          inputs: ['customerData', 'permissions'],
          outputs: ['filteredData']
        },
        
        {
          stepId: 'step_4_audit_access',
          name: 'Audit Data Access',
          type: 'storage',
          required: true,
          parallel: true,
          inputs: ['customerId', 'requestingParticipant', 'accessedData'],
          outputs: ['auditRecorded']
        }
      ]
    });

    console.log(` Initialized ${this.processDefinitions.size} universal process definitions`);
  }

  /**
   * Register universal step handlers
   */
  registerUniversalStepHandlers() {
    // Initialization step handler (Referenzprozess Step 1)
    this.stepHandlers.set('initialization', async (stepConfig, inputs, context) => {
      return await this.handleInitialization(inputs, context);
    });

    // Configuration step handler (Referenzprozess Step 2)
    this.stepHandlers.set('configuration', async (stepConfig, inputs, context) => {
      return await this.handleProductConfiguration(inputs, context);
    });

    // Data collection step handler (Referenzprozess Steps 3-5)
    this.stepHandlers.set('data_collection', async (stepConfig, inputs, context) => {
      if (stepConfig.stepId === 'step_3_selbstdeklaration') {
        return await this.handleSelfDeclaration(inputs, context);
      }
      if (stepConfig.stepId === 'step_4_basisdaten') {
        return await this.handleBasicDataCollection(inputs, context);
      }
      if (stepConfig.stepId === 'step_5_erweiterte_daten') {
        return await this.handleExtendedDataCollection(inputs, context);
      }
      return { success: true };
    });

    // Verification step handler (Referenzprozess Step 6)
    this.stepHandlers.set('verification', async (stepConfig, inputs, context) => {
      return await this.handleIdentityVerification(inputs, context);
    });

    // Compliance step handler (Referenzprozess Step 7)
    this.stepHandlers.set('compliance', async (stepConfig, inputs, context) => {
      return await this.handleBackgroundChecks(inputs, context);
    });

    // Legal step handler (Referenzprozess Step 8)
    this.stepHandlers.set('legal', async (stepConfig, inputs, context) => {
      return await this.handleContractAcceptance(inputs, context);
    });

    // Signature step handler (Referenzprozess Step 9)
    this.stepHandlers.set('signature', async (stepConfig, inputs, context) => {
      return await this.handleDigitalSignature(inputs, context);
    });

    // System processing step handler (Referenzprozess Step 10)
    this.stepHandlers.set('system_processing', async (stepConfig, inputs, context) => {
      return await this.handleSystemProcessing(inputs, context);
    });

    // Legacy handlers for backward compatibility
    // Validation step handler
    this.stepHandlers.set('validation', async (stepConfig, inputs, context) => {
      const { validationEngine } = context.coreComponents;
      
      if (stepConfig.stepId === 'step_1_customer_check') {
        return await this.handleCustomerExistenceCheck(inputs, context);
      }
      
      if (stepConfig.stepId === 'step_1_validate_input') {
        return await this.handleInputValidation(inputs, context);
      }
      
      if (stepConfig.stepId === 'step_1_consent_validation') {
        return await this.handleConsentValidation(inputs, context);
      }
      
      // Generic validation
      return await validationEngine.validate(inputs.data, inputs.schema);
    });

    // Transformation step handler
    this.stepHandlers.set('transformation', async (stepConfig, inputs, context) => {
      if (stepConfig.stepId === 'step_3_response_formatting') {
        return this.handleResponseFormatting(inputs, context);
      }
      
      if (stepConfig.stepId === 'step_3_data_filtering') {
        return this.handleDataFiltering(inputs, context);
      }
      
      // Generic transformation
      return inputs;
    });

    // External call step handler
    this.stepHandlers.set('external_call', async (stepConfig, inputs, context) => {
      if (stepConfig.stepId === 'step_2_customer_lookup') {
        return await this.handleCustomerLookup(inputs, context);
      }
      
      if (stepConfig.stepId === 'step_2_data_retrieval') {
        return await this.handleDataRetrieval(inputs, context);
      }
      
      // Generic external call
      console.log(`External call step: ${stepConfig.stepId}`);
      return { success: true };
    });

    // Storage step handler
    this.stepHandlers.set('storage', async (stepConfig, inputs, context) => {
      if (stepConfig.stepId === 'step_4_audit_access') {
        return await this.handleAuditStorage(inputs, context);
      }
      
      // Generic storage
      console.log(`Storage step: ${stepConfig.stepId}`, inputs);
      return { stored: true, timestamp: new Date().toISOString() };
    });

    // Notification step handler
    this.stepHandlers.set('notification', async (stepConfig, inputs, context) => {
      console.log(`Notification step: ${stepConfig.stepId}`, inputs);
      return { sent: true, timestamp: new Date().toISOString() };
    });
  }

  /**
   * Execute a process
   */
  async executeProcess(processId, inputs, extensionName = null, options = {}) {
    const processInstance = uuidv4();
    const startTime = new Date();
    
    try {
      // Get process definition
      const processDefinition = this.getProcessDefinition(processId, extensionName);
      if (!processDefinition) {
        throw new Error(`Process definition not found: ${processId}`);
      }

      // Initialize process context
      const context = {
        processInstance,
        processId,
        extensionName,
        startTime,
        inputs,
        options,
        results: {},
        auditTrail: [],
        coreComponents: inputs.coreComponents || {}
      };

      // Store active process
      this.processes.set(processInstance, {
        ...context,
        status: 'running',
        currentStep: null
      });

      console.log(` Starting process: ${processId} [${processInstance}]`);

      // Execute steps
      const result = await this.executeSteps(processDefinition.steps, context);

      // Mark as completed
      const activeProcess = this.processes.get(processInstance);
      if (activeProcess) {
        activeProcess.status = 'completed';
        activeProcess.endTime = new Date();
        activeProcess.duration = activeProcess.endTime - startTime;
      }

      console.log(` Process completed: ${processId} [${processInstance}] in ${Date.now() - startTime}ms`);

      return {
        success: true,
        processInstance,
        result,
        duration: Date.now() - startTime,
        auditTrail: context.auditTrail
      };

    } catch (error) {
      // Mark as failed
      const activeProcess = this.processes.get(processInstance);
      if (activeProcess) {
        activeProcess.status = 'failed';
        activeProcess.error = error.message;
        activeProcess.endTime = new Date();
      }

      console.error(` Process failed: ${processId} [${processInstance}]:`, error);

      return {
        success: false,
        processInstance,
        error: error.message,
        duration: Date.now() - startTime,
        auditTrail: context.auditTrail
      };
    } finally {
      // Clean up after some time
      setTimeout(() => {
        this.processes.delete(processInstance);
      }, 60000); // Keep for 1 minute
    }
  }

  /**
   * Execute process steps
   */
  async executeSteps(steps, context) {
    const results = {};
    const parallelSteps = [];
    
    for (const step of steps) {
      if (step.parallel && this.config.parallelSteps) {
        parallelSteps.push(step);
        continue;
      }
      
      // Execute sequential step
      const stepResult = await this.executeStep(step, context);
      results[step.stepId] = stepResult;
      
      // Update context with step results
      Object.assign(context.results, stepResult.outputs || {});
    }
    
    // Execute parallel steps
    if (parallelSteps.length > 0) {
      const parallelResults = await Promise.allSettled(
        parallelSteps.map(step => this.executeStep(step, context))
      );
      
      parallelResults.forEach((result, index) => {
        const step = parallelSteps[index];
        if (result.status === 'fulfilled') {
          results[step.stepId] = result.value;
          Object.assign(context.results, result.value.outputs || {});
        } else {
          results[step.stepId] = {
            success: false,
            error: result.reason.message,
            required: step.required
          };
        }
      });
    }
    
    return results;
  }

  /**
   * Execute individual step
   */
  async executeStep(stepConfig, context) {
    const stepStart = Date.now();
    const activeProcess = this.processes.get(context.processInstance);
    
    if (activeProcess) {
      activeProcess.currentStep = stepConfig.stepId;
    }

    try {
      console.log(` Executing step: ${stepConfig.stepId}`);

      // Prepare step inputs
      const stepInputs = this.prepareStepInputs(stepConfig, context);
      
      // Get step handler
      const handler = this.stepHandlers.get(stepConfig.type);
      if (!handler) {
        throw new Error(`No handler found for step type: ${stepConfig.type}`);
      }

      // Execute step with timeout and retries
      const stepResult = await this.executeWithRetries(
        () => handler(stepConfig, stepInputs, context),
        stepConfig.retries || this.config.maxRetries,
        stepConfig.timeout || this.config.maxStepTimeout
      );

      // Record in audit trail
      if (this.config.enableAuditTrail) {
        context.auditTrail.push({
          stepId: stepConfig.stepId,
          stepName: stepConfig.name,
          success: true,
          duration: Date.now() - stepStart,
          timestamp: new Date().toISOString(),
          inputs: stepInputs,
          outputs: stepResult
        });
      }

      console.log(` Step completed: ${stepConfig.stepId} in ${Date.now() - stepStart}ms`);

      return {
        success: true,
        outputs: stepResult,
        duration: Date.now() - stepStart
      };

    } catch (error) {
      // Record failure in audit trail
      if (this.config.enableAuditTrail) {
        context.auditTrail.push({
          stepId: stepConfig.stepId,
          stepName: stepConfig.name,
          success: false,
          error: error.message,
          duration: Date.now() - stepStart,
          timestamp: new Date().toISOString()
        });
      }

      if (stepConfig.required !== false) {
        throw error;
      }

      console.warn(` Optional step failed: ${stepConfig.stepId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - stepStart
      };
    }
  }

  /**
   * Prepare inputs for step execution
   */
  prepareStepInputs(stepConfig, context) {
    const stepInputs = {};
    
    // Map required inputs from context
    if (stepConfig.inputs) {
      for (const inputName of stepConfig.inputs) {
        stepInputs[inputName] = context.inputs[inputName] || context.results[inputName];
      }
    }
    
    return stepInputs;
  }

  /**
   * Execute function with retries and timeout
   */
  async executeWithRetries(fn, maxRetries, timeout) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Step timeout')), timeout)
          )
        ]);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`Step attempt ${attempt + 1} failed, retrying:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }

  /**
   * Step implementation methods
   */
  async handleCustomerExistenceCheck(inputs, context) {
    // This would typically call the customer database
    console.log('Checking customer existence for:', inputs.customerId);
    return {
      customerExists: true,
      identificationDate: '2024-01-10T10:00:00Z',
      levelOfAssurance: 'high'
    };
  }

  async handleInputValidation(inputs, context) {
    const { validationEngine } = context.coreComponents;
    return validationEngine?.validate(inputs, 'customerCheck') || { valid: true };
  }

  async handleConsentValidation(inputs, context) {
    const { consentEngine } = context.coreComponents;
    return consentEngine?.validate(inputs.consentToken, inputs.purpose) || { valid: true };
  }

  handleResponseFormatting(inputs, context) {
    return {
      formattedResponse: {
        match: inputs.customerExists,
        identificationDate: inputs.identificationDate,
        levelOfAssurance: inputs.levelOfAssurance,
        validUntil: new Date(Date.now() + 24 * 30 * 24 * 60 * 60 * 1000).toISOString() // 24 months
      }
    };
  }

  handleDataFiltering(inputs, context) {
    // Filter customer data based on consent permissions
    const { customerData, permissions } = inputs;
    const filteredData = { ...customerData };
    
    // Apply filtering logic based on permissions
    if (!permissions?.read) {
      return { filteredData: null };
    }
    
    return { filteredData };
  }

  async handleCustomerLookup(inputs, context) {
    // This would typically query the customer database
    console.log('Looking up customer:', inputs.sharedCustomerHash);
    return {
      customerExists: true,
      identificationDate: '2024-01-10T10:00:00Z',
      levelOfAssurance: 'high'
    };
  }

  async handleDataRetrieval(inputs, context) {
    console.log('Retrieving customer data for:', inputs.customerId);
    return {
      customerData: {
        basicData: { /* customer data */ },
        metadata: { accessedAt: new Date().toISOString() }
      }
    };
  }

  async handleAuditStorage(inputs, context) {
    console.log('Storing audit record for data access:', inputs.customerId);
    return {
      auditRecorded: true,
      auditId: uuidv4(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * New Referenzprozess step handlers
   */
  
  // Step 1: Initialisierung
  async handleInitialization(inputs, context) {
    console.log('Processing initialization step with cookie consent and service selection');
    return {
      cookieConsent: inputs.initialConsent === 'accepted',
      initialConsentStatus: 'granted',
      selectedCountry: inputs.countrySelection || 'CH',
      selectedServices: inputs.serviceSelection || ['basic_banking']
    };
  }

  // Step 2: Produktauswahl
  async handleProductConfiguration(inputs, context) {
    console.log('Processing product configuration and suitability assessment');
    return {
      selectedProducts: inputs.availableProducts || ['savings_account'],
      productConfiguration: {
        accountType: 'private',
        serviceLevel: 'basic'
      },
      suitabilityAssessment: {
        eligible: true,
        riskMatch: 'conservative'
      }
    };
  }

  // Step 3: Selbstdeklaration
  async handleSelfDeclaration(inputs, context) {
    console.log('Processing self-declaration for FATCA/MIFID compliance');
    return {
      economicOwnership: inputs.taxResidency === 'self',
      taxDomicile: inputs.taxResidency || 'CH',
      usPersonStatus: inputs.usPerson || false,
      fatcaSelfDeclaration: {
        compliant: true,
        timestamp: new Date().toISOString()
      },
      sourceOfFunds: inputs.sourceOfFunds || 'employment'
    };
  }

  // Step 4: Basisdaten
  async handleBasicDataCollection(inputs, context) {
    console.log('Processing basic data collection (core identity)');
    return {
      name: {
        firstName: inputs.personalData?.firstName,
        lastName: inputs.personalData?.lastName,
        title: inputs.personalData?.title
      },
      birthData: {
        birthDate: inputs.personalData?.birthDate,
        birthPlace: inputs.personalData?.birthPlace
      },
      nationality: inputs.personalData?.nationality || 'CH',
      address: {
        street: inputs.addressData?.street,
        postalCode: inputs.addressData?.postalCode,
        city: inputs.addressData?.city,
        country: inputs.addressData?.country || 'CH'
      },
      contactDetails: {
        email: inputs.contactData?.email,
        phone: inputs.contactData?.phone,
        mobile: inputs.contactData?.mobile
      },
      basicKycData: {
        profession: inputs.personalData?.profession,
        employer: inputs.personalData?.employer
      }
    };
  }

  // Step 5: Erweiterte Daten
  async handleExtendedDataCollection(inputs, context) {
    console.log('Processing extended data collection for risk assessment');
    return {
      totalWealth: inputs.financialData?.totalWealth,
      income: inputs.financialData?.annualIncome,
      profession: inputs.professionalData?.profession,
      riskProfile: {
        tolerance: inputs.investmentProfile?.riskTolerance || 'conservative',
        horizon: inputs.investmentProfile?.timeHorizon || 'long_term'
      },
      investmentExperience: inputs.investmentProfile?.experience || 'beginner'
    };
  }

  // Step 6: Identifikation
  async handleIdentityVerification(inputs, context) {
    console.log('Processing identity verification (QEAA level)');
    // This would integrate with identity verification providers
    return {
      identityVerified: true,
      documentData: {
        documentType: inputs.identityDocument?.type || 'passport',
        documentNumber: inputs.identityDocument?.number,
        expiryDate: inputs.identityDocument?.expiryDate
      },
      biometricMatch: {
        faceMatch: true,
        livenessCheck: true,
        score: 0.95
      },
      auditTrail: {
        verificationId: uuidv4(),
        timestamp: new Date().toISOString(),
        method: 'video_ident',
        provider: 'identity_service_provider'
      }
    };
  }

  // Step 7: Background Checks
  async handleBackgroundChecks(inputs, context) {
    console.log('Processing background checks for KYC/AML compliance');
    // This would integrate with compliance service providers
    return {
      sanctionsCheck: { status: 'clear', score: 0.0, timestamp: new Date().toISOString() },
      pepCheck: { status: 'clear', score: 0.0, timestamp: new Date().toISOString() },
      crimeCheck: { status: 'clear', score: 0.0, timestamp: new Date().toISOString() },
      adverseMediaCheck: { status: 'clear', score: 0.0, timestamp: new Date().toISOString() },
      complianceStatus: {
        overall: 'approved',
        riskLevel: 'low',
        requiresReview: false
      }
    };
  }

  // Step 8: Vertragsabschluss
  async handleContractAcceptance(inputs, context) {
    console.log('Processing contract terms acceptance');
    return {
      agbAcceptance: {
        accepted: true,
        timestamp: new Date().toISOString(),
        version: '1.0'
      },
      privacyConsent: {
        granted: true,
        timestamp: new Date().toISOString(),
        dataCategories: ['basic', 'contact', 'financial']
      },
      marketingConsent: {
        granted: inputs.marketingConsent || false,
        timestamp: new Date().toISOString()
      },
      additionalAgreements: []
    };
  }

  // Step 9: Signatur
  async handleDigitalSignature(inputs, context) {
    console.log('Processing digital signature');
    // This would integrate with qualified signature providers
    return {
      signature: {
        type: inputs.signatureMethod || 'QES',
        value: 'digital_signature_placeholder',
        algorithm: 'RSA-PSS'
      },
      signatureTimestamp: new Date().toISOString(),
      signatureMethod: inputs.signatureMethod || 'QES',
      certificateChain: {
        signerCert: 'cert_placeholder',
        issuerCert: 'issuer_cert_placeholder',
        rootCert: 'root_cert_placeholder'
      }
    };
  }

  // Step 10: Metadaten und Verteilung
  async handleSystemProcessing(inputs, context) {
    console.log('Processing final system integration and service activation');
    return {
      accountProvisioned: {
        accountId: uuidv4(),
        accountNumber: 'CH' + Math.random().toString(36).substring(2, 15).toUpperCase(),
        status: 'active'
      },
      servicesActivated: {
        onlineBanking: true,
        mobileApp: true,
        debitCard: true
      },
      documentArchived: {
        contractId: uuidv4(),
        archiveLocation: 'secure_document_store',
        retentionPeriod: '10_years'
      },
      customerNotified: {
        welcomeEmailSent: true,
        onboardingPackageSent: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get process definition (with extension support)
   */
  getProcessDefinition(processId, extensionName = null) {
    if (extensionName && this.extensionHandlers.has(extensionName)) {
      const handler = this.extensionHandlers.get(extensionName);
      const customProcess = handler.getProcessDefinition?.(processId);
      if (customProcess) {
        return customProcess;
      }
    }
    
    return this.processDefinitions.get(processId);
  }

  /**
   * Register a custom process definition (for extensions)
   */
  registerProcess(processId, processDefinition) {
    this.processDefinitions.set(processId, processDefinition);
    console.log(` Registered custom process: ${processId}`);
  }

  /**
   * Register extension handler
   */
  registerExtensionHandler(extensionName, handler) {
    this.extensionHandlers.set(extensionName, handler);
    console.log(` Registered process handler for extension: ${extensionName}`);
  }

  /**
   * Get process status
   */
  getProcessStatus(processInstance) {
    return this.processes.get(processInstance);
  }

  /**
   * List active processes
   */
  listActiveProcesses() {
    return Array.from(this.processes.values());
  }

  async getHealthStatus() {
    return {
      status: 'healthy',
      processes: {
        definitions: this.processDefinitions.size,
        active: this.processes.size,
        extensions: this.extensionHandlers.size
      }
    };
  }

  async shutdown() {
    console.log(' Shutting down Process Orchestrator...');
    // Wait for active processes to complete or timeout
    console.log(' Process Orchestrator shutdown complete');
  }
}

module.exports = ProcessOrchestrator;