// Import Node.js shims first to ensure they're loaded before any other imports
import './node-shims.js';
import getProvider from './provider';

/**
 * Gets transaction details using the Esplora API
 * @param {string} txid - Transaction ID to fetch
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Transaction details
 */
export const getTransactionInfo = async (txid, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting transaction ${txid} with ${endpoint} endpoint`);
    
    // Ensure provider.esplora exists
    if (!provider.esplora || typeof provider.esplora.getTxInfo !== 'function') {
      throw new Error('Esplora getTxInfo method not available');
    }
    
    // Call the getTxInfo method
    const result = await provider.esplora.getTxInfo(txid);
    
    return {
      status: "success",
      message: "Transaction retrieved",
      txid,
      transaction: result
    };
  } catch (error) {
    console.error('Error getting transaction:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      txid
    };
  }
};

/**
 * Gets transaction status using the Esplora API
 * @param {string} txid - Transaction ID to fetch status for
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Transaction status
 */
export const getTransactionStatus = async (txid, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting transaction status for ${txid} with ${endpoint} endpoint`);
    
    // Ensure provider.esplora exists
    if (!provider.esplora || typeof provider.esplora.getTxStatus !== 'function') {
      throw new Error('Esplora getTxStatus method not available');
    }
    
    // Call the getTxStatus method
    const result = await provider.esplora.getTxStatus(txid);
    
    return {
      status: "success",
      message: "Transaction status retrieved",
      txid,
      transactionStatus: result
    };
  } catch (error) {
    console.error('Error getting transaction status:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      txid
    };
  }
};

/**
 * Gets transaction hex data using the Esplora API
 * @param {string} txid - Transaction ID to fetch hex for
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Transaction hex
 */
export const getTransactionHex = async (txid, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting transaction hex for ${txid} with ${endpoint} endpoint`);
    
    // Ensure provider.esplora exists
    if (!provider.esplora || typeof provider.esplora.getTxHex !== 'function') {
      throw new Error('Esplora getTxHex method not available');
    }
    
    // Call the getTxHex method
    const result = await provider.esplora.getTxHex(txid);
    
    return {
      status: "success",
      message: "Transaction hex retrieved",
      txid,
      hex: result
    };
  } catch (error) {
    console.error('Error getting transaction hex:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      txid
    };
  }
};

/**
 * Gets transaction outspends using the Esplora API
 * @param {string} txid - Transaction ID to fetch outspends for
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Transaction outspends
 */
export const getTransactionOutspends = async (txid, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting transaction outspends for ${txid} with ${endpoint} endpoint`);
    
    // Ensure provider.esplora exists
    if (!provider.esplora || typeof provider.esplora.getTxOutspends !== 'function') {
      throw new Error('Esplora getTxOutspends method not available');
    }
    
    // Call the getTxOutspends method
    const result = await provider.esplora.getTxOutspends(txid);
    
    return {
      status: "success",
      message: "Transaction outspends retrieved",
      txid,
      outspends: result
    };
  } catch (error) {
    console.error('Error getting transaction outspends:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      txid
    };
  }
};

/**
 * Gets address information including transaction count using the Esplora API
 * @param {string} address - Bitcoin address to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Address information including transaction count
 */
export const getAddressInfo = async (address, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting address info for ${address} with ${endpoint} endpoint`);
    
    // Make a direct fetch request to the Esplora API
    const projectId = import.meta.env.VITE_SANDSHREW_PROJECT_ID;
    const url = endpoint === 'mainnet' ? `https://mainnet.sandshrew.io/v2/${projectId}` :
                endpoint === 'oylnet' ? `https://oylnet.oyl.gg/v2/${projectId}` :
                `http://localhost:18888/v1/${projectId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'esplora_address',
        params: [address]
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Error fetching address info');
    }
    
    const result = data.result;
    
    // Calculate total transaction count (chain + mempool)
    const totalTxCount = result.chain_stats.tx_count + result.mempool_stats.tx_count;
    
    return {
      status: "success",
      message: "Address info retrieved",
      address,
      info: result,
      totalTxCount
    };
  } catch (error) {
    console.error('Error getting address info:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      address,
      totalTxCount: 0
    };
  }
};

/**
 * Gets transactions for a specific Bitcoin address using cursor-based pagination
 * @param {string} address - Bitcoin address to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @param {string|null} lastSeenTxid - Last transaction ID seen for pagination (null for first page)
 * @returns {Promise<Object>} - Transactions for the address with pagination info
 */
export const getAddressTransactionsChain = async (address, endpoint = 'regtest', lastSeenTxid = null) => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting transactions for address ${address} with ${endpoint} endpoint (lastSeenTxid: ${lastSeenTxid || 'null'})`);
    
    // Make a direct fetch request to the Esplora API
    const projectId = import.meta.env.VITE_SANDSHREW_PROJECT_ID;
    const url = endpoint === 'mainnet' ? `https://mainnet.sandshrew.io/v2/${projectId}` :
                endpoint === 'oylnet' ? `https://oylnet.oyl.gg/v2/${projectId}` :
                `http://localhost:18888/v1/${projectId}`;
    
    const params = lastSeenTxid ? [address, lastSeenTxid] : [address];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'esplora_address::txs:chain',
        params: params
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Error fetching address transactions');
    }
    
    const result = data.result;
    
    return {
      status: "success",
      message: "Transactions retrieved",
      address,
      transactions: result,
      pagination: {
        lastSeenTxid: result.length > 0 ? result[result.length - 1].txid : null,
        hasMore: result.length === 25 // CHAIN_TXS_PER_PAGE is 25 in rest.rs
      }
    };
  } catch (error) {
    console.error('Error getting address transactions:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      address,
      transactions: []
    };
  }
};

/**
 * Gets mempool transactions for a specific Bitcoin address
 * @param {string} address - Bitcoin address to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Mempool transactions for the address
 */
export const getAddressMempoolTransactions = async (address, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting mempool transactions for address ${address} with ${endpoint} endpoint`);
    
    // Ensure provider.esplora exists
    if (!provider.esplora || typeof provider.esplora.getAddressTxInMempool !== 'function') {
      throw new Error('Esplora getAddressTxInMempool method not available');
    }
    
    // Call the getAddressTxInMempool method
    const result = await provider.esplora.getAddressTxInMempool(address);
    
    return {
      status: "success",
      message: "Mempool transactions retrieved",
      address,
      transactions: result
    };
  } catch (error) {
    console.error('Error getting address mempool transactions:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      address
    };
  }
};

/**
 * Gets UTXOs for a specific Bitcoin address
 * @param {string} address - Bitcoin address to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - UTXOs for the address
 */
export const getAddressUtxos = async (address, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting UTXOs for address ${address} with ${endpoint} endpoint`);
    
    // Ensure provider.esplora exists
    if (!provider.esplora || typeof provider.esplora.getAddressUtxo !== 'function') {
      throw new Error('Esplora getAddressUtxo method not available');
    }
    
    // Call the getAddressUtxo method
    const result = await provider.esplora.getAddressUtxo(address);
    
    return {
      status: "success",
      message: "UTXOs retrieved",
      address,
      utxos: result
    };
  } catch (error) {
    console.error('Error getting address UTXOs:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      address
    };
  }
};

/**
 * Gets fee estimates using the Esplora API
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Fee estimates
 */
export const getFeeEstimates = async (endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting fee estimates with ${endpoint} endpoint`);
    
    // Ensure provider.esplora exists
    if (!provider.esplora || typeof provider.esplora.getFeeEstimates !== 'function') {
      throw new Error('Esplora getFeeEstimates method not available');
    }
    
    // Call the getFeeEstimates method
    const result = await provider.esplora.getFeeEstimates();
    
    return {
      status: "success",
      message: "Fee estimates retrieved",
      estimates: result
    };
  } catch (error) {
    console.error('Error getting fee estimates:', error);
    return {
      status: "error",
      message: error.message || "Unknown error"
    };
  }
};

/**
 * Gets transactions for a Bitcoin address and traces them
 * @param {string} address - Bitcoin address to query
 * @param {string} endpoint - API endpoint to use ('regtest', 'mainnet', 'oylnet')
 * @returns {Promise<Object>} - Transactions with trace results
 */
export const getAddressTransactionsWithTrace = async (address, endpoint = 'regtest') => {
  try {
    const provider = getProvider(endpoint);
    console.log(`Getting and tracing transactions for address ${address} with ${endpoint} endpoint`);
    
    // Get all transactions for the address using the new chain method
    const txResult = await getAddressTransactionsChain(address, endpoint);
    
    if (txResult.status === "error") {
      throw new Error(txResult.message);
    }
    
    // Import the traceTransaction function from alkanes.js
    const { traceTransaction } = await import('./alkanes');
    
    // For each transaction, get the trace results
    const transactions = txResult.transactions || [];
    const tracedTransactions = [];
    
    for (const tx of transactions) {
      const txid = tx.txid;
      
      // Get the transaction details to find OP_RETURN outputs
      const txDetails = await getTransactionInfo(txid, endpoint);
      
      if (txDetails.status === "error") {
        tracedTransactions.push({
          ...tx,
          traceStatus: "error",
          traceError: txDetails.message
        });
        continue;
      }
      
      // Find OP_RETURN outputs
      const opReturnOutputs = txDetails.transaction.vout
        .filter(output => output.scriptpubkey_type === "op_return")
        .map((output, index) => ({
          vout: txDetails.transaction.vout.indexOf(output),
          scriptpubkey: output.scriptpubkey
        }));
      
      // If there are no OP_RETURN outputs, skip tracing
      if (opReturnOutputs.length === 0) {
        tracedTransactions.push({
          ...tx,
          traceStatus: "skipped",
          traceReason: "No OP_RETURN outputs found"
        });
        continue;
      }
      
      // Trace each OP_RETURN output
      const traces = [];
      
      for (const output of opReturnOutputs) {
        try {
          const traceResult = await traceTransaction(txid, output.vout, endpoint);
          traces.push({
            vout: output.vout,
            result: traceResult
          });
        } catch (traceError) {
          traces.push({
            vout: output.vout,
            error: traceError.message
          });
        }
      }
      
      tracedTransactions.push({
        ...tx,
        traceStatus: "success",
        traces
      });
    }
    
    return {
      status: "success",
      message: "Transactions retrieved and traced",
      address,
      transactions: tracedTransactions
    };
  } catch (error) {
    console.error('Error getting and tracing address transactions:', error);
    return {
      status: "error",
      message: error.message || "Unknown error",
      address
    };
  }
};
