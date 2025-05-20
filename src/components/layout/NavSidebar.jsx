import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './NavSidebar.css';

/**
 * NavSidebar Component
 * 
 * Provides a Windows 98-style sidebar navigation with collapsible sections
 * for Playground and Explorer categories.
 */
const NavSidebar = () => {
  const location = useLocation();
  const [playgroundExpanded, setPlaygroundExpanded] = useState(true);
  const [explorerExpanded, setExplorerExpanded] = useState(true);
  
  // Helper to check if a link is active
  const isActive = (path) => location.pathname === path;
  
  // Toggle section expansion
  const togglePlayground = () => setPlaygroundExpanded(!playgroundExpanded);
  const toggleExplorer = () => setExplorerExpanded(!explorerExpanded);
  
  return (
    <div className="nav-sidebar">
      {/* Playground Section */}
      <fieldset className="group-box">
        <legend onClick={togglePlayground} style={{ cursor: 'pointer' }}>
          Playground {playgroundExpanded ? '[-]' : '[+]'}
        </legend>
        
        {playgroundExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <Link 
                to="/api-methods/trace"
                className={`nav-link ${isActive('/api-methods/trace') ? 'active' : ''}`}
              >
                /api-methods/trace
              </Link>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                Explore and debug transaction execution
              </p>
            </div>
            
            <div>
              <Link 
                to="/api-methods/simulate"
                className={`nav-link ${isActive('/api-methods/simulate') ? 'active' : ''}`}
              >
                /api-methods/simulate
              </Link>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                Simulate Alkanes operations
              </p>
            </div>
            
            <div>
              <Link 
                to="/api-methods/protorunesbyoutpoint"
                className={`nav-link ${isActive('/api-methods/protorunesbyoutpoint') ? 'active' : ''}`}
              >
                /api-methods/protorunesbyoutpoint
              </Link>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                Query Protorunes by outpoint
              </p>
            </div>
          </div>
        )}
      </fieldset>
      
      {/* Explorer Section */}
      <fieldset className="group-box" style={{ marginTop: '10px' }}>
        <legend onClick={toggleExplorer} style={{ cursor: 'pointer' }}>
          Explorer {explorerExpanded ? '[-]' : '[+]'}
        </legend>
        
        {explorerExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link 
                  to="/explorer/2:n"
                  className={`nav-link ${isActive('/explorer/2:n') || location.pathname.startsWith('/explorer/2:n/') ? 'active' : ''}`}
                >
                  /explorer/2:n
                </Link>
                <span style={{ fontSize: '11px', color: '#555' }}>[2,n]</span>
              </div>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                View all <strong>initialized</strong> Alkanes tokens
              </p>
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link 
                  to="/explorer/alkanes-templates"
                  className={`nav-link ${isActive('/explorer/alkanes-templates') ? 'active' : ''}`}
                >
                  /explorer/alkanes-templates
                </Link>
                <span style={{ fontSize: '11px', color: '#555' }}>[4,n]</span>
              </div>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                View all deployed Alkanes factory templates
              </p>
            </div>
            
            <div>
              <Link 
                to="/explorer/alkanes-balance"
                className={`nav-link ${isActive('/explorer/alkanes-balance') ? 'active' : ''}`}
              >
                /explorer/alkanes-balance
              </Link>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                Explore Alkanes balances across the network
              </p>
            </div>
            
            <div>
              <Link 
                to="/explorer/address"
                className={`nav-link ${isActive('/explorer/address') ? 'active' : ''}`}
              >
                /explorer/address
              </Link>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                Explore transactions for an address
              </p>
            </div>
            
            <div>
              <Link 
                to="/explorer/transaction-io"
                className={`nav-link ${isActive('/explorer/transaction-io') ? 'active' : ''}`}
              >
                /explorer/transaction-io
              </Link>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
                Explore transaction inputs and outputs
              </p>
            </div>
          </div>
        )}
      </fieldset>
      
      {/* Utilities Section */}
      <fieldset className="group-box" style={{ marginTop: '10px' }}>
        <legend>Utilities</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <Link 
              to="/clock-in"
              className={`nav-link ${isActive('/clock-in') ? 'active' : ''}`}
            >
              Clock In
            </Link>
            <p style={{ marginTop: '2px', fontSize: '11px', color: '#555' }}>
              Track your work sessions
            </p>
          </div>
        </div>
      </fieldset>

      {/* Link to original home page */}
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <Link 
          to="/home"
          className={`nav-link ${isActive('/home') ? 'active' : ''}`}
        >
          View Full Home Page
        </Link>
      </div>
    </div>
  );
};

export default NavSidebar;
