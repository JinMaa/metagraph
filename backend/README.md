# Bitcoin Neo4j Backend

This backend service provides a bridge between the Bitcoin blockchain and a Neo4j graph database. It fetches data from the Bitcoin blockchain using the Sandshrew API and stores it in Neo4j for efficient graph-based querying.

## Features

- Import blocks and transactions from the Bitcoin blockchain
- Store blockchain data in a Neo4j graph database
- Resolve orphan blocks and handle chain reorganizations
- Provide REST API endpoints for querying the blockchain data
- Support for path finding between addresses
- Continuous blockchain synchronization

## Prerequisites

- Node.js (v16+)
- Neo4j Database (v4.4+)
- Sandshrew API access

## Installation

1. Clone the repository
2. Install dependencies:

```bash
cd backend
npm install
```

3. Create a `.env` file based on `.env.template`:

```bash
cp .env.template .env
```

4. Update the `.env` file with your Neo4j credentials and Sandshrew API URL.

## Configuration

The following environment variables can be configured in the `.env` file:

### Neo4j Configuration
- `NEO4J_URI`: Neo4j connection URI (default: bolt://localhost:7687)
- `NEO4J_USER`: Neo4j username (default: neo4j)
- `NEO4J_PASSWORD`: Neo4j password (default: password)

### Sandshrew API Configuration
- `SANDSHREW_URL`: Sandshrew API base URL (default: https://oylnet.oyl.gg)
- `SANDSHREW_NETWORK`: Sandshrew API network (default: oylnet)

### Application Configuration
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## Usage

### Initialize the Database

Before importing any data, initialize the Neo4j database with the required constraints and indexes:

```bash
npm run init-db
```

### Import Blocks

Import blocks from a specific height:

```bash
npm run import-blocks [startHeight] [endHeight] [batchSize]
```

- `startHeight`: Starting block height (default: 0)
- `endHeight`: Ending block height (optional)
- `batchSize`: Number of blocks to process in a batch (optional)

### Resolve Orphan Blocks

Resolve orphan blocks (blocks with unknown parent):

```bash
npm run resolve-orphans
```

### Detect Chain Reorganizations

Detect and handle chain reorganizations at a specific height or range:

```bash
npm run detect-reorg [startHeight] [endHeight]
```

- `startHeight`: Starting block height
- `endHeight`: Ending block height (optional, defaults to startHeight)

### Continuous Blockchain Sync

Keep the Neo4j database in sync with the blockchain:

```bash
npm run sync-chain [startHeight] [interval]
```

- `startHeight`: Starting block height (default: 0)
- `interval`: Sync interval in milliseconds (default: 60000)

### Start the API Server

Start the REST API server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## Testing the Setup

To test the setup, follow these steps:

1. Make sure Neo4j is running and accessible with the credentials in your `.env` file.

2. Initialize the database:

```bash
npm run init-db
```

3. Import a few blocks to test the import process:

```bash
npm run import-blocks 0 10
```

This will import the first 10 blocks from the blockchain.

4. Start the API server:

```bash
npm start
```

5. Test the API endpoints:

```bash
# Get the latest block
curl http://localhost:3000/api/blocks/latest

# Get a specific block by height
curl http://localhost:3000/api/blocks/5

# Get blocks from Neo4j
curl http://localhost:3000/api/graph/blocks/latest
```

## API Endpoints

### Blockchain Data

- `GET /api/blocks/latest`: Get the latest block
- `GET /api/blocks/:height`: Get block by height
- `GET /api/blocks/hash/:hash`: Get block by hash
- `GET /api/transactions/:txid`: Get transaction by ID
- `GET /api/addresses/:address`: Get address information
- `GET /api/addresses/:address/transactions`: Get transactions for an address
- `GET /api/addresses/:address/utxos`: Get UTXOs for an address

### Neo4j Graph Queries

- `GET /api/graph/blocks/latest`: Get latest blocks from Neo4j
- `GET /api/graph/blocks/:height`: Get block by height from Neo4j
- `GET /api/graph/transactions/:txid`: Get transaction by ID from Neo4j
- `GET /api/graph/addresses/:address`: Get address information from Neo4j
- `GET /api/graph/path/addresses?source=<address1>&target=<address2>&maxDepth=<depth>`: Find path between addresses

## Graph Data Model

The Neo4j graph database uses the following data model:

### Node Labels

- `:block`: Bitcoin blocks
- `:tx`: Bitcoin transactions
- `:output`: Transaction outputs (UTXOs)
- `:address`: Bitcoin addresses
- `:coinbase`: Special outputs for block rewards

### Relationships

- `[:chain]`: Connects a block to its previous block
- `[:inc]`: Connects a transaction to the block it's included in
- `[:in]`: Connects an output to the transaction that spends it
- `[:out]`: Connects a transaction to the outputs it creates
- `[:locked]`: Connects an output to the address it's locked to
- `[:coinbase]`: Connects a block to its coinbase output

## Example Cypher Queries

### Get the latest blocks

```cypher
MATCH (b:block)
WHERE b.height IS NOT NULL
RETURN b
ORDER BY b.height DESC
LIMIT 10
```

### Get transactions in a block

```cypher
MATCH (b:block {height: 123456})<-[:inc]-(tx:tx)
RETURN tx
ORDER BY tx.txid
```

### Get UTXOs for an address

```cypher
MATCH (a:address {address: "bc1q..."})<-[:locked]-(o:output)
WHERE NOT EXISTS((o)-[:in]->(:tx))
RETURN o
```

### Find path between addresses

```cypher
MATCH (source:address {address: "bc1q..."}), (target:address {address: "bc1q..."})
MATCH path = shortestPath((source)-[:locked|in|out*..8]-(target))
RETURN path
LIMIT 1
```

## License

ISC