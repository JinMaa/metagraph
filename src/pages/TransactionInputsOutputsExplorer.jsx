import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useLaserEyes } from '@omnisat/lasereyes';
import {
  getAddressInfo,
  getAddressTransactionsChain,
  getTransactionInfo,
  getTransactionOutspends
} from '../sdk/esplora';
import { getProtorunesByOutpoint } from '../sdk/alkanes';
import getProvider from '../sdk/provider';

/**
 * TransactionInputsOutputsExplorer Component
 * 
 * Page for exploring Bitcoin transaction inputs and outputs
 * Allows users to search for an address and view all its transactions
 * with detailed inputs and outputs visualization
 */
const TransactionInputsOutputsExplorer = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  const { connected, address: walletAddress } = useLaserEyes();
  
  // State for address input
  const [address, setAddress] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  
  // State for transaction data
  const [transactions, setTransactions] = useState([]);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [fetchingAllTransactions, setFetchingAllTransactions] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [maxTransactionsToFetch, setMaxTransactionsToFetch] = useState(10000);
  const transactionsPerPage = 25; // Default page size from Esplora API
  
  // Reset component state when endpoint/network changes
  useEffect(() => {
    // Reset the state to prevent issues when switching networks
    setTransactions([]);
    setProcessedTransactions([]);
    setError(null);
    setPage(1);
    setTotalPages(1);
    
    console.log(`Network switched to ${endpoint}`);
  }, [endpoint]);
  
  // Only populate the address field when both wallet connects and no address is already entered
  useEffect(() => {
    if (connected && walletAddress && !address && !manualAddress) {
      // Only set the wallet address when both address and manualAddress are empty
      // This prevents overriding any user input
      setAddress(walletAddress);
    }
  }, [connected, walletAddress, address, manualAddress]);
  
  // Helper function to shorten txids and addresses
  const shortenTxid = (txid) => {
    if (!txid) return 'N/A';
    if (txid.length <= 13) return txid;
    return `${txid.substring(0, 6)}...${txid.substring(txid.length - 6)}`;
  };
  
  const shortenAddress = (address) => {
    if (!address) return 'Unknown';
    if (address === 'OP_RETURN') return address;
    if (address.length <= 15) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
  };
  
  // Function to copy text to clipboard
  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log('Copied to clipboard:', text);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };
  
  // Validate Bitcoin address (basic validation)
  const isValidBitcoinAddress = (addr) => {
    // Basic validation - check if it starts with valid prefixes
    return addr && (
      addr.startsWith('bc1') || 
      addr.startsWith('1') || 
      addr.startsWith('3') ||
      addr.startsWith('bcr') || //regtest
      addr.startsWith('tb1') || // testnet
      addr.startsWith('m') || // testnet
      addr.startsWith('n') || // testnet
      addr.startsWith('2') // testnet
    );
  };
  
  // Format date from timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  // Get mempool.space URL for transaction
  const getMempoolSpaceUrl = (txid) => {
    if (!txid) return '#';
    return `https://mempool.space/tx/${txid}`;
  };
  
  // Helper function to convert hex to decimal
  const hexToDec = (hexString) => {
    if (!hexString || typeof hexString !== 'string') return 'N/A';
    // Remove '0x' prefix if present
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    try {
      return BigInt(`0x${cleanHex}`).toString(10);
    } catch (error) {
      console.error("Error converting hex to decimal:", error);
      return hexString; // Return original if conversion fails
    }
  };
  
  // Note: We now use the getAddressInfo function from esplora.js
  
  // Fetch all transactions for an address up to the maximum limit
  const fetchAllTransactions = async (address) => {
    try {
      setFetchingAllTransactions(true);
      setFetchProgress(0);
      
      // First get the total transaction count
      const addressInfoResult = await getAddressInfo(address, endpoint);
      
      if (addressInfoResult.status === "error") {
        throw new Error(addressInfoResult.message);
      }
      
      const totalTxCount = Math.min(addressInfoResult.totalTxCount, maxTransactionsToFetch);
      setTotalTransactions(totalTxCount);
      
      // Start with an empty array of transactions
      let allTransactions = [];
      let lastSeenTxid = null;
      
      // Update progress
      let progress = 0;
      setFetchProgress(progress);
      
      // Fetch transactions in batches using cursor-based pagination
      while (allTransactions.length < totalTxCount && allTransactions.length < maxTransactionsToFetch) {
        // Fetch the next batch
        const result = await getAddressTransactionsChain(
          address,
          endpoint,
          lastSeenTxid
        );
        
        if (result.status === "error" || !result.transactions || !result.transactions.length) {
          break; // No more transactions or error
        }
        
        // Add transactions to our collection
        allTransactions = [...allTransactions, ...result.transactions];
        
        // Update progress
        progress = Math.min(100, Math.round((allTransactions.length / totalTxCount) * 100));
        setFetchProgress(progress);
        
        // Update the last seen txid for the next batch
        lastSeenTxid = result.pagination.lastSeenTxid;
        
        // If we don't have more transactions or we've reached the maximum, stop fetching
        if (!result.pagination.hasMore || allTransactions.length >= maxTransactionsToFetch) {
          break;
        }
      }
      
      return {
        status: "success",
        message: "All transactions retrieved",
        address,
        transactions: allTransactions,
        pagination: {
          total: totalTxCount,
          fetched: allTransactions.length
        }
      };
    } catch (error) {
      console.error('Error fetching all transactions:', error);
      return {
        status: "error",
        message: error.message || "Unknown error",
        address,
        transactions: []
      };
    } finally {
      setFetchingAllTransactions(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset all states before making a new request
    setError(null);
    setPage(1);
    
    // Validate address
    const addressToUse = manualAddress || address;
    if (!addressToUse) {
      setError("Please enter an address");
      return;
    }
    
    if (!isValidBitcoinAddress(addressToUse)) {
      setError("Please enter a valid Bitcoin address");
      return;
    }
    
    // Set loading state
    setLoading(true);
    setTransactions([]); // Clear previous results
    setProcessedTransactions([]);
    
    try {
      console.log(`Searching for transactions on network ${endpoint} for address ${addressToUse}`);
      
      // Fetch all transactions for the address (up to maxTransactionsToFetch)
      const result = await fetchAllTransactions(addressToUse);
      
      if (result.status === "error") {
        throw new Error(result.message);
      }
      
      // Set data
      const txs = result.transactions || [];
      setTransactions(txs);
      setAddress(addressToUse);
      
      // Set pagination data for UI display
      if (result.pagination) {
        setTotalTransactions(result.pagination.total);
        // Calculate total pages based on the number of transactions we actually fetched
        const calculatedPages = Math.max(1, Math.ceil(txs.length / transactionsPerPage));
        setTotalPages(calculatedPages);
        
        console.log(`Total transactions: ${result.pagination.total}, Fetched: ${txs.length}, Pages: ${calculatedPages}`);
      } else {
        // Fallback if pagination info is not available
        setTotalTransactions(txs.length);
        setTotalPages(Math.max(1, Math.ceil(txs.length / transactionsPerPage)));
        
        console.log(`Total transactions: ${txs.length}, Pages: ${Math.ceil(txs.length / transactionsPerPage)}`);
      }
      
      // Process transactions to get inputs and outputs
      await processTransactions(txs);
      
    } catch (err) {
      console.error("Error fetching transactions data:", err);
      setError(err.message || "Failed to fetch transactions data");
      setTransactions([]);
      setProcessedTransactions([]);
      setTotalTransactions(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };
  
  // Process transactions to get detailed input and output information
  const processTransactions = async (txs) => {
    const processed = [];
    
    // Process transactions in batches to avoid overwhelming the browser
    const batchSize = 25;
    const totalBatches = Math.ceil(txs.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, txs.length);
      const batch = txs.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${startIndex}-${endIndex} of ${txs.length} transactions)`);
      
      // Process each transaction in the batch
      for (const tx of batch) {
        try {
          // Get detailed transaction info
          const txInfo = await getTransactionInfo(tx.txid, endpoint);
          
          if (txInfo.status === "error") {
            processed.push({
              ...tx,
              error: txInfo.message,
              inputs: [],
              outputs: []
            });
            continue;
          }
          
          const transaction = txInfo.transaction;
          
          // Get outspends to determine if outputs have been spent
          const outspends = await getTransactionOutspends(tx.txid, endpoint);
          
          // Process inputs
          const inputs = transaction.vin.map(input => ({
            txid: input.txid,
            vout: input.vout,
            address: input.prevout?.scriptpubkey_address || 'Unknown',
            value: input.prevout?.value || 0,
            valueBTC: (input.prevout?.value || 0) / 100000000, // Convert satoshis to BTC
            isCoinbase: input.is_coinbase || false
          }));
          
          // Process outputs
          const outputs = await Promise.all(transaction.vout.map(async (output, index) => {
            const isSpent = outspends.status === "success" &&
                           outspends.outspends &&
                           outspends.outspends[index] &&
                           outspends.outspends[index].spent;
            
            // Check for Alkanes at this outpoint
            let alkanes = null;
            try {
              // Use the transaction's block height instead of current height
              const blockHeight = tx.status?.block_height;
              
              // If block height is not available, skip Alkanes check
              if (!blockHeight) {
                console.log(`Skipping Alkanes check for ${tx.txid}: No block height available`);
                return null;
              }
              
              // Use the correct vout index
              const voutIndex = index; // Use the array index to ensure we check all vouts
              
              console.log(`Checking for Alkanes at outpoint ${tx.txid}:${voutIndex} (output.n: ${output.n}) at block height ${blockHeight}`);
              
              // Call the alkanes_protorunesbyoutpoint function
              const alkanesResult = await getProtorunesByOutpoint(
                {
                  txid: tx.txid,
                  vout: voutIndex,
                  protocolTag: '1'
                },
                blockHeight,
                endpoint
              );
              
              console.log(`Alkanes result for ${tx.txid}:${voutIndex}:`, alkanesResult);
              
              // Check if we got a valid result with Alkanes
              if (alkanesResult.result && alkanesResult.result.length > 0) {
                console.log(`Found Alkanes at outpoint ${tx.txid}:${voutIndex}:`, alkanesResult.result);
                
                alkanes = alkanesResult.result.map(item => {
                  const token = item.token || {};
                  const id = token.id || {};
                  
                  // Convert hex block and tx values to decimal
                  const blockHex = id.block || "0x0";
                  const txHex = id.tx || "0x0";
                  const blockDecimal = parseInt(blockHex, 16);
                  const txDecimal = parseInt(txHex, 16);
                  
                  // Convert hex value to decimal and divide by 10^8 (8 decimals)
                  const valueHex = item.value || "0x0";
                  const valueDecimal = parseInt(valueHex, 16);
                  const valueFormatted = valueDecimal / 100000000; // Divide by 10^8
                    
                  return {
                    token: {
                      ...token,
                      id: {
                        ...id,
                        blockDecimal,
                        txDecimal,
                        formatted: `[${blockDecimal},${txDecimal}]`
                      }
                    },
                    valueHex: item.value,
                    valueDecimal,
                    valueFormatted
                  };
                });
              }
            } catch (error) {
              console.error(`Error checking for Alkanes at outpoint ${tx.txid}:${output.n}:`, error);
            }
            
            return {
              n: output.n,
              address: output.scriptpubkey_address || 'OP_RETURN',
              value: output.value || 0,
              valueBTC: (output.value || 0) / 100000000, // Convert satoshis to BTC
              type: output.scriptpubkey_type,
              isOpReturn: output.scriptpubkey_type === 'op_return',
              spent: isSpent,
              alkanes: alkanes // Add Alkanes information if found
            };
          }));
          
          // Calculate total input and output values
          const totalInput = inputs.reduce((sum, input) => sum + input.value, 0);
          const totalOutput = outputs.reduce((sum, output) => sum + output.value, 0);
          
          processed.push({
            ...tx,
            inputs,
            outputs,
            totalInput,
            totalOutput,
            totalInputBTC: totalInput / 100000000,
            totalOutputBTC: totalOutput / 100000000,
            fee: totalInput - totalOutput,
            feeBTC: (totalInput - totalOutput) / 100000000
          });
          
        } catch (error) {
          console.error(`Error processing transaction ${tx.txid}:`, error);
          processed.push({
            ...tx,
            error: error.message,
            inputs: [],
            outputs: []
          });
        }
      }
      
      // Update the processed transactions after each batch
      setProcessedTransactions([...processed]);
      
      // Update progress
      const progress = Math.min(100, Math.round((processed.length / txs.length) * 100));
      setFetchProgress(progress);
    }
    
    console.log(`Processed ${processed.length} transactions in total`);
    setProcessedTransactions(processed);
  };
  
  // Get current page transactions - paginate locally since we've fetched all transactions
  const getCurrentPageTransactions = () => {
    const startIndex = (page - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    const pageTransactions = processedTransactions.slice(startIndex, endIndex);
    
    console.log(`Getting page ${page} transactions: ${startIndex}-${endIndex} of ${processedTransactions.length}`);
    return pageTransactions;
  };
  
  // Handle pagination - now just updates the page state for local pagination
  const handlePreviousPage = () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      // Scroll to top of results
      window.scrollTo(0, 0);
    }
  };
  
  const handleNextPage = () => {
    if (page < totalPages) {
      const newPage = page + 1;
      setPage(newPage);
      // Scroll to top of results
      window.scrollTo(0, 0);
    }
  };
  
  // Handle using connected wallet
  const useConnectedWallet = () => {
    if (connected && walletAddress) {
      setManualAddress('');
      setAddress(walletAddress);
    }
  };
  
  // Custom CSS classes for 98.css styling
  const customStyles = {
    monospaceText: {
      fontFamily: 'monospace',
    },
    clickable: {
      cursor: 'pointer',
    },
    flexBetween: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    flexCenter: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    flexGap: {
      display: 'flex',
      gap: '10px',
    },
    fullWidth: {
      width: '100%',
    },
    marginBottom: {
      marginBottom: '16px',
    },
    marginTop: {
      marginTop: '16px',
    },
    textAlignRight: {
      textAlign: 'right',
    },
    textAlignCenter: {
      textAlign: 'center',
    },
    inlineTag: {
      display: 'inline-block',
      marginLeft: '5px',
      fontSize: '12px',
      padding: '2px 5px',
    },
    opReturnTag: {
      backgroundColor: '#c0c0c0',
      color: '#000000',
    },
    runesTag: {
      backgroundColor: '#9C27B0',
      color: '#FFFFFF',
    },
    alkanesTag: {
      backgroundColor: '#FF9800',
      color: '#FFFFFF',
    },
    alkanesDetails: {
      marginTop: '5px',
      padding: '5px',
      backgroundColor: '#ffffcc',
      fontSize: '12px',
    },
    progressText: {
      marginBottom: '8px',
    },
  };
  
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      <h2>Transaction Inputs & Outputs Explorer</h2>
      <p className={customStyles.marginBottom}>
        Search for a Bitcoin address to view all its transactions with inputs and outputs.
      </p>
      
      <fieldset>
        <legend>Search</legend>
        <form onSubmit={handleSubmit}>
          <div className="field-row-stacked">
            <label htmlFor="bitcoinAddress">Bitcoin Address:</label>
            <input
              id="bitcoinAddress"
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Enter Bitcoin address"
              className={customStyles.fullWidth}
            />
          </div>
          
          <div className="field-row" style={{ marginTop: '16px' }}>
            <button 
              type="submit" 
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            
            {connected && walletAddress && (
              <button
                type="button"
                onClick={useConnectedWallet}
              >
                Use Connected Wallet
              </button>
            )}
          </div>
        </form>
        
        {error && (
          <div className="status-bar error" style={{ marginTop: '16px', color: 'red' }}>
            <div className="status-bar-field">Error: {error}</div>
          </div>
        )}
      </fieldset>
      
        {address && (
        <fieldset style={{ marginTop: '16px' }}>
          <legend>Results</legend>
          <div className="field-row" style={{ marginBottom: '16px' }}>
            <label>Address:</label>
            <span className={customStyles.monospaceText}>{address}</span>
          </div>
          
          {loading ? (
            <div className="status-bar">
              <div className="status-bar-field">Loading transactions...</div>
            </div>
          ) : fetchingAllTransactions ? (
            <div>
              <p className={customStyles.progressText}>Fetching transactions... {fetchProgress}% complete</p>
              <div className="sunken-panel" style={{ height: '20px', position: 'relative', marginBottom: '8px' }}>
                <div style={{ 
                  position: 'absolute', 
                  left: 0, 
                  top: 0, 
                  height: '100%', 
                  width: `${fetchProgress}%`,
                  backgroundColor: '#008080'
                }}></div>
              </div>
              <p className={customStyles.progressText}>This may take a while for addresses with many transactions.</p>
            </div>
          ) : processedTransactions.length > 0 ? (
            <div>
              <div className="status-bar" style={{ marginBottom: '16px' }}>
                <div className="status-bar-field">
                  Showing {getCurrentPageTransactions().length} of {processedTransactions.length} transactions (Total: {totalTransactions})
                </div>
              </div>
              
              {getCurrentPageTransactions().map((tx, index) => (
                <fieldset key={tx.txid} style={{ 
                  marginBottom: '24px', 
                  border: '2px solid #c0c0c0',
                  borderRadius: '4px',
                  padding: '16px'
                }}>
                  <legend>Transaction {index + 1}</legend>
                    
                    <div className="field-row" style={{ marginBottom: '8px' }}>
                      <label>TXID:</label>
                      <span 
                        className={`${customStyles.monospaceText} ${customStyles.clickable}`}
                        onClick={() => copyToClipboard(tx.txid)}
                        title="Click to copy"
                      >
                        {tx.txid}
                      </span>
                    </div>
                    
                    <div className="field-row" style={{ marginBottom: '8px' }}>
                      <label>Date:</label>
                      <span>{formatDate(tx.status?.block_time)}</span>
                    </div>
                    
                    <div className="field-row" style={{ marginBottom: '8px' }}>
                      <label>Block Height:</label>
                      <span>{tx.status?.block_height || 'Unconfirmed'}</span>
                    </div>
                    
                    <div className="field-row" style={{ marginBottom: '8px', justifyContent: 'space-between' }}>
                      <span>Inputs & Outputs</span>
                      <a 
                        href={getMempoolSpaceUrl(tx.txid)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <button>Details</button>
                      </a>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {/* Inputs Column */}
                      <div style={{ flex: 1 }}>
                        <fieldset>
                          <legend>Inputs</legend>
                          <div className="sunken-panel">
                            {tx.inputs.map((input, i) => (
                              <div key={i} className="field-row" style={{ margin: '4px 0', padding: '4px', border: '1px solid #c0c0c0' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span style={{ color: '#FF0000', marginRight: '5px' }}>▶</span>
                                  {input.isCoinbase ? (
                                    <span className={`${customStyles.inlineTag} ${customStyles.opReturnTag}`}>Coinbase (New Coins)</span>
                                  ) : (
                                    <span 
                                      className={`${customStyles.monospaceText} ${customStyles.clickable}`}
                                      onClick={() => copyToClipboard(input.address)}
                                      title="Click to copy"
                                    >
                                      {shortenAddress(input.address)}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontWeight: 'bold' }}>
                                  {input.valueBTC.toFixed(8)} BTC
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="status-bar" style={{ marginTop: '8px' }}>
                            <div className="status-bar-field" style={{ justifyContent: 'flex-end' }}>
                              <strong>Total:</strong> {tx.totalInputBTC.toFixed(8)} BTC
                            </div>
                          </div>
                        </fieldset>
                      </div>
                      
                      {/* Outputs Column */}
                      <div style={{ flex: 1 }}>
                        <fieldset>
                          <legend>Outputs</legend>
                          <div className="sunken-panel">
                            {tx.outputs.map((output, i) => (
                              <div key={i} className="field-row" style={{ margin: '4px 0', padding: '4px', border: '1px solid #c0c0c0' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span style={{ color: '#00AA00', marginRight: '5px' }}>◀</span>
                                  {output.isOpReturn ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span className={`${customStyles.inlineTag} ${customStyles.opReturnTag}`}>OP_RETURN</span>
                                      <span className={`${customStyles.inlineTag} ${customStyles.runesTag}`}>Runestone</span>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span
                                        className={`${customStyles.monospaceText} ${customStyles.clickable}`}
                                        onClick={() => copyToClipboard(output.address)}
                                        title="Click to copy"
                                      >
                                        {shortenAddress(output.address)}
                                      </span>
                                      {output.alkanes && (
                                        <span className={`${customStyles.inlineTag} ${customStyles.alkanesTag}`}>Alkanes</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontWeight: 'bold' }}>
                                  {output.valueBTC.toFixed(8)} BTC
                                </div>
                                {output.alkanes && (
                                  <div className="sunken-panel" style={{ width: '100%', marginTop: '8px', padding: '8px', backgroundColor: '#ffffcc' }}>
                                    <div className="field-row" style={{ marginBottom: '4px', justifyContent: 'space-between' }}>
                                      <span style={{ fontWeight: 'bold' }}>Token Details ({output.alkanes.length})</span>
                                    </div>
                                    
                                    {output.alkanes.map((alkane, j) => (
                                      <div key={j} style={{ 
                                        padding: '4px', 
                                        margin: '4px 0', 
                                        border: '1px solid #c0c0c0',
                                        backgroundColor: '#ffffff'
                                      }}>
                                        <div className="field-row">
                                          <label>Token:</label>
                                          <span>{alkane.token.name} ({alkane.token.symbol})</span>
                                        </div>
                                        <div className="field-row">
                                          <label>ID:</label>
                                          <span>{alkane.token.id.formatted}</span>
                                        </div>
                                        <div className="field-row">
                                          <label>Value:</label>
                                          <span>{alkane.valueFormatted.toFixed(8)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="status-bar" style={{ marginTop: '8px' }}>
                            <div className="status-bar-field" style={{ justifyContent: 'flex-end' }}>
                              <strong>Total:</strong> {tx.totalOutputBTC.toFixed(8)} BTC
                            </div>
                          </div>
                        </fieldset>
                      </div>
                    </div>
                    
                    <div className="status-bar" style={{ marginTop: '8px' }}>
                      <div className="status-bar-field" style={{ justifyContent: 'flex-end' }}>
                        <strong>Fee:</strong> {tx.feeBTC.toFixed(8)} BTC
                      </div>
                    </div>
                  </fieldset>
                ))}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="field-row" style={{ justifyContent: 'center', marginTop: '16px' }}>
                  <button
                    onClick={handlePreviousPage}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <div className="status-bar" style={{ margin: '0 10px' }}>
                    <div className="status-bar-field">
                      Page {page} of {totalPages} ({processedTransactions.length} of {totalTransactions} transactions)
                    </div>
                  </div>
                  <button
                    onClick={handleNextPage}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="status-bar">
              <div className="status-bar-field">No transactions found for this address.</div>
            </div>
          )}
        </fieldset>
      )}
      
      <div className="status-bar" style={{ marginTop: '16px' }}>
        <div className="status-bar-field">Network: {endpoint}</div>
        <div className="status-bar-field">
          {loading ? 'Searching...' : fetchingAllTransactions ? `Fetching: ${fetchProgress}%` : 'Ready'}
        </div>
      </div>
    </div>
  );
};

export default TransactionInputsOutputsExplorer;
