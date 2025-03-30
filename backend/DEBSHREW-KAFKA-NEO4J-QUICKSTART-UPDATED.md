# Debshrew Kafka Neo4j Quickstart Guide (Updated)

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

## Step 2: Update the Transform Module to Use alkanes-support

The transform module needs to use alkanes-support to properly encode requests to the Metashrew API. We've already updated the Cargo.toml and lib.rs files to include this dependency.

### Cargo.toml
```toml
[package]
name = "simple-transform"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
debshrew-runtime = { path = "../../debshrew-runtime", default-features = false }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
chrono = { version = "0.4", features = ["serde"] }
hex = "0.4"
getrandom = { version = "0.2", features = ["js"] }
alkanes-support = { git = "https://github.com/kungfuflex/alkanes-rs.git", default-features = false }
```

### lib.rs
The key changes in lib.rs include:

1. Importing types from alkanes-support:
```rust
use alkanes_support::rpc::{GetBlockRequest, GetTransactionRequest};
```

2. Using these types to encode requests:
```rust
let block_request = GetBlockRequest {
    height: Some(height),
    hash: None,
};
let params = debshrew_runtime::serialize_params(&block_request)?;
```

## Step 3: Build the Transform Module

Build the transform module with the alkanes-support dependency:

```bash
cd backend/debshrew
cargo build --target wasm32-unknown-unknown --release -p simple-transform
```

This will create the WASM file at `target/wasm32-unknown-unknown/release/simple_transform.wasm`.

## Step 4: Fix the WASM File Location Issue

Debshrew expects the WASM file to be in a specific location. We need to create the directory structure and copy the WASM file:

```bash
# Create the directory structure
mkdir -p examples/simple-transform/target/wasm32-unknown-unknown/release/

# Copy the WASM file to the expected location
cp target/wasm32-unknown-unknown/release/simple_transform.wasm examples/simple-transform/target/wasm32-unknown-unknown/release/
```

## Step 5: Start Docker Services

Start the Docker services (Neo4j, Kafka, etc.):

```bash
cd ../  # Return to the backend directory
docker-compose down
docker-compose up -d
```

Wait for all services to start up.

## Step 6: Create Kafka Topic

Create the Kafka topic:

```bash
docker exec kafka kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1 --topic debshrew.cdc
```

## Step 7: Configure Neo4j Sink Connector

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

## Step 8: Initialize Neo4j Database

Initialize the Neo4j database:

```bash
node src/scripts/initDatabase.js
```

## Step 9: Ensure Metashrew is Running

Make sure Metashrew is running with the correct parameters:

```bash
./metashrew/target/release/rockshrew-mono --daemon-rpc-url https://mainnet.sandshrew.io/v2/lasereyes --indexer ./alkanes-rs/target/wasm32-unknown-unknown/release/alkanes.wasm --db-path ./.metashrew --host 0.0.0.0 --port 8080 --start-block 880000 --cors '*'
```

## Step 10: Run Debshrew

Now you can run Debshrew:

```bash
cd debshrew
cargo run --release -- run --config ../debshrew-config.json
```

## Troubleshooting

### Build Errors with alkanes-support

If you encounter errors when building the transform module with alkanes-support, try:

1. Make sure you have the wasm32-unknown-unknown target installed:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

2. Check if the alkanes-support repository is accessible:
   ```bash
   git ls-remote https://github.com/kungfuflex/alkanes-rs.git
   ```

3. Try building with a specific version of Rust:
   ```bash
   rustup default 1.68.0
   cargo build --target wasm32-unknown-unknown --release -p simple-transform
   rustup default stable  # Switch back to stable after building
   ```

4. If all else fails, you may need to manually build the transform module and place it at:
   ```
   examples/simple-transform/target/wasm32-unknown-unknown/release/simple_transform.wasm
   ```

### Transform Module Not Found

If you see an error like:

```
Error: Configuration("Transform file not found: examples/simple-transform/target/wasm32-unknown-unknown/release/simple_transform.wasm")
```

Make sure:
1. You've built the transform module with `cargo build --target wasm32-unknown-unknown --release -p simple-transform`
2. You've copied the WASM file to the expected location as described in Step 4

### Metashrew Connection Issues

If you see an error like:

```
Error: MetashrewClient("HTTP error: 400 Bad Request")
```

Make sure:
1. Metashrew is running and accessible at http://localhost:8080
2. The transform module is using alkanes-support to properly encode requests
3. The view function names ("get_block", "get_transaction") match what Metashrew expects
4. The start block height in debshrew-config.json matches what Metashrew has indexed

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

## Next Steps

Once the system is running, you can:

1. Check Neo4j Browser to see the graph data being populated
2. Monitor Kafka topics using the Kafka UI
3. Customize the transform module to capture additional data