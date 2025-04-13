import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, Link, useLocation } from 'react-router-dom';
import useTokensWithCache from '../hooks/useTokensWithCache';
import ProgressBar from '../components/shared/ProgressBar';
import { getAllAlkanes, getAlkanesTokenImage } from '../sdk/alkanes';

/**
 * AlkanesTokensExplorer Component (98.css version)
 *
 * Page for exploring all initialized Alkanes tokens with pagination, styled with 98.css.
 * Uses caching to improve performance and reduce API calls.
 * 
 * URL format:
 * - /explorer/2:n/ - Base URL for all tokens in block 2 (page 1)
 * - /explorer/2:n/2 - Page 2 of tokens in block 2
 * - /explorer/2:n/3 - Page 3 of tokens in block 2, etc.
 * - /explorer/2:1 - Individual token view for block 2, txId 1
 * 
 * Where:
 * - 2 is the blockId
 * - n represents an undefined txId (meaning all tokens in the block)
 * - A specific number after the colon represents a specific txId
 */
const AlkanesTokensExplorer = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse the URL path to determine the view type and parameters
  const [viewType, page, txId] = useMemo(() => {
    // Get the path after /explorer/
    const path = location.pathname.replace(/^\/explorer\//, '');
    
    // Check if it's a token view (2:123 format)
    if (path.match(/^2:\d+$/)) {
      const tokenId = path.replace('2:', '');
      return ['token', null, tokenId];
    }
    
    // Check if it's a paginated list view (2:n/2 format)
    if (path.match(/^2:n\/\d+$/)) {
      const pageNum = parseInt(path.replace('2:n/', ''), 10);
      return ['list', pageNum, null];
    }
    
    // Default to list view (2:n format)
    if (path === '2:n' || path === '') {
      return ['list', 1, null];
    }
    
    // If it's none of the above, default to list view
    return ['list', 1, null];
  }, [location.pathname]);
  
  const isIndividualTokenView = viewType === 'token';
  
  // Debug logs for routing
  useEffect(() => {
    console.log('Path:', location.pathname);
    console.log('View Type:', viewType);
    console.log('Page:', page);
    console.log('txId:', txId);
    console.log('isIndividualTokenView:', isIndividualTokenView);
  }, [location.pathname, viewType, page, txId, isIndividualTokenView]);
  
  // Determine current page from URL parameter or default to 1
  const currentPage = page ? parseInt(page, 10) : 1;
  const tokensPerPage = 25; // Number of tokens per page
  
  // Handle redirects and URL format
  useEffect(() => {
    // If we're at the old URL path, redirect to the new format
    if (location.pathname === '/explorer/alkanes-tokens') {
      navigate('/explorer/2:n', { replace: true });
    }
  }, [location.pathname, navigate]);
  
  // For individual token view, fetch the token details
  const [individualToken, setIndividualToken] = useState(null);
  const [individualTokenLoading, setIndividualTokenLoading] = useState(false);
  const [individualTokenError, setIndividualTokenError] = useState(null);
  const [tokenImage, setTokenImage] = useState(null);
  const [tokenImageLoading, setTokenImageLoading] = useState(false);
  const [showUnverifiedWasm, setShowUnverifiedWasm] = useState(false);
  
  // Function to fetch individual token data
  const fetchIndividualToken = async () => {
    if (!isIndividualTokenView || !txId) return;
    
    setIndividualTokenLoading(true);
    setIndividualTokenError(null);
    
    try {
      // First check if the token is in the cache
      const tokenCacheKey = `alkanes_token_${endpoint}_2:${txId}`;
      const cachedToken = localStorage.getItem(tokenCacheKey);
      
      if (cachedToken) {
        try {
          const { data, timestamp } = JSON.parse(cachedToken);
          
          // Check if cache is still valid (60 minutes)
          if (Date.now() - timestamp < 60 * 60 * 1000) {
            console.log('Using cached individual token data');
            setIndividualToken(data);
            
            // Fetch token image if we have a valid token ID
            if (data.id && data.id.block && data.id.tx) {
              fetchTokenImage(data.id);
            }
            
            setIndividualTokenLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error parsing cached token:', e);
          // Continue to fetch from API if cache parsing fails
        }
      }
      
      // If no valid cache, fetch from API
      console.log(`Fetching individual token data for 2:${txId} from API`);
      
      // Use getAllAlkanes and filter for the specific token
      const result = await getAllAlkanes(50, 0, endpoint);
      
      if (result.status === 'error') {
        throw new Error(result.message || 'Failed to fetch token data');
      }
      
      // Find the token with the matching txId
      const token = result.tokens.find(t => t.id.tx === txId);
      
      if (!token) {
        throw new Error(`Token with ID 2:${txId} not found`);
      }
      
      setIndividualToken(token);
      
      // Store in cache for future use
      localStorage.setItem(
        tokenCacheKey,
        JSON.stringify({
          data: token,
          timestamp: Date.now()
        })
      );
      
      // Fetch token image if we have a valid token ID
      if (token.id && token.id.block && token.id.tx) {
        fetchTokenImage(token.id);
      }
    } catch (err) {
      console.error('Error fetching individual token:', err);
      setIndividualTokenError(err.message || 'An error occurred while fetching token data');
    } finally {
      setIndividualTokenLoading(false);
    }
  };
  
  // Function to fetch token image
  const fetchTokenImage = async (tokenId) => {
    setTokenImageLoading(true);
    
    try {
      const result = await getAlkanesTokenImage(tokenId, endpoint);
      
      if (result.status === 'error' || !result.imageUri) {
        throw new Error(result.message || 'Failed to fetch token image');
      }
      
      setTokenImage(result.imageUri);
    } catch (err) {
      console.error('Error fetching token image:', err);
      // We don't set an error state here as the image is optional
    } finally {
      setTokenImageLoading(false);
    }
  };
  
  // Fetch individual token data when on individual token view
  useEffect(() => {
    if (isIndividualTokenView && txId) {
      fetchIndividualToken();
    }
  }, [isIndividualTokenView, txId, endpoint]);
  
  // Use the custom hook for cached tokens data with client-side pagination
  const { 
    tokens, 
    loading, 
    error, 
    totalTokens, 
    hasMore,
    refetch 
  } = useTokensWithCache(tokensPerPage, currentPage, endpoint);
  
  // Handle page navigation
  const handlePageChange = (newPage) => {
    if (newPage > 0) {
      // Navigate to the new page URL
      if (newPage === 1) {
        navigate('/explorer/2:n');
      } else {
        navigate(`/explorer/2:n/${newPage}`);
      }
      window.scrollTo(0, 0); // Scroll to top on page change
    }
  };
  
  // Use totalPages from the hook (calculated based on all tokens)
  const totalPages = Math.ceil(totalTokens / tokensPerPage) || 1;
  
  // Check if a token is an unverified WASM contract
  // This includes tokens with empty names, whitespace-only names, or null/undefined names
  const isUnverifiedWasm = (name) => {
    return !name || name.trim() === '';
  };
  
  // Filter tokens based on unverified WASM contracts flag
  // Note: We're filtering the current page's tokens, not the entire dataset
  const filteredTokens = tokens.filter(token => showUnverifiedWasm || !isUnverifiedWasm(token.name));
  
  // Debug logs for pagination
  useEffect(() => {
    console.log('Current location:', location.pathname);
    console.log('Current page:', currentPage);
    console.log('Total tokens:', totalTokens);
    console.log('Total pages:', totalPages);
    console.log('Tokens length:', tokens.length);
    console.log('Has more:', hasMore);
    console.log('Filtered tokens length:', filteredTokens.length);
  }, [location, currentPage, totalTokens, totalPages, tokens, hasMore, filteredTokens]);
  
  // Render function for individual token view
  const renderIndividualTokenView = () => {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Alkanes Token [2:{txId}]</h2>
            <p>
              Viewing details for individual token.
            </p>
          </div>
          <Link 
            to="/explorer/2:n"
            className="button"
            style={{ textDecoration: 'none' }}
          >
            Back to Token List
          </Link>
        </div>

        {individualTokenLoading ? (
          <p>Loading token details...</p>
        ) : individualTokenError ? (
          <div>
            <p style={{ color: 'red' }}>Error: {individualTokenError}</p>
            <button onClick={fetchIndividualToken}>Retry</button>
          </div>
        ) : !individualToken ? (
          <p>Token not found.</p>
        ) : (
          <>
            {/* Token Details */}
            <fieldset className="group-box">
              <legend>Token Details</legend>
              
              <div style={{ display: 'flex', gap: '20px' }}>
                {/* Left column - Token image */}
                <div style={{ width: '200px' }}>
                  {tokenImageLoading ? (
                    <div style={{ width: '180px', height: '180px', border: '1px solid #000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      Loading...
                    </div>
                  ) : tokenImage ? (
                    <img 
                      src={tokenImage} 
                      alt={`${individualToken.name} token image`} 
                      style={{ maxWidth: '180px', maxHeight: '180px', border: '1px solid #000' }}
                    />
                  ) : (
                    <div style={{ width: '180px', height: '180px', border: '1px solid #000', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#c0c0c0' }}>
                      No Image
                    </div>
                  )}
                </div>
                
                {/* Right column - Token information */}
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 'bold', width: '150px' }}>Token ID:</td>
                        <td>{individualToken.id.block}:{individualToken.id.tx}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Name:</td>
                        <td style={isUnverifiedWasm(individualToken.name) ? { color: 'red', backgroundColor: '#ffcccc' } : {}}>
                          {isUnverifiedWasm(individualToken.name) ? (
                            <span>
                              <img 
                                src="/src/assets/bomb.png" 
                                alt="Bomb Warning" 
                                style={{ verticalAlign: 'middle', marginRight: '5px', width: '20px', height: '20px' }}
                              />
                              <span style={{ fontWeight: 'bold' }}>UNVERIFIED WASM CONTRACT</span> - {individualToken.name.length > 0 ? `[${individualToken.name.length} whitespace chars]` : '[empty string]'}
                            </span>
                          ) : individualToken.name}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Symbol:</td>
                        <td>{individualToken.symbol || '-'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Circulating Supply:</td>
                        <td>
                          {(individualToken.totalSupply ? (individualToken.totalSupply / 100000000) : 0).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 8
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Cap:</td>
                        <td>
                          {(individualToken.cap ? individualToken.cap : 0).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Minted:</td>
                        <td>
                          {(individualToken.minted ? individualToken.minted : 0).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Mint Amount:</td>
                        <td>
                          {(individualToken.mintAmount ? (individualToken.mintAmount / 100000000) : 0).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 8
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Mint Active:</td>
                        <td>{individualToken.mintActive ? 'Yes' : 'No'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Progress:</td>
                        <td>
                          <ProgressBar 
                            value={individualToken.percentageMinted || 0} 
                            style={{ width: '100%', minWidth: '100px' }}
                            label={individualToken.percentageMinted ? `${individualToken.percentageMinted}%` : '0%'}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </fieldset>
            
            {/* Raw Data */}
            <fieldset className="group-box" style={{ marginTop: '15px' }}>
              <legend>Raw Data</legend>
              <div style={{ maxHeight: '300px', overflow: 'auto', backgroundColor: '#f0f0f0', padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                <pre>{JSON.stringify(individualToken, null, 2)}</pre>
              </div>
            </fieldset>
          </>
        )}
      </div>
    );
  };

  // Render function for token list view
  const renderTokenListView = () => {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Alkanes Tokens Explorer [2:n]</h2>
            <p>
              Browse through all initialized Alkanes tokens.
            </p>
          </div>
          <button 
            onClick={refetch} 
            disabled={loading}
            title="Refresh data from server"
          >
            Refresh Data
          </button>
        </div>

        <fieldset className="group-box">
          <legend>Tokens</legend>
          {loading ? (
            <p>Loading tokens...</p>
          ) : error ? (
            <div>
              <p style={{ color: 'red' }}>Error: {error}</p>
              <button onClick={refetch}>Retry</button>
            </div>
          ) : tokens.length === 0 ? (
            <p>No Alkanes tokens found.</p>
          ) : (
            <>
              {/* Table header with checkbox aligned to the right */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <div className="field-row">
                  <input 
                    id="showUnverifiedWasm"
                    type="checkbox" 
                    checked={showUnverifiedWasm} 
                    onChange={() => setShowUnverifiedWasm(!showUnverifiedWasm)}
                    className="checkbox"
                  />
                  <label 
                    htmlFor="showUnverifiedWasm"
                    style={{ 
                      color: 'red',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Show unverified WASM contracts
                  </label>
                </div>
              </div>
            <table>
              <thead>
                <tr>
                  <th>AlkaneId</th>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Circulating Supply</th>
                  <th>Cap</th>
                  <th>Minted</th>
                  <th>Progress</th>
                  <th>Mint Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                      <div>
                        <p style={{ marginBottom: '10px' }}>
                          No tokens match the current filter on this page.
                        </p>
                        {!showUnverifiedWasm && (
                          <button 
                            onClick={() => setShowUnverifiedWasm(true)}
                            className="button"
                          >
                            Show Unverified WASM Contracts
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTokens.map((token, index) => (
                    <tr key={index}>
                      <td>
                        {/* Display Alkane ID with link to individual token page */} 
                        <Link 
                          to={`/explorer/2:${token.id.tx}`}
                          className="nav-link"
                          title="View token details"
                        >
                          {token.id.block}:{token.id.tx}
                        </Link>
                      </td>
                      <td>{token.symbol || '-'}</td>
                      <td style={isUnverifiedWasm(token.name) ? { color: 'red', backgroundColor: '#ffcccc' } : {}}>
                        {isUnverifiedWasm(token.name) ? (
                          <span>
                            <img 
                              src="/src/assets/bomb.png" 
                              alt="Bomb Warning" 
                              style={{ verticalAlign: 'middle', marginRight: '5px', width: '20px', height: '20px' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>UNVERIFIED WASM CONTRACT</span>
                          </span>
                        ) : token.name}
                      </td>
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
                        {/* Format minted count */}
                        {(token.minted ? token.minted : 0).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td style={{ padding: '2px 6px' }}>
                        {/* Progress bar with percentage */}
                        <ProgressBar 
                          value={token.percentageMinted || 0} 
                          style={{ width: '100%', minWidth: '100px' }}
                          label={token.percentageMinted ? `${token.percentageMinted}%` : '0%'}
                        />
                      </td>
                      <td>
                        {/* Format mint amount */} 
                        {(token.mintAmount ? (token.mintAmount / 100000000) : 0).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 8
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Pagination controls - centered */} 
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              {/* Previous page button */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="button"
              >
                Previous
              </button>
              
              <span style={{ margin: '0 10px' }}>
                Page {currentPage} of {totalPages}
              </span>
              
              {/* Next page button */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="button"
              >
                Next
              </button>
            </div>
            </>
          )}
        </fieldset>
      </div>
    );
  };

  // Main render function
  return isIndividualTokenView ? renderIndividualTokenView() : renderTokenListView();
};

export default AlkanesTokensExplorer;
