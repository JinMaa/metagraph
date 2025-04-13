import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import ProgressBar from '../components/shared/ProgressBar';
import { getAllAlkanes, getAlkanesTokenImage } from '../sdk/alkanes';
import bombIcon from '../assets/bomb.svg';

/**
 * AlkanesTokenView Component
 *
 * Page for viewing details of a specific Alkanes token.
 * 
 * URL format:
 * - /explorer/2:123 - Individual token view for block 2, txId 123
 * 
 * Where:
 * - 2 is the blockId
 * - 123 is the txId
 */
const AlkanesTokenView = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  const { txId } = useParams();
  
  // Debug logs for routing
  useEffect(() => {
    console.log('Token View - txId:', txId);
    console.log('Token View - endpoint:', endpoint);
  }, [txId, endpoint]);
  
  // State for token data
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenImage, setTokenImage] = useState(null);
  const [tokenImageLoading, setTokenImageLoading] = useState(false);
  
  // Function to check if a token is an unverified WASM contract
  const isUnverifiedWasm = (name) => {
    return !name || name.trim() === '';
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
  
  // Function to fetch token data
  const fetchToken = async () => {
    if (!txId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First check if the token is in the cache
      const tokenCacheKey = `alkanes_token_${endpoint}_2:${txId}`;
      const cachedToken = localStorage.getItem(tokenCacheKey);
      
      if (cachedToken) {
        try {
          const { data, timestamp } = JSON.parse(cachedToken);
          
          // Check if cache is still valid (60 minutes)
          if (Date.now() - timestamp < 60 * 60 * 1000) {
            console.log('Using cached token data');
            setToken(data);
            
            // Fetch token image if we have a valid token ID
            if (data.id && data.id.block && data.id.tx) {
              fetchTokenImage(data.id);
            }
            
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error parsing cached token:', e);
          // Continue to fetch from API if cache parsing fails
        }
      }
      
      // If no valid cache, fetch from API
      console.log(`Fetching token data for 2:${txId} from API`);
      
      // Use getAllAlkanes and filter for the specific token
      const result = await getAllAlkanes(50, 0, endpoint);
      
      if (result.status === 'error') {
        throw new Error(result.message || 'Failed to fetch token data');
      }
      
      // Find the token with the matching txId
      const foundToken = result.tokens.find(t => t.id.tx === txId);
      
      if (!foundToken) {
        throw new Error(`Token with ID 2:${txId} not found`);
      }
      
      setToken(foundToken);
      
      // Store in cache for future use
      localStorage.setItem(
        tokenCacheKey,
        JSON.stringify({
          data: foundToken,
          timestamp: Date.now()
        })
      );
      
      // Fetch token image if we have a valid token ID
      if (foundToken.id && foundToken.id.block && foundToken.id.tx) {
        fetchTokenImage(foundToken.id);
      }
    } catch (err) {
      console.error('Error fetching token:', err);
      setError(err.message || 'An error occurred while fetching token data');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch token data when component mounts or txId/endpoint changes
  useEffect(() => {
    fetchToken();
  }, [txId, endpoint]);
  
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

      {loading ? (
        <p>Loading token details...</p>
      ) : error ? (
        <div>
          <p style={{ color: 'red' }}>Error: {error}</p>
          <button onClick={fetchToken}>Retry</button>
        </div>
      ) : !token ? (
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
                    alt={`${token.name} token image`} 
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
                      <td>{token.id.block}:{token.id.tx}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Name:</td>
                      <td style={isUnverifiedWasm(token.name) ? { color: 'red', backgroundColor: '#ffcccc' } : {}}>
                        {isUnverifiedWasm(token.name) ? (
                          <span>
                              <img 
                                src={bombIcon} 
                                alt="Bomb Warning" 
                                style={{ verticalAlign: 'middle', marginRight: '5px', width: '20px', height: '20px' }}
                              />
                            <span style={{ fontWeight: 'bold' }}>UNVERIFIED WASM CONTRACT</span> - {token.name.length > 0 ? `[${token.name.length} whitespace chars]` : '[empty string]'}
                          </span>
                        ) : token.name}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Symbol:</td>
                      <td>{token.symbol || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Circulating Supply:</td>
                      <td>
                        {(token.totalSupply ? (token.totalSupply / 100000000) : 0).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 8
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Cap:</td>
                      <td>
                        {(token.cap ? token.cap : 0).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Minted:</td>
                      <td>
                        {(token.minted ? token.minted : 0).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Mint Amount:</td>
                      <td>
                        {(token.mintAmount ? (token.mintAmount / 100000000) : 0).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 8
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Mint Active:</td>
                      <td>{token.mintActive ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Progress:</td>
                      <td>
                        <ProgressBar 
                          value={token.percentageMinted || 0} 
                          style={{ width: '100%', minWidth: '100px' }}
                          label={token.percentageMinted ? `${token.percentageMinted}%` : '0%'}
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
              <pre>{JSON.stringify(token, null, 2)}</pre>
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
};

export default AlkanesTokenView;
