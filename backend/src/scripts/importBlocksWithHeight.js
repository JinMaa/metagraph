/**
 * Import blocks with explicit height
 * This script imports a range of blocks and explicitly sets the height property
 */
require('dotenv').config();
const { SandshrewApi, Neo4jService } = require('../services');
const { logger } = require('../utils');

// Parse command line arguments
const args = process.argv.slice(2);
const startHeight = parseInt(args[0], 10) || 889412;
const count = parseInt(args[1], 10) || 10;
const endHeight = startHeight + count - 1;

async function importBlocksWithHeight() {
  logger.info(`Starting block import from height ${startHeight} to ${endHeight}`);
  
  const sandshrewApi = new SandshrewApi('oylnet');
  const neo4jService = new Neo4jService();
  
  try {
    // Process blocks sequentially to ensure proper chain
    for (let height = startHeight; height <= endHeight; height++) {
      logger.info(`Processing block at height ${height}`);
      
      // Get block hash
      const hash = await sandshrewApi.getBlockHash(height);
      
      // Check if block already exists in Neo4j
      const blockExists = await neo4jService.blockExists(hash);
      if (blockExists) {
        logger.info(`Block ${hash} at height ${height} already exists in Neo4j`);
        
        // Update the height property
        await neo4jService.runQuery(`
          MATCH (b:block {hash: $hash})
          SET b.height = $height
          RETURN b.hash as hash, b.height as height
        `, { hash, height });
        
        logger.info(`Updated block ${hash} with height ${height}`);
        continue;
      }
      
      // Get block data
      const block = await sandshrewApi.getBlock(hash);
      
      // Prepare block parameters
      const blockParams = {
        blockhash: block.hash,
        blocksize: block.size,
        txcount: block.tx.length,
        version: block.version,
        prevblock: block.previousblockhash || '0000000000000000000000000000000000000000000000000000000000000000',
        merkleroot: block.merkleroot,
        timestamp: block.time,
        bits: block.bits,
        nonce: block.nonce,
        height: height // Explicitly set the height
      };
      
      // Store block in Neo4j with explicit height
      await neo4jService.runQuery(`
        // Create Block
        MERGE (block:block {hash:$blockhash})
        MERGE (block)-[:coinbase]->(:output:coinbase)
        SET
            block.size=$blocksize,
            block.txcount=$txcount,
            block.version=$version,
            block.prevblock=$prevblock,
            block.merkleroot=$merkleroot,
            block.time=$timestamp,
            block.bits=$bits,
            block.nonce=$nonce,
            block.height=$height

        // Create Chain - create prevblock node if it doesn't exist
        MERGE (prevblock:block {hash:$prevblock})
        MERGE (block)-[:chain]->(prevblock)

        RETURN block.hash as hash, block.height as height
      `, blockParams);
      
      logger.info(`Stored block ${hash} at height ${height} in Neo4j`);
      
      // Process transactions
      logger.info(`Processing ${block.tx.length} transactions for block ${hash}`);
      
      for (let i = 0; i < block.tx.length; i++) {
        const txid = typeof block.tx[i] === 'object' ? block.tx[i].txid : block.tx[i];
        
        // Skip transaction processing for genesis block (height 0)
        if (height === 0) {
          logger.info(`Skipping transaction processing for genesis block ${hash}`);
          continue;
        }
        
        try {
          // Get transaction data
          const tx = await sandshrewApi.getTransaction(txid);
          
          // Check if this is a coinbase transaction
          const isCoinbase = tx.vin[0].coinbase !== undefined;
          
          // Prepare transaction parameters
          const txParams = {
            txid,
            blockhash: hash,
            t: i,
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
            await neo4jService.storeCoinbaseTransaction(txParams);
          } else {
            await neo4jService.storeTransaction(txParams);
          }
        } catch (error) {
          logger.error(`Error processing transaction ${txid}`, error);
          // Continue with next transaction
        }
      }
      
      logger.info(`Completed processing block ${hash} at height ${height}`);
    }
    
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
    
    logger.info(`Completed block import from ${startHeight} to ${endHeight}`);
  } catch (error) {
    logger.error('Error importing blocks', error);
  } finally {
    await neo4jService.close();
  }
}

// Run the script
importBlocksWithHeight();