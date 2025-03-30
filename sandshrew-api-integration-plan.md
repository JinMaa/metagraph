# Sandshrew API Integration Plan for Neo4j Backend

Based on your feedback, we'll use the Sandshrew API exclusively for all Bitcoin data needs, as it provides Esplora functionality through a JSON-RPC interface. This simplifies our architecture by using a single API endpoint for all blockchain data.

## Sandshrew API Overview

Sandshrew provides a JSON-RPC interface that maps to Esplora REST endpoints. The JSON-RPC method follows this pattern:

```
esplora_[path_component1]::[path_component2]::...
```

Where empty components (`::`) are placeholders for parameters. For example:

```json
{    
    "jsonrpc": "2.0", 
    "id": 1, 
    "method": "esplora_address::txs",
    "params": [
      "bc1pqu8j3dlfwjkzt6tcx6w2dvf9j4wxku2n7mnp9eawegayu6k6x9xsgsff7n"
    ]
}
```

This maps to the Esplora REST endpoint: `/address/bc1pqu8j3dlfwjkzt6tcx6w2dvf9j4wxku2n7mnp9eawegayu6k6x9xsgsff7n/txs`

## Simplified API Client

We'll create a simplified Sandshrew API client that handles all our Bitcoin data needs:

```javascript
// src/services/sandshrewApi.js
class SandshrewApi {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.projectId = config.projectId;
    this.network = config.network;
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Project-ID': this.projectId
      }
    });
    this.requestId = 1;
  }

  async callRpc(method, params = []) {
    try {
      const response = await this.httpClient.post('/', {
        jsonrpc: '2.0',
        id: this.requestId++,
        method,
        params
      });
      
      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }
      
      return response.data.result;
    } catch (error) {
      console.error(`Error calling ${method}:`, error);
      throw error;
    }
  }

  // Block methods
  async getBlockHash(height) {
    return this.callRpc('esplora_block-height::', [height]);
  }

  async getBlock(hash, verbosity = 1) {
    return this.callRpc('esplora_block::', [hash]);
  }

  async getBlockHeader(hash) {
    return this.callRpc('esplora_block::header', [hash]);
  }

  async getBlockStatus(hash) {
    return this.callRpc('esplora_block::status', [hash]);
  }

  async getBlockTxids(hash) {
    return this.callRpc('esplora_block::txids', [hash]);
  }

  async getBlockTxs(hash, startIndex = 0) {
    return this.callRpc('esplora_block::txs::', [hash, startIndex]);
  }

  async getBlockCount() {
    return this.callRpc('esplora_blocks_tip::height');
  }

  // Transaction methods
  async getTransaction(txid) {
    return this.callRpc('esplora_tx::', [txid]);
  }

  async getRawTransaction(txid) {
    return this.callRpc('esplora_tx::raw', [txid]);
  }

  async getTransactionStatus(txid) {
    return this.callRpc('esplora_tx::status', [txid]);
  }

  async getTransactionOutspend(txid, vout) {
    return this.callRpc('esplora_tx::outspend::', [txid, vout]);
  }

  async getTransactionMerkleProof(txid) {
    return this.callRpc('esplora_tx::merkle-proof', [txid]);
  }

  // Address methods
  async getAddressInfo(address) {
    return this.callRpc('esplora_address::', [address]);
  }

  async getAddressTransactions(address) {
    return this.callRpc('esplora_address::txs', [address]);
  }

  async getAddressUtxos(address) {
    return this.callRpc('esplora_address::utxo', [address]);
  }

  // Mempool methods
  async getMempoolTransactions(address) {
    return this.callRpc('esplora_address::txs::mempool', [address]);
  }
}
```

## Caching Layer

We'll add a simple caching layer to reduce API calls:

```javascript
// src/services/cachedSandshrewApi.js
class CachedSandshrewApi {
  constructor(sandshrewApi, options = {}) {
    this.api = sandshrewApi;
    this.cache = new Map();
    this.ttl = {
      block: options.blockTtl || 3600000, // 1 hour
      tx: options.txTtl || 3600000,       // 1 hour
      address: options.addressTtl || 300000, // 5 minutes
      blockCount: options.blockCountTtl || 60000 // 1 minute
    };
  }

  async getCached(key, ttl, fetchFn) {
    const cacheItem = this.cache.get(key);
    
    if (cacheItem && Date.now() < cacheItem.expiry) {
      return cacheItem.data;
    }
    
    const data = await fetchFn();
    
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
    
    return data;
  }

  // Block methods with caching
  async getBlockHash(height) {
    return this.getCached(
      `block-hash:${height}`,
      this.ttl.block,
      () => this.api.getBlockHash(height)
    );
  }

  async getBlock(hash) {
    return this.getCached(
      `block:${hash}`,
      this.ttl.block,
      () => this.api.getBlock(hash)
    );
  }

  // Add similar methods for other API calls
}
```

## Block Processing Service

We'll create a service to process blocks sequentially and store them in Neo4j:

```javascript
// src/services/blockProcessor.js
class BlockProcessor {
  constructor(sandshrewApi, neo4jService, options = {}) {
    this.api = sandshrewApi;
    this.neo4j = neo4jService;
    this.options = {
      batchSize: options.batchSize || 10,
      concurrency: options.concurrency || 3,
      ...options
    };
  }

  async processBlockRange(startHeight, endHeight) {
    console.log(`Processing blocks from ${startHeight} to ${endHeight}`);
    
    for (let height = startHeight; height <= endHeight; height += this.options.batchSize) {
      const endBatch = Math.min(height + this.options.batchSize - 1, endHeight);
      await this.processBatch(height, endBatch);
    }
  }

  async processBatch(startHeight, endHeight) {
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
  }

  async processBlock(height) {
    try {
      // Get block hash
      const hash = await this.api.getBlockHash(height);
      
      // Get block data
      const block = await this.api.getBlock(hash);
      
      // Store block in Neo4j
      await this.neo4j.storeBlock({
        blockhash: block.id,
        blocksize: block.size,
        txcount: block.tx_count,
        version: block.version,
        prevblock: block.previousblockhash,
        merkleroot: block.merkle_root,
        timestamp: block.timestamp,
        bits: block.bits,
        nonce: block.nonce
      });
      
      // Get and process transactions
      const txids = await this.api.getBlockTxids(hash);
      
      for (let i = 0; i < txids.length; i++) {
        await this.processTransaction(txids[i], hash, i);
      }
      
      console.log(`Processed block ${height} (${hash})`);
      return block;
    } catch (error) {
      console.error(`Error processing block ${height}:`, error);
      throw error;
    }
  }

  async processTransaction(txid, blockHash, index) {
    try {
      // Get transaction data
      const tx = await this.api.getTransaction(txid);
      
      // Check if this is a coinbase transaction
      const isCoinbase = tx.vin[0].is_coinbase;
      
      // Prepare transaction parameters
      const txParams = {
        txid,
        blockhash: blockHash,
        t: index,
        tx: {
          version: tx.version,
          locktime: tx.locktime,
          size: tx.size
        },
        inputs: tx.vin.map((input, i) => ({
          vin: i,
          index: input.txid ? `${input.txid}:${input.vout}` : '0000000000000000000000000000000000000000000000000000000000000000:4294967295',
          scriptSig: input.scriptsig || '',
          sequence: input.sequence,
          witness: input.witness ? input.witness.join('') : ''
        })),
        outputs: tx.vout.map((output, i) => ({
          vout: i,
          index: `${txid}:${i}`,
          value: output.value,
          scriptPubKey: output.scriptpubkey,
          addresses: output.scriptpubkey_address || ''
        })),
        outtotal: tx.vout.reduce((sum, output) => sum + output.value, 0)
      };
      
      // Store transaction in Neo4j
      if (isCoinbase) {
        txParams.coinbase_script = tx.vin[0].scriptsig || '';
        txParams.coinbase_sequence = tx.vin[0].sequence;
        await this.neo4j.storeCoinbaseTransaction(txParams);
      } else {
        await this.neo4j.storeTransaction(txParams);
      }
      
      console.log(`Processed transaction ${txid}`);
    } catch (error) {
      console.error(`Error processing transaction ${txid}:`, error);
      throw error;
    }
  }
}
```

## Neo4j Service

The Neo4j service will remain largely the same as in our revised architecture plan, using the Cypher queries we've already defined.

## Configuration

We'll simplify the configuration to focus on Sandshrew:

```javascript
// src/config/sandshrew.js
const config = {
  development: {
    baseUrl: 'https://oylnet.oyl.gg',
    projectId: process.env.VITE_SANDSHREW_PROJECT_ID || 'lasereyes',
    network: 'oylnet'
  },
  production: {
    baseUrl: 'https://mainnet.sandshrew.io',
    projectId: process.env.VITE_SANDSHREW_PROJECT_ID || 'lasereyes',
    network: 'mainnet'
  }
};

export default config[process.env.NODE_ENV || 'development'];
```

## Implementation Steps

1. **Set up Neo4j Database**
   - Install Neo4j (Docker container for development)
   - Create constraints and indexes for efficient querying
   - Define Cypher queries for blocks, transactions, and addresses

2. **Implement Sandshrew API Client**
   - Create the SandshrewApi class
   - Add caching layer
   - Implement error handling and retries

3. **Create Block Processing Service**
   - Implement sequential block processing
   - Handle transaction processing
   - Connect to Neo4j service

4. **Create Command-Line Scripts**
   - Script to import blocks from a specific height
   - Script to sync the chain continuously
   - Script to resolve orphan blocks

5. **Testing and Optimization**
   - Test with a small subset of blocks
   - Optimize queries and indexing
   - Measure performance and adjust batch sizes

## Handling Chain Reorganizations

Since we're using the Sandshrew API, we'll rely on it to provide the canonical chain. However, we still need to handle chain reorganizations in our Neo4j database:

1. **Track the Main Chain**
   - Mark blocks with a `mainchain` property
   - Update this property during reorganizations

2. **Detect Reorganizations**
   - Periodically check if the block at a given height has changed
   - If it has, update the chain structure in Neo4j

3. **Update Block Relationships**
   - Update the `[:chain]` relationships to reflect the new chain structure
   - Update block heights accordingly

```javascript
// Example reorganization detection
async function detectReorganization(api, neo4j, height) {
  // Get the current block hash at this height from the API
  const currentHash = await api.getBlockHash(height);
  
  // Get the block hash at this height from Neo4j
  const storedHash = await neo4j.getBlockHashAtHeight(height);
  
  if (currentHash !== storedHash) {
    console.log(`Reorganization detected at height ${height}`);
    console.log(`API hash: ${currentHash}, Stored hash: ${storedHash}`);
    
    // Find the fork point
    let forkHeight = height;
    while (forkHeight > 0) {
      forkHeight--;
      const apiHash = await api.getBlockHash(forkHeight);
      const dbHash = await neo4j.getBlockHashAtHeight(forkHeight);
      
      if (apiHash === dbHash) {
        console.log(`Fork point found at height ${forkHeight}`);
        break;
      }
    }
    
    // Update the chain from the fork point
    await updateChainFromHeight(api, neo4j, forkHeight);
  }
}
```

## Next Steps

1. Set up Neo4j database with the schema defined in our revised architecture plan
2. Implement the Sandshrew API client
3. Create the block processing service
4. Test with a small subset of blocks
5. Implement chain reorganization handling
6. Optimize for performance

This simplified plan focuses exclusively on the Sandshrew API for all Bitcoin data needs, which streamlines our architecture and implementation.