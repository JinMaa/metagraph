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

# Step 4: Build the transform module
echo "Building the transform module..."
cd debshrew/examples/simple-transform
# Ensure the wasm32-unknown-unknown target is installed
rustup target add wasm32-unknown-unknown
# Build the transform module
cargo build --target wasm32-unknown-unknown --release
cd ../../..

# Step 5: Initialize Neo4j database
echo "Initializing Neo4j database..."
node src/scripts/initDatabase.js

echo "Setup complete! You can now run Debshrew with:"
echo "cd debshrew && cargo run --release -- run --config ../debshrew-config.json"