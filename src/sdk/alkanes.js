// Import Node.js shims first to ensure they're loaded before any other imports
import './node-shims.js';
import getProvider from './provider';

/**
 * Traces a transaction, showing the execution of a smart contract
 * @param {string} txid - Transaction ID to trace
 * @param {number} vout - Output index (default: 0)
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Trace results
 */
export const traceTransaction = async (txid, vout = 0, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Tracing transaction ${txid} with ${endpoint} endpoint`);
    
    // Ensure provider.alkanes exists
    if (!provider.alkanes || typeof provider.alkanes.trace !== 'function') {
      throw new Error('Alkanes trace method not available');
    }
    
    // Use the alkanes.trace method - note that the method will handle txid reversal internally
    const result = await provider.alkanes.trace({
      txid,
      vout
    });
    
    return {
      status: "success",
      message: "Trace completed",
      txid,
      result: result // Return the full result from the trace method
    };
  } catch (error) {
    console.error('Error tracing transaction:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      txid
    };
  }
};

/**
 * Simulates an Alkanes transaction or operation
 * @param {Object} simulationParams - Parameters for the simulation
 * @param {Object} simulationParams.target - The target block and transaction ID
 * @param {string} simulationParams.target.block - Block identifier
 * @param {string} simulationParams.target.tx - Transaction identifier
 * @param {Array} simulationParams.inputs - Array of operation inputs
 * @param {Array} [simulationParams.alkanes=[]] - Optional tokens to include
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Simulation results
 */
export const performAlkanesSimulation = async (simulationParams, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Performing Alkanes simulation with ${endpoint} endpoint`, simulationParams);
    
    // Ensure provider.alkanes exists and the simulate method is available
    if (!provider.alkanes || typeof provider.alkanes.simulate !== 'function') {
      throw new Error('Alkanes simulate method not available');
    }
    
    // Prepare simulation request with required defaults
    const simulationRequest = {
      target: simulationParams.target,
      inputs: simulationParams.inputs,
      alkanes: simulationParams.alkanes || [],
      // Default values will be provided by the AlkanesRpc.simulate method
    };
    
    // Call the provider's simulate method
    const result = await provider.alkanes.simulate(simulationRequest);

    console.log(result)
    
    return {
      status: "success",
      message: "Simulation completed successfully",
      data: result,
      // If a parsed property exists, include it for easier consumption
      parsedResults: result.parsed
    };
  } catch (error) {
    console.error('Error performing Alkanes simulation:', error);
    return {
      status: "error",
      message: error.message || "Unknown error occurred during simulation",
      details: error.toString()
    };
  }
};

/**
 * Traces all transactions in a block
 * @param {string|number} blockHeight - Block height to trace
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - TraceBlock results
 */
export const traceBlock = async (blockHeight, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Tracing block at height ${blockHeight} with ${endpoint} endpoint`);
    
    // Ensure provider.sandshrew exists
    if (!provider.sandshrew || !provider.sandshrew.bitcoindRpc) {
      throw new Error('Sandshrew RPC client not available');
    }
    
    // First get all the transactions in the block
    // We'll need to use the Sandshrew client to get block information
    const blockHash = await provider.sandshrew.bitcoindRpc.getBlockHash(blockHeight);
    const blockInfo = await provider.sandshrew.bitcoindRpc.getBlock(blockHash, 2); // Verbosity 2 gets full tx info
    
    if (!blockInfo || !blockInfo.tx) {
      throw new Error(`Block information not available for height ${blockHeight}`);
    }
    
    // For better performance, limit the number of transactions to process if needed
    const transactions = blockInfo.tx.slice(0, 20); // Process up to 20 transactions for demo
    
    return {
      status: "success",
      message: "Block trace completed",
      blockHeight,
      blockHash: blockInfo.hash,
      timestamp: blockInfo.time,
      transactions: transactions.map(tx => ({
        txid: tx.txid || tx.hash,
        status: "pending" // Initial status before tracing
      }))
    };
  } catch (error) {
    console.error('Error tracing block:', error);
    
    // Return a proper error response
    return {
      status: "error",
      message: error.message || "Unknown error",
      blockHeight
    };
  }
};

/**
 * Helper function to transform the Alkanes response from the provider
 * into a format that the AlkanesBalanceExplorer component can use
 *
 * @param {Object|Array} response - The response from the provider.alkanes.getAlkanesByAddress method
 * @returns {Array} - Array of token objects with name, symbol, amount, and tokenId properties
 */
const transformAlkanesResponse = (response) => {
  try {
    // Initialize an empty array to store the transformed tokens
    const tokens = [];
    
    // Check if the response is an array (outpoints) or has an outpoints property
    const outpoints = Array.isArray(response) ? response : (response.outpoints || []);
    
    // Iterate through each outpoint
    outpoints.forEach(outpoint => {
      // Check if the outpoint has a runes property
      if (outpoint.runes && Array.isArray(outpoint.runes)) {
        // Iterate through each rune in the outpoint
        outpoint.runes.forEach(runeData => {
          // Extract the rune and balance information
          const { rune, balance } = runeData;
          
          // Skip tokens with invalid names (no name or spacedName)
          if (!rune.name && !rune.spacedName) {
            return;
          }
          
          // Create a token object with the required properties
          const token = {
            name: rune.name || rune.spacedName,
            symbol: rune.symbol || '-',
            amount: parseFloat(balance) || 0,
            tokenId: rune.id || null // Add the tokenId for image fetching
          };
          
          // Add the token to the array
          tokens.push(token);
        });
      }
    });
    
    return tokens;
  } catch (error) {
    console.error('Error transforming Alkanes response:', error);
    return []; // Return an empty array in case of error
  }
};

/**
 * Converts a hex string to a data URI
 * @param {string} hexString - The hex string to convert
 * @returns {string|null} - The data URI or null if conversion fails
 */
const hexToDataUri = (hexString) => {
  try {
    if (!hexString || typeof hexString !== 'string') {
      return null;
    }
    
    // Remove '0x' prefix if present
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    
    // Convert hex to binary
    const binary = new Uint8Array(cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    // Detect file type (simplified version - in production, use proper file signature detection)
    let mimeType = 'image/png'; // Default to PNG
    
    // Check for common file signatures
    if (binary[0] === 0xFF && binary[1] === 0xD8) {
      mimeType = 'image/jpeg';
    } else if (binary[0] === 0x47 && binary[1] === 0x49 && binary[2] === 0x46) {
      mimeType = 'image/gif';
    } else if (binary[0] === 0x89 && binary[1] === 0x50 && binary[2] === 0x4E && binary[3] === 0x47) {
      mimeType = 'image/png';
    }
    
    // Convert binary to base64
    const base64 = btoa(Array.from(binary).map(b => String.fromCharCode(b)).join(''));
    
    // Create data URI
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting hex to data URI:', error);
    return null;
  }
};

/**
 * Gets a list of all available Alkanes tokens with pagination
 * @param {number} limit - Maximum number of tokens to retrieve (max 1000)
 * @param {number} [offset=0] - Starting index for pagination
 * @param {string} [endpoint='regtest'] - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Retrieved Alkanes tokens
 */

export const decorateProviderInterruptSimulate = (provider) => {
  const _simulate = provider.alkanes.simulate;
  const _getAlkanes = provider.alkanes.getAlkanes;
  const alkanes = new (provider.alkanes.constructor)(provider.alkanes.alkanesUrl);
  alkanes.getAlkanes = async function (o) {
    alkanes.simulate = async function (...args) {
      const response = await _simulate.apply(alkanes, args);
      console.log(response);
      if (response.execution.error === "unexpected end-of-file (at offset 0x0)") {
        alkanes.simulate = async function (...args) { throw Error('catch me'); };
        return null;
      }
      return response;
    };
    const result = await _getAlkanes.call(alkanes, o);
    alkanes.simulate = _simulate;
    return result;
  };
  provider.alkanes = alkanes;
  return provider;
}
export const getAllAlkanes = async (limit, offset = 0, endpoint = 'regtest') => {
  try {
    // Input validation
    if (!limit || typeof limit !== 'number' || limit <= 0) {
      throw new Error('Invalid limit parameter: must be a positive number');
    }

    if (limit > 1000) {
      throw new Error('Limit exceeds maximum allowed value (1000)');
    }

    // Get the provider
    const provider = getProvider(endpoint);
    console.log(`Getting ${limit} Alkanes tokens starting from offset ${offset} with ${endpoint} endpoint`);
    
    // Ensure provider.alkanes exists and has the getAlkanes method
    if (!provider.alkanes || typeof provider.alkanes.getAlkanes !== 'function') {
      throw new Error('Alkanes getAlkanes method not available');
    }
    
    // Call the getAlkanes method
    const result = await decorateProviderInterruptSimulate(provider).alkanes.getAlkanes({
      limit,
      offset
    });
    
    // Transform tokens to a consistent format and filter out tokens with invalid names
    const transformedTokens = result
      //.filter(token => token.name) // Skip tokens with no name
      .map(token => ({
        // Core token details
        id: token.id || { block: '', tx: '' },
        name: token.name,
        symbol: token.symbol || '-',
        
        // Supply information
        totalSupply: token.totalSupply || 0,
        cap: token.cap || 0,
        minted: token.minted || 0,
        mintAmount: token.mintAmount || 0,
        
        // Calculated fields
        mintActive: token.mintActive || false,
        percentageMinted: token.percentageMinted || 0,
        
        // For consistent API response structure
        amount: 0 // Default to 0 as this isn't an address-specific balance
      }));
      
    // Calculate a better estimation of total tokens for pagination
    // If we got a full page, assume there are more tokens
    // If we got a partial page, assume that's all there is
    const estimatedTotal = transformedTokens.length >= limit
      ? Math.max(offset + transformedTokens.length * 2, offset + transformedTokens.length + 1) // Ensure at least one more page
      : offset + transformedTokens.length;
      
    // Return in a consistent format with other API functions
    return {
      status: "success",
      message: "Alkanes tokens retrieved",
      pagination: {
        limit,
        offset,
        total: estimatedTotal, // Use our estimated total instead of just the current page count
        hasMore: transformedTokens.length >= limit // Flag to indicate if there are more tokens
      },
      tokens: transformedTokens
    };
  } catch (error) {
    console.error('Error getting Alkanes tokens:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      pagination: {
        limit,
        offset
      },
      tokens: []
    };
  }
};

/**
 * Gets the image for an Alkanes token
 * @param {Object} tokenId - The token ID object with block and tx properties
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Object containing the image data URI or placeholder
 */
export const getAlkanesTokenImage = async (tokenId, endpoint = 'regtest') => {
  try {
    if (!tokenId || !tokenId.block || !tokenId.tx) {
      throw new Error('Invalid token ID');
    }

    // Create simulation parameters for image retrieval
    const simulationParams = {
      target: tokenId,
      inputs: ["1000"], // 1000 is the input value for images
      alkanes: []
    };

    // Call the simulation function
    const result = await performAlkanesSimulation(simulationParams, endpoint);

    if (result.status === "error" || !result.data) {
      throw new Error(result.message || 'Failed to retrieve token image');
    }

    // Extract the hex string from the result
    const hexData = result?.data?.execution?.data;
    
    if (!hexData) {
      throw new Error('No image data found');
    }

    // Convert hex string to data URI
    const dataUri = hexToDataUri(hexData);
    
    if (!dataUri) {
      throw new Error('Failed to convert image data');
    }
    
    return {
      status: "success",
      imageUri: dataUri
    };
  } catch (error) {
    console.error('Error getting token image:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      imageUri: null
    };
  }
};

/**
 * Gets all Alkanes owned by a specific address
 * @param {string} address - Bitcoin address to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Alkanes owned by the address
 */
export const getAlkanesByAddress = async (address, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting Alkanes for address ${address} with ${endpoint} endpoint`);
    
    // Ensure provider.alkanes exists
    if (!provider.alkanes || typeof provider.alkanes.getAlkanesByAddress !== 'function') {
      throw new Error('Alkanes getAlkanesByAddress method not available');
    }
    
    // Use the oyl-sdk Provider to get Alkanes by address
    const result = await provider.alkanes.getAlkanesByAddress({
      address,
      protocolTag: '1'
    });
    
    // Transform the result into the format expected by the component
    const transformedAlkanes = transformAlkanesResponse(result);
    
    return {
      status: "success",
      message: "Alkanes retrieved",
      address,
      alkanes: transformedAlkanes
    };
  } catch (error) {
    console.error('Error getting Alkanes by address:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      address
    };
  }
};

/**
 * Gets all Alkanes at a specific block height
 * @param {number} height - Block height to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Alkanes at the specified height
 */
export const getAlkanesByHeight = async (height, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting Alkanes at height ${height} with ${endpoint} endpoint`);
    
    // Ensure provider.alkanes exists
    if (!provider.alkanes || typeof provider.alkanes.getAlkanesByHeight !== 'function') {
      throw new Error('Alkanes getAlkanesByHeight method not available');
    }
    
    // Use the oyl-sdk Provider to get Alkanes by height
    const result = await provider.alkanes.getAlkanesByHeight({
      height,
      protocolTag: '1'
    });
    
    return {
      status: "success",
      message: "Alkanes retrieved",
      height,
      alkanes: result
    };
  } catch (error) {
    console.error('Error getting Alkanes by height:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      height
    };
  }
};

/**
 * Gets Protorunes by outpoint at a specific block height using direct JSON-RPC call
 * @param {Object} params - Parameters for the query
 * @param {string} params.txid - Transaction ID (will be reversed for the API call)
 * @param {number} params.vout - Output index
 * @param {string} params.protocolTag - Protocol tag (default: "1")
 * @param {number} height - Block height to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Protorunes at the specified outpoint and height
 */
export const getProtorunesByOutpoint = async (params, height, endpoint = 'regtest') => {
  try {
    console.log(`Getting Protorunes by outpoint ${params.txid}:${params.vout} at height ${height} with ${endpoint} endpoint`);
    
    // Validate inputs
    if (!params.txid || typeof params.txid !== 'string') {
      throw new Error('Invalid txid: must be a non-empty string');
    }
    
    if (params.vout === undefined || params.vout === null || isNaN(parseInt(params.vout, 10))) {
      throw new Error('Invalid vout: must be a number');
    }
    
    if (!height || isNaN(parseInt(height, 10))) {
      throw new Error('Invalid height: must be a number');
    }
    
    // The txid in the example is already in the correct format for the API call
    // No need to reverse it as the form already shows the correct format
    const txidForApi = params.txid;
    
    // Determine the API URL based on the endpoint
    const url = endpoint === 'mainnet' ? 'https://mainnet.sandshrew.io/v2/lasereyes' :
                endpoint === 'oylnet' ? 'https://oylnet.oyl.gg/v2/lasereyes' :
                'http://localhost:18888/v1/lasereyes';
    
    console.log(`Making API call to ${url} with txid: ${txidForApi}, vout: ${params.vout}, height: ${height}`);
    
    // Make the JSON-RPC request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'alkanes_protorunesbyoutpoint',
        params: [
          {
            protocolTag: params.protocolTag || '1',
            txid: txidForApi,
            vout: parseInt(params.vout, 10)
          },
          parseInt(height, 10)
        ]
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Error fetching Protorunes by outpoint');
    }
    
    // Return the exact API response format
    return data;
  } catch (error) {
    console.error('Error getting Protorunes by outpoint:', error);
    return {
      error: {
        message: error.message || "Unknown error"
      },
      id: 0,
      jsonrpc: "2.0"
    };
  }
};
