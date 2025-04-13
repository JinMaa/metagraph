import React, { useState } from 'react';
import { performAlkanesSimulation } from '../../sdk/alkanes';

/**
 * SimulationForm Component
 * 
 * Form for simulating transactions before they are broadcast to the network
 * Allows previewing the outcome of a transaction execution
 */
const SimulationForm = ({ endpoint = 'local' }) => {
  const [txid, setTxid] = useState('');
  const [scriptHex, setScriptHex] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // Create simulation parameters
      const params = {
        txid: txid,
        script: scriptHex || undefined
      };
      
      // Call the simulation API
      const simulationResult = await performAlkanesSimulation(params, endpoint);
      
      if (simulationResult.status === 'error') {
        throw new Error(simulationResult.message);
      }
      
      setResults(simulationResult);
    } catch (err) {
      console.error('Error simulating transaction:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <h2>Simulate Transaction</h2>
      <p style={{ marginBottom: '16px' }}>
        This method simulates the execution of a transaction to preview its outcome without broadcasting it to the network.
      </p>
      
      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Simulation Parameters</legend>
          
          <div className="field-row-stacked" style={{ marginBottom: '16px' }}>
            <label htmlFor="txid">Transaction ID:</label>
            <input
              type="text"
              id="txid"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              placeholder="Enter transaction ID to simulate"
              required
              style={{ width: '100%' }}
            />
          </div>
          
          <div className="field-row-stacked" style={{ marginBottom: '16px' }}>
            <label htmlFor="scriptHex">Script Hex (Optional):</label>
            <input
              type="text"
              id="scriptHex"
              value={scriptHex}
              onChange={(e) => setScriptHex(e.target.value)}
              placeholder="Optional: Enter script hex to use for simulation"
              style={{ width: '100%' }}
            />
          </div>
          
          <div className="field-row" style={{ marginTop: '16px' }}>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Simulating...' : 'Simulate Transaction'}
            </button>
          </div>
        </fieldset>
      </form>
      
      {error && (
        <div className="status-bar error" style={{ marginTop: '16px', color: 'red' }}>
          <div className="status-bar-field">Error: {error}</div>
        </div>
      )}
      
      {isLoading && (
        <div className="status-bar" style={{ marginTop: '16px' }}>
          <div className="status-bar-field">Simulating transaction... This may take a moment.</div>
        </div>
      )}
      
      {results && !isLoading && (
        <fieldset style={{ marginTop: '16px' }}>
          <legend>Simulation Results</legend>
          
          <div className="field-row" style={{ marginBottom: '16px' }}>
            <label>Transaction Status:</label>
            <div 
              style={{ 
                display: 'inline-block',
                padding: '4px 8px',
                backgroundColor: results.status === 'success' ? '#e6ffe6' : '#ffe6e6',
                border: '1px solid',
                borderColor: results.status === 'success' ? '#006600' : '#cc0000',
                color: results.status === 'success' ? '#006600' : '#cc0000'
              }}
            >
              {results.status === 'success' ? 'Success' : 'Failed'}
            </div>
          </div>
          
          {results.results && (
            <div className="sunken-panel" style={{ padding: '8px' }}>
              {results.results.gasUsed && (
                <div className="field-row" style={{ marginBottom: '8px' }}>
                  <label>Gas Used:</label>
                  <span>{results.results.gasUsed}</span>
                </div>
              )}
              
              {results.results.value && (
                <div className="field-row" style={{ marginBottom: '8px' }}>
                  <label>Return Value:</label>
                  <span>{results.results.value.toString()}</span>
                </div>
              )}
              
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '8px' }}>Full Results</h4>
                <pre style={{ 
                  backgroundColor: '#f0f0f0', 
                  padding: '8px', 
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  border: '1px solid #c0c0c0'
                }}>
                  {JSON.stringify(results.results, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </fieldset>
      )}
      
      <div className="status-bar" style={{ marginTop: '16px' }}>
        <div className="status-bar-field">Network: {endpoint}</div>
        <div className="status-bar-field">
          {isLoading ? 'Simulating...' : 'Ready'}
        </div>
      </div>
    </div>
  );
};

export default SimulationForm;
