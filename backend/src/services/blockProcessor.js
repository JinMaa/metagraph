const { sandshrewConfig } = require('../config');
const { logger } = require('../utils');

/**
 * Block processor service
 * Processes blocks and transactions from the Bitcoin blockchain
 */
class BlockProcessor {
  /**
   * Create a new block processor
   * @param {Object} sandshrewApi - Sandshrew API client
   * @param {Object} neo4jService - Neo4j service
   * @param {Object} options - Processing options
   */
  constructor(sandshrewApi, neo4jService, options = {}) {
    this.api = sandshrewApi;
    this.neo4j = neo4jService;
    this.options = {
      batchSize: options.batchSize || sandshrewConfig.batch.size,
      concurrency: options.concurrency || sandshrewConfig.batch.concurrency,
      ...options
    };
  }

  /**
   * Process a range of blocks
   * @param {number} startHeight - Starting block height
   * @param {number} endHeight - Ending block height
   * @returns {Promise<void>}
   */
  async processBlockRange(startHeight, endHeight) {
    logger.info(`Processing blocks from ${startHeight} to ${endHeight}`);
    
    for (let height = startHeight; height <= endHeight; height += this.options.batchSize) {
      const endBatch = Math.min(height + this.options.batchSize - 1, endHeight);
      await this.processBatch(height, endBatch);
      
      // Handle orphan blocks after each batch
      await this.handleOrphanBlocks();
    }
    
    logger.info(`Completed processing blocks from ${startHeight} to ${endHeight}`);
  }

  /**
   * Process a batch of blocks
   * @param {number} startHeight - Starting block height
   * @param {number} endHeight - Ending block height
   * @returns {Promise<void>}
   */
  async processBatch(startHeight, endHeight) {
    logger.info(`Processing batch from ${startHeight} to ${endHeight}`);
    
    const heights = Array.from(
      { length: endHeight - startHeight + 1 },
      (_, i) => startHeight + i
    );
    
    // Process blocks with limited concurrency
    const promises = heights.map((height, index) => {
      // Stagger requests to avoid rate limiting
      const delay = 200 * (index % this.options.concurrency);
      return new Promise(resolve => setTimeout(resolve, delay))
        .then(() => this.processBlock(height));
    });
    
    await Promise.all(promises);
    
    logger.info(`Completed batch from ${startHeight} to ${endHeight}`);
  }

  /**
   * Process a single block
   * @param {number} height - Block height
   * @returns {Promise<Object>} - Processed block
   */
  async processBlock(height) {
    try {
      logger.info(`Processing block at height ${height}`);
      
      // Get block hash
      const hash = await this.api.getBlockHash(height);
      
      // Check if block already exists in Neo4j
      const blockExists = await this.neo4j.blockExists(hash);
      if (blockExists) {
        logger.info(`Block ${hash} at height ${height} already exists in Neo4j`);
        return { hash, height, exists: true };
      }
      
      // Get block data
      const block = await this.api.getBlock(hash);
      
      // Prepare block parameters
      const blockParams = {
        blockhash: block.hash,
        blocksize: block.size,
        txcount: block.tx.length,
        version: block.version,
        merkleroot: block.merkleroot,
        timestamp: block.time,
        bits: block.bits,
        nonce: block.nonce
      };
      
      // Add prevblock parameter if it exists
      if (block.previousblockhash) {
        blockParams.prevblock = block.previousblockhash;
      } else {
        // For genesis block, set a dummy prevblock value
        blockParams.prevblock = '0000000000000000000000000000000000000000000000000000000000000000';
      }
      
      // Store block in Neo4j
      const blockResult = await this.neo4j.storeBlock(blockParams);
      
      logger.info(`Stored block ${hash} at height ${height} in Neo4j`);
      
      // Skip transaction processing for genesis block (height 0)
      if (height === 0) {
        logger.info(`Skipping transaction processing for genesis block ${hash}`);
        return { hash, height, exists: false };
      }
      
      // Get and process transactions
      const txids = await this.api.getBlockTxids(hash);
      
      logger.info(`Processing ${txids.length} transactions for block ${hash}`);
      
      for (let i = 0; i < txids.length; i++) {
        await this.processTransaction(txids[i], hash, i);
      }
      
      logger.info(`Completed processing block ${hash} at height ${height}`);
      
      return { hash, height, exists: false };
    } catch (error) {
      logger.error(`Error processing block at height ${height}`, error);
      throw error;
    }
  }

  /**
   * Process a single transaction
   * @param {string} txid - Transaction ID
   * @param {string} blockHash - Block hash
   * @param {number} index - Transaction index in the block
   * @returns {Promise<Object>} - Processed transaction
   */
  async processTransaction(txid, blockHash, index) {
    try {
      logger.debug(`Processing transaction ${txid} in block ${blockHash} at index ${index}`);
      
      // Get transaction data
      const tx = await this.api.getTransaction(txid);
      
      // Check if this is a coinbase transaction
      const isCoinbase = tx.vin[0].coinbase !== undefined;
      
      // Prepare transaction parameters
      const txParams = {
        txid,
        blockhash: blockHash,
        t: index,
        tx: {
          version: tx.version,
          locktime: tx.locktime,
          size: tx.size || tx.hex.length / 2
        },
        inputs: tx.vin.map((input, i) => ({
          vin: i,
          index: input.txid ? `${input.txid}:${input.vout}` : '0000000000000000000000000000000000000000000000000000000000000000:4294967295',
          scriptSig: input.scriptSig ? input.scriptSig.hex : '',
          sequence: input.sequence,
          witness: input.txinwitness ? input.txinwitness.join('') : ''
        })),
        outputs: tx.vout.map((output, i) => ({
          vout: i,
          index: `${txid}:${i}`,
          value: output.value,
          scriptPubKey: output.scriptPubKey.hex,
          addresses: output.scriptPubKey.addresses ? output.scriptPubKey.addresses[0] : ''
        })),
        outtotal: tx.vout.reduce((sum, output) => sum + output.value, 0)
      };
      
      // Store transaction in Neo4j
      if (isCoinbase) {
        txParams.coinbase_script = tx.vin[0].coinbase || '';
        txParams.coinbase_sequence = tx.vin[0].sequence;
        await this.neo4j.storeCoinbaseTransaction(txParams);
      } else {
        await this.neo4j.storeTransaction(txParams);
      }
      
      logger.debug(`Completed processing transaction ${txid}`);
      
      return { txid, blockHash, index };
    } catch (error) {
      logger.error(`Error processing transaction ${txid}`, error);
      throw error;
    }
  }

  /**
   * Handle orphan blocks
   * @returns {Promise<void>}
   */
  async handleOrphanBlocks() {
    try {
      logger.info('Handling orphan blocks');
      
      // Get all orphan blocks
      const orphans = await this.neo4j.getOrphanBlocks();
      
      if (orphans.length === 0) {
        logger.info('No orphan blocks found');
        return;
      }
      
      logger.info(`Found ${orphans.length} orphan blocks`);
      
      // For each orphan block
      for (const orphan of orphans) {
        // Check if the parent block exists now
        const parentExists = await this.neo4j.blockExists(orphan.prevblock);
        
        if (parentExists) {
          logger.info(`Updating orphan block ${orphan.hash}`);
          
          // Update the orphan block's height
          const height = await this.neo4j.updateBlockHeight(orphan.hash);
          
          if (height !== null) {
            logger.info(`Updated orphan block ${orphan.hash} to height ${height}`);
            
            // Recursively update heights of blocks that build on this one
            const updatedBlocks = await this.neo4j.updateChainHeights(orphan.hash);
            
            if (updatedBlocks.length > 0) {
              logger.info(`Updated ${updatedBlocks.length} blocks in the chain above ${orphan.hash}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error handling orphan blocks', error);
      throw error;
    }
  }

  /**
   * Detect and handle chain reorganizations
   * @param {number} height - Block height to check
   * @returns {Promise<boolean>} - True if a reorganization was detected and handled
   */
  async detectReorganization(height) {
    try {
      logger.info(`Checking for reorganization at height ${height}`);
      
      // Get the current block hash at this height from the API
      const currentHash = await this.api.getBlockHash(height);
      
      // Get the block hash at this height from Neo4j
      const storedHash = await this.neo4j.getBlockHashAtHeight(height);
      
      if (!storedHash) {
        logger.info(`No block found at height ${height} in Neo4j`);
        return false;
      }
      
      if (currentHash !== storedHash) {
        logger.warn(`Reorganization detected at height ${height}`);
        logger.warn(`API hash: ${currentHash}, Stored hash: ${storedHash}`);
        
        // Find the fork point
        let forkHeight = height;
        while (forkHeight > 0) {
          forkHeight--;
          const apiHash = await this.api.getBlockHash(forkHeight);
          const dbHash = await this.neo4j.getBlockHashAtHeight(forkHeight);
          
          if (apiHash === dbHash) {
            logger.info(`Fork point found at height ${forkHeight}`);
            break;
          }
        }
        
        // Process blocks from the fork point
        await this.processBlockRange(forkHeight + 1, height);
        
        return true;
      }
      
      logger.info(`No reorganization detected at height ${height}`);
      return false;
    } catch (error) {
      logger.error(`Error detecting reorganization at height ${height}`, error);
      throw error;
    }
  }

  /**
   * Sync the blockchain from a specific height to the current tip
   * @param {number} startHeight - Starting block height
   * @returns {Promise<void>}
   */
  async syncBlockchain(startHeight) {
    try {
      logger.info(`Starting blockchain sync from height ${startHeight}`);
      
      // Get the current block count
      const currentHeight = await this.api.getBlockCount();
      
      logger.info(`Current blockchain height is ${currentHeight}`);
      
      if (startHeight > currentHeight) {
        logger.warn(`Start height ${startHeight} is greater than current height ${currentHeight}`);
        return;
      }
      
      // Process blocks in batches
      await this.processBlockRange(startHeight, currentHeight);
      
      logger.info(`Completed blockchain sync from ${startHeight} to ${currentHeight}`);
    } catch (error) {
      logger.error(`Error syncing blockchain from height ${startHeight}`, error);
      throw error;
    }
  }
}

module.exports = BlockProcessor;