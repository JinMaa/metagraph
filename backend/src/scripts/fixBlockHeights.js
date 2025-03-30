/**
 * Fix block heights
 * This script checks all blocks in the database and ensures they have a height property
 */
require('dotenv').config();
const { Neo4jService } = require('../services');
const { logger } = require('../utils');

async function fixBlockHeights() {
  logger.info('Starting to fix block heights');
  
  const neo4jService = new Neo4jService();
  
  try {
    // Get all blocks without a height property
    const blocksWithoutHeight = await neo4jService.runQuery(`
      MATCH (b:block)
      WHERE b.height IS NULL
      RETURN b.hash as hash, b.prevblock as prevblock
    `);
    
    logger.info(`Found ${blocksWithoutHeight.records.length} blocks without height`);
    
    // Get the genesis block
    const genesisBlock = await neo4jService.runQuery(`
      MATCH (b:block)
      WHERE b.prevblock = '0000000000000000000000000000000000000000000000000000000000000000'
      RETURN b.hash as hash
    `);
    
    if (genesisBlock.records.length === 0) {
      logger.error('Genesis block not found');
      return;
    }
    
    const genesisHash = genesisBlock.records[0].get('hash');
    logger.info(`Genesis block hash: ${genesisHash}`);
    
    // Set the height of the genesis block to 0
    await neo4jService.runQuery(`
      MATCH (b:block {hash: $hash})
      SET b.height = 0
      RETURN b.hash as hash, b.height as height
    `, { hash: genesisHash });
    
    logger.info('Set genesis block height to 0');
    
    // Recursively update heights of blocks in the chain
    let updatedBlocks = 1;
    let totalUpdated = 0;
    
    while (updatedBlocks > 0) {
      // Find blocks with a parent that has a height, but the block itself doesn't have a height
      const result = await neo4jService.runQuery(`
        MATCH (b:block)-[:chain]->(parent:block)
        WHERE parent.height IS NOT NULL AND b.height IS NULL
        SET b.height = parent.height + 1
        RETURN count(b) as count
      `);
      
      updatedBlocks = result.records[0].get('count').toNumber();
      totalUpdated += updatedBlocks;
      
      logger.info(`Updated ${updatedBlocks} blocks in this iteration, total updated: ${totalUpdated}`);
    }
    
    // Check if there are still blocks without a height
    const remainingBlocks = await neo4jService.runQuery(`
      MATCH (b:block)
      WHERE b.height IS NULL
      RETURN count(b) as count
    `);
    
    const remainingCount = remainingBlocks.records[0].get('count').toNumber();
    
    if (remainingCount > 0) {
      logger.warn(`There are still ${remainingCount} blocks without a height`);
      
      // Get the blocks without a height
      const orphanBlocks = await neo4jService.runQuery(`
        MATCH (b:block)
        WHERE b.height IS NULL
        RETURN b.hash as hash, b.prevblock as prevblock
      `);
      
      logger.info('Orphan blocks:');
      orphanBlocks.records.forEach(record => {
        logger.info(`Hash: ${record.get('hash')}, Previous block: ${record.get('prevblock')}`);
      });
    } else {
      logger.info('All blocks now have a height property');
    }
    
    // Get the highest block height
    const highestBlock = await neo4jService.runQuery(`
      MATCH (b:block)
      RETURN max(b.height) as maxHeight
    `);
    
    const maxHeight = highestBlock.records[0].get('maxHeight').toNumber();
    logger.info(`Highest block height: ${maxHeight}`);
    
    // Get the total number of blocks
    const totalBlocks = await neo4jService.runQuery(`
      MATCH (b:block)
      RETURN count(b) as count
    `);
    
    const blockCount = totalBlocks.records[0].get('count').toNumber();
    logger.info(`Total number of blocks: ${blockCount}`);
    
    // Get the total number of transactions
    const totalTxs = await neo4jService.runQuery(`
      MATCH (tx:tx)
      RETURN count(tx) as count
    `);
    
    const txCount = totalTxs.records[0].get('count').toNumber();
    logger.info(`Total number of transactions: ${txCount}`);
    
    // Get the total number of addresses
    const totalAddresses = await neo4jService.runQuery(`
      MATCH (a:address)
      RETURN count(a) as count
    `);
    
    const addressCount = totalAddresses.records[0].get('count').toNumber();
    logger.info(`Total number of addresses: ${addressCount}`);
    
  } catch (error) {
    logger.error('Error fixing block heights', error);
  } finally {
    await neo4jService.close();
  }
}

// Run the script
fixBlockHeights();