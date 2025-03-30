/**
 * Test the Sandshrew API client
 * This script tests the Sandshrew API client by making various API calls
 */
require('dotenv').config();
const { SandshrewApi } = require('../services');
const { logger } = require('../utils');

async function testSandshrewApi() {
  logger.info('Testing Sandshrew API client');
  
  try {
    // Create Sandshrew API client
    logger.info('Creating Sandshrew API client...');
    const api = new SandshrewApi('mainnet');
    
    // Test health check
    logger.info('Testing health check...');
    const isHealthy = await api.checkHealth();
    logger.info(`Health check result: ${isHealthy}`);
    
    if (!isHealthy) {
      logger.error('Health check failed. Exiting...');
      process.exit(1);
    }
    
    // Test getBlockCount
    logger.info('Testing getBlockCount...');
    const blockCount = await api.getBlockCount();
    logger.info(`Current block count: ${blockCount}`);
    
    // Test getBlockHash
    logger.info('Testing getBlockHash...');
    const blockHash = await api.getBlockHash(0); // Genesis block
    logger.info(`Genesis block hash: ${blockHash}`);
    
    // Test getBlock
    logger.info('Testing getBlock...');
    const block = await api.getBlock(blockHash);
    logger.info(`Genesis block: ${JSON.stringify(block, null, 2)}`);
    
    // Test getBlockTxids
    logger.info('Testing getBlockTxids...');
    const txids = await api.getBlockTxids(blockHash);
    logger.info(`Genesis block txids: ${JSON.stringify(txids, null, 2)}`);
    
    // Test getTransaction with a non-genesis block transaction
    // The genesis block coinbase is not considered an ordinary transaction and cannot be retrieved
    logger.info('Testing getTransaction with a recent block...');
    
    // Get a recent block (10 blocks from the tip)
    const recentHeight = blockCount - 10;
    const recentBlockHash = await api.getBlockHash(recentHeight);
    const recentBlock = await api.getBlock(recentBlockHash);
    
    if (recentBlock && recentBlock.tx && recentBlock.tx.length > 0) {
      const txid = typeof recentBlock.tx[0] === 'object' ? recentBlock.tx[0].txid : recentBlock.tx[0];
      logger.info(`Testing transaction ${txid} from block ${recentHeight}...`);
      
      const tx = await api.getTransaction(txid);
      logger.info(`Transaction ${txid}: ${JSON.stringify(tx, null, 2)}`);
    } else {
      logger.warn('No transactions found in the recent block');
    }
    
    logger.info('All tests completed successfully!');
  } catch (error) {
    logger.error('Error testing Sandshrew API client', error);
    process.exit(1);
  }
}

// Run the test
testSandshrewApi();