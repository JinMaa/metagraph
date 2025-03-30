#!/bin/bash

# Exit on error
set -e

echo "Building and running Debshrew with the transform module..."

# Step 1: Build the transform module
echo "Building the transform module..."
cd "$(dirname "$0")/debshrew/examples/simple-transform"
# Ensure the wasm32-unknown-unknown target is installed
rustup target add wasm32-unknown-unknown
# Build the transform module
cargo build --target wasm32-unknown-unknown --release
cd ../../

# Step 2: Run Debshrew
echo "Running Debshrew..."
cargo run --release -- run --config ../debshrew-config.json

# If the above command fails, try running with the full path
if [ $? -ne 0 ]; then
  echo "Trying with full path..."
  FULL_PATH=$(realpath examples/simple-transform/target/wasm32-unknown-unknown/release/simple_transform.wasm)
  echo "Full path: $FULL_PATH"
  
  # Create a temporary config file with the full path
  TMP_CONFIG=$(mktemp)
  cat ../debshrew-config.json | sed "s|\"path\": \".*\"|\"path\": \"$FULL_PATH\"|" > $TMP_CONFIG
  
  echo "Running with temporary config..."
  cargo run --release -- run --config $TMP_CONFIG
  
  # Clean up
  rm $TMP_CONFIG
fi