import React from 'react';
import { Link } from 'react-router-dom';
import APIForm from '../shared/APIForm';
import { getProtorunesByOutpoint } from '../../sdk';

/**
 * ProtorunesByOutpointForm Component
 *
 * Form specific to the protorunesByOutpoint API method.
 * Gets Protorunes by outpoint at a specific block height.
 *
 * @param {Object} props
 * @param {string} props.endpoint - Current endpoint (regtest, mainnet, oylnet)
 */
const ProtorunesByOutpointForm = ({ endpoint = 'mainnet' }) => {
  // Define method details
  const methodDetails = {
    'Method Type': 'View Function',
    'JSON-RPC Method': 'alkanes_protorunesbyoutpoint',
    'Required Parameters': 'txid (transaction ID), vout (output index), height (block height)',
    'Response Format': 'Returns token information with ID in hex format (converted to decimal for readability) and value in hex format with 8 decimals'
  };

  // Define parameters for the form
  const parameters = [
    {
      name: 'txid',
      label: 'Transaction ID',
      placeholder: '06dcb00bf23306255dc43816f123fbc0839aa6f1c37dbbd3e2c02aca065ac864',
      description: () => (
        <span>
          The transaction ID to query. <strong>Important:</strong> The txid should be in the byte-reversed format as shown in the example below (starting with "06" not "64"). This is different from how it appears on block explorers. View the original transaction on <a
            href="https://mempool.space/tx/64c85a06ca2ac0e2d3bb7dc3f1a69a83c0fb23f11638c45d250633f20bb0dc06"
            target="_blank"
            rel="noopener noreferrer"
            style={{color: '#0000FF', textDecoration: 'none'}}>
            mempool.space
          </a>
        </span>
      ),
      required: true
    },
    {
      name: 'vout',
      label: 'Output Index',
      placeholder: '0',
      description: 'The output index (vout) to query.',
      required: true
    },
    {
      name: 'height',
      label: 'Block Height',
      placeholder: '890550',
      description: 'The block height at which to query the outpoint.',
      required: true
    },
    {
      name: 'protocolTag',
      label: 'Protocol Tag',
      placeholder: '1',
      description: 'The protocol tag to use. Defaults to "1" if not specified, but can be changed for different protocols.',
      required: false
    }
  ];

  // Handle form submission
  const handleSubmit = async (values) => {
    const { txid, vout, height, protocolTag = '1' } = values;
    
    // Call the SDK function
    return await getProtorunesByOutpoint(
      {
        txid,
        vout: parseInt(vout, 10),
        protocolTag
      },
      parseInt(height, 10),
      endpoint
    );
  };

  return (
    <APIForm
      methodName="protorunesByOutpoint"
      methodType="VIEW FUNCTION"
      description="Gets Protorunes by outpoint (txid, vout) at a specific block height. This method allows you to query the state of Protorunes at a particular transaction output and block height."
      methodDetails={methodDetails}
      parameters={parameters}
      onSubmit={handleSubmit}
      endpoint={endpoint}
      examples={{
        request: `{
  "id": 0,
  "jsonrpc": "2.0",
  "method": "alkanes_protorunesbyoutpoint",
  "params": [
    {
      "protocolTag": "1",
      "txid": "06dcb00bf23306255dc43816f123fbc0839aa6f1c37dbbd3e2c02aca065ac864",
      "vout": 0
    },
    890550
  ]
}`,
        response: `{"result":[{"token":{"id":{"block":"0x2","tx":"0x10"},"name":"METHANE","symbol":"CH4"},"value":"0x0"}],"id":0,"jsonrpc":"2.0"}`,
        curl: `curl -X POST -H "Content-Type: application/json" -d '{
  "id": 0,
  "jsonrpc": "2.0",
  "method": "alkanes_protorunesbyoutpoint",
  "params": [
    {
      "protocolTag": "1",
      "txid": "06dcb00bf23306255dc43816f123fbc0839aa6f1c37dbbd3e2c02aca065ac864",
      "vout": 0
    },
    890550
  ]
}' https://mainnet.sandshrew.io/v2/lasereyes`
      }}
      notes="Note that the txid in the API call must be in byte-reversed format (as shown in the example), which is different from how it appears in block explorers. You need to manually reverse the byte order of the txid when entering it in this form. The protocol tag defaults to '1' but can be changed for different protocols. Ensure the txid, vout, and height correspond to a valid transaction on the current network.

Important information about the response format:
- Token IDs are provided in hex format (e.g., block: '0x2', tx: '0x10'), which correspond to decimal values 2 and 16, giving an alkane ID of [2,16]
- Token values are provided in hex format with 8 decimal places, so a value like '0x05f5e100' would represent 100000000 (1.0 after dividing by 10^8)"
    />
  );
};

export default ProtorunesByOutpointForm;
