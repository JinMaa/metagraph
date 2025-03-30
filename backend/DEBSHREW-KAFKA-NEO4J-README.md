# Debshrew Kafka Neo4j Integration

This integration connects Debshrew with Neo4j using Kafka as a message broker. It allows for real-time synchronization of Bitcoin data from Metashrew to Neo4j using Change Data Capture (CDC) events.

## Architecture

The integration follows this architecture:

```
Metashrew → Debshrew → Kafka → Kafka Connect → Neo4j
```

- **Metashrew**: Indexes Bitcoin blockchain data and provides views
- **Debshrew**: Processes data from Metashrew and generates CDC events
- **Kafka**: Acts as a message broker for CDC events
- **Kafka Connect**: Connects Kafka to Neo4j using the Neo4j Sink Connector
- **Neo4j**: Stores Bitcoin data in a graph database

## Prerequisites

- Docker and Docker Compose
- Rust 1.70 or later
- Node.js 14 or later
- A running Metashrew instance

## Setup

1. Make sure Metashrew is running:
   ```
   ./metashrew/target/release/rockshrew-mono --daemon-rpc-url https://mainnet.sandshrew.io/v2/lasereyes --indexer ./alkanes-rs/target/wasm32-unknown-unknown/release/alkanes.wasm --db-path ./.metashrew --host 0.0.0.0 --port 8080 --start-block 880000 --cors '*'
   ```

2. Run the setup script:
   ```
   cd backend
   chmod +x setup-debshrew-kafka-neo4j.sh
   ./setup-debshrew-kafka-neo4j.sh
   ```

3. Run Debshrew:
   ```
   cd backend/debshrew
   cargo run --release -- run --config ../debshrew-config.json
   ```

## Components

### Docker Compose Services

The `docker-compose.yml` file includes the following services:

- **Neo4j**: Graph database for storing Bitcoin data
- **Zookeeper**: Required for Kafka
- **Kafka**: Message broker for CDC events
- **Schema Registry**: For managing CDC event schemas
- **Kafka Connect**: For connecting Kafka to Neo4j
- **Kafka UI**: For monitoring Kafka

### Debshrew Configuration

The `debshrew-config.json` file configures Debshrew to:

- Connect to Metashrew
- Use the transform module
- Output CDC events to a single Kafka topic named "debshrew.cdc"

### Transform Module

The transform module in `debshrew/examples/simple-transform/src/lib.rs` is responsible for:

- Querying Metashrew for block and transaction data
- Generating CDC events for blocks, transactions, inputs, and outputs
- Handling reorgs by generating inverse CDC events

### Neo4j Sink Connector

The Neo4j Sink Connector in `neo4j-sink-config.json` is configured to:

- Consume CDC events from the "debshrew.cdc" Kafka topic
- Use APOC procedures to route different event types to appropriate Cypher queries
- Execute Cypher queries against Neo4j based on the event's table field
- Create or update nodes and relationships in the graph model

## Monitoring

- Neo4j Browser: http://localhost:7474
- Kafka UI: http://localhost:8084

## Troubleshooting

- Check Kafka Connect logs: `docker logs kafka-connect`
- Check Neo4j logs: `docker logs bitcoin-neo4j`
- Check Debshrew logs: Look at the console output when running Debshrew
- Common issues:
  - If you see "missing field `topic`" error, make sure the debshrew-config.json has a "topic" field in the sink section
  - If Kafka Connect fails to start, check if the Neo4j Sink Connector is installed correctly

## Data Flow

1. Metashrew indexes Bitcoin blocks and transactions
2. Debshrew queries Metashrew for block and transaction data
3. The transform module generates CDC events with a "table" field indicating the event type (blocks, transactions, inputs, outputs)
4. CDC events are published to the "debshrew.cdc" Kafka topic
5. Kafka Connect consumes CDC events and routes them to appropriate Cypher queries based on the "table" field
6. Neo4j stores the data in a graph model

## Neo4j Graph Model

The Neo4j graph model consists of:

- **Nodes**:
  - `block`: Represents a Bitcoin block
  - `tx`: Represents a Bitcoin transaction
  - `output`: Represents a transaction output
  - `address`: Represents a Bitcoin address

- **Relationships**:
  - `[:chain]`: Connects a block to its previous block
  - `[:inc]`: Connects a transaction to the block it's included in
  - `[:in]`: Connects an output (as input) to a transaction
  - `[:out]`: Connects a transaction to its outputs
  - `[:locked]`: Connects an output to the address it's locked to

## Customization

- Modify `debshrew-config.json` to change Debshrew configuration
- Modify `neo4j-sink-config.json` to change Neo4j Sink Connector configuration
- Modify the transform module in `debshrew/examples/simple-transform/src/lib.rs` to change how CDC events are generated