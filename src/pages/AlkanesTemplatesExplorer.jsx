import React from 'react';
import { useOutletContext } from 'react-router-dom';

/**
 * AlkanesTemplatesExplorer Component (98.css version)
 * 
 * Page for exploring Alkanes factory templates, styled with 98.css.
 */
const AlkanesTemplatesExplorer = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  
  // Helper function to format Alkane ID (Block:TX)
  const formatAlkaneId = (tokenId) => {
    if (!tokenId || typeof tokenId.block === 'undefined' || typeof tokenId.tx === 'undefined') {
      return 'Invalid ID';
    }
    return `${tokenId.block}:${tokenId.tx}`;
  };

  // Helper function to format large numbers
  const formatLargeNumber = (num) => {
    if (typeof num !== 'number' || isNaN(num)) {
      return '-'; // Return dash for non-numbers or NaN
    }
    const numStr = String(num);
    if (numStr.length > 15) {
      return num.toExponential(2); // Use scientific notation with 2 decimal places
    } else {
      return num.toLocaleString(); // Use standard locale string with commas
    }
  };

  return (
    <div>
      <h2>Alkanes Templates Explorer</h2>
      <p>
        Explore deployed Alkanes factory templates on the {endpoint.toUpperCase()} network.
      </p>
      
      {/* Content Area */}
      <fieldset className="group-box">
        <legend>Templates</legend>
        <div className="status-bar" style={{ margin: '20px 0' }}>
          <p className="status-bar-field">Coming Soon</p>
          <p className="status-bar-field">Templates Explorer is under development</p>
        </div>
        
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>The Alkanes Templates Explorer will allow you to browse and search for deployed Alkanes factory templates.</p>
          <p>This feature is currently being implemented and will be available in a future update.</p>
        </div>
      </fieldset>
    </div>
  );
};

export default AlkanesTemplatesExplorer;
