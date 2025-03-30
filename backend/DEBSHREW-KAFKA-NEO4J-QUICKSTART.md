# Debshrew Kafka Neo4j Quickstart Guide

This guide provides step-by-step instructions to set up and run the Debshrew Kafka Neo4j integration.

## Prerequisites

- Docker and Docker Compose
- Rust 1.70 or later with wasm32-unknown-unknown target
- Node.js 14 or later
- A running Metashrew instance

## Step 1: Install Rust and the wasm32-unknown-unknown target

If you haven't already installed Rust, you can do so with:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Then add the wasm32-unknown-unknown target:

```bash
rustup target add wasm32-unknown-unknown
```

## Step 2: Build the Transform Module

First, let's build the transform module:

```bash
cd backend/debshrew/examples/simple-transform
cargo build --target wasm32-unknown-unknown --release
```

This will create the WASM file at `target/wasm32-unknown-unknown/release/simple_transform.wasm`.

## Step 3: Update the Debshrew Configuration

Let's update the path in the debshrew-config.json file to point to the correct location of the WASM file:

```bash
cd ../../../../  # Return to the backend directory
```

Edit the `debshrew-config.json` file to update the transform path:

```json
{
  "metashrew": {
    "url": "http://localhost:8080",
    "timeout": 30,
    "max_retries": 3,
    "retry_delay": 1000
  },
  "transform": {
    "path": "examples/simple-transform/target/wasm32-unknown-unknown/release/simple_transform.wasm"
  },
  "sink": {
    "type": "kafka",
    "bootstrap_servers": "localhost:29092",
    "topic": "debshrew.cdc",
    "client_id": "debshrew",
    "batch_size": 100,
    "flush_interval": 1000
  },
  "cache_size": 6,
  "start_height": 880000,
  "log_level": "info"
}
```

## Step 4: Start Docker Services

Start the Docker services (Neo4j, Kafka, etc.):

```bash
docker-compose down
docker-compose up -d
```

Wait for all services to start up.

## Step 5: Create Kafka Topic

Create the Kafka topic:

```bash
docker exec kafka kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1 --topic debshrew.cdc
```

## Step 6: Configure Neo4j Sink Connector

Wait for Kafka Connect to be ready:

```bash
until curl -s -f http://localhost:8083/connectors > /dev/null; do
  echo "Kafka Connect not ready yet, waiting..."
  sleep 5
done
```

Then configure the Neo4j Sink Connector:

```bash
curl -X POST -H "Content-Type: application/json" --data @neo4j-sink-config.json http://localhost:8083/connectors
```

## Step 7: Initialize Neo4j Database

Initialize the Neo4j database:

```bash
node src/scripts/initDatabase.js
```

## Step 8: Run Debshrew

Now you can run Debshrew:

```bash
cd debshrew
cargo run --release -- run --config ../debshrew-config.json
```

## Step 9: Monitor the System

You can monitor the system using:

- Neo4j Browser: http://localhost:7474 (username: neo4j, password: password)
- Kafka UI: http://localhost:8084

## Troubleshooting

### Transform Module Not Found

If you see an error like:

```
Error: Configuration("Transform file not found: ./path/to/transform.wasm")
```

Make sure:
1. You've built the transform module with `cargo build --target wasm32-unknown-unknown --release`
2. The path in debshrew-config.json is correct and relative to where you're running debshrew from

### Kafka Connect Issues

If Kafka Connect fails to start or the connector fails to configure:

```bash
# Check Kafka Connect logs
docker logs kafka-connect
```

### Neo4j Connection Issues

If Neo4j fails to connect:

```bash
# Check Neo4j logs
docker logs bitcoin-neo4j
```

## Complete Setup Script

For convenience, you can use the setup script that automates all these steps:

```bash
chmod +x setup-debshrew-kafka-neo4j.sh
./setup-debshrew-kafka-neo4j.sh
```

## Next Steps

Once the system is running, you can:

1. Check Neo4j Browser to see the graph data being populated
2. Monitor Kafka topics using the Kafka UI
3. Customize the transform module to capture additional data