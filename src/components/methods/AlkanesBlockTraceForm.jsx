import React, { useState, useEffect } from 'react';
import { traceBlockAlkanes } from '../../sdk/alkanes';
import ProgressBar from '../shared/ProgressBar';

/**
 * AlkanesBlockTraceForm Component
 * 
 * Form for tracing transactions in a block and identifying Alkanes transactions
 * @param {Object} props
 * @param {string} props.endpoint - Current endpoint (regtest, mainnet, oylnet)
 */
const AlkanesBlockTraceForm = ({ endpoint = 'mainnet' }) => {
  const [blockHeight, setBlockHeight] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  
  // Filter states
  const [showOnlyAlkanes, setShowOnlyAlkanes] = useState(false);
  const [filterByEvent, setFilterByEvent] = useState('all'); // 'all', 'create', 'invoke', 'return'
  const [filterByStatus, setFilterByStatus] = useState('all'); // 'all', 'success', 'error'
  
  // Handle progress updates
  const handleProgress = (progressData) => {
    setProgress(progressData);
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);
    setProgress({ current: 0, total: 0, percentage: 0 });
    
    try {
      // Trace the block
      const blockResult = await traceBlockAlkanes(blockHeight, endpoint, handleProgress);
      setResults(blockResult);
      
      if (blockResult.status === 'error') {
        throw new Error(blockResult.message);
      }
    } catch (err) {
      console.error('Error tracing block:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter transactions based on current filter settings
  const filteredTransactions = React.useMemo(() => {
    if (!results || !results.transactions) return [];
    
    return results.transactions.filter(tx => {
      // Filter by Alkanes
      if (showOnlyAlkanes && !tx.hasAlkanes) return false;
      
      // Filter by event type
      if (filterByEvent !== 'all' && tx.eventType !== filterByEvent) return false;
      
      // Filter by status
      if (filterByStatus !== 'all' && tx.eventStatus !== filterByStatus) return false;
      
      return true;
    });
  }, [results, showOnlyAlkanes, filterByEvent, filterByStatus]);
  
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
  
  return (
    <div className="alkanes-block-trace-form">
      <h2>Alkanes Block Explorer</h2>
      <p className="api-description">
        This tool traces all transactions in a block, identifies those with OP_RETURN outputs,
        and runs trace on each to find Alkanes transactions.
      </p>
      
      <fieldset className="group-box">
        <legend>Block Search</legend>
        <form onSubmit={handleSubmit}>
          <div className="field-row-stacked">
            <label htmlFor="blockHeight">Block Height:</label>
            <input
              type="text"
              id="blockHeight"
              value={blockHeight}
              onChange={(e) => setBlockHeight(e.target.value)}
              placeholder="Enter block height (e.g., 817974)"
              required
            />
          </div>
          
          <button type="submit" disabled={isLoading} className="submit-button">
            {isLoading ? 'Tracing...' : 'Trace Block'}
          </button>
        </form>
      </fieldset>
      
      {error && (
        <div className="error-message">
          <fieldset className="group-box">
            <legend>Error</legend>
            <p>{error}</p>
          </fieldset>
        </div>
      )}
      
      {isLoading && (
        <div className="loading-message">
          <fieldset className="group-box">
            <legend>Processing</legend>
            <p>Tracing transactions... This may take a moment.</p>
            <p>Processing transaction {progress.current} of {progress.total} ({progress.percentage}%)</p>
            <ProgressBar 
              value={progress.percentage} 
              style={{ width: '100%', minWidth: '100px' }}
              label={`${progress.percentage}%`}
            />
          </fieldset>
        </div>
      )}
      
      {results && !isLoading && (
        <div className="results-container">
          <fieldset className="group-box">
            <legend>Block Information</legend>
            <div className="field-row">
              <label>Block Height:</label>
              <span>{results.blockHeight}</span>
            </div>
            <div className="field-row">
              <label>Block Hash:</label>
              <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{results.blockHash || 'N/A'}</span>
            </div>
            <div className="field-row">
              <label>Timestamp:</label>
              <span>{results.blockDetails.timestamp ? formatDate(results.blockDetails.timestamp) : 'N/A'}</span>
            </div>
            <div className="field-row">
              <label>Total Transactions:</label>
              <span>{results.transactions?.length || 0}</span>
            </div>
          </fieldset>
          
          {/* Summary */}
          <fieldset className="group-box">
            <legend>Summary</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div>
                <div className="field-row">
                  <label>Total Transactions:</label>
                  <span>{results.summary.total}</span>
                </div>
                <div className="field-row">
                  <label>With OP_RETURN:</label>
                  <span>{results.summary.withOpReturn}</span>
                </div>
              </div>
              <div>
                <div className="field-row">
                  <label>With Alkanes:</label>
                  <span>{results.summary.withAlkanes}</span>
                </div>
                <div className="field-row">
                  <label>Successful Traces:</label>
                  <span>{results.summary.successful}</span>
                </div>
              </div>
              <div>
                <div className="field-row">
                  <label>Failed Traces:</label>
                  <span>{results.summary.errors}</span>
                </div>
                <div className="field-row">
                  <label>Skipped Traces:</label>
                  <span>{results.summary.skipped}</span>
                </div>
              </div>
            </div>
          </fieldset>
          
          {/* Filters */}
          <fieldset className="group-box">
            <legend>Filters</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div className="field-row">
                <input
                  id="showOnlyAlkanes"
                  type="checkbox"
                  checked={showOnlyAlkanes}
                  onChange={() => setShowOnlyAlkanes(!showOnlyAlkanes)}
                  className="checkbox"
                />
                <label htmlFor="showOnlyAlkanes">Show only Alkanes transactions</label>
              </div>
              
              <div className="field-row">
                <label htmlFor="filterByEvent">Filter by Event:</label>
                <select
                  id="filterByEvent"
                  value={filterByEvent}
                  onChange={(e) => setFilterByEvent(e.target.value)}
                >
                  <option value="all">All Events</option>
                  <option value="create">Create</option>
                  <option value="invoke">Invoke</option>
                  <option value="return">Return</option>
                </select>
              </div>
              
              <div className="field-row">
                <label htmlFor="filterByStatus">Filter by Status:</label>
                <select
                  id="filterByStatus"
                  value={filterByStatus}
                  onChange={(e) => setFilterByStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
          </fieldset>
          
          {/* Transaction List */}
          <fieldset className="group-box">
            <legend>Transactions ({filteredTransactions.length})</legend>
            
            {filteredTransactions.length === 0 ? (
              <p>No transactions match the current filters.</p>
            ) : (
              filteredTransactions.map((tx) => (
                <fieldset 
                  key={tx.txid} 
                  className={`transaction-item ${tx.hasAlkanes ? 'alkanes' : ''}`}
                  style={{ 
                    marginBottom: '15px', 
                    border: tx.hasAlkanes ? '2px solid #FF9800' : '1px solid #c0c0c0',
                    padding: '10px'
                  }}
                >
                  <legend>
                    Transaction #{tx.txIndex}
                    {tx.hasAlkanes && (
                      <span style={{ 
                        marginLeft: '10px', 
                        backgroundColor: '#FF9800', 
                        color: 'white', 
                        padding: '2px 5px',
                        borderRadius: '3px',
                        fontSize: '12px'
                      }}>
                        Alkanes
                      </span>
                    )}
                  </legend>
                  
                  <div className="transaction-details">
                    <div className="field-row">
                      <label>TXID:</label>
                      <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        <a 
                          href={getMempoolSpaceUrl(tx.txid)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#0000FF', textDecoration: 'none' }}
                        >
                          {tx.txid}
                        </a>
                      </span>
                    </div>
                    
                    <div className="field-row">
                      <label>Has OP_RETURN:</label>
                      <span>{tx.hasOpReturn ? 'Yes' : 'No'}</span>
                    </div>
                    
                    <div className="field-row">
                      <label>Trace Status:</label>
                      <span style={{ 
                        color: tx.traceStatus === 'success' ? 'green' : 
                               tx.traceStatus === 'error' ? 'red' : 'gray'
                      }}>
                        {tx.traceStatus}
                      </span>
                    </div>
                    
                    {tx.traceStatus === 'skipped' && (
                      <div className="field-row">
                        <label>Reason:</label>
                        <span>{tx.traceReason}</span>
                      </div>
                    )}
                    
                    {tx.traceStatus === 'error' && (
                      <div className="field-row">
                        <label>Error:</label>
                        <span style={{ color: 'red' }}>{tx.traceError}</span>
                      </div>
                    )}
                    
                    {tx.eventType && (
                      <div className="field-row">
                        <label>Event Type:</label>
                        <span>{tx.eventType}</span>
                      </div>
                    )}
                    
                    {tx.eventStatus && (
                      <div className="field-row">
                        <label>Event Status:</label>
                        <span style={{ 
                          color: tx.eventStatus === 'success' ? 'green' : 
                                 tx.eventStatus === 'error' ? 'red' : 'black'
                        }}>
                          {tx.eventStatus}
                        </span>
                      </div>
                    )}
                    
                    {/* Show Alkanes details if available */}
                    {tx.hasAlkanes && tx.eventData && tx.eventData.response && tx.eventData.response.alkanes && (
                      <div className="alkanes-details" style={{ marginTop: '10px' }}>
                        <fieldset>
                          <legend>Alkanes Details</legend>
                          <div className="sunken-panel" style={{ 
                            backgroundColor: '#f0f0f0', 
                            padding: '10px', 
                            fontFamily: 'monospace', 
                            fontSize: '12px',
                            maxHeight: '200px',
                            overflow: 'auto'
                          }}>
                            <pre>{JSON.stringify(tx.eventData.response.alkanes, null, 2)}</pre>
                          </div>
                        </fieldset>
                      </div>
                    )}
                    
                    {/* Toggle full trace button */}
                    {tx.traceStatus === 'success' && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          onClick={() => {
                            // Toggle showing full trace
                            const detailsElement = document.getElementById(`trace-details-${tx.txid}`);
                            if (detailsElement) {
                              detailsElement.style.display = 
                                detailsElement.style.display === 'none' ? 'block' : 'none';
                            }
                          }}
                        >
                          Toggle Full Trace
                        </button>
                      </div>
                    )}
                    
                    {/* Full trace details (hidden by default) */}
                    {tx.traceStatus === 'success' && (
                      <div 
                        id={`trace-details-${tx.txid}`} 
                        className="full-trace" 
                        style={{ display: 'none', marginTop: '10px' }}
                      >
                        <fieldset>
                          <legend>Full Trace</legend>
                          <div className="sunken-panel" style={{ 
                            backgroundColor: '#f0f0f0', 
                            padding: '10px', 
                            fontFamily: 'monospace', 
                            fontSize: '12px',
                            maxHeight: '300px',
                            overflow: 'auto'
                          }}>
                            <pre>{JSON.stringify(tx.traceResult, null, 2)}</pre>
                          </div>
                        </fieldset>
                      </div>
                    )}
                  </div>
                </fieldset>
              ))
            )}
          </fieldset>
        </div>
      )}
    </div>
  );
};

export default AlkanesBlockTraceForm;
