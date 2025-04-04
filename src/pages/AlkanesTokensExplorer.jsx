import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getAllAlkanes } from '../sdk/alkanes';

/**
 * AlkanesTokensExplorer Component
 *
 * Page for exploring all initialized Alkanes tokens with pagination
 */
const AlkanesTokensExplorer = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  
  // State for tokens data
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTokens, setTotalTokens] = useState(0);
  const tokensPerPage = 200;
  
  // Fetch tokens on component mount and when page or endpoint changes
  useEffect(() => {
    fetchTokens();
  }, [currentPage, endpoint]);
  
  // Function to fetch tokens with pagination
  const fetchTokens = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const offset = (currentPage - 1) * tokensPerPage;
      const result = await getAllAlkanes(tokensPerPage, offset, endpoint);
      
      if (result.status === 'error') {
        throw new Error(result.message || 'Failed to fetch Alkanes tokens');
      }
      
      setTokens(result.tokens || []);
      
      // Set total tokens count for pagination
      // If the API doesn't return a total count, we can estimate based on the current results
      if (result.pagination && result.pagination.total) {
        setTotalTokens(result.pagination.total);
      } else if (result.tokens && result.tokens.length === tokensPerPage) {
        // If we got a full page, there might be more
        setTotalTokens((currentPage * tokensPerPage) + tokensPerPage);
      } else {
        // If we got less than a full page, we're probably at the end
        setTotalTokens((currentPage - 1) * tokensPerPage + (result.tokens ? result.tokens.length : 0));
      }
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
      window.scrollTo(0, 0);
    }
  };
  
  // Calculate total pages
  const totalPages = Math.ceil(totalTokens / tokensPerPage) || 1;
  
  // CSS for inline styling according to design guidelines
  const styles = {
    container: {
      width: '100%',
      maxWidth: '900px',
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
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'Roboto Mono, monospace',
      fontSize: '14px',
    },
    tableHeader: {
      backgroundColor: '#F5F5F5',
      textAlign: 'left',
      padding: '10px',
      borderBottom: '2px solid #E0E0E0',
      fontWeight: 'bold',
    },
    tableCell: {
      padding: '10px',
      borderBottom: '1px solid #E0E0E0',
      textAlign: 'left',
    },
    tokenId: {
      fontFamily: 'Roboto Mono, monospace',
      fontWeight: 'bold',
    },
    pagination: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: '20px',
      gap: '10px',
    },
    pageButton: {
      padding: '5px 10px',
      border: '1px solid #E0E0E0',
      backgroundColor: '#FFFFFF',
      cursor: 'pointer',
      fontFamily: 'Roboto Mono, monospace',
    },
    activePageButton: {
      padding: '5px 10px',
      border: '1px solid #000000',
      backgroundColor: '#000000',
      color: '#FFFFFF',
      cursor: 'pointer',
      fontFamily: 'Roboto Mono, monospace',
    },
    disabledPageButton: {
      padding: '5px 10px',
      border: '1px solid #E0E0E0',
      backgroundColor: '#F5F5F5',
      color: '#A0A0A0',
      cursor: 'not-allowed',
      fontFamily: 'Roboto Mono, monospace',
    },
    loadingMessage: {
      textAlign: 'center',
      padding: '20px',
      fontFamily: 'Roboto Mono, monospace',
    },
    errorMessage: {
      textAlign: 'center',
      padding: '20px',
      color: '#FF0000',
      fontFamily: 'Roboto Mono, monospace',
    }
  };
  
  return (
    <div style={styles.container} className="container">
      <h2 style={styles.title}>Alkanes Tokens Explorer</h2>
      <p style={styles.description}>
        Explore all initialized Alkanes tokens on the {endpoint.toUpperCase()} network.
      </p>
      
      <div style={styles.section}>
        {loading ? (
          <div style={styles.loadingMessage}>
            <p>Loading Alkanes tokens...</p>
          </div>
        ) : error ? (
          <div style={styles.errorMessage}>
            <p>Error: {error}</p>
            <button
              onClick={fetchTokens}
              style={{
                padding: '5px 10px',
                marginTop: '10px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : tokens.length === 0 ? (
          <p>No Alkanes tokens found.</p>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>AlkaneId</th>
                  <th style={styles.tableHeader}>Symbol</th>
                  <th style={styles.tableHeader}>Name</th>
                  <th style={styles.tableHeader}>Total Supply</th>
                  <th style={styles.tableHeader}>Cap</th>
                  <th style={styles.tableHeader}>Minted</th>
                  <th style={styles.tableHeader}>Mint Amount</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token, index) => (
                  <tr key={index}>
                    <td style={styles.tableCell}>
                      <span style={styles.tokenId}>
                        {token.id.block}:{token.id.tx}
                      </span>
                    </td>
                    <td style={styles.tableCell}>{token.symbol || '-'}</td>
                    <td style={styles.tableCell}>{token.name}</td>
                    <td style={styles.tableCell}>
                      {(token.totalSupply ? (token.totalSupply / 100000000) : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 8
                      })}
                    </td>
                    <td style={styles.tableCell}>
                      {(token.cap ? (token.cap / 100000000) : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 8
                      })}
                    </td>
                    <td style={styles.tableCell}>
                      {(token.minted ? (token.minted / 100000000) : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 8
                      })}
                      {token.percentageMinted ? ` (${token.percentageMinted}%)` : ''}
                    </td>
                    <td style={styles.tableCell}>
                      {(token.mintAmount ? (token.mintAmount / 100000000) : 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 8
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination controls */}
            <div style={styles.pagination}>
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                style={currentPage === 1 ? styles.disabledPageButton : styles.pageButton}
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={currentPage === 1 ? styles.disabledPageButton : styles.pageButton}
              >
                Previous
              </button>
              
              <span style={{ fontFamily: 'Roboto Mono, monospace' }}>
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={currentPage === totalPages ? styles.disabledPageButton : styles.pageButton}
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                style={currentPage === totalPages ? styles.disabledPageButton : styles.pageButton}
              >
                Last
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AlkanesTokensExplorer;