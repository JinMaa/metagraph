require('dotenv').config();

/**
 * Sandshrew API configuration
 * Configuration for connecting to the Sandshrew API
 */
const sandshrewConfig = {
  // Network configurations
  networks: {
    mainnet: {
      url: 'https://mainnet.sandshrew.io',
      projectId: 'lasereyes',
      version: 'v2',
      networkType: 'mainnet'
    },
    
    regtest: {
      url: 'http://localhost:18888',
      projectId: 'regtest',
      version: 'v1',
      networkType: 'regtest'
    },

    oylnet: {
      url: 'https://oylnet.oyl.gg', 
      projectId: 'regtest',
      version: 'v2',
      networkType: 'regtest'
    }
  },
  
  // Default network to use
  defaultNetwork: process.env.SANDSHREW_NETWORK || 'mainnet',
  
  // Cache TTL values in milliseconds
  cacheTtl: {
    block: 3600000,      // 1 hour
    tx: 3600000,         // 1 hour
    address: 300000,     // 5 minutes
    blockCount: 60000    // 1 minute
  },
  
  // Rate limiting configuration
  rateLimit: {
    maxRequests: 100,    // Maximum requests per time window
    timeWindow: 60000    // Time window in milliseconds (1 minute)
  },
  
  // Retry configuration
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    retryableErrors: [429, 500, 502, 503, 504]
  },
  
  // Batch processing configuration
  batch: {
    size: 10,            // Number of blocks to process in a batch
    concurrency: 3       // Number of concurrent requests
  }
};

/**
 * Get configuration for a specific network
 * @param {string} network - Network name ('mainnet', 'regtest', 'oylnet')
 * @returns {Object} Network configuration
 */
const getNetworkConfig = (network = sandshrewConfig.defaultNetwork) => {
  return sandshrewConfig.networks[network] || sandshrewConfig.networks.mainnet;
};

module.exports = {
  sandshrewConfig,
  getNetworkConfig
};