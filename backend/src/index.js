/**
 * Backend server entry point
 * Provides API endpoints for querying the Neo4j database
 */
require('dotenv').config();
const express = require('express');
const { appConfig } = require('./config');
const { logger } = require('./utils');
const { Neo4jService, SandshrewApi } = require('./services');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', appConfig.cors.origin);
  res.header('Access-Control-Allow-Methods', appConfig.cors.methods.join(', '));
  res.header('Access-Control-Allow-Headers', appConfig.cors.allowedHeaders.join(', '));
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Create services
const neo4jService = new Neo4jService();
const sandshrewApi = new SandshrewApi();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.get('/api/blocks/latest', async (req, res) => {
  try {
    const blockCount = await sandshrewApi.getBlockCount();
    const blockHash = await sandshrewApi.getBlockHash(blockCount);
    const block = await sandshrewApi.getBlock(blockHash);
    
    res.json({
      height: blockCount,
      hash: blockHash,
      block
    });
  } catch (error) {
    logger.error('Error getting latest block', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blocks/:height', async (req, res) => {
  try {
    const height = parseInt(req.params.height, 10);
    
    if (isNaN(height)) {
      return res.status(400).json({ error: 'Invalid block height' });
    }
    
    const blockHash = await sandshrewApi.getBlockHash(height);
    const block = await sandshrewApi.getBlock(blockHash);
    
    res.json(block);
  } catch (error) {
    logger.error(`Error getting block at height ${req.params.height}`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blocks/hash/:hash', async (req, res) => {
  try {
    const hash = req.params.hash;
    const block = await sandshrewApi.getBlock(hash);
    
    res.json(block);
  } catch (error) {
    logger.error(`Error getting block with hash ${req.params.hash}`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions/:txid', async (req, res) => {
  try {
    const txid = req.params.txid;
    const tx = await sandshrewApi.getTransaction(txid);
    
    res.json(tx);
  } catch (error) {
    logger.error(`Error getting transaction ${req.params.txid}`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/addresses/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const addressInfo = await sandshrewApi.getAddressInfo(address);
    
    res.json(addressInfo);
  } catch (error) {
    logger.error(`Error getting address info for ${req.params.address}`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/addresses/:address/transactions', async (req, res) => {
  try {
    const address = req.params.address;
    const transactions = await sandshrewApi.getAddressTransactions(address);
    
    res.json(transactions);
  } catch (error) {
    logger.error(`Error getting transactions for address ${req.params.address}`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/addresses/:address/utxos', async (req, res) => {
  try {
    const address = req.params.address;
    const utxos = await sandshrewApi.getAddressUtxos(address);
    
    res.json(utxos);
  } catch (error) {
    logger.error(`Error getting UTXOs for address ${req.params.address}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Neo4j graph query endpoints
app.get('/api/graph/blocks/latest', async (req, res) => {
  try {
    const result = await neo4jService.runQuery(`
      MATCH (b:block)
      WHERE b.height IS NOT NULL
      RETURN b
      ORDER BY b.height DESC
      LIMIT 10
    `);
    
    const blocks = result.records.map(record => record.get('b').properties);
    
    res.json(blocks);
  } catch (error) {
    logger.error('Error getting latest blocks from Neo4j', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/graph/blocks/:height', async (req, res) => {
  try {
    const height = parseInt(req.params.height, 10);
    
    if (isNaN(height)) {
      return res.status(400).json({ error: 'Invalid block height' });
    }
    
    const result = await neo4jService.runQuery(`
      MATCH (b:block {height: $height})
      RETURN b
    `, { height });
    
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }
    
    const block = result.records[0].get('b').properties;
    
    res.json(block);
  } catch (error) {
    logger.error(`Error getting block at height ${req.params.height} from Neo4j`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/graph/transactions/:txid', async (req, res) => {
  try {
    const txid = req.params.txid;
    
    const result = await neo4jService.runQuery(`
      MATCH (tx:tx {txid: $txid})
      OPTIONAL MATCH (tx)-[:inc]->(b:block)
      RETURN tx, b
    `, { txid });
    
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const tx = result.records[0].get('tx').properties;
    const block = result.records[0].get('b')?.properties || null;
    
    res.json({ ...tx, block });
  } catch (error) {
    logger.error(`Error getting transaction ${req.params.txid} from Neo4j`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/graph/addresses/:address', async (req, res) => {
  try {
    const address = req.params.address;
    
    const result = await neo4jService.runQuery(`
      MATCH (a:address {address: $address})
      OPTIONAL MATCH (o:output)-[:locked]->(a)
      WHERE NOT EXISTS((o)-[:in]->(:tx))
      RETURN a, collect(o) as utxos
    `, { address });
    
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    const addressNode = result.records[0].get('a').properties;
    const utxos = result.records[0].get('utxos').map(utxo => utxo.properties);
    
    // Calculate balance
    const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    res.json({
      ...addressNode,
      balance,
      utxos
    });
  } catch (error) {
    logger.error(`Error getting address ${req.params.address} from Neo4j`, error);
    res.status(500).json({ error: error.message });
  }
});

// Path finding between addresses (without APOC)
app.get('/api/graph/path/addresses', async (req, res) => {
  try {
    const { source, target, maxDepth = 4 } = req.query;
    
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target addresses are required' });
    }
    
    // Use a standard shortest path query instead of APOC
    const result = await neo4jService.runQuery(`
      MATCH (source:address {address: $source}), (target:address {address: $target})
      MATCH path = shortestPath((source)-[:locked|in|out*..${parseInt(maxDepth, 10) * 2}]-(target))
      RETURN path
      LIMIT 1
    `, { source, target });
    
    if (result.records.length === 0) {
      return res.json({ found: false });
    }
    
    const path = result.records[0].get('path');
    const nodes = path.segments.map(segment => segment.start).concat([path.end]);
    const relationships = path.segments.map(segment => segment.relationship);
    
    res.json({
      found: true,
      path: {
        nodes: nodes.map(node => ({
          id: node.identity.toNumber(),
          labels: node.labels,
          properties: node.properties
        })),
        relationships: relationships.map(rel => ({
          id: rel.identity.toNumber(),
          type: rel.type,
          properties: rel.properties,
          startNodeId: rel.start.toNumber(),
          endNodeId: rel.end.toNumber()
        }))
      }
    });
  } catch (error) {
    logger.error(`Error finding path between addresses`, error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const PORT = appConfig.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

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