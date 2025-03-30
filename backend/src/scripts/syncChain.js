/**
 * Continuously sync the blockchain
 * Keeps the Neo4j database in sync with the Bitcoin blockchain
 */
require('dotenv').config();
const { SandshrewApi, Neo4jService, BlockProcessor } = require('../services');
const { logger } = require('../utils');

// Parse command line arguments
const args = process.argv.slice(2);
const startHeight = parseInt(args[0], 10) || 0;
const interval = parseInt(args[1], 10) || 60000; // Default: 1 minute

async function syncChain() {
  logger.info(`Starting continuous blockchain sync from height ${startHeight}`);
  logger.info(`Sync interval: ${interval}ms`);
  
  // Create services
  const sandshrewApi = new SandshrewApi();
  const neo4jService = new Neo4jService();
  const blockProcessor = new BlockProcessor(sandshrewApi, neo4jService);
  
  try {
    // Initial sync
    await performSync();
    
    // Set up interval for continuous sync
    setInterval(performSync, interval);
    
    // Handle process termination
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT. Shutting down...');
      await neo4jService.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM. Shutting down...');
      await neo4jService.close();
      process.exit(0);
    });
    
    // Function to perform sync
    async function performSync() {
      try {
        // Get the current height in Neo4j
        let currentHeight = startHeight;
        
        // Try to get the highest block height from Neo4j
        try {
          // This is a simplified approach - in a real implementation,
          // you would query Neo4j for the highest block height
          const latestBlockHash = await neo4jService.getBlockHashAtHeight(currentHeight);
          
          if (latestBlockHash) {
            // If we found a block at this height, increment to the next height
            currentHeight++;
          }
          
          // Keep incrementing until we find a height with no block
          while (await neo4jService.getBlockHashAtHeight(currentHeight)) {
            currentHeight++;
          }
          
          // Decrement to get the last valid height
          if (currentHeight > startHeight) {
            currentHeight--;
          }
        } catch (error) {
          logger.error('Error getting current height from Neo4j', error);
          // Fall back to startHeight if there's an error
          currentHeight = startHeight;
        }
        
        // Get the blockchain tip height
        const tipHeight = await sandshrewApi.getBlockCount();
        
        if (currentHeight >= tipHeight) {
          logger.info(`Already at the tip (height ${tipHeight}). Nothing to sync.`);
          return;
        }
        
        // Sync from current height to tip
        logger.info(`Syncing from height ${currentHeight + 1} to ${tipHeight}`);
        await blockProcessor.processBlockRange(currentHeight + 1, tipHeight);
        
        // Handle orphan blocks
        await blockProcessor.handleOrphanBlocks();
        
        // Check for reorganizations at the tip
        await blockProcessor.detectReorganization(tipHeight);
        
        logger.info(`Sync completed. Current height: ${tipHeight}`);
      } catch (error) {
        logger.error('Error during sync', error);
      }
    }
  } catch (error) {
    logger.error('Error in sync chain process', error);
    await neo4jService.close();
    process.exit(1);
  }
}

// Run the continuous sync
syncChain();