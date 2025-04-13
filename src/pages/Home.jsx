import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';

/**
 * Home Page Component
 *
 * The main landing page for the METAGRAPH application
 * Displays categories of API methods and explorer links using group boxes.
 */
const Home = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {}; // Endpoint context might be useful later

  return (
    // Main container div (no special styling needed here)
    <div>
      <h2>Welcome to METAGRAPH</h2>
      <p>An interactive playground for Alkanes metaprotocol and Sandshrew API methods.</p>

      {/* Use flexbox for simple two-column layout */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>

        {/* Left Column - Playground */}
        <fieldset className="group-box" style={{ flex: 1 }}>
          <legend>Playground</legend>
          {/* List of methods */}
          <div style={{ marginBottom: '8px' }}>
            <Link to="/api-methods/trace">/api-methods/trace</Link>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              Explore and debug transaction execution with detailed trace output
            </p>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <Link to="/api-methods/simulate">/api-methods/simulate</Link>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              Simulate Alkanes operations to preview outcomes without broadcasting
            </p>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <Link to="/api-methods/protorunesbyoutpoint">/api-methods/protorunesbyoutpoint</Link>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              Query Protorunes by outpoint (txid, vout) at a specific block height
            </p>
          </div>
        </fieldset>

        {/* Right Column - Explorer */}
        <fieldset className="group-box" style={{ flex: 1 }}>
          <legend>Explorer</legend>
          {/* List of explorer links */}
          <div style={{ marginBottom: '8px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to="/explorer/2:n">/explorer/2:n</Link>
                <span style={{ fontSize: '11px', color: '#555' }}>[2,n]</span>
             </div>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              View all <strong>initialized</strong> Alkanes tokens
            </p>
          </div>

          <div style={{ marginBottom: '8px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to="/explorer/alkanes-templates">/explorer/alkanes-templates</Link>
                <span style={{ fontSize: '11px', color: '#555' }}>[4,n]</span>
             </div>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              View all deployed Alkanes factory templates
            </p>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <Link to="/explorer/alkanes-balance">/explorer/alkanes-balance</Link>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              Explore Alkanes balances across the network
            </p>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <Link to="/explorer/address">/explorer/address</Link>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              Explore transactions for an address
            </p>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <Link to="/explorer/transaction-io">/explorer/transaction-io</Link>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              Explore transaction inputs and outputs
            </p>
          </div>
        </fieldset>

      </div>
    </div>
  );
};

export default Home;
