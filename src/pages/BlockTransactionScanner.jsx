import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { traceTransaction } from '../sdk/alkanes';
import getProvider from '../sdk/provider';

/**
 * BlockTransactionScanner Component
 * 
 * Page for scanning all transactions in a block, tracing them,
 * and classifying them by event type, status, and alkaneID
 */
const BlockTransactionScanner = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  
  // State for block input
  const [blockHeight, setBlockHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for block data
  const [blockData, setBlockData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  // State for trace results
  const [traceResults, setTraceResults] = useState({});
  const [traceProgress, setTraceProgress] = useState(0);
  
  // State for classification
  const [classifiedTransactions, setClassifiedTransactions] = useState({
    byEventType: {},
    byStatus: {},
    byAlkaneID: {}
  });
  
  // State for UI
  const [activeClassification, setActiveClassification] = useState('byAlkaneID');
  
  // Helper function to shorten txids
  const shortenTxid = (txid) => {
    if (!txid) return 'N/A';
    if (txid.length <= 13) return txid;
    return `${txid.substring(0, 6)}...${txid.substring(txid.length - 6)}`;
  };
  
  // Function to copy text to clipboard
  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
  };
  
  // Reset component state when endpoint/network changes
  useEffect(() => {
    setBlockData(null);
    setTransactions([]);
    setTraceResults({});
    setError(null);
    setClassifiedTransactions({
      byEventType: {},
      byStatus: {},
      byAlkaneID: {}
    });
  }, [endpoint]);
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset all states before making a new request
    setError(null);
    setBlockData(null);
    setTransactions([]);
    setTraceResults({});
    setTraceProgress(0);
    setClassifiedTransactions({
      byEventType: {},
      byStatus: {},
      byAlkaneID: {}
    });
    
    // Validate block height
    if (!blockHeight) {
      setError("Please enter a block height");
      return;
    }
    
    const heightNum = parseInt(blockHeight, 10);
    if (isNaN(heightNum) || heightNum < 0) {
      setError("Please enter a valid block height");
      return;
    }
    
    // Set loading state
    setLoading(true);
    
    try {
      console.log(`Scanning block at height ${blockHeight} on network ${endpoint}`);
      
      // Get the provider
      const provider = getProvider(endpoint);
      
      // First get the block hash
      const blockHash = await provider.sandshrew.bitcoindRpc.getBlockHash(heightNum);
      
      // Then get the block with all transaction details
      const blockInfo = await provider.sandshrew.bitcoindRpc.getBlock(blockHash, 2); // Verbosity 2 gets full tx info
      
      if (!blockInfo || !blockInfo.tx) {
        throw new Error(`Block information not available for height ${blockHeight}`);
      }
      
      // Store block data
      setBlockData(blockInfo);
      
      // Process transactions
      const txs = blockInfo.tx.map((tx, index) => ({
        txid: tx.txid || tx.hash,
        index,
        size: tx.size,
        weight: tx.weight,
        fee: tx.fee,
        vsize: tx.vsize,
        status: "pending" // Initial status before tracing
      }));
      
      setTransactions(txs);
      
      // Start tracing transactions
      await traceAllTransactions(txs);
      
    } catch (err) {
      console.error("Error scanning block:", err);
      setError(err.message || "Failed to scan block");
    } finally {
      setLoading(false);
    }
  };
  
  // Trace all transactions in the block
  const traceAllTransactions = async (txs) => {
    const results = {};
    
    // Process transactions sequentially to respect the order
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      
      try {
        // Trace both vout 4 and vout 5
        const result4 = await traceTransaction(tx.txid, 4, endpoint);
        const result5 = await traceTransaction(tx.txid, 5, endpoint);
        
        results[tx.txid] = {
          vout4: result4,
          vout5: result5
        };
        
        // Update progress
        setTraceProgress(Math.round(((i + 1) / txs.length) * 100));
        
      } catch (error) {
        console.error(`Error tracing transaction ${tx.txid}:`, error);
        results[tx.txid] = { 
          status: "error", 
          message: error.message 
        };
      }
    }
    
    setTraceResults(results);
    
    // Classify transactions based on trace results
    classifyTransactions(txs, results);
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
  
  // Classify transactions based on trace results
  const classifyTransactions = (txs, traceResults) => {
    const classification = {
      byEventType: {
        invoke: [],
        return: [],
        other: []
      },
      byStatus: {
        success: [],
        revert: [],
        error: []
      },
      byAlkaneID: {}
    };
    
    txs.forEach(tx => {
      const txResult = traceResults[tx.txid];
      
      // Skip if no trace results
      if (!txResult) {
        classification.byEventType.other.push(tx);
        classification.byStatus.error.push(tx);
        return;
      }
      
      // Check both vout4 and vout5 results
      const vout4Result = txResult.vout4;
      const vout5Result = txResult.vout5;
      
      // Process vout4 result
      if (vout4Result && vout4Result.status === "success" && vout4Result.result) {
        processTraceResult(tx, vout4Result, 4, classification);
      }
      
      // Process vout5 result
      if (vout5Result && vout5Result.status === "success" && vout5Result.result) {
        processTraceResult(tx, vout5Result, 5, classification);
      }
      
      // If no valid results were processed, add to error categories
      if (!tx.processed) {
        classification.byEventType.other.push(tx);
        classification.byStatus.error.push(tx);
      }
    });
    
    setClassifiedTransactions(classification);
  };
  
  // Process a single trace result and update classification
  const processTraceResult = (tx, traceResult, vout, classification) => {
    // Find invoke event
    const invokeEvent = traceResult.result.find(event => event.event === "invoke");
    if (invokeEvent) {
      // Mark as processed
      tx.processed = true;
      
      // Add to invoke category
      classification.byEventType.invoke.push({
        ...tx,
        vout,
        invokeEvent
      });
    }
    
    // Find return event
    const returnEvent = traceResult.result.find(event => event.event === "return");
    if (returnEvent) {
      // Mark as processed
      tx.processed = true;
      
      // Add to return category
      classification.byEventType.return.push({
        ...tx,
        vout,
        returnEvent
      });
      
      // Check status
      const status = returnEvent.data?.status;
      if (status === "success") {
        classification.byStatus.success.push({
          ...tx,
          vout,
          returnEvent
        });
        
        // Extract alkanes if available
        if (returnEvent.data?.response?.alkanes) {
          returnEvent.data.response.alkanes.forEach(alkane => {
            if (alkane.id) {
              // Convert block and tx from hex to decimal
              const blockDec = hexToDec(alkane.id.block);
              const txDec = hexToDec(alkane.id.tx);
              const alkaneId = `[${blockDec},${txDec}]`;
              
              // Initialize array if needed
              if (!classification.byAlkaneID[alkaneId]) {
                classification.byAlkaneID[alkaneId] = [];
              }
              
              // Add to alkaneID category
              classification.byAlkaneID[alkaneId].push({
                ...tx,
                vout,
                returnEvent,
                alkaneId,
                alkaneValue: hexToDec(alkane.value)
              });
            }
          });
        }
      } else if (status === "revert") {
        classification.byStatus.revert.push({
          ...tx,
          vout,
          returnEvent
        });
      } else {
        classification.byStatus.error.push({
          ...tx,
          vout,
          returnEvent
        });
      }
    }
  };
  
  // Format date from timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  // Calculate sats per vbyte
  const calculateSatsPerVbyte = (fee, vsize) => {
    if (!fee || !vsize) return 'N/A';
    const satsPerVbyte = (fee * 100000000) / vsize; // Convert BTC to sats
    return satsPerVbyte.toFixed(2);
  };
  
  // CSS for inline styling
  const styles = {
    container: {
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#FFFFFF',
      padding: '20px',
      border: '1px solid #E0E0E0',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '16px',
      textAlign: 'left',
      fontFamily: 'Roboto Mono, monospace',
    },
    description: {
      fontSize: '14px',
      marginBottom: '20px',
      textAlign: 'left',
      fontFamily: 'Roboto Mono, monospace',
    },
    section: {
      marginBottom: '20px',
      padding: '20px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E0E0E0',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    formRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
    },
    input: {
      padding: '8px',
      border: '1px solid #E0E0E0',
      borderRadius: '4px',
      width: '100%',
      fontFamily: 'Roboto Mono, monospace',
      fontSize: '14px',
    },
    button: {
      backgroundColor: '#000000',
      color: '#FFFFFF',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'Roboto Mono, monospace',
      fontSize: '14px',
      fontWeight: 'bold',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '20px',
      fontFamily: 'Roboto Mono, monospace',
    },
    tableHead: {
      backgroundColor: '#F5F5F5',
      textAlign: 'left',
    },
    tableRow: {
      borderBottom: '1px solid #E0E0E0',
    },
    tableCell: {
      padding: '12px 8px',
      textAlign: 'left',
      fontSize: '14px',
    },
    tableHeaderCell: {
      padding: '12px 8px',
      fontWeight: 'bold',
      textAlign: 'left',
      fontSize: '14px',
    }
  };
  
  // Render the component
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Block Transaction Scanner</h2>
      <p style={styles.description}>
        Scan all transactions in a block, trace them, and classify them by event type, status, and alkaneID.
        Currently using the {endpoint.toUpperCase()} network.
      </p>
      
      {/* Block input form */}
      <div style={styles.section}>
        <form style={styles.form} onSubmit={handleSubmit}>
          <div>
            <label style={{fontWeight: 'bold', marginBottom: '8px', display: 'block'}}>Block Height</label>
            <div style={styles.formRow}>
              <input
                type="text"
                style={styles.input}
                placeholder="Enter a block height"
                value={blockHeight}
                onChange={(e) => setBlockHeight(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                style={loading ? {...styles.button, opacity: 0.7} : styles.button}
                disabled={loading}
              >
                {loading ? 'Scanning...' : 'Scan Block'}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Show loading state */}
      {loading && (
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0'}}>
          <div>Loading...</div>
        </div>
      )}
      
      {/* Show error state */}
      {error && (
        <div style={{padding: '16px', backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '4px', marginTop: '20px'}}>
          <p style={{color: '#B71C1C', fontSize: '14px'}}>{error}</p>
        </div>
      )}
      
      {/* Show block information */}
      {blockData && (
        <div style={styles.section}>
          <h3 style={styles.title}>Block Information</h3>
          
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px'}}>
            <div style={{padding: '12px', backgroundColor: '#F5F5F5', borderRadius: '4px'}}>
              <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Height</div>
              <div>{blockData.height}</div>
            </div>
            <div style={{padding: '12px', backgroundColor: '#F5F5F5', borderRadius: '4px'}}>
              <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Hash</div>
              <div style={{wordBreak: 'break-all'}}>{blockData.hash}</div>
            </div>
            <div style={{padding: '12px', backgroundColor: '#F5F5F5', borderRadius: '4px'}}>
              <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Time</div>
              <div>{formatDate(blockData.time)}</div>
            </div>
            <div style={{padding: '12px', backgroundColor: '#F5F5F5', borderRadius: '4px'}}>
              <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Transactions</div>
              <div>{blockData.tx.length}</div>
            </div>
          </div>
          
          {/* Show trace progress */}
          {traceProgress > 0 && traceProgress < 100 && (
            <div style={{width: '100%', backgroundColor: '#E0E0E0', borderRadius: '4px', marginTop: '20px'}}>
              <div style={{
                height: '10px', 
                backgroundColor: '#4CAF50', 
                borderRadius: '4px', 
                width: `${traceProgress}%`
              }}></div>
              <div style={{textAlign: 'center', marginTop: '8px', fontSize: '14px'}}>
                Tracing transactions: {traceProgress}% complete
              </div>
            </div>
          )}
          
          {/* Classification tabs */}
          {Object.keys(classifiedTransactions.byAlkaneID).length > 0 && (
            <div style={{marginTop: '20px'}}>
              <div style={{display: 'flex', marginBottom: '10px', borderBottom: '1px solid #E0E0E0'}}>
                <div 
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontFamily: 'Roboto Mono, monospace',
                    fontSize: '14px',
                    backgroundColor: activeClassification === 'byAlkaneID' ? '#FFFFFF' : '#F5F5F5',
                    border: '1px solid #E0E0E0',
                    borderBottom: activeClassification === 'byAlkaneID' ? '1px solid #FFFFFF' : 'none',
                    marginRight: '4px',
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px',
                    fontWeight: activeClassification === 'byAlkaneID' ? 'bold' : 'normal'
                  }}
                  onClick={() => setActiveClassification('byAlkaneID')}
                >
                  By AlkaneID
                </div>
                <div 
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontFamily: 'Roboto Mono, monospace',
                    fontSize: '14px',
                    backgroundColor: activeClassification === 'byStatus' ? '#FFFFFF' : '#F5F5F5',
                    border: '1px solid #E0E0E0',
                    borderBottom: activeClassification === 'byStatus' ? '1px solid #FFFFFF' : 'none',
                    marginRight: '4px',
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px',
                    fontWeight: activeClassification === 'byStatus' ? 'bold' : 'normal'
                  }}
                  onClick={() => setActiveClassification('byStatus')}
                >
                  By Status
                </div>
                <div 
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontFamily: 'Roboto Mono, monospace',
                    fontSize: '14px',
                    backgroundColor: activeClassification === 'byEventType' ? '#FFFFFF' : '#F5F5F5',
                    border: '1px solid #E0E0E0',
                    borderBottom: activeClassification === 'byEventType' ? '1px solid #FFFFFF' : 'none',
                    marginRight: '4px',
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px',
                    fontWeight: activeClassification === 'byEventType' ? 'bold' : 'normal'
                  }}
                  onClick={() => setActiveClassification('byEventType')}
                >
                  By Event Type
                </div>
              </div>
              
              {/* AlkaneID classification */}
              {activeClassification === 'byAlkaneID' && (
                <div>
                  <h4 style={{marginTop: '20px', marginBottom: '10px'}}>Transactions by AlkaneID</h4>
                  {Object.keys(classifiedTransactions.byAlkaneID).length === 0 ? (
                    <p>No transactions with AlkaneID found</p>
                  ) : (
                    Object.entries(classifiedTransactions.byAlkaneID).map(([alkaneId, txs]) => (
                      <div key={alkaneId} style={{marginBottom: '20px', border: '1px solid #E0E0E0', borderRadius: '4px'}}>
                        <div style={{padding: '10px', backgroundColor: '#F5F5F5', fontWeight: 'bold', borderBottom: '1px solid #E0E0E0'}}>
                          AlkaneID: {alkaneId} ({txs.length} transactions)
                        </div>
                        <table style={styles.table}>
                          <thead style={styles.tableHead}>
                            <tr>
                              <th style={styles.tableHeaderCell}>TXID</th>
                              <th style={styles.tableHeaderCell}>Vout</th>
                              <th style={styles.tableHeaderCell}>Fee (sats/vB)</th>
                              <th style={styles.tableHeaderCell}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {txs.map((tx) => (
                              <tr key={`${tx.txid}-${tx.vout}`} style={styles.tableRow}>
                                <td style={styles.tableCell}>
                                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    {shortenTxid(tx.txid)}
                                    <button 
                                      style={{backgroundColor: 'transparent', border: 'none', cursor: 'pointer'}}
                                      onClick={() => copyToClipboard(tx.txid)}
                                      title="Copy TXID"
                                    >
                                      📋
                                    </button>
                                  </div>
                                </td>
                                <td style={styles.tableCell}>{tx.vout}</td>
                                <td style={styles.tableCell}>{calculateSatsPerVbyte(tx.fee, tx.vsize)}</td>
                                <td style={styles.tableCell}>
                                  <a
                                    href={`https://mempool.space/${endpoint === 'mainnet' ? '' : endpoint + '/'}tx/${tx.txid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      backgroundColor: '#FFFFFF',
                                      color: '#000000',
                                      border: '1px solid #000000',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      textDecoration: 'none',
                                      fontSize: '12px',
                                      display: 'inline-block'
                                    }}
                                  >
                                    View
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BlockTransactionScanner;
