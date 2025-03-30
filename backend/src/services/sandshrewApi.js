const { Provider } = require('@oyl/sdk');
const bitcoin = require('bitcoinjs-lib');
const { sandshrewConfig, getNetworkConfig } = require('../config/sandshrew');
const { logger, Cache } = require('../utils');

/**
 * Sandshrew API client
 * Provides methods for interacting with the Sandshrew API
 */
class SandshrewApi {
  /**
   * Create a new Sandshrew API client
   * @param {string} network - Network name ('mainnet', 'regtest', 'oylnet')
   */
  constructor(network = sandshrewConfig.defaultNetwork) {
    // Get network configuration
    const networkConfig = getNetworkConfig(network);
    
    // Create provider configuration
    const providerConfig = {
      url: networkConfig.url,
      version: networkConfig.version || 'v2',
      projectId: networkConfig.projectId || 'lasereyes',
      network: this.getBitcoinNetwork(network),
      networkType: networkConfig.networkType
    };
    
    // Create provider
    try {
      this.provider = new Provider(providerConfig);
      
      // Initialize caches
      this.blockCache = new Cache(sandshrewConfig.cacheTtl.block);
      this.txCache = new Cache(sandshrewConfig.cacheTtl.tx);
      this.addressCache = new Cache(sandshrewConfig.cacheTtl.address);
      this.blockCountCache = new Cache(sandshrewConfig.cacheTtl.blockCount);
      
      logger.info(`Created Sandshrew API client for ${network} network`);
      logger.debug(`Provider URL: ${this.provider.url}`);
    } catch (error) {
      logger.error(`Failed to create Sandshrew API client for ${network} network`, error);
      throw error;
    }
  }

  /**
   * Get the Bitcoin network based on the network name
   * @param {string} network - Network name
   * @returns {Object} - Bitcoin network
   */
  getBitcoinNetwork(network) {
    switch (network) {
      case 'mainnet':
        return bitcoin.networks.bitcoin;
      case 'regtest':
        return bitcoin.networks.regtest;
      case 'oylnet':
      default:
        return bitcoin.networks.testnet;
    }
  }

  /**
   * Get the current block count (height of the tip)
   * @returns {Promise<number>} - Current block count
   */
  async getBlockCount() {
    const cacheKey = 'block-count';
    
    return this.blockCountCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await this.provider.sandshrew.bitcoindRpc.getBlockCount();
        } catch (error) {
          logger.error('Error getting block count', error);
          throw error;
        }
      }
    );
  }

  /**
   * Get the block hash for a given height
   * @param {number} height - Block height
   * @returns {Promise<string>} - Block hash
   */
  async getBlockHash(height) {
    const cacheKey = `block-hash:${height}`;
    
    return this.blockCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await this.provider.sandshrew.bitcoindRpc.getBlockHash(height);
        } catch (error) {
          logger.error(`Error getting block hash for height ${height}`, error);
          throw error;
        }
      }
    );
  }

  /**
   * Get block details by hash
   * @param {string} hash - Block hash
   * @returns {Promise<Object>} - Block details
   */
  async getBlock(hash) {
    const cacheKey = `block:${hash}`;
    
    return this.blockCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await this.provider.sandshrew.bitcoindRpc.getBlock(hash, 2); // Verbosity level 2 includes transaction details
        } catch (error) {
          logger.error(`Error getting block ${hash}`, error);
          throw error;
        }
      }
    );
  }

  /**
   * Get raw transaction by ID
   * @param {string} txid - Transaction ID
   * @param {boolean} verbose - Whether to return verbose transaction data
   * @returns {Promise<Object|string>} - Transaction data or hex string
   */
  async getRawTransaction(txid, verbose = true) {
    const cacheKey = `tx-raw:${txid}:${verbose}`;
    
    return this.txCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await this.provider.sandshrew.bitcoindRpc.getRawTransaction(txid, verbose);
        } catch (error) {
          logger.error(`Error getting raw transaction ${txid}`, error);
          throw error;
        }
      }
    );
  }

  /**
   * Get transaction details by ID
   * @param {string} txid - Transaction ID
   * @returns {Promise<Object>} - Transaction details
   */
  async getTransaction(txid) {
    return this.getRawTransaction(txid, true);
  }

  /**
   * Get transaction IDs in a block
   * @param {string} hash - Block hash
   * @returns {Promise<string[]>} - Array of transaction IDs
   */
  async getBlockTxids(hash) {
    const cacheKey = `block-txids:${hash}`;
    
    return this.blockCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const block = await this.getBlock(hash);
          return block.tx.map(tx => typeof tx === 'object' ? tx.txid : tx);
        } catch (error) {
          logger.error(`Error getting block txids for ${hash}`, error);
          throw error;
        }
      }
    );
  }

  /**
   * Get transactions in a block
   * @param {string} hash - Block hash
   * @param {number} startIndex - Start index for pagination
   * @returns {Promise<Object[]>} - Array of transactions
   */
  async getBlockTxs(hash, startIndex = 0) {
    const cacheKey = `block-txs:${hash}:${startIndex}`;
    
    return this.blockCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const block = await this.getBlock(hash);
          return block.tx.slice(startIndex);
        } catch (error) {
          logger.error(`Error getting block transactions for ${hash}`, error);
          throw error;
        }
      }
    );
  }

  /**
   * Get address information
   * @param {string} address - Bitcoin address
   * @returns {Promise<Object>} - Address information
   */
  async getAddressInfo(address) {
    const cacheKey = `address:${address}`;
    
    return this.addressCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await this.provider.esplora.getAddressInfo(address);
        } catch (error) {
          logger.error(`Error getting address info for ${address}`, error);
          
          // If the address doesn't exist, return an empty object
          if (error.message && error.message.includes('not found')) {
            return { address };
          }
          
          throw error;
        }
      }
    );
  }

  /**
   * Get UTXOs for an address
   * @param {string} address - Bitcoin address
   * @returns {Promise<Object[]>} - Array of UTXOs
   */
  async getAddressUtxos(address) {
    const cacheKey = `address-utxos:${address}`;
    
    return this.addressCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await this.provider.esplora.getAddressUtxo(address);
        } catch (error) {
          logger.error(`Error getting address UTXOs for ${address}`, error);
          throw error;
        }
      }
    );
  }

  /**
   * Get transactions for an address
   * @param {string} address - Bitcoin address
   * @returns {Promise<Object[]>} - Array of transactions
   */
  async getAddressTransactions(address) {
    const cacheKey = `address-txs:${address}`;
    
    return this.addressCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await this.provider.esplora.getAddressTx(address);
        } catch (error) {
          logger.error(`Error getting address transactions for ${address}`, error);
          throw error;
        }
      }
    );
  }

  /**
   * Get mempool transactions for an address
   * @param {string} address - Bitcoin address
   * @returns {Promise<Object[]>} - Array of mempool transactions
   */
  async getMempoolTransactions(address) {
    try {
      return await this.provider.esplora.getAddressTxInMempool(address);
    } catch (error) {
      logger.error(`Error getting mempool transactions for ${address}`, error);
      throw error;
    }
  }

  /**
   * Check if the API is responsive
   * @returns {Promise<boolean>} - True if the API is responsive
   */
  async checkHealth() {
    try {
      const blockCount = await this.getBlockCount();
      return blockCount > 0;
    } catch (error) {
      logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.blockCache.clear();
    this.txCache.clear();
    this.addressCache.clear();
    this.blockCountCache.clear();
    logger.info('All caches cleared');
  }
}

module.exports = SandshrewApi;