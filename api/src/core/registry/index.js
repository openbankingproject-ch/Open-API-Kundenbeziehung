/**
 * Universal Participant Registry
 * 
 * Manages participants across all industries and ecosystems,
 * providing trust network infrastructure and discovery services.
 */

const crypto = require('crypto');

/**
 * Participant Registry
 */
class ParticipantRegistry {
  constructor(config = {}) {
    this.config = {
      enableTrustScoring: true,
      enableAutoDiscovery: false,
      defaultTrustLevel: 'basic',
      certificateValidation: true,
      ...config
    };
    
    this.participants = new Map(); // Active participants
    this.trustRelationships = new Map(); // Trust relationships between participants
    this.industryRegistries = new Map(); // Industry-specific registry data
    
    // Initialize with system participants
    this.initializeSystemParticipants();
  }

  async initialize() {
    console.log(' Initializing Participant Registry...');
    
    // Load participants from persistent storage
    await this.loadParticipants();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    console.log(` Participant Registry initialized with ${this.participants.size} participants`);
  }

  /**
   * Initialize system participants
   */
  initializeSystemParticipants() {
    // System participant (this API instance)
    const systemParticipant = {
      participantId: 'SYSTEM-API-001',
      name: 'Open API Kundenbeziehung System',
      type: 'system',
      industry: 'infrastructure',
      ecosystem: 'universal',

      capabilities: {
        dataProvider: false,
        dataConsumer: false,
        identityProvider: true,
        consentProvider: true,
        processOrchestrator: true,
        registry: true
      },

      endpoints: {
        baseUrl: process.env.API_BASE_URL || 'https://api.openbanking.ch',
        healthCheck: '/health',
        consent: '/v1/consent',
        registry: '/v1/registry'
      },

      trustLevel: 'system',
      status: 'active',
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),

      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        uptime: 100,
        lastRequestAt: null
      },

      metadata: {
        version: '1.0.0',
        maintainer: 'Open Banking Project',
        compliance: ['FAPI2.0', 'GDPR', 'DSG']
      }
    };

    this.participants.set(systemParticipant.participantId, systemParticipant);
  }

  /**
   * Register new participant
   */
  async register(participantData) {
    try {
      // Validate participant data
      const validation = this.validateParticipantData(participantData);
      if (!validation.valid) {
        throw new Error(`Participant validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if participant already exists
      if (this.participants.has(participantData.participantId)) {
        throw new Error(`Participant already registered: ${participantData.participantId}`);
      }

      // Create participant record
      const participant = {
        ...participantData,
        status: 'pending',
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        
        // Security and trust
        trustScore: this.calculateInitialTrustScore(participantData),
        verificationStatus: 'unverified',
        
        // API capabilities
        apiVersion: participantData.apiVersion || '1.0',
        supportedFeatures: participantData.supportedFeatures || [],
        
        // Compliance
        compliance: {
          regulations: participantData.compliance?.regulations || [],
          certifications: participantData.compliance?.certifications || [],
          lastAuditDate: participantData.compliance?.auditDate,
          dataProtectionOfficer: participantData.compliance?.dataProtectionOfficer
        },
        
        // Statistics
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          uptime: 100,
          lastRequestAt: null
        }
      };

      // Validate certificates if provided
      if (participant.certificates && this.config.certificateValidation) {
        await this.validateCertificates(participant.certificates);
      }

      // Store participant
      this.participants.set(participant.participantId, participant);
      
      // Add to industry registry
      this.addToIndustryRegistry(participant);

      console.log(` Participant registered: ${participant.participantId} (${participant.name})`);

      return {
        participantId: participant.participantId,
        status: participant.status,
        trustScore: participant.trustScore,
        registeredAt: participant.registeredAt
      };

    } catch (error) {
      console.error(` Participant registration failed:`, error);
      throw error;
    }
  }

  /**
   * Validate participant
   */
  async validate(participantId) {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      return {
        valid: false,
        error: 'PARTICIPANT_NOT_FOUND',
        message: 'Participant not registered'
      };
    }

    if (participant.status === 'inactive' || participant.status === 'suspended') {
      return {
        valid: false,
        error: 'PARTICIPANT_INACTIVE',
        message: `Participant status: ${participant.status}`
      };
    }

    // Check if participant has been seen recently
    const lastSeenHours = (Date.now() - new Date(participant.lastSeen)) / (1000 * 60 * 60);
    if (lastSeenHours > 24) {
      return {
        valid: false,
        error: 'PARTICIPANT_STALE',
        message: `Participant last seen ${Math.round(lastSeenHours)} hours ago`
      };
    }

    // Check trust score
    if (participant.trustScore < 0.3) {
      return {
        valid: false,
        error: 'LOW_TRUST_SCORE',
        message: `Trust score too low: ${participant.trustScore}`
      };
    }

    return {
      valid: true,
      participant: {
        participantId: participant.participantId,
        name: participant.name,
        industry: participant.industry,
        trustLevel: participant.trustLevel,
        trustScore: participant.trustScore,
        capabilities: participant.capabilities,
        endpoints: participant.endpoints
      }
    };
  }

  /**
   * Update participant status
   */
  async updateParticipant(participantId, updates) {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      throw new Error('Participant not found');
    }

    // Apply updates
    const updatedParticipant = {
      ...participant,
      ...updates,
      lastUpdated: new Date().toISOString()
    };

    // Recalculate trust score if relevant fields changed
    if (updates.stats || updates.compliance || updates.status) {
      updatedParticipant.trustScore = this.calculateTrustScore(updatedParticipant);
    }

    this.participants.set(participantId, updatedParticipant);
    
    console.log(` Participant updated: ${participantId}`);
    
    return updatedParticipant;
  }

  /**
   * Get participant information
   */
  getParticipant(participantId) {
    return this.participants.get(participantId);
  }

  /**
   * Get all participants
   */
  getParticipants(filters = {}) {
    let participants = Array.from(this.participants.values());
    
    // Apply filters
    if (filters.industry) {
      participants = participants.filter(p => p.industry === filters.industry);
    }
    
    if (filters.ecosystem) {
      participants = participants.filter(p => p.ecosystem === filters.ecosystem);
    }
    
    if (filters.status) {
      participants = participants.filter(p => p.status === filters.status);
    }
    
    if (filters.capabilities) {
      const requiredCapabilities = Array.isArray(filters.capabilities) ? filters.capabilities : [filters.capabilities];
      participants = participants.filter(p => 
        requiredCapabilities.some(cap => p.capabilities[cap])
      );
    }

    if (filters.trustLevel) {
      participants = participants.filter(p => p.trustLevel === filters.trustLevel);
    }

    // Sort by trust score descending
    participants.sort((a, b) => b.trustScore - a.trustScore);

    return {
      participants: participants.map(p => ({
        participantId: p.participantId,
        name: p.name,
        industry: p.industry,
        ecosystem: p.ecosystem,
        capabilities: p.capabilities,
        endpoints: p.endpoints,
        trustLevel: p.trustLevel,
        trustScore: p.trustScore,
        status: p.status,
        lastSeen: p.lastSeen,
        uptime: p.stats?.uptime
      })),
      total: participants.length,
      industries: [...new Set(participants.map(p => p.industry))],
      ecosystems: [...new Set(participants.map(p => p.ecosystem))]
    };
  }

  /**
   * Discover participants by capability
   */
  discoverParticipants(requiredCapability, industry = null) {
    const participants = Array.from(this.participants.values())
      .filter(p => p.status === 'active')
      .filter(p => p.capabilities[requiredCapability])
      .filter(p => !industry || p.industry === industry)
      .sort((a, b) => b.trustScore - a.trustScore);

    return participants.map(p => ({
      participantId: p.participantId,
      name: p.name,
      industry: p.industry,
      endpoints: p.endpoints,
      trustScore: p.trustScore,
      avgResponseTime: p.stats?.avgResponseTime
    }));
  }

  /**
   * Record participant interaction
   */
  async recordInteraction(participantId, interactionData) {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      return;
    }

    // Update statistics
    participant.stats.totalRequests += 1;
    
    if (interactionData.success) {
      participant.stats.successfulRequests += 1;
    } else {
      participant.stats.failedRequests += 1;
    }
    
    if (interactionData.responseTime) {
      // Update average response time (simple moving average)
      participant.stats.avgResponseTime = 
        (participant.stats.avgResponseTime * (participant.stats.totalRequests - 1) + interactionData.responseTime) / 
        participant.stats.totalRequests;
    }
    
    participant.stats.lastRequestAt = new Date().toISOString();
    participant.lastSeen = new Date().toISOString();

    // Recalculate trust score based on new stats
    participant.trustScore = this.calculateTrustScore(participant);

    this.participants.set(participantId, participant);
  }

  /**
   * Validate participant data
   */
  validateParticipantData(data) {
    const errors = [];
    
    if (!data.participantId) {
      errors.push('participantId is required');
    }
    
    if (!data.name) {
      errors.push('name is required');
    }
    
    if (!data.industry) {
      errors.push('industry is required');
    }
    
    if (!data.endpoints?.baseUrl) {
      errors.push('endpoints.baseUrl is required');
    }
    
    if (data.endpoints?.baseUrl && !data.endpoints.baseUrl.startsWith('https://')) {
      errors.push('endpoints.baseUrl must use HTTPS');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate initial trust score for new participant
   */
  calculateInitialTrustScore(participantData) {
    let score = 0.5; // Base score
    
    // Industry reputation
    if (['banking', 'insurance', 'government'].includes(participantData.industry)) {
      score += 0.2;
    }
    
    // Has certificates
    if (participantData.certificates?.length > 0) {
      score += 0.2;
    }
    
    // Compliance certifications
    if (participantData.compliance?.certifications?.length > 0) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate trust score based on participant behavior
   */
  calculateTrustScore(participant) {
    if (!this.config.enableTrustScoring) {
      return 0.8; // Default trust score
    }

    let score = this.calculateInitialTrustScore(participant);
    
    // Adjust based on statistics
    const stats = participant.stats;
    if (stats.totalRequests > 0) {
      const successRate = stats.successfulRequests / stats.totalRequests;
      score = score * 0.7 + successRate * 0.3; // 70% base + 30% performance
    }
    
    // Uptime factor
    if (stats.uptime) {
      score = score * (stats.uptime / 100);
    }
    
    // Response time factor (penalize slow responses)
    if (stats.avgResponseTime > 5000) { // 5 seconds
      score = score * 0.9;
    } else if (stats.avgResponseTime > 1000) { // 1 second
      score = score * 0.95;
    }
    
    // Recent activity bonus
    if (participant.lastSeen) {
      const hoursAgo = (Date.now() - new Date(participant.lastSeen)) / (1000 * 60 * 60);
      if (hoursAgo < 1) {
        score = Math.min(score * 1.05, 1.0);
      } else if (hoursAgo > 24) {
        score = score * 0.9;
      }
    }
    
    return Math.round(score * 1000) / 1000; // Round to 3 decimals
  }

  /**
   * Validate certificates
   */
  async validateCertificates(certificates) {
    // TODO: Implement certificate validation
    // - Check certificate validity
    // - Verify certificate chain
    // - Check revocation status
    console.log(`Validating ${certificates.length} certificates...`);
    return true;
  }

  /**
   * Add participant to industry-specific registry
   */
  addToIndustryRegistry(participant) {
    const { industry, ecosystem } = participant;
    const registryKey = ecosystem ? `${industry}:${ecosystem}` : industry;
    
    if (!this.industryRegistries.has(registryKey)) {
      this.industryRegistries.set(registryKey, new Map());
    }
    
    const industryRegistry = this.industryRegistries.get(registryKey);
    industryRegistry.set(participant.participantId, {
      participantId: participant.participantId,
      name: participant.name,
      capabilities: participant.capabilities,
      trustScore: participant.trustScore,
      registeredAt: participant.registeredAt
    });
  }

  /**
   * Get industry-specific participants
   */
  getIndustryParticipants(industry, ecosystem = null) {
    const registryKey = ecosystem ? `${industry}:${ecosystem}` : industry;
    const industryRegistry = this.industryRegistries.get(registryKey);
    
    if (!industryRegistry) {
      return [];
    }
    
    return Array.from(industryRegistry.values());
  }

  /**
   * Health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      await this.performHealthChecks();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async performHealthChecks() {
    const activeParticipants = Array.from(this.participants.values())
      .filter(p => p.status === 'active' && p.endpoints?.healthCheck);

    for (const participant of activeParticipants) {
      try {
        // Ensure stats object exists
        if (!participant.stats) {
          participant.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            uptime: 100,
            lastRequestAt: null
          };
        }

        // TODO: Implement actual health check HTTP request
        // const healthStatus = await this.checkParticipantHealth(participant);

        // For now, simulate health check
        const isHealthy = Math.random() > 0.1; // 90% healthy

        if (isHealthy) {
          participant.lastSeen = new Date().toISOString();
          participant.stats.uptime = Math.min(participant.stats.uptime + 1, 100);
        } else {
          participant.stats.uptime = Math.max(participant.stats.uptime - 5, 0);
          if (participant.stats.uptime < 50) {
            participant.status = 'degraded';
          }
        }

        // Update trust score
        participant.trustScore = this.calculateTrustScore(participant);

      } catch (error) {
        console.warn(`Health check failed for ${participant.participantId}:`, error.message);
        // Ensure stats exists before accessing
        if (!participant.stats) {
          participant.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            uptime: 0,
            lastRequestAt: null
          };
        }
        participant.stats.uptime = Math.max(participant.stats.uptime - 10, 0);
      }
    }

    const degradedCount = activeParticipants.filter(p => p.stats?.uptime < 80).length;
    if (degradedCount > 0) {
      console.log(` ${degradedCount} participants have degraded health`);
    }
  }

  /**
   * Load participants from storage
   */
  async loadParticipants() {
    // TODO: Implement loading from persistent storage
    // For now, participants are initialized in memory
  }

  /**
   * Save participants to storage
   */
  async saveParticipants() {
    // TODO: Implement saving to persistent storage
    console.log('Saving participants to storage...');
  }

  async getHealthStatus() {
    const participants = Array.from(this.participants.values());
    const active = participants.filter(p => p.status === 'active').length;
    const degraded = participants.filter(p => p.stats?.uptime < 80).length;
    
    return {
      status: degraded > active * 0.2 ? 'degraded' : 'healthy',
      participants: {
        total: participants.length,
        active,
        degraded,
        suspended: participants.filter(p => p.status === 'suspended').length
      },
      industries: this.industryRegistries.size,
      avgTrustScore: participants.reduce((sum, p) => sum + p.trustScore, 0) / participants.length
    };
  }

  async shutdown() {
    console.log(' Shutting down Participant Registry...');
    await this.saveParticipants();
    console.log(' Participant Registry shutdown complete');
  }
}

module.exports = ParticipantRegistry;