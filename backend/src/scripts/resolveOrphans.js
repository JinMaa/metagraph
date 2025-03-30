/**
 * Resolve orphan blocks
 * Finds and resolves orphan blocks in the Neo4j database
 */
require('dotenv').config();
const { SandshrewApi, Neo4jService, BlockProcessor } = require('../services');
const { logger } = require('../utils');

async function resolveOrphans() {
  logger.info('Starting orphan block resolution');
  
  // Create services
  const sandshrewApi = new SandshrewApi();
  const neo4jService = new Neo4jService();
  const blockProcessor = new BlockProcessor(sandshrewApi, neo4jService);
  
  try {
    // Get all orphan blocks
    const orphans = await neo4jService.getOrphanBlocks();
    
    if (orphans.length === 0) {
      logger.info('No orphan blocks found');
      return;
    }
    
    logger.info(`Found ${orphans.length} orphan blocks`);
    
    // Handle orphan blocks
    await blockProcessor.handleOrphanBlocks();
    
    // Check if there are still orphans
    const remainingOrphans = await neo4jService.getOrphanBlocks();
    
    if (remainingOrphans.length === 0) {
      logger.info('All orphan blocks resolved successfully');
    } else {
      logger.info(`${remainingOrphans.length} orphan blocks still remain`);
      
      // Log the remaining orphans
      for (const orphan of remainingOrphans) {
        logger.info(`Orphan block: ${orphan.hash}, Previous block: ${orphan.prevblock}`);
        
        // Check if the previous block exists in the blockchain
        try {
          const blockExists = await sandshrewApi.getBlock(orphan.prevblock);
          logger.info(`Previous block ${orphan.prevblock} exists in the blockchain: ${!!blockExists}`);
          
          // If the previous block exists, try to fetch and process it
          if (blockExists) {
            logger.info(`Fetching and processing previous block ${orphan.prevblock}`);
            
            // Get the block height
            const blockStatus = await sandshrewApi.getBlockStatus(orphan.prevblock);
            if (blockStatus && blockStatus.height !== undefined) {
              logger.info(`Previous block ${orphan.prevblock} is at height ${blockStatus.height}`);
              
              // Process the block
              await blockProcessor.processBlock(blockStatus.height);
              
              // Handle orphans again
              await blockProcessor.handleOrphanBlocks();
            }
          }
        } catch (error) {
          logger.error(`Error checking previous block ${orphan.prevblock}`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Error resolving orphan blocks', error);
    process.exit(1);
  } finally {
    // Close Neo4j driver
    await neo4jService.close();
  }
}

// Run the orphan resolution
resolveOrphans();