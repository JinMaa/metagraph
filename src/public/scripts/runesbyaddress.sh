#!/bin/bash

# runesbyaddress.sh - Test script for the runesbyaddress API method
# 
# This script tests the runesbyaddress view function through the Metashrew API
# This is for the legacy Runes compatibility API

# ===== CONFIGURATION =====
METHOD_NAME="metashrew_view"
VIEW_FUNCTION="runesbyaddress"

# Default values
DEFAULT_ADDRESS="bc1p8g0t8c8wv97433p3yg04cq7jn4xxsysqs9s3fc8xxx"
DEFAULT_BLOCK_TAG="latest"
PRODUCTION_ENDPOINT="https://mainnet.sandshrew.io/v2/lasereyes"
LOCAL_ENDPOINT="http://localhost:8080"

# ===== HELP FUNCTION =====
show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help                Show this help message"
  echo "  -a, --address ADDRESS     Bitcoin address to query (default: $DEFAULT_ADDRESS)"
  echo "  -b, --block-tag TAG       Block tag (default: $DEFAULT_BLOCK_TAG)"
  echo "  -e, --endpoint URL        Set API endpoint (default: $PRODUCTION_ENDPOINT)"
  echo "  -l, --local               Use local endpoint ($LOCAL_ENDPOINT)"
  echo ""
  echo "Example:"
  echo "  $0 --address bc1p9yfme5nxsyzl8frjugkqtq59lhatqv86xj5p5z8nqh5aat44ensq5v8z0t -l"
  exit 0
}

# ===== PARAMETER PARSING =====
# Initialize parameters with defaults
ADDRESS=$DEFAULT_ADDRESS
BLOCK_TAG=$DEFAULT_BLOCK_TAG
ENDPOINT=$PRODUCTION_ENDPOINT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      ;;
    -a|--address)
      ADDRESS="$2"
      shift 2
      ;;
    -b|--block-tag)
      BLOCK_TAG="$2"
      shift 2
      ;;
    -e|--endpoint)
      ENDPOINT="$2"
      shift 2
      ;;
    -l|--local)
      ENDPOINT=$LOCAL_ENDPOINT
      shift
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      ;;
  esac
done

# ===== PARAMETER ENCODING FUNCTION =====
# Function to convert address to hex for legacy runes API
address_to_hex() {
  local address=$1
  local hex_length=$(printf "%02x" ${#address})
  local hex_address=$(echo -n "$address" | xxd -p | tr -d '\n')
  
  # Final encoding - this is a simplified version, in a real implementation
  # you would need proper protobuf encoding
  echo "0x0a${hex_length}${hex_address}"
}

# Encode parameters for the API call
encode_params() {
  local address="$1"
  local blockTag="$2"
  local encodedAddress=$(address_to_hex "$address")
  
  # Return properly formatted params array for metashrew_view
  echo "[\"$VIEW_FUNCTION\", \"$encodedAddress\", \"$blockTag\"]"
}

# ===== BUILD REQUEST =====
params=$(encode_params "$ADDRESS" "$BLOCK_TAG")
request="{\"method\":\"$METHOD_NAME\",\"params\":$params,\"id\":0,\"jsonrpc\":\"2.0\"}"

# ===== DISPLAY INFO =====
echo "Testing $VIEW_FUNCTION view function..."
echo "Endpoint: $ENDPOINT"
echo "Parameters:"
echo "  - address: $ADDRESS"
echo "  - block tag: $BLOCK_TAG"
echo ""
echo "Request: $request"
echo ""
echo "Sending request..."

# ===== EXECUTE CURL REQUEST =====
curl -s "$ENDPOINT" -X POST \
  -d "$request" \
  -H 'Content-Type: application/json' | jq .

echo ""
echo "Request complete."
