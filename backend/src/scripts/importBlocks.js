/**
 * Import blocks from the Bitcoin blockchain
 * Processes blocks and transactions from a specified height
 */
require('dotenv').config();
const { SandshrewApi, Neo4jService, BlockProcessor } = require('../services');
const { logger } = require('../utils');

// Parse command line arguments
const args = process.argv.slice(2);
const startHeight = parseInt(args[0], 10) || 0;
const endHeight = args[1] ? parseInt(args[1], 10) : undefined;
const batchSize = args[2] ? parseInt(args[2], 10) : undefined;

async function importBlocks() {
  logger.info(`Starting block import from height ${startHeight}${endHeight ? ` to ${endHeight}` : ''}`);
  
  // Create services
  const sandshrewApi = new SandshrewApi();
  const neo4jService = new Neo4jService();
  
  // Create block processor with optional batch size
  const options = batchSize ? { batchSize } : {};
  const blockProcessor = new BlockProcessor(sandshrewApi, neo4jService, options);
  
  try {
    // If endHeight is specified, process a range of blocks
    if (endHeight !== undefined) {
      await blockProcessor.processBlockRange(startHeight, endHeight);
    } else {
      // Otherwise, sync from startHeight to the current tip
      await blockProcessor.syncBlockchain(startHeight);
    }
    
    logger.info('Block import completed successfully');
  } catch (error) {
    logger.error('Error importing blocks', error);
    process.exit(1);
  } finally {
    // Close Neo4j driver
    await neo4jService.close();
  }
}

// Run the import
importBlocks();