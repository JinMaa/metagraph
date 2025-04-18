/**
 * Provider implementation for the METAGRAPH application
 *
 * This implementation uses the oyl-sdk Provider to interact with
 * Bitcoin networks and provides a consistent interface across environments.
 */
// Import our Node.js shims first to ensure they're loaded before the SDK
import './node-shims.js';
import { Provider } from '@oyl/sdk';
import * as bitcoin from 'bitcoinjs-lib';

// Define network configurations for our application
const networks = {
  mainnet: {
    url: 'https://mainnet.sandshrew.io',
    version: 'v2',
    projectId: import.meta.env.VITE_SANDSHREW_PROJECT_ID,
    network: bitcoin.networks.bitcoin,
    networkType: 'mainnet'
  },
  
  regtest: {
    url: 'http://localhost:18888',
    projectId: 'regtest',
    network: bitcoin.networks.regtest,
    networkType: 'regtest',
    version: 'v1'
  },
  
  oylnet: {
    url: 'https://oylnet.oyl.gg',
    version: 'v2',
    projectId: 'regtest',
    network: bitcoin.networks.testnet,
    networkType: 'regtest'
  }
};

/**
 * Get a provider instance for the specified environment
 * This wraps the oyl-sdk Provider with our application-specific functionality
 *
 * @param {string} network - Network name ('mainnet', 'regtest', 'oylnet')
 * @returns {Provider} Provider instance configured for the specified network
 */
const getProvider = (network = 'regtest') => {
  const config = networks[network] || networks.regtest;
  
  try {
    // Create an instance of the oyl-sdk Provider with our configuration
    const provider = new Provider(config);
    
    // Wrap provider methods to handle browser environment issues
    const originalSandshrew = provider.sandshrew;
    
    // Create a proxy for the sandshrew client to handle errors
    provider.sandshrew = new Proxy(originalSandshrew || {}, {
      get: (target, prop) => {
        // If the property exists on the target, return it
        if (prop in target) {
          return target[prop];
        }
        
        // If the property is bitcoindRpc, create a proxy for it
        if (prop === 'bitcoindRpc') {
          return new Proxy({}, {
            get: (_, method) => {
              // Return a function that handles the RPC call
              return async (...args) => {
                try {
                  // If the original method exists, call it
                  if (target.bitcoindRpc && typeof target.bitcoindRpc[method] === 'function') {
                    return await target.bitcoindRpc[method](...args);
                  }
                  
                  // Otherwise, throw an error
                  throw new Error(`Method ${method} not available in browser environment`);
                } catch (error) {
                  console.error(`Error calling ${method}:`, error);
                  throw error;
                }
              };
            }
          });
        }
        
        // Return undefined for other properties
        return undefined;
      }
    });
    
    // Add application-specific methods to the provider
    provider.checkHealth = async () => {
      try {
        // Use the provider's sandshrew client to check if the node is responsive
        const blockCount = await provider.sandshrew.bitcoindRpc.getBlockCount();
        return blockCount > 0;
      } catch (error) {
        console.error(`Provider health check failed:`, error);
        return false;
      }
    };
    
    // Use the actual provider to get block height
    provider.getBlockHeight = async () => {
      try {
        // Use the provider's sandshrew client to get the current block height
        return await provider.sandshrew.bitcoindRpc.getBlockCount();
      } catch (error) {
        console.warn(`Failed to get block height:`, error);
        throw new Error(`Failed to get block height: ${error.message || 'Unknown error'}`);
      }
    };
    
    return provider;
  } catch (error) {
    console.error(`Failed to create provider for ${network}:`, error);
    throw new Error(`Failed to create provider for ${network}: ${error.message || 'Unknown error'}`);
  }
};

export default getProvider;
