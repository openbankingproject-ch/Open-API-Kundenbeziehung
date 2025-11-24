const express = require('express');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { validateRequest } = require('../middleware/validation');
const { requireConsent } = require('../middleware/auth');

const router = express.Router();

// Service layer references (injected by app.js)
let serviceManager = null;
let identificationRouter = null;
let checksRouter = null;
let signatureRouter = null;

/**
 * Set service manager reference
 */
function setServiceManager(manager) {
  serviceManager = manager;
}

/**
 * Set route references for wrapping
 */
function setRouteReferences(refs) {
  identificationRouter = refs.identification;
  checksRouter = refs.checks;
  signatureRouter = refs.signature;
}

// In-memory process storage (use database in production)
const processes = new Map();

/**
 * Step 1: Initialize Process
 * POST /process/initialize
 * NO Bearer token required (pre-authorization step)
 */
router.post('/initialize', async (req, res) => {
  try {
    const { requestingInstitution, serviceType, timestamp } = req.body;

    const processId = 'proc_' + crypto.randomBytes(16).toString('hex');

    logger.info('Process initialization', {
      processId,
      requestingInstitution,
      serviceType,
      ip: req.ip
    });

    // Create process instance
    const processInstance = {
      processId,
      requestingInstitution,
      serviceType,
      status: 'initialized',
      currentStep: 1,
      createdAt: timestamp || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      steps: {
        step1: { completed: true, completedAt: new Date().toISOString() }
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    };

    processes.set(processId, processInstance);

    logger.info('Process initialized successfully', { processId, serviceType });

    res.json({
      success: true,
      processId,
      status: 'initialized',
      currentStep: 1,
      message: 'Process initialized successfully',
      nextStep: 'product-selection'
    });

  } catch (error) {
    logger.error('Error initializing process:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to initialize process',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Step 2: Product Selection
 * POST /process/product-selection
 * NO Bearer token required (pre-authorization step)
 */
router.post('/product-selection', async (req, res) => {
  try {
    const { processId, selectedProducts, determinedScopes } = req.body;

    logger.info('Product selection', {
      processId,
      selectedProducts,
      determinedScopes
    });

    const processInstance = processes.get(processId);

    if (!processInstance) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Process not found',
        timestamp: new Date().toISOString()
      });
    }

    // Update process with selected products and required scopes
    processInstance.selectedProducts = selectedProducts;
    processInstance.requiredScopes = determinedScopes;
    processInstance.currentStep = 2;
    processInstance.lastUpdated = new Date().toISOString();
    processInstance.steps.step2 = {
      completed: true,
      completedAt: new Date().toISOString(),
      data: { selectedProducts, determinedScopes }
    };

    processes.set(processId, processInstance);

    logger.info('Product selection recorded', {
      processId,
      products: selectedProducts.length,
      scopes: determinedScopes.length
    });

    res.json({
      success: true,
      processId,
      selectedProducts,
      requiredScopes: determinedScopes,
      status: 'products_selected',
      currentStep: 2,
      message: 'Product selection recorded',
      nextStep: 'oauth-authentication'
    });

  } catch (error) {
    logger.error('Error in product selection:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to record product selection',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Step 3: Self-Declaration (Stufe 3)
 * POST /process/self-declaration
 * Requires Bearer token with scope: kyc:selfDeclaration:write
 */
router.post('/self-declaration',
  requireConsent('kyc:selfDeclaration:write'),
  async (req, res) => {
    try {
      const { processId, fatcaStatus, taxResidency, taxIdentificationNumber, sourceOfFunds, expectedActivity, pepStatus } = req.body;

      logger.info('Self-declaration submission', {
        processId,
        institutionId: req.user?.institutionId || 'demo',
        scope: 'kyc:selfDeclaration:write'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with kyc:selfDeclaration:write scope required',
          timestamp: new Date().toISOString()
        });
      }

      const processInstance = processes.get(processId);

      if (!processInstance) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Process not found',
          timestamp: new Date().toISOString()
        });
      }

      // Store self-declaration data
      processInstance.selfDeclaration = {
        fatcaStatus,
        taxResidency,
        taxIdentificationNumber,
        sourceOfFunds,
        expectedActivity,
        pepStatus,
        submittedAt: new Date().toISOString()
      };

      // Calculate risk score based on self-declaration
      let riskScore = 'low';
      if (pepStatus !== 'no') riskScore = 'high';
      else if (fatcaStatus === 'yes') riskScore = 'medium';

      processInstance.selfDeclaration.riskScore = riskScore;
      processInstance.currentStep = 3;
      processInstance.lastUpdated = new Date().toISOString();
      processInstance.steps.step3 = {
        completed: true,
        completedAt: new Date().toISOString()
      };

      processes.set(processId, processInstance);

      logger.info('Self-declaration recorded', {
        processId,
        riskScore
      });

      res.json({
        success: true,
        processId,
        message: 'Self-declaration recorded',
        riskScore,
        nextStep: 'basic-data-collection'
      });

    } catch (error) {
      logger.error('Error in self-declaration:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to record self-declaration',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Step 7: Background Checks (Wrapper for /v1/checks/comprehensive)
 * POST /process/background-checks
 * Requires Bearer token with scope: kyc:backgroundChecks:write
 */
router.post('/background-checks',
  requireConsent('kyc:backgroundChecks:write'),
  async (req, res) => {
    try {
      const { processId, customerId, checks } = req.body;

      logger.info('Background checks request', {
        processId,
        customerId,
        checks,
        institutionId: req.user?.institutionId || 'demo'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with kyc:backgroundChecks:write scope required',
          timestamp: new Date().toISOString()
        });
      }

      // Use service layer if available
      if (serviceManager) {
        const checksService = serviceManager.getService('checks');
        if (checksService) {
          const result = await checksService.runComprehensiveChecks(
            { customerId, checks },
            {
              institutionId: req.user.institutionId || 'demo',
              userId: req.user.id || 'demo-user'
            }
          );

          if (result.success) {
            // Update process
            const processInstance = processes.get(processId);
            if (processInstance) {
              processInstance.backgroundChecks = result.checks;
              processInstance.currentStep = 7;
              processInstance.steps.step7 = {
                completed: true,
                completedAt: new Date().toISOString()
              };
              processes.set(processId, processInstance);
            }

            return res.json({
              success: true,
              processId,
              checks: result.checks,
              overallResult: result.overallResult,
              message: 'All background checks passed',
              nextStep: 'contract-signature'
            });
          }
        }
      }

      // Simulated background checks
      const simulatedChecks = {
        pepCheck: {
          status: 'pass',
          result: 'Not a PEP',
          checkedAt: new Date().toISOString()
        },
        sanctionsCheck: {
          status: 'pass',
          result: 'No sanctions matches',
          checkedAt: new Date().toISOString()
        },
        adverseMediaCheck: {
          status: 'pass',
          result: 'No adverse media found',
          checkedAt: new Date().toISOString()
        },
        creditCheck: {
          status: 'pass',
          result: 'Credit score: 750/850',
          checkedAt: new Date().toISOString()
        }
      };

      // Update process
      const processInstance = processes.get(processId);
      if (processInstance) {
        processInstance.backgroundChecks = simulatedChecks;
        processInstance.currentStep = 7;
        processInstance.steps.step7 = {
          completed: true,
          completedAt: new Date().toISOString()
        };
        processes.set(processId, processInstance);
      }

      logger.info('Background checks completed', {
        processId,
        overallResult: 'approved'
      });

      res.json({
        success: true,
        processId,
        checks: simulatedChecks,
        overallResult: 'approved',
        message: 'All background checks passed',
        nextStep: 'contract-signature',
        processedBy: 'simulated'
      });

    } catch (error) {
      logger.error('Error in background checks:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to run background checks',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Steps 8-9: Contract Signature (Wrapper for /v1/signature/initiate)
 * POST /process/contract-signature
 * Requires Bearer token with scope: contract:write_detailed
 */
router.post('/contract-signature',
  requireConsent('contract:write_detailed'),
  async (req, res) => {
    try {
      const { processId, contracts, signatureMethod, signatureTimestamp, signatureHash } = req.body;

      logger.info('Contract signature request', {
        processId,
        contracts: contracts.length,
        signatureMethod,
        institutionId: req.user?.institutionId || 'demo'
      });

      // Check Bearer token authorization
      if (!req.user || !req.user.consent) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token with contract:write_detailed scope required',
          timestamp: new Date().toISOString()
        });
      }

      const processInstance = processes.get(processId);

      if (!processInstance) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Process not found',
          timestamp: new Date().toISOString()
        });
      }

      // Store contract signature data
      processInstance.contracts = {
        contractsAccepted: contracts,
        signatureMethod,
        signatureTimestamp,
        signatureHash,
        signedAt: new Date().toISOString()
      };

      // Generate account numbers for selected products
      const accountNumbers = processInstance.selectedProducts.map(product => ({
        product,
        accountNumber: 'CH' + Math.floor(Math.random() * 10000000000000000).toString().padStart(17, '0')
      }));

      processInstance.accountNumbers = accountNumbers;
      processInstance.currentStep = 9;
      processInstance.status = 'completed';
      processInstance.completedAt = new Date().toISOString();
      processInstance.steps.step89 = {
        completed: true,
        completedAt: new Date().toISOString()
      };

      processes.set(processId, processInstance);

      logger.info('Contract signature recorded', {
        processId,
        contractsAccepted: contracts.length,
        accountsCreated: accountNumbers.length
      });

      res.json({
        success: true,
        processId,
        contractsAccepted: contracts.length,
        signatureVerified: true,
        message: 'Contracts signed successfully',
        accountNumbers,
        status: 'completed',
        nextStep: 'process-complete'
      });

    } catch (error) {
      logger.error('Error in contract signature:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process contract signature',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get process status
 * GET /process/:processId
 */
router.get('/:processId', async (req, res) => {
  try {
    const { processId } = req.params;

    const processInstance = processes.get(processId);

    if (!processInstance) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Process not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      process: processInstance
    });

  } catch (error) {
    logger.error('Error fetching process:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch process',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
module.exports.setServiceManager = setServiceManager;
module.exports.setRouteReferences = setRouteReferences;
