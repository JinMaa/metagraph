/**
 * Detect and handle chain reorganizations
 * Checks for chain reorganizations at a specific height or range of heights
 */
require('dotenv').config();
const { SandshrewApi, Neo4jService, BlockProcessor } = require('../services');
const { logger } = require('../utils');

// Parse command line arguments
const args = process.argv.slice(2);
const startHeight = parseInt(args[0], 10);
const endHeight = args[1] ? parseInt(args[1], 10) : startHeight;

if (isNaN(startHeight)) {
  console.error('Please provide a valid block height to check for reorganization');
  process.exit(1);
}

async function detectReorg() {
  logger.info(`Checking for reorganization from height ${startHeight} to ${endHeight}`);
  
  // Create services
  const sandshrewApi = new SandshrewApi();
  const neo4jService = new Neo4jService();
  const blockProcessor = new BlockProcessor(sandshrewApi, neo4jService);
  
  try {
    let reorgDetected = false;
    
    // Check each height in the range
    for (let height = startHeight; height <= endHeight; height++) {
      const result = await blockProcessor.detectReorganization(height);
      
      if (result) {
        reorgDetected = true;
        logger.info(`Reorganization detected and handled at height ${height}`);
      }
    }
    
    if (!reorgDetected) {
      logger.info(`No reorganization detected in the range ${startHeight} to ${endHeight}`);
    }
  } catch (error) {
    logger.error('Error detecting reorganization', error);
    process.exit(1);
  } finally {
    // Close Neo4j driver
    await neo4jService.close();
  }
}

// Run the reorganization detection
detectReorg();