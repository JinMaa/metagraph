# Debshrew Kafka Neo4j Implementation Steps

This document outlines the specific steps and files needed to implement the integration between Debshrew, Kafka, and Neo4j.

## 1. Update Docker Compose File

We'll update the existing docker-compose.yml to include Kafka and related services.

**File: `backend/docker-compose.yml`**

```yaml
version: '3'

services:
  neo4j:
    image: neo4j:4.4
    container_name: bitcoin-neo4j
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_dbms_memory_pagecache_size=1G
      - NEO4J_dbms_memory_heap_initial__size=1G
      - NEO4J_dbms_memory_heap_max__size=2G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins
    restart: unless-stopped
    networks:
      - bitcoin-network

  # Zookeeper - required for Kafka
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    container_name: zookeeper
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    restart: unless-stopped
    networks:
      - bitcoin-network

  # Kafka broker
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    container_name: kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
      - "29092:29092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    restart: unless-stopped
    networks:
      - bitcoin-network

  # Schema Registry - for managing CDC event schemas
  schema-registry:
    image: confluentinc/cp-schema-registry:7.4.0
    container_name: schema-registry
    depends_on:
      - kafka
    ports:
      - "8081:8081"
    environment:
      SCHEMA_REGISTRY_HOST_NAME: schema-registry
      SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: kafka:9092
      SCHEMA_REGISTRY_LISTENERS: http://0.0.0.0:8081
    restart: unless-stopped
    networks:
      - bitcoin-network

  # Kafka Connect - for the Neo4j Sink Connector
  kafka-connect:
    image: confluentinc/cp-kafka-connect:7.4.0
    container_name: kafka-connect
    depends_on:
      - kafka
      - schema-registry
    ports:
      - "8083:8083"
    environment:
      CONNECT_BOOTSTRAP_SERVERS: kafka:9092
      CONNECT_REST_PORT: 8083
      CONNECT_GROUP_ID: "connect-cluster"
      CONNECT_CONFIG_STORAGE_TOPIC: "connect-configs"
      CONNECT_OFFSET_STORAGE_TOPIC: "connect-offsets"
      CONNECT_STATUS_STORAGE_TOPIC: "connect-status"
      CONNECT_CONFIG_STORAGE_REPLICATION_FACTOR: 1
      CONNECT_OFFSET_STORAGE_REPLICATION_FACTOR: 1
      CONNECT_STATUS_STORAGE_REPLICATION_FACTOR: 1
      CONNECT_KEY_CONVERTER: "org.apache.kafka.connect.storage.StringConverter"
      CONNECT_VALUE_CONVERTER: "org.apache.kafka.connect.json.JsonConverter"
      CONNECT_VALUE_CONVERTER_SCHEMAS_ENABLE: "false"
      CONNECT_REST_ADVERTISED_HOST_NAME: "kafka-connect"
      CONNECT_PLUGIN_PATH: "/usr/share/java,/usr/share/confluent-hub-components,/connectors"
    volumes:
      - kafka_connect_plugins:/connectors
    command:
      - bash
      - -c
      - |
        echo "Installing Neo4j Sink Connector..."
        confluent-hub install --no-prompt neo4j/kafka-connect-neo4j:5.0.2
        echo "Launching Kafka Connect..."
        /etc/confluent/docker/run
    restart: unless-stopped
    networks:
      - bitcoin-network

  # Kafka UI - for monitoring Kafka
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: kafka-ui
    depends_on:
      - kafka
      - schema-registry
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
      KAFKA_CLUSTERS_0_SCHEMAREGISTRY: http://schema-registry:8081
      KAFKA_CLUSTERS_0_KAFKACONNECT_0_NAME: connect
      KAFKA_CLUSTERS_0_KAFKACONNECT_0_ADDRESS: http://kafka-connect:8083
    restart: unless-stopped
    networks:
      - bitcoin-network

volumes:
  neo4j_data:
  neo4j_logs:
  neo4j_import:
  neo4j_plugins:
  kafka_connect_plugins:

networks:
  bitcoin-network:
    driver: bridge
```

## 2. Create Debshrew Configuration

We'll create a configuration file for Debshrew that connects to Metashrew and Kafka.

**File: `backend/debshrew-config.json`**

```json
{
  "metashrew": {
    "url": "http://localhost:8080",
    "timeout": 30,
    "max_retries": 3,
    "retry_delay": 1000
  },
  "transform": {
    "path": "./backend/debshrew/examples/simple-transform/target/wasm32-unknown-unknown/release/simple_transform.wasm"
  },
  "sink": {
    "type": "kafka",
    "bootstrap_servers": "localhost:29092",
    "topic_prefix": "debshrew.cdc",
    "client_id": "debshrew",
    "batch_size": 100,
    "flush_interval": 1000
  },
  "cache_size": 6,
  "start_height": 880000,
  "log_level": "info"
}
```

## 3. Modify the Transform Module

We'll modify the simple-transform example to generate CDC events for Bitcoin data.

**File: `backend/debshrew/examples/simple-transform/src/lib.rs`**

```rust
use debshrew_runtime::{self, DebTransform};
use debshrew_runtime::{CdcMessage, CdcHeader, CdcOperation, CdcPayload};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Default, Clone, Debug)]
pub struct BitcoinTransform {
    // State fields to track processed blocks and transactions
    last_processed_height: u32,
}

#[derive(Serialize, Deserialize)]
struct BlockParams {
    height: u32,
}

#[derive(Serialize, Deserialize)]
struct Block {
    hash: String,
    size: u32,
    tx_count: u32,
    version: u32,
    prev_block: String,
    merkle_root: String,
    timestamp: u64,
    bits: String,
    nonce: u32,
    height: u32,
    transactions: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct TransactionParams {
    txid: String,
}

#[derive(Serialize, Deserialize)]
struct Transaction {
    txid: String,
    version: u32,
    locktime: u32,
    size: u32,
    weight: u32,
    inputs: Vec<Input>,
    outputs: Vec<Output>,
}

#[derive(Serialize, Deserialize)]
struct Input {
    prev_txid: String,
    prev_vout: u32,
    script_sig: String,
    sequence: u32,
    witness: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
struct Output {
    value: u64,
    script_pub_key: String,
    addresses: Vec<String>,
}

impl DebTransform for BitcoinTransform {
    fn process_block(&mut self) -> debshrew_runtime::Result<()> {
        let height = debshrew_runtime::get_height();
        let hash = debshrew_runtime::get_block_hash();
        
        debshrew_runtime::println!("Processing block {} with hash {}", height, hex::encode(&hash));
        
        // Query metashrew for block data
        let params = debshrew_runtime::serialize_params(&BlockParams { height })?;
        let result = debshrew_runtime::view("get_block".to_string(), params)?;
        let block: Block = debshrew_runtime::deserialize_result(&result)?;
        
        // Generate CDC event for block
        let block_message = CdcMessage {
            header: CdcHeader {
                source: "bitcoin_transform".to_string(),
                timestamp: chrono::Utc::now(),
                block_height: height,
                block_hash: hex::encode(&hash),
                transaction_id: None,
            },
            payload: CdcPayload {
                operation: CdcOperation::Create,
                table: "blocks".to_string(),
                key: block.hash.clone(),
                before: None,
                after: Some(serde_json::json!({
                    "hash": block.hash,
                    "size": block.size,
                    "txcount": block.tx_count,
                    "version": block.version,
                    "prevblock": block.prev_block,
                    "merkleroot": block.merkle_root,
                    "time": block.timestamp,
                    "bits": block.bits,
                    "nonce": block.nonce,
                    "height": block.height
                })),
            },
        };
        
        // Push block CDC message
        self.push_message(block_message)?;
        
        // Process each transaction in the block
        for (index, txid) in block.transactions.iter().enumerate() {
            // Query metashrew for transaction data
            let tx_params = debshrew_runtime::serialize_params(&TransactionParams { txid: txid.clone() })?;
            let tx_result = debshrew_runtime::view("get_transaction".to_string(), tx_params)?;
            let tx: Transaction = debshrew_runtime::deserialize_result(&tx_result)?;
            
            // Generate CDC event for transaction
            let tx_message = CdcMessage {
                header: CdcHeader {
                    source: "bitcoin_transform".to_string(),
                    timestamp: chrono::Utc::now(),
                    block_height: height,
                    block_hash: hex::encode(&hash),
                    transaction_id: Some(txid.clone()),
                },
                payload: CdcPayload {
                    operation: CdcOperation::Create,
                    table: "transactions".to_string(),
                    key: txid.clone(),
                    before: None,
                    after: Some(serde_json::json!({
                        "txid": txid,
                        "version": tx.version,
                        "locktime": tx.locktime,
                        "size": tx.size,
                        "weight": tx.weight,
                        "fee": 0, // Fee calculation would be done in Neo4j
                        "index_in_block": index
                    })),
                },
            };
            
            // Push transaction CDC message
            self.push_message(tx_message)?;
            
            // Process inputs
            for (vin, input) in tx.inputs.iter().enumerate() {
                let input_key = format!("{}:{}", txid, vin);
                let input_message = CdcMessage {
                    header: CdcHeader {
                        source: "bitcoin_transform".to_string(),
                        timestamp: chrono::Utc::now(),
                        block_height: height,
                        block_hash: hex::encode(&hash),
                        transaction_id: Some(txid.clone()),
                    },
                    payload: CdcPayload {
                        operation: CdcOperation::Create,
                        table: "inputs".to_string(),
                        key: input_key.clone(),
                        before: None,
                        after: Some(serde_json::json!({
                            "txid": txid,
                            "vin": vin,
                            "prev_txid": input.prev_txid,
                            "prev_vout": input.prev_vout,
                            "scriptSig": input.script_sig,
                            "sequence": input.sequence,
                            "witness": input.witness,
                            "index": format!("{}:{}:{}:{}", txid, vin, input.prev_txid, input.prev_vout)
                        })),
                    },
                };
                
                // Push input CDC message
                self.push_message(input_message)?;
            }
            
            // Process outputs
            for (vout, output) in tx.outputs.iter().enumerate() {
                let output_key = format!("{}:{}", txid, vout);
                let output_message = CdcMessage {
                    header: CdcHeader {
                        source: "bitcoin_transform".to_string(),
                        timestamp: chrono::Utc::now(),
                        block_height: height,
                        block_hash: hex::encode(&hash),
                        transaction_id: Some(txid.clone()),
                    },
                    payload: CdcPayload {
                        operation: CdcOperation::Create,
                        table: "outputs".to_string(),
                        key: output_key.clone(),
                        before: None,
                        after: Some(serde_json::json!({
                            "txid": txid,
                            "vout": vout,
                            "value": output.value,
                            "scriptPubKey": output.script_pub_key,
                            "addresses": output.addresses.join(","),
                            "index": output_key
                        })),
                    },
                };
                
                // Push output CDC message
                self.push_message(output_message)?;
            }
        }
        
        // Update state
        self.last_processed_height = height;
        
        debshrew_runtime::println!("Block processing complete");
        
        Ok(())
    }
    
    // We don't need to implement rollback() as the default implementation
    // will use the automatically generated inverse operations
}

// Register the transform
debshrew_runtime::declare_transform!(BitcoinTransform);
```

## 4. Create Neo4j Sink Connector Configuration

We'll create a configuration file for the Neo4j Sink Connector.

**File: `backend/neo4j-sink-config.json`**

```json
{
  "name": "neo4j-sink",
  "config": {
    "connector.class": "streams.kafka.connect.sink.Neo4jSinkConnector",
    "topics": "debshrew.cdc.blocks,debshrew.cdc.transactions,debshrew.cdc.inputs,debshrew.cdc.outputs",
    "neo4j.server.uri": "bolt://neo4j:7687",
    "neo4j.authentication.basic.username": "neo4j",
    "neo4j.authentication.basic.password": "password",
    "neo4j.topic.cypher.debshrew.cdc.blocks": "MERGE (block:block {hash: event.after.hash}) SET block.size = event.after.size, block.txcount = event.after.txcount, block.version = event.after.version, block.prevblock = event.after.prevblock, block.merkleroot = event.after.merkleroot, block.time = event.after.time, block.bits = event.after.bits, block.nonce = event.after.nonce, block.height = event.after.height MERGE (prevblock:block {hash: event.after.prevblock}) MERGE (block)-[:chain]->(prevblock)",
    "neo4j.topic.cypher.debshrew.cdc.transactions": "MATCH (block:block {hash: event.header.block_hash}) MERGE (tx:tx {txid: event.after.txid}) MERGE (tx)-[:inc {i: event.after.index_in_block}]->(block) SET tx.version = event.after.version, tx.locktime = event.after.locktime, tx.size = event.after.size, tx.weight = event.after.weight, tx.fee = event.after.fee",
    "neo4j.topic.cypher.debshrew.cdc.inputs": "MATCH (tx:tx {txid: event.after.txid}) MERGE (prevOutput:output {index: event.after.prev_txid + ':' + event.after.prev_vout}) MERGE (prevOutput)-[:in {vin: event.after.vin, scriptSig: event.after.scriptSig, sequence: event.after.sequence, witness: event.after.witness}]->(tx) REMOVE prevOutput:unspent",
    "neo4j.topic.cypher.debshrew.cdc.outputs": "MATCH (tx:tx {txid: event.after.txid}) MERGE (output:output {index: event.after.index}) SET output.value = event.after.value, output.scriptPubKey = event.after.scriptPubKey, output:unspent MERGE (tx)-[:out {vout: event.after.vout}]->(output) WITH output, event WHERE event.after.addresses IS NOT NULL AND size(event.after.addresses) > 0 MERGE (address:address {address: event.after.addresses}) MERGE (output)-[:locked]->(address)",
    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "false",
    "errors.tolerance": "all",
    "errors.log.enable": "true",
    "errors.log.include.messages": "true"
  }
}
```

## 5. Create Setup Script

We'll create a setup script to automate the deployment process.

**File: `backend/setup-debshrew-kafka-neo4j.sh`**

```bash
#!/bin/bash

# Exit on error
set -e

echo "Setting up Debshrew with Kafka and Neo4j..."

# Step 1: Start Docker Compose services
echo "Starting Docker Compose services..."
cd "$(dirname "$0")"
docker-compose down
docker-compose up -d

# Wait for Kafka Connect to be ready
echo "Waiting for Kafka Connect to be ready..."
until curl -s -f http://localhost:8083/connectors > /dev/null; do
  echo "Kafka Connect not ready yet, waiting..."
  sleep 5
done
echo "Kafka Connect is ready!"

# Step 2: Create Kafka topics
echo "Creating Kafka topics..."
docker exec kafka kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1 --topic debshrew.cdc.blocks
docker exec kafka kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1 --topic debshrew.cdc.transactions
docker exec kafka kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1 --topic debshrew.cdc.inputs
docker exec kafka kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1 --topic debshrew.cdc.outputs

# Step 3: Configure Neo4j Sink Connector
echo "Configuring Neo4j Sink Connector..."
curl -X POST -H "Content-Type: application/json" --data @neo4j-sink-config.json http://localhost:8083/connectors

# Step 4: Build the transform module
echo "Building the transform module..."
cd debshrew/examples/simple-transform
cargo build --target wasm32-unknown-unknown --release
cd ../../..

# Step 5: Initialize Neo4j database
echo "Initializing Neo4j database..."
node src/scripts/initDatabase.js

echo "Setup complete! You can now run Debshrew with:"
echo "cargo run --release -- run --config debshrew-config.json"
```

## 6. Update Environment Variables

We'll update the .env.template file to include Kafka configuration.

**File: `backend/.env.template`**

```
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Sandshrew API Configuration
SANDSHREW_NETWORK=mainnet

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=localhost:29092
KAFKA_TOPIC_PREFIX=debshrew.cdc

# Application Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## 7. Create a README for the Integration

**File: `backend/DEBSHREW-KAFKA-NEO4J-README.md`**

```markdown
# Debshrew Kafka Neo4j Integration

This integration connects Debshrew with Neo4j using Kafka as a message broker. It allows for real-time synchronization of Bitcoin data from Metashrew to Neo4j using Change Data Capture (CDC) events.

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

- **Debshrew**: Processes Bitcoin data from Metashrew and generates CDC events
- **Kafka**: Acts as a message broker for CDC events
- **Kafka Connect**: Connects Kafka to Neo4j
- **Neo4j**: Stores Bitcoin data in a graph database

## Monitoring

- Neo4j Browser: http://localhost:7474
- Kafka UI: http://localhost:8080

## Troubleshooting

- Check Kafka Connect logs: `docker logs kafka-connect`
- Check Neo4j logs: `docker logs bitcoin-neo4j`
- Check Debshrew logs: Look at the console output when running Debshrew

## Customization

- Modify `debshrew-config.json` to change Debshrew configuration
- Modify `neo4j-sink-config.json` to change Neo4j Sink Connector configuration
- Modify the transform module in `debshrew/examples/simple-transform/src/lib.rs` to change how CDC events are generated
```

## 8. Execution Steps

1. **Start Docker Compose Services**:
   ```bash
   cd backend
   docker-compose up -d
   ```

2. **Build the Transform Module**:
   ```bash
   cd backend/debshrew/examples/simple-transform
   cargo build --target wasm32-unknown-unknown --release
   ```

3. **Configure Kafka Connect**:
   ```bash
   cd backend
   curl -X POST -H "Content-Type: application/json" --data @neo4j-sink-config.json http://localhost:8083/connectors
   ```

4. **Run Debshrew**:
   ```bash
   cd backend/debshrew
   cargo run --release -- run --config ../debshrew-config.json
   ```

5. **Monitor the Integration**:
   - Neo4j Browser: http://localhost:7474
   - Kafka UI: http://localhost:8080