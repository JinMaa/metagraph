import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AlkanesBlockTraceForm from '../components/methods/AlkanesBlockTraceForm';

/**
 * AlkanesBlockExplorer Page
 * 
 * Page for exploring Alkanes transactions in blocks
 * Allows users to search for a block and view all Alkanes transactions within it
 */
const AlkanesBlockExplorer = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  
  return (
    <div>
      <h2>Alkanes Block Explorer</h2>
      <p>
        This page allows you to explore Alkanes transactions within Bitcoin blocks.
        Enter a block height to trace all transactions and identify those with Alkanes operations.
      </p>
      
      <fieldset className="group-box">
        <legend>How It Works</legend>
        <p>
          When you enter a block height, the explorer will:
        </p>
        <ol>
          <li>Retrieve all transactions in the specified block</li>
          <li>Identify transactions with OP_RETURN outputs</li>
          <li>For each OP_RETURN transaction, run a trace on output n+1 (where n is the max output value)</li>
          <li>Analyze the trace results to identify Alkanes transactions</li>
          <li>Display the results with filtering options</li>
        </ol>
        <p>
          <strong>Note:</strong> Tracing a block with many transactions may take some time, especially on mainnet.
          The explorer will show progress as it processes each transaction.
        </p>
      </fieldset>
      
      <fieldset className="group-box">
        <legend>Understanding the Results</legend>
        <p>
          The results are organized into several sections:
        </p>
        <ul>
          <li><strong>Block Information</strong>: Basic details about the block including height, hash, and timestamp.</li>
          <li><strong>Summary</strong>: Overview of transaction counts by type (with OP_RETURN, with Alkanes, etc.).</li>
          <li><strong>Filters</strong>: Options to filter the transaction list by various criteria.</li>
          <li><strong>Transactions</strong>: Detailed list of transactions with their trace results.</li>
        </ul>
        <p>
          Transactions with Alkanes are highlighted with an orange border and badge. You can click "Toggle Full Trace" 
          to see the complete trace result for any transaction.
        </p>
      </fieldset>
      
      <AlkanesBlockTraceForm endpoint={endpoint} />
    </div>
  );
};

export default AlkanesBlockExplorer;
