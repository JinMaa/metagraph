import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getAllAlkanes } from '../sdk/alkanes';

/**
 * AlkanesTokensExplorer Component (98.css version)
 *
 * Page for exploring all initialized Alkanes tokens with pagination, styled with 98.css.
 */

// Cache helper functions
const CACHE_PREFIX = 'alkanes_tokens_cache_';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

// Save tokens to cache
const saveToCache = (endpoint, page, data) => {
  const cacheKey = `${CACHE_PREFIX}${endpoint}_page${page}`;
  const cacheData = {
    timestamp: Date.now(),
    data: data
  };
  localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  console.log(`Cached data for ${endpoint} page ${page}`);
};

// Get tokens from cache
const getFromCache = (endpoint, page) => {
  const cacheKey = `${CACHE_PREFIX}${endpoint}_page${page}`;
  const cachedData = localStorage.getItem(cacheKey);
  
  if (!cachedData) return null;
  
  try {
    const parsed = JSON.parse(cachedData);
    const isExpired = Date.now() - parsed.timestamp > CACHE_EXPIRY;
    
    if (isExpired) {
      console.log(`Cache expired for ${endpoint} page ${page}`);
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log(`Using cached data for ${endpoint} page ${page}`);
    return parsed.data;
  } catch (error) {
    console.error('Error parsing cached data:', error);
    localStorage.removeItem(cacheKey);
    return null;
  }
};

// Clear cache for a specific endpoint
const clearCache = (endpoint) => {
  Object.keys(localStorage)
    .filter(key => key.startsWith(`${CACHE_PREFIX}${endpoint}`))
    .forEach(key => localStorage.removeItem(key));
  console.log(`Cleared cache for ${endpoint}`);
};

// Add this function to limit cache size
const cleanupOldCache = () => {
  const keys = Object.keys(localStorage)
    .filter(key => key.startsWith(CACHE_PREFIX))
    .map(key => ({
      key,
      time: JSON.parse(localStorage.getItem(key)).timestamp
    }))
    .sort((a, b) => b.time - a.time);
  
  // Keep only the 20 most recent entries
  if (keys.length > 20) {
    keys.slice(20).forEach(item => localStorage.removeItem(item.key));
    console.log(`Removed ${keys.length - 20} old cache entries`);
  }
};

// Cache status indicator component
const CacheStatusIndicator = ({ isFromCache }) => {
  return (
    <div 
      style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        marginLeft: '10px',
        borderRadius: '4px',
        backgroundColor: isFromCache ? '#e0f7fa' : '#e8f5e9',
        border: `1px solid ${isFromCache ? '#4dd0e1' : '#66bb6a'}`,
        fontSize: '12px',
        color: isFromCache ? '#00838f' : '#2e7d32'
      }}
    >
      <span style={{ 
        display: 'inline-block',
        width: '8px', 
        height: '8px', 
        borderRadius: '50%', 
        backgroundColor: isFromCache ? '#00b8d4' : '#00c853',
        marginRight: '5px' 
      }}></span>
      {isFromCache ? 'Cached' : 'Fresh'}
    </div>
  );
};

const AlkanesTokensExplorer = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  
  // State for tokens data
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTokens, setTotalTokens] = useState(0);
  const tokensPerPage = 200;
  
  // Add this new state for forcing refresh
  const [forceRefresh, setForceRefresh] = useState(false);
  
  // Fetch tokens on component mount and when page or endpoint changes
  useEffect(() => {
    fetchTokens();
  }, [currentPage, endpoint]);
  
  // Clear cache when endpoint changes
  useEffect(() => {
    // Clear the cache for the previous endpoint when it changes
    clearCache(endpoint);
  }, [endpoint]);
  
  // Function to fetch tokens with pagination and caching
  const fetchTokens = async () => {
    setLoading(true);
    setError(null);
    
    // Check if we have cached data and aren't forcing a refresh
    if (!forceRefresh) {
      const cachedData = getFromCache(endpoint, currentPage);
      if (cachedData) {
        setTokens(cachedData.tokens || []);
        setTotalTokens(cachedData.pagination?.total || 0);
        setIsFromCache(true); // Mark that data is from cache
        setLoading(false);
        setForceRefresh(false); // Reset force refresh
        return;
      }
    }
    
    try {
      const offset = (currentPage - 1) * tokensPerPage;
      const result = await getAllAlkanes(tokensPerPage, offset, endpoint);
      
      if (result.status === 'error') {
        throw new Error(result.message || 'Failed to fetch Alkanes tokens');
      }
      
      setTokens(result.tokens || []);
      setIsFromCache(false); // Mark that data is freshly fetched
      
      // Set total tokens count for pagination
      if (result.pagination && result.pagination.total) {
        setTotalTokens(result.pagination.total);
      } else if (result.tokens && result.tokens.length === tokensPerPage) {
        setTotalTokens((currentPage * tokensPerPage) + tokensPerPage); // Estimate if full page
      } else {
        setTotalTokens((currentPage - 1) * tokensPerPage + (result.tokens ? result.tokens.length : 0));
      }
      
      // Save the result to cache
      saveToCache(endpoint, currentPage, result);
      setForceRefresh(false); // Reset force refresh
    } catch (err) {
      console.error('Error fetching Alkanes tokens:', err);
      setError(err.message || 'An error occurred while fetching tokens');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage > 0 && (!totalTokens || (newPage - 1) * tokensPerPage < totalTokens)) {
      setCurrentPage(newPage);
      window.scrollTo(0, 0); // Scroll to top on page change
    }
  };
  
  // Calculate total pages
  const totalPages = Math.ceil(totalTokens / tokensPerPage) || 1;
  
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2>Alkanes Tokens Explorer</h2>
        {!loading && <CacheStatusIndicator isFromCache={isFromCache} />}
      </div>
      <p>
        Browse through all initialized Alkanes tokens. Results are paginated.
      </p>
      
      {/* Add refresh button */}
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => {
            setForceRefresh(true);
            fetchTokens();
          }}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
        <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
          {loading ? 'Fetching fresh data...' : 
            isFromCache ? 'Using cached data (expires after 5 minutes)' : 'Using fresh data'}
        </span>
      </div>

      <fieldset className="group-box">
        <legend>Tokens</legend>
        {loading ? (
          <p>Loading tokens...</p>
        ) : error ? (
          <div>
            <p style={{ color: 'red' }}>Error: {error}</p>
            <button onClick={fetchTokens}>Retry</button>
          </div>
        ) : tokens.length === 0 ? (
          <p>No Alkanes tokens found.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>AlkaneId</th>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Circulating Supply</th>
                  <th>Cap</th>
                  <th>Minted</th>
                  <th>Mint Amount</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token, index) => (
                  <tr key={index}>
                    <td>
                      {/* Display Alkane ID */} 
                      {token.id.block}:{token.id.tx}
                    </td>
                    <td>{token.symbol || '-'}</td>
                    <td>{token.name}</td>
                    <td>
                      {/* Format circulating supply */} 
                      {(token.totalSupply ? (token.totalSupply / 100000000) : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 8
                      })}
                    </td>
                    <td>
                      {/* Format cap */} 
                      {(token.cap ? token.cap : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </td>
                    <td>
                      {/* Format minted count and percentage */} 
                      {(token.minted ? token.minted : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                      {token.percentageMinted ? ` (${token.percentageMinted}%)` : ''}
                    </td>
                    <td>
                      {/* Format mint amount */} 
                      {(token.mintAmount ? (token.mintAmount / 100000000) : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 8
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination controls - centered */} 
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{ marginLeft: '5px' }}
              >
                Previous
              </button>
              
              <span style={{ margin: '0 10px' }}>
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                style={{ marginLeft: '5px' }}
              >
                Last
              </button>
            </div>
          </>
        )}
      </fieldset>
    </div>
  );
};

export default AlkanesTokensExplorer;