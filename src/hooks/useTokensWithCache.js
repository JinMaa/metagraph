import { useState, useEffect } from 'react';
import { getAllAlkanes } from '../sdk/alkanes';

/**
 * Custom hook for fetching and caching Alkanes tokens
 * 
 * Implements caching with localStorage to reduce API calls
 * and improve performance. Fetches all tokens at once and
 * handles pagination client-side.
 * 
 * @param {number} pageSize - Number of tokens to display per page
 * @param {number} pageNumber - Current page number (1-based)
 * @param {string} endpoint - Network endpoint (mainnet, testnet, etc.)
 * @param {number} cacheExpiryMinutes - Cache expiry time in minutes (default: 60)
 * @returns {Object} - Object containing tokens data, loading state, error state, and refetch function
 */
const useTokensWithCache = (pageSize, pageNumber, endpoint, cacheExpiryMinutes = 60) => {
  const [allTokens, setAllTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Calculate pagination values
  const offset = (pageNumber - 1) * pageSize;
  const currentPageTokens = allTokens.slice(offset, offset + pageSize);
  const totalTokens = allTokens.length;
  const totalPages = Math.ceil(totalTokens / pageSize) || 1;
  const hasMore = pageNumber < totalPages;
  
  // Generate a cache key for all tokens
  const getCacheKey = (endpoint) => {
    return `alkanes_tokens_all_${endpoint}`;
  };
  
  // Check if cache is valid (not expired)
  const isCacheValid = (timestamp) => {
    const expiryTime = cacheExpiryMinutes * 60 * 1000; // Convert minutes to milliseconds
    return Date.now() - timestamp < expiryTime;
  };
  
  // Function to fetch all tokens (either from cache or API)
  const fetchAllTokens = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    const cacheKey = getCacheKey(endpoint);
    
    try {
      // Check cache first (if not forcing a refresh)
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          
          // If cache is still valid, use it
          if (isCacheValid(timestamp)) {
            console.log('Using cached tokens data');
            setAllTokens(data.tokens || []);
            setLoading(false);
            return;
          }
        }
      }
      
      // If no valid cache or forcing refresh, fetch from API
      console.log(`Fetching all tokens from API: endpoint=${endpoint}`);
      
      // Use the maximum allowed limit (1000) to get all tokens in one request
      const result = await getAllAlkanes(1000, 0, endpoint);
      
      if (result.status === 'error') {
        throw new Error(result.message || 'Failed to fetch Alkanes tokens');
      }
      
      // Store the result in state
      setAllTokens(result.tokens || []);
      
      // Debug logs for pagination
      console.log('Fetched all tokens:', result.tokens?.length || 0);
      console.log('Current page tokens:', currentPageTokens.length);
      console.log('Total pages:', totalPages);
      console.log('Has more:', hasMore);
      
      // Store in cache with timestamp
      localStorage.setItem(
        cacheKey, 
        JSON.stringify({
          data: result,
          timestamp: Date.now()
        })
      );
      
      // Also store each individual token in its own cache entry for quick access
      if (result.tokens && result.tokens.length > 0) {
        result.tokens.forEach(token => {
          if (token.id && token.id.tx) {
            const tokenCacheKey = `alkanes_token_${endpoint}_2:${token.id.tx}`;
            localStorage.setItem(
              tokenCacheKey,
              JSON.stringify({
                data: token,
                timestamp: Date.now()
              })
            );
          }
        });
      }
      
    } catch (err) {
      console.error('Error fetching Alkanes tokens:', err);
      setError(err.message || 'An error occurred while fetching tokens');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch tokens when endpoint changes
  useEffect(() => {
    fetchAllTokens();
  }, [endpoint]);
  
  return {
    tokens: currentPageTokens,
    loading,
    error,
    totalTokens,
    hasMore,
    refetch: () => fetchAllTokens(true) // Function to force refresh
  };
};

export default useTokensWithCache;
