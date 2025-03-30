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

# Step 2: Create Kafka topic
echo "Creating Kafka topic..."
docker exec kafka kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1 --topic debshrew.cdc

# Step 3: Configure Neo4j Sink Connector
echo "Configuring Neo4j Sink Connector..."
curl -X POST -H "Content-Type: application/json" --data @neo4j-sink-config.json http://localhost:8083/connectors

# Step 4: Set up the transform module directory structure
echo "Setting up the transform module directory structure..."
cd debshrew
mkdir -p examples/simple-transform/target/wasm32-unknown-unknown/release/

# Step 5: Build the transform module with alkanes-support
echo "Building the transform module with alkanes-support..."
echo "Note: This may take a while as it needs to download and compile dependencies."

# Try building with current Rust toolchain
if cargo build --target wasm32-unknown-unknown --release -p simple-transform; then
  echo "Build successful! Copying WASM file to the expected location..."
  cp target/wasm32-unknown-unknown/release/simple_transform.wasm examples/simple-transform/target/wasm32-unknown-unknown/release/
else
  echo "Build failed. This could be due to issues with the alkanes-support dependency."
  echo "Please check the error messages above for more details."
  
  # Provide some troubleshooting tips
  echo ""
  echo "Troubleshooting tips:"
  echo "1. Make sure you have the wasm32-unknown-unknown target installed: rustup target add wasm32-unknown-unknown"
  echo "2. Check if the alkanes-support repository is accessible: git ls-remote https://github.com/kungfuflex/alkanes-rs.git"
  echo "3. Try building with a specific version of Rust: rustup default 1.68.0"
  echo "4. If all else fails, you may need to manually build the transform module and place it at: examples/simple-transform/target/wasm32-unknown-unknown/release/simple_transform.wasm"
  
  # Ask if the user wants to continue
  read -p "Do you want to continue with the setup? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup aborted."
    exit 1
  fi
fi

cd ..

# Step 6: Initialize Neo4j database
echo "Initializing Neo4j database..."
node src/scripts/initDatabase.js

echo "Setup complete! You can now run Debshrew with:"
echo "cd debshrew && cargo run --release -- run --config ../debshrew-config.json"
echo ""
echo "Make sure Metashrew is running with the correct parameters:"
echo "./metashrew/target/release/rockshrew-mono --daemon-rpc-url https://mainnet.sandshrew.io/v2/lasereyes --indexer ./alkanes-rs/target/wasm32-unknown-unknown/release/alkanes.wasm --db-path ./.metashrew --host 0.0.0.0 --port 8080 --start-block 880000 --cors '*'"