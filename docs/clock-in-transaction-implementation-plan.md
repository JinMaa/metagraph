# Clock-In Transaction Implementation Plan

## Overview

This document provides a comprehensive implementation plan for adding blockchain transaction functionality to the Clock-In feature using the OYL SDK and LaserEyes wallet integration.

## Requirements

- Create a transaction when the user clicks the "Clock In" button
- Call the "clock-in" contract with ID [2,1] using opcode 77 (mint)
- Use the LaserEyes wallet's signTransaction method for signing
- Handle UTXO selection manually using the OYL SDK
- Display appropriate UI states during the transaction process

## Implementation Steps

### 1. Update Imports in ClockIn.jsx

Add the following imports to the existing imports:

```jsx
import { useLaserEyes } from '@omnisat/lasereyes';
import getProvider from '../sdk/provider';
import * as alkanes from '../sdk/alkanes';
import { encodeRunestoneProtostone } from '../sdk/alkanes';
import { ProtoStone } from '../sdk/alkanes';
import { encipher } from '../sdk/alkanes';
```

### 2. Add State Variables

Add the following state variables to the component:

```jsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [txId, setTxId] = useState(null);
```

### 3. Add LaserEyes Hook

Add the LaserEyes hook to access wallet functionality:

```jsx
const { connected, address, signTransaction } = useLaserEyes();
```

### 4. Create Helper Functions

#### 4.1. Create a function to fetch UTXOs

```jsx
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
```

#### 4.2. Create a function to create the protostone

```jsx
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
```

### 5. Update handleClockIn Function

Replace the existing handleClockIn function with this implementation:

```jsx
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
```

### 6. Update the UI Rendering

Replace the existing UI rendering with this implementation:

```jsx
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
```

## Potential Issues and Solutions

### 1. Missing Imports

If any of the imports are not available directly from the paths specified, you may need to:

- Check if they are exported from the SDK modules
- Import them from the correct paths
- Create wrapper functions if needed

### 2. UTXO Formatting

The UTXO format expected by the alkanes.execute function might differ from what's returned by the esplora.getAddressUtxo method. If you encounter errors, check the expected format and adjust the getAccountUtxos function accordingly.

### 3. Error Handling

The implementation includes basic error handling, but you might need to add more specific error handling for different scenarios:

- Network errors
- Insufficient funds
- Transaction rejection
- Signing errors

### 4. Testing

Test the implementation with different scenarios:

- Connected wallet with sufficient funds
- Connected wallet with insufficient funds
- Disconnected wallet
- Different network settings

## Final Notes

- The implementation assumes that the alkanes.execute function is available and works as expected
- The feeRate is set to 5, which might need to be adjusted based on network conditions
- The UI is updated to show the transaction ID when successful
- The reset button clears both the clockedIn state and the txId