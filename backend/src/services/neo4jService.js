const { createDriver } = require('../config');
const { logger } = require('../utils');

/**
 * Neo4j service
 * Provides methods for interacting with the Neo4j database
 */
class Neo4jService {
  /**
   * Create a new Neo4j service
   */
  constructor() {
    this.driver = createDriver();
    
    // Cypher queries
    this.queries = {
      // Block queries
      BLOCK_QUERY: `
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
            block.nonce=$nonce

        // Create Chain - create prevblock node if it doesn't exist
        MERGE (prevblock:block {hash:$prevblock})
        MERGE (block)-[:chain]->(prevblock)

        // Set Height if prevblock has height, otherwise mark as orphan
        FOREACH (h IN CASE WHEN prevblock.height IS NOT NULL THEN [prevblock.height] ELSE [] END |
          SET block.height = h + 1
        )

        // Return
        RETURN block.height as height, block.prevblock as prevblock
      `,
      
      GENESIS_BLOCK_QUERY: `
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
            block.height=0

        // Return
        RETURN block.height as height, block.prevblock as prevblock
      `,
      
      // Transaction queries
      TRANSACTION_QUERY: `
        // Create Transaction
        MATCH (block :block {hash:$blockhash})
        MERGE (tx:tx {txid:$txid})
        MERGE (tx)-[:inc {i:$t}]->(block)
        SET tx += $tx

        // Inputs
        WITH tx
        FOREACH (input in $inputs |
            MERGE (in :output {index: input.index})
            MERGE (in)-[:in {vin: input.vin, scriptSig: input.scriptSig, sequence: input.sequence, witness: input.witness}]->(tx)
            REMOVE in:unspent
        )

        // Outputs
        FOREACH (output in $outputs |
            MERGE (out :output {index: output.index})
            MERGE (tx)-[:out {vout: output.vout}]->(out)
            // This uses the foreach hack to only create an address node if the address value is not an empty string
            FOREACH(ignoreMe IN CASE WHEN output.addresses <> '' THEN [1] ELSE [] END |
                MERGE (address :address {address: output.addresses})
                MERGE (out)-[:locked]->(address)
            )

            MERGE (out)-[:in]->(existing)
            ON CREATE SET
                out.value= output.value,
                out.scriptPubKey= output.scriptPubKey
            ON MATCH SET
                out.value= output.value,
                out.scriptPubKey= output.scriptPubKey,
                existing.fee = existing.fee + output.value
        )

        // Fee
        WITH tx
        MATCH (i :output)-[:in]->(tx)
        WITH tx, sum(i.value) - $outtotal as fee
        SET tx.fee=fee

        // Return
        RETURN fee
      `,
      
      COINBASE_TRANSACTION_QUERY: `
        // Create Transaction
        MATCH (block :block {hash:$blockhash})-[:coinbase]->(coinbase :coinbase)
        MERGE (tx:tx {txid:$txid})
        MERGE (tx)-[:inc {i:$t}]->(block)
        SET tx += $tx

        // Coinbase Input
        MERGE (coinbase)-[coinbasein:in {vin:0, scriptSig:$coinbase_script, sequence:$coinbase_sequence}]->(tx)
        FOREACH (input in $inputs |
          SET coinbasein.witness = input.witness
        )

        // Outputs
        WITH tx
        FOREACH (output in $outputs |
          MERGE (out :output {index: output.index})
          MERGE (tx)-[:out {vout: output.vout}]->(out)
          // This uses the foreach hack to only create an address node if the address value is not an empty string
          FOREACH(ignoreMe IN CASE WHEN output.addresses <> '' THEN [1] ELSE [] END |
            MERGE (address :address {address: output.addresses})
            MERGE (out)-[:locked]->(address)
          )

          MERGE (out)-[:in]->(existing)
          ON CREATE SET
            out.value= output.value,
            out.scriptPubKey= output.scriptPubKey
          ON MATCH SET
            out.value= output.value,
            out.scriptPubKey= output.scriptPubKey,
            existing.fee = existing.fee + output.value
        )

        // Fee
        WITH tx
        MATCH (i :output)-[:in]->(tx)
        WITH tx, sum(i.value) - $outtotal as fee
        SET tx.fee=fee

        // Return
        RETURN fee
      `,
      
      // Query to check if a block exists
      BLOCK_EXISTS_QUERY: `
        MATCH (b:block {hash: $hash})
        RETURN b.hash as hash
      `,
      
      // Query to get block hash at a specific height
      BLOCK_HASH_AT_HEIGHT_QUERY: `
        MATCH (b:block {height: $height})
        RETURN b.hash as hash
      `,
      
      // Query to get orphan blocks
      ORPHAN_BLOCKS_QUERY: `
        MATCH (b:block)
        WHERE b.height IS NULL
        RETURN b.hash as hash, b.prevblock as prevblock
      `,
      
      // Query to update block height
      UPDATE_BLOCK_HEIGHT_QUERY: `
        MATCH (block:block {hash: $hash})-[:chain]->(prevblock:block)
        WHERE prevblock.height IS NOT NULL
        SET block.height = prevblock.height + 1
        RETURN block.height as height
      `,
      
      // Query to update chain heights
      UPDATE_CHAIN_HEIGHTS_QUERY: `
        MATCH (start:block {hash: $hash})<-[:chain*]-(blocks:block)
        WHERE start.height IS NOT NULL
        WITH blocks, start
        MATCH (blocks)-[:chain]->(parent:block)
        WHERE parent.height IS NOT NULL
        SET blocks.height = parent.height + 1
        RETURN collect(blocks.hash) as updated
      `,
      
      // Queries to create constraints and indexes (separated)
      CREATE_BLOCK_HASH_CONSTRAINT: `
        CREATE CONSTRAINT block_hash_unique IF NOT EXISTS FOR (b:block) REQUIRE b.hash IS UNIQUE
      `,
      CREATE_TX_TXID_CONSTRAINT: `
        CREATE CONSTRAINT tx_txid_unique IF NOT EXISTS FOR (tx:tx) REQUIRE tx.txid IS UNIQUE
      `,
      CREATE_OUTPUT_INDEX_CONSTRAINT: `
        CREATE CONSTRAINT output_index_unique IF NOT EXISTS FOR (o:output) REQUIRE o.index IS UNIQUE
      `,
      CREATE_ADDRESS_CONSTRAINT: `
        CREATE CONSTRAINT address_address_unique IF NOT EXISTS FOR (a:address) REQUIRE a.address IS UNIQUE
      `,
      CREATE_BLOCK_HEIGHT_INDEX: `
        CREATE INDEX block_height_index IF NOT EXISTS FOR (b:block) ON (b.height)
      `,
      CREATE_ADDRESS_INDEX: `
        CREATE INDEX address_index IF NOT EXISTS FOR (a:address) ON (a.address)
      `
    };
  }

  /**
   * Run a Cypher query
   * @param {string} query - Cypher query
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async runQuery(query, params = {}) {
    const session = this.driver.session();
    try {
      const result = await session.run(query, params);
      return result;
    } catch (error) {
      logger.error('Error running Cypher query', error, { query, params });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Initialize the database with constraints and indexes
   * @returns {Promise<void>}
   */
  async initializeDatabase() {
    try {
      // Run each constraint and index creation query separately
      const constraintQueries = [
        this.queries.CREATE_BLOCK_HASH_CONSTRAINT,
        this.queries.CREATE_TX_TXID_CONSTRAINT,
        this.queries.CREATE_OUTPUT_INDEX_CONSTRAINT,
        this.queries.CREATE_ADDRESS_CONSTRAINT,
        this.queries.CREATE_BLOCK_HEIGHT_INDEX,
        this.queries.CREATE_ADDRESS_INDEX
      ];
      
      for (const query of constraintQueries) {
        try {
          await this.runQuery(query);
          logger.info(`Successfully executed: ${query.trim()}`);
        } catch (error) {
          logger.warn(`Error executing query: ${query.trim()}`, error);
          // Continue with other queries even if one fails
        }
      }
      
      logger.info('Database initialized with constraints and indexes');
    } catch (error) {
      logger.error('Error initializing database', error);
      throw error;
    }
  }

  /**
   * Store a block in Neo4j
   * @param {Object} blockParams - Block parameters
   * @returns {Promise<Object>} - Block height and previous block hash
   */
  async storeBlock(blockParams) {
    try {
      // Check if this is the genesis block
      const isGenesis = blockParams.prevblock === '0000000000000000000000000000000000000000000000000000000000000000';
      
      // Select the appropriate query
      const query = isGenesis ? this.queries.GENESIS_BLOCK_QUERY : this.queries.BLOCK_QUERY;
      
      // Execute the query
      const result = await this.runQuery(query, blockParams);
      
      if (result.records.length === 0) {
        return {
          height: null,
          prevblock: blockParams.prevblock
        };
      }
      
      const record = result.records[0];
      return {
        height: record.get('height') ? record.get('height').toNumber() : null,
        prevblock: record.get('prevblock')
      };
    } catch (error) {
      logger.error('Error storing block', error, { blockHash: blockParams.blockhash });
      throw error;
    }
  }

  /**
   * Store a transaction in Neo4j
   * @param {Object} txParams - Transaction parameters
   * @returns {Promise<number>} - Transaction fee
   */
  async storeTransaction(txParams) {
    try {
      // Execute the query
      const result = await this.runQuery(this.queries.TRANSACTION_QUERY, txParams);
      
      if (result.records.length === 0) {
        return null;
      }
      
      const record = result.records[0];
      const fee = record.get('fee');
      return fee ? (typeof fee.toNumber === 'function' ? fee.toNumber() : fee) : null;
    } catch (error) {
      logger.error('Error storing transaction', error, { txid: txParams.txid });
      throw error;
    }
  }

  /**
   * Store a coinbase transaction in Neo4j
   * @param {Object} txParams - Transaction parameters
   * @returns {Promise<number>} - Transaction fee
   */
  async storeCoinbaseTransaction(txParams) {
    try {
      // Execute the query
      const result = await this.runQuery(this.queries.COINBASE_TRANSACTION_QUERY, txParams);
      
      if (result.records.length === 0) {
        return null;
      }
      
      const record = result.records[0];
      const fee = record.get('fee');
      return fee ? (typeof fee.toNumber === 'function' ? fee.toNumber() : fee) : null;
    } catch (error) {
      logger.error('Error storing coinbase transaction', error, { txid: txParams.txid });
      throw error;
    }
  }

  /**
   * Check if a block exists in Neo4j
   * @param {string} blockHash - Block hash
   * @returns {Promise<boolean>} - True if the block exists
   */
  async blockExists(blockHash) {
    try {
      const result = await this.runQuery(this.queries.BLOCK_EXISTS_QUERY, { hash: blockHash });
      return result.records.length > 0;
    } catch (error) {
      logger.error('Error checking if block exists', error, { blockHash });
      throw error;
    }
  }

  /**
   * Get the block hash at a specific height
   * @param {number} height - Block height
   * @returns {Promise<string|null>} - Block hash or null if not found
   */
  async getBlockHashAtHeight(height) {
    try {
      const result = await this.runQuery(this.queries.BLOCK_HASH_AT_HEIGHT_QUERY, { height });
      
      if (result.records.length === 0) {
        return null;
      }
      
      return result.records[0].get('hash');
    } catch (error) {
      logger.error('Error getting block hash at height', error, { height });
      throw error;
    }
  }

  /**
   * Get orphan blocks (blocks with no height)
   * @returns {Promise<Object[]>} - Array of orphan blocks
   */
  async getOrphanBlocks() {
    try {
      const result = await this.runQuery(this.queries.ORPHAN_BLOCKS_QUERY);
      
      return result.records.map(record => ({
        hash: record.get('hash'),
        prevblock: record.get('prevblock')
      }));
    } catch (error) {
      logger.error('Error getting orphan blocks', error);
      throw error;
    }
  }

  /**
   * Update a block's height based on its parent
   * @param {string} blockHash - Block hash
   * @returns {Promise<number|null>} - New block height or null if not updated
   */
  async updateBlockHeight(blockHash) {
    try {
      const result = await this.runQuery(this.queries.UPDATE_BLOCK_HEIGHT_QUERY, { hash: blockHash });
      
      if (result.records.length === 0) {
        return null;
      }
      
      return result.records[0].get('height').toNumber();
    } catch (error) {
      logger.error('Error updating block height', error, { blockHash });
      throw error;
    }
  }

  /**
   * Update heights of blocks in a chain
   * @param {string} blockHash - Hash of the starting block
   * @returns {Promise<string[]>} - Array of updated block hashes
   */
  async updateChainHeights(blockHash) {
    try {
      const result = await this.runQuery(this.queries.UPDATE_CHAIN_HEIGHTS_QUERY, { hash: blockHash });
      
      if (result.records.length === 0) {
        return [];
      }
      
      return result.records[0].get('updated');
    } catch (error) {
      logger.error('Error updating chain heights', error, { blockHash });
      throw error;
    }
  }

  /**
   * Close the Neo4j driver
   * @returns {Promise<void>}
   */
  async close() {
    try {
      await this.driver.close();
      logger.info('Neo4j driver closed');
    } catch (error) {
      logger.error('Error closing Neo4j driver', error);
      throw error;
    }
  }
}

module.exports = Neo4jService;