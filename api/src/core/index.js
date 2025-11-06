/**
 * Open API Kundenbeziehung - Generic Core Framework
 * Universal customer relationship API that can be extended for any ecosystem
 * 
 * This core module provides the foundational infrastructure for:
 * - Universal customer data exchange
 * - Cross-industry consent management  
 * - Generic trust network infrastructure
 * - Extensible process orchestration
 * - FAPI 2.0 security compliance
 */

const DataModels = require('./models');
const ConsentEngine = require('./consent');
const ProcessOrchestrator = require('./process');
const ParticipantRegistry = require('./registry');
const TrustNetwork = require('./trust');
const ValidationEngine = require('./validation');
const ExtensionLoader = require('./extensions');

/**
 * Core Framework Manager
 * Initializes and coordinates all core components
 */
class CoreFramework {
  constructor(config = {}) {
    this.config = {
      // Default configuration
      enableExtensions: true,
      enableTrustNetwork: true,
      enableProcessOrchestration: true,
      securityProfile: 'fapi2.0',
      dataRetention: '7y', // 7 years default
      auditTrail: true,
      ...config
    };
    
    this.initialized = false;
    this.extensions = new Map();
    this.components = {};
  }

  /**
   * Initialize the core framework
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize core components in dependency order
      this.components.dataModels = new DataModels(this.config);
      this.components.participantRegistry = new ParticipantRegistry(this.config);
      this.components.consentEngine = new ConsentEngine(this.config);
      this.components.processOrchestrator = new ProcessOrchestrator(this.config);
      this.components.trustNetwork = new TrustNetwork(this.config);
      this.components.validationEngine = new ValidationEngine(this.config);
      
      // Initialize components
      await this.components.dataModels.initialize();
      await this.components.participantRegistry.initialize();
      await this.components.consentEngine.initialize();
      await this.components.processOrchestrator.initialize();
      await this.components.trustNetwork.initialize();
      await this.components.validationEngine.initialize();

      // Load extensions if enabled
      if (this.config.enableExtensions) {
        this.components.extensionLoader = new ExtensionLoader(this.config);
        await this.components.extensionLoader.initialize();
        
        // Load and activate extensions
        await this.loadExtensions();
      }

      this.initialized = true;
      console.log(' Core Framework initialized successfully');
    } catch (error) {
      console.error(' Core Framework initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load and activate extensions
   */
  async loadExtensions() {
    const extensions = await this.components.extensionLoader.discoverExtensions();
    
    for (const extension of extensions) {
      try {
        const loaded = await this.components.extensionLoader.loadExtension(extension);
        await loaded.initialize(this);
        this.extensions.set(extension.name, loaded);
        console.log(` Extension loaded: ${extension.name}`);
      } catch (error) {
        console.error(` Failed to load extension ${extension.name}:`, error);
      }
    }
  }

  /**
   * Get framework component
   */
  getComponent(name) {
    if (!this.initialized) {
      throw new Error('Framework not initialized');
    }
    return this.components[name];
  }

  /**
   * Get loaded extension
   */
  getExtension(name) {
    return this.extensions.get(name);
  }

  /**
   * Create universal customer data handler
   */
  createCustomerHandler(extensionName = null) {
    const handler = {
      // Generic customer operations
      checkCustomer: async (request) => {
        return this.components.processOrchestrator.executeProcess('customer_check', request, extensionName);
      },
      
      requestCustomerData: async (request) => {
        return this.components.processOrchestrator.executeProcess('customer_data_request', request, extensionName);
      },
      
      updateCustomerData: async (request) => {
        return this.components.processOrchestrator.executeProcess('customer_data_update', request, extensionName);
      }
    };

    // Add extension-specific methods if extension is specified
    if (extensionName && this.extensions.has(extensionName)) {
      const extension = this.extensions.get(extensionName);
      if (extension.getCustomerHandler) {
        Object.assign(handler, extension.getCustomerHandler());
      }
    }

    return handler;
  }

  /**
   * Create universal consent handler
   */
  createConsentHandler(extensionName = null) {
    const handler = {
      createConsent: async (request) => {
        return this.components.consentEngine.createConsent(request, extensionName);
      },
      
      getConsentStatus: async (consentId) => {
        return this.components.consentEngine.getStatus(consentId);
      },
      
      revokeConsent: async (consentId, reason) => {
        return this.components.consentEngine.revoke(consentId, reason);
      },
      
      validateConsent: async (consentToken, purpose) => {
        return this.components.consentEngine.validate(consentToken, purpose);
      }
    };

    // Add extension-specific consent methods
    if (extensionName && this.extensions.has(extensionName)) {
      const extension = this.extensions.get(extensionName);
      if (extension.getConsentHandler) {
        Object.assign(handler, extension.getConsentHandler());
      }
    }

    return handler;
  }

  /**
   * Create participant registry handler
   */
  createRegistryHandler() {
    return {
      getParticipants: () => this.components.participantRegistry.getParticipants(),
      registerParticipant: (participant) => this.components.participantRegistry.register(participant),
      validateParticipant: (participantId) => this.components.participantRegistry.validate(participantId)
    };
  }

  /**
   * Execute a process through the process orchestrator
   * @param {string} processName - Name of the process to execute
   * @param {object} request - Request data
   * @param {string} extensionName - Optional extension name
   * @returns {Promise} Process execution result
   */
  async executeProcess(processName, request, extensionName = null) {
    if (!this.initialized) {
      throw new Error('Framework not initialized');
    }
    return this.components.processOrchestrator.executeProcess(processName, request, extensionName);
  }

  /**
   * Validate request against universal schemas and extension schemas
   */
  async validateRequest(request, operation, extensionName = null) {
    // Universal validation first
    const universalResult = await this.components.validationEngine.validate(request, operation);
    
    if (!universalResult.valid) {
      return universalResult;
    }

    // Extension-specific validation
    if (extensionName && this.extensions.has(extensionName)) {
      const extension = this.extensions.get(extensionName);
      if (extension.validateRequest) {
        return await extension.validateRequest(request, operation);
      }
    }

    return universalResult;
  }

  /**
   * Get health status of framework and extensions
   */
  async getHealthStatus() {
    const status = {
      framework: 'healthy',
      timestamp: new Date().toISOString(),
      components: {},
      extensions: {}
    };

    // Check core components
    for (const [name, component] of Object.entries(this.components)) {
      if (component.getHealthStatus) {
        status.components[name] = await component.getHealthStatus();
      } else {
        status.components[name] = 'unknown';
      }
    }

    // Check extensions
    for (const [name, extension] of this.extensions) {
      if (extension.getHealthStatus) {
        status.extensions[name] = await extension.getHealthStatus();
      } else {
        status.extensions[name] = 'unknown';
      }
    }

    // Determine overall status
    const componentStatuses = Object.values(status.components);
    const extensionStatuses = Object.values(status.extensions);
    
    if ([...componentStatuses, ...extensionStatuses].some(s => s === 'unhealthy')) {
      status.framework = 'unhealthy';
    } else if ([...componentStatuses, ...extensionStatuses].some(s => s === 'degraded')) {
      status.framework = 'degraded';
    }

    return status;
  }

  /**
   * Shutdown framework gracefully
   */
  async shutdown() {
    console.log(' Shutting down Core Framework...');

    // Shutdown extensions first
    for (const [name, extension] of this.extensions) {
      try {
        if (extension.shutdown) {
          await extension.shutdown();
        }
      } catch (error) {
        console.error(`Error shutting down extension ${name}:`, error);
      }
    }

    // Shutdown core components
    for (const [name, component] of Object.entries(this.components)) {
      try {
        if (component.shutdown) {
          await component.shutdown();
        }
      } catch (error) {
        console.error(`Error shutting down component ${name}:`, error);
      }
    }

    this.initialized = false;
    console.log(' Core Framework shutdown complete');
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create framework instance
 */
function getInstance(config = {}) {
  if (!instance) {
    instance = new CoreFramework(config);
  }
  return instance;
}

module.exports = {
  CoreFramework,
  getInstance,
  // Export core components for direct access
  DataModels,
  ConsentEngine,
  ProcessOrchestrator,
  ParticipantRegistry,
  TrustNetwork,
  ValidationEngine,
  ExtensionLoader
};