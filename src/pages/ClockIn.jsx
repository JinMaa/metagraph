import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useLaserEyes } from '@omnisat/lasereyes';
import getProvider from '../sdk/provider';
import * as alkanes from '../sdk/alkanes';
import { encodeRunestoneProtostone } from '../sdk/alkanes';
import { ProtoStone } from '../sdk/alkanes';
import { encipher } from '../sdk/alkanes';

/**
 * ClockIn Page Component
 *
 * A simple page with a centered button for clocking in
 * that creates a blockchain transaction using the OYL SDK
 */
const ClockIn = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  const [clockedIn, setClockedIn] = useState(false);
  const [timestamp, setTimestamp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txId, setTxId] = useState(null);
  
  // Get LaserEyes wallet functionality
  const { connected, address, signTransaction } = useLaserEyes();
  
  /**
   * Fetches UTXOs for the given address
   */
  const getAccountUtxos = async (address, provider) => {
    try {
      // Use the esplora module to get UTXOs
      const utxosResponse = await provider.esplora.getAddressUtxo(address);
      
      if (!utxosResponse || !Array.isArray(utxosResponse) || utxosResponse.length === 0) {
        throw new Error('No UTXOs found for address');
      }
      
      // Format UTXOs for the alkanes.execute function
      const accountUtxos = utxosResponse.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: utxo.status
      }));
      
      return { accountUtxos };
    } catch (error) {
      console.error('Error fetching UTXOs:', error);
      throw new Error(`Failed to fetch UTXOs: ${error.message}`);
    }
  };
  
  /**
   * Creates a protostone for the clock-in transaction
   */
  const createProtostone = () => {
    // Create calldata with opcode 77 (mint) for contract [2,1]
    const calldata = [BigInt(2), BigInt(1), BigInt(77)];
    
    // Create protostone
    return encodeRunestoneProtostone({
      protostones: [
        ProtoStone.message({
          protocolTag: 1n,
          edicts: [],
          pointer: 0,
          refundPointer: 0,
          calldata: encipher(calldata),
        }),
      ],
    }).encodedRunestone;
  };
  
  /**
   * Handles the clock-in action
   */
  const handleClockIn = async () => {
    // Check if wallet is connected
    if (!connected || !address) {
      setError("Please connect your wallet first");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get provider for current network
      const provider = getProvider(endpoint);
      
      // Fetch UTXOs for the address
      const { accountUtxos } = await getAccountUtxos(address, provider);
      
      // Create protostone
      const protostone = createProtostone();
      
      // Create account object from address
      const account = {
        address,
        publicKey: null, // We'll get this from LaserEyes if needed
      };
      
      // Create custom signer that uses LaserEyes
      const signer = {
        sign: async (psbt) => {
          return await signTransaction(psbt);
        }
      };
      
      // Execute the transaction
      const result = await alkanes.execute({
        protostone,
        utxos: accountUtxos,
        feeRate: 5, // Default fee rate
        account,
        signer,
        provider,
      });
      
      // Handle successful transaction
      const now = new Date();
      setTimestamp(now);
      setClockedIn(true);
      setTxId(result.txid);
      console.log('User clocked in at:', now, 'Transaction ID:', result.txid);
      
    } catch (err) {
      console.error('Error clocking in:', err);
      setError(err.message || "Failed to clock in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="region" aria-labelledby="clock-in-title">
      <h2 id="clock-in-title">Clock In</h2>
      <p>Use the button below to clock in for your session.</p>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '40px',
        marginBottom: '40px'
      }}>
        <fieldset className="group-box" style={{ width: '300px', textAlign: 'center' }}>
          <legend>Time Tracking</legend>
          
          {!connected ? (
            <p>Please connect your wallet to clock in</p>
          ) : !clockedIn ? (
            <button 
              onClick={handleClockIn}
              disabled={loading}
              style={{ 
                padding: '15px 30px',
                fontSize: '16px',
                margin: '20px auto'
              }}
              aria-label="Clock in now"
            >
              {loading ? 'Processing...' : 'Clock In'}
            </button>
          ) : (
            <div>
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                ✓ Clocked in successfully
              </p>
              <p>
                {timestamp.toLocaleString()}
              </p>
              {txId && (
                <p style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                  Transaction ID: {txId}
                </p>
              )}
              <button 
                onClick={() => {
                  setClockedIn(false);
                  setTxId(null);
                }}
                style={{ marginTop: '10px' }}
              >
                Reset
              </button>
            </div>
          )}
          
          {error && (
            <p style={{ color: 'red', marginTop: '10px' }}>
              Error: {error}
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );
};

export default ClockIn;
