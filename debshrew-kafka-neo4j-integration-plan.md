# Debshrew to Neo4j Integration Plan

## CDC Event Mapping to Neo4j Graph Structure

### Current Neo4j Graph Model

Based on the existing Neo4j service, the current graph model consists of:

**Nodes:**
- `block`: Represents a Bitcoin block
  - Properties: hash, size, txcount, version, prevblock, merkleroot, time, bits, nonce, height
- `tx`: Represents a Bitcoin transaction
  - Properties: txid, fee, and other transaction metadata
- `output`: Represents a transaction output
  - Properties: value, scriptPubKey, index
- `address`: Represents a Bitcoin address
  - Properties: address

**Relationships:**
- `[:chain]`: Connects a block to its previous block
- `[:inc]`: Connects a transaction to the block it's included in
- `[:in]`: Connects an output (as input) to a transaction
- `[:out]`: Connects a transaction to its outputs
- `[:locked]`: Connects an output to the address it's locked to

### CDC Event Structure

Debshrew generates CDC events in the following format:

```json
{
  "header": {
    "source": "transform_name",
    "timestamp": "2023-01-01T00:00:00Z",
    "block_height": 123456,
    "block_hash": "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d",
    "transaction_id": "tx123"
  },
  "payload": {
    "operation": "create",
    "table": "table_name",
    "key": "record_key",
    "before": null,
    "after": {
      "field1": "value1",
      "field2": 42
    }
  }
}
```

### Mapping CDC Events to Neo4j

We'll configure the Kafka Connect Neo4j Sink Connector to map CDC events to Neo4j's graph structure. Here's how different types of CDC events will be mapped:

#### 1. Block Events

**CDC Event:**
```json
{
  "header": {
    "source": "bitcoin_transform",
    "timestamp": "2023-01-01T00:00:00Z",
    "block_height": 123456,
    "block_hash": "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d"
  },
  "payload": {
    "operation": "create",
    "table": "blocks",
    "key": "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d",
    "before": null,
    "after": {
      "hash": "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d",
      "size": 1234,
      "txcount": 100,
      "version": 1,
      "prevblock": "00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054",
      "merkleroot": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      "time": 1609459200,
      "bits": "1d00ffff",
      "nonce": 2083236893,
      "height": 123456
    }
  }
}
```

**Neo4j Cypher Mapping:**
```cypher
MERGE (block:block {hash: event.after.hash})
SET block.size = event.after.size,
    block.txcount = event.after.txcount,
    block.version = event.after.version,
    block.prevblock = event.after.prevblock,
    block.merkleroot = event.after.merkleroot,
    block.time = event.after.time,
    block.bits = event.after.bits,
    block.nonce = event.after.nonce,
    block.height = event.after.height
MERGE (prevblock:block {hash: event.after.prevblock})
MERGE (block)-[:chain]->(prevblock)
```

#### 2. Transaction Events

**CDC Event:**
```json
{
  "header": {
    "source": "bitcoin_transform",
    "timestamp": "2023-01-01T00:00:00Z",
    "block_height": 123456,
    "block_hash": "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d",
    "transaction_id": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16"
  },
  "payload": {
    "operation": "create",
    "table": "transactions",
    "key": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
    "before": null,
    "after": {
      "txid": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
      "version": 1,
      "locktime": 0,
      "size": 275,
      "weight": 1100,
      "fee": 0,
      "index_in_block": 1
    }
  }
}
```

**Neo4j Cypher Mapping:**
```cypher
MATCH (block:block {hash: event.header.block_hash})
MERGE (tx:tx {txid: event.after.txid})
MERGE (tx)-[:inc {i: event.after.index_in_block}]->(block)
SET tx.version = event.after.version,
    tx.locktime = event.after.locktime,
    tx.size = event.after.size,
    tx.weight = event.after.weight,
    tx.fee = event.after.fee
```

#### 3. Transaction Input Events

**CDC Event:**
```json
{
  "header": {
    "source": "bitcoin_transform",
    "timestamp": "2023-01-01T00:00:00Z",
    "block_height": 123456,
    "block_hash": "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d",
    "transaction_id": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16"
  },
  "payload": {
    "operation": "create",
    "table": "inputs",
    "key": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16:0",
    "before": null,
    "after": {
      "txid": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
      "vin": 0,
      "prev_txid": "0437cd7f8525ceed2324359c2d0ba26006d92d856a9c20fa0241106ee5a597c9",
      "prev_vout": 0,
      "scriptSig": "47304402204e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd410220181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d0901",
      "sequence": 4294967295,
      "witness": null,
      "index": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16:0:0437cd7f8525ceed2324359c2d0ba26006d92d856a9c20fa0241106ee5a597c9:0"
    }
  }
}
```

**Neo4j Cypher Mapping:**
```cypher
MATCH (tx:tx {txid: event.after.txid})
MERGE (prevOutput:output {index: event.after.prev_txid + ":" + event.after.prev_vout})
MERGE (prevOutput)-[:in {
  vin: event.after.vin,
  scriptSig: event.after.scriptSig,
  sequence: event.after.sequence,
  witness: event.after.witness
}]->(tx)
REMOVE prevOutput:unspent
```

#### 4. Transaction Output Events

**CDC Event:**
```json
{
  "header": {
    "source": "bitcoin_transform",
    "timestamp": "2023-01-01T00:00:00Z",
    "block_height": 123456,
    "block_hash": "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d",
    "transaction_id": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16"
  },
  "payload": {
    "operation": "create",
    "table": "outputs",
    "key": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16:0",
    "before": null,
    "after": {
      "txid": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
      "vout": 0,
      "value": 1000000,
      "scriptPubKey": "4104ae1a62fe09c5f51b13905f07f06b99a2f7159b2225f374cd378d71302fa28414e7aab37397f554a7df5f142c21c1b7303b8a0626f1baded5c72a704f7e6cd84ac",
      "addresses": ["1Q2TWHE3GMdB6BZKafqwxXtWAWgFt5Jvm3"],
      "index": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16:0"
    }
  }
}
```

**Neo4j Cypher Mapping:**
```cypher
MATCH (tx:tx {txid: event.after.txid})
MERGE (output:output {index: event.after.index})
SET output.value = event.after.value,
    output.scriptPubKey = event.after.scriptPubKey,
    output:unspent
MERGE (tx)-[:out {vout: event.after.vout}]->(output)
WITH output, event
WHERE event.after.addresses IS NOT NULL AND size(event.after.addresses) > 0
MERGE (address:address {address: event.after.addresses[0]})
MERGE (output)-[:locked]->(address)
```

### Kafka Connect Neo4j Sink Configuration

The Neo4j Sink Connector will be configured to:

1. **Topic Routing**: Map Kafka topics to specific Cypher queries
2. **Event Transformation**: Convert CDC events to Neo4j operations
3. **Error Handling**: Handle failures and ensure data consistency

Here's a sample configuration for the Neo4j Sink Connector:

```json
{
  "name": "neo4j-sink",
  "config": {
    "connector.class": "streams.kafka.connect.sink.Neo4jSinkConnector",
    "topics": "debshrew.cdc.blocks,debshrew.cdc.transactions,debshrew.cdc.inputs,debshrew.cdc.outputs",
    "neo4j.server.uri": "bolt://neo4j:7687",
    "neo4j.authentication.basic.username": "neo4j",
    "neo4j.authentication.basic.password": "password",
    "neo4j.topic.cypher.debshrew.cdc.blocks": "MERGE (block:block {hash: event.after.hash}) SET block.size = event.after.size, block.txcount = event.after.txcount, block.version = event.after.version, block.prevblock = event.after.prevblock, block.merkleroot = event.after.merkleroot, block.time = event.after.time, block.bits = event.after.bits, block.nonce = event.after.nonce, block.height = event.after.height MERGE (prevblock:block {hash: event.after.prevblock}) MERGE (block)-[:chain]->(prevblock)",
    "neo4j.topic.cypher.debshrew.cdc.transactions": "MATCH (block:block {hash: event.header.block_hash}) MERGE (tx:tx {txid: event.after.txid}) MERGE (tx)-[:inc {i: event.after.index_in_block}]->(block) SET tx.version = event.after.version, tx.locktime = event.after.locktime, tx.size = event.after.size, tx.weight = event.after.weight, tx.fee = event.after.fee",
    "neo4j.topic.cypher.debshrew.cdc.inputs": "MATCH (tx:tx {txid: event.after.txid}) MERGE (prevOutput:output {index: event.after.prev_txid + ':' + event.after.prev_vout}) MERGE (prevOutput)-[:in {vin: event.after.vin, scriptSig: event.after.scriptSig, sequence: event.after.sequence, witness: event.after.witness}]->(tx) REMOVE prevOutput:unspent",
    "neo4j.topic.cypher.debshrew.cdc.outputs": "MATCH (tx:tx {txid: event.after.txid}) MERGE (output:output {index: event.after.index}) SET output.value = event.after.value, output.scriptPubKey = event.after.scriptPubKey, output:unspent MERGE (tx)-[:out {vout: event.after.vout}]->(output) WITH output, event WHERE event.after.addresses IS NOT NULL AND size(event.after.addresses) > 0 MERGE (address:address {address: event.after.addresses[0]}) MERGE (output)-[:locked]->(address)",
    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "false",
    "errors.tolerance": "all",
    "errors.log.enable": "true",
    "errors.log.include.messages": "true"
  }
}
```

### Transform Module Considerations

The transform module will need to:

1. Query Metashrew for block and transaction data
2. Generate appropriate CDC events for blocks, transactions, inputs, and outputs
3. Ensure proper handling of reorgs by generating inverse CDC events

The simple-transform example will be modified to:
- Query relevant Metashrew views for Bitcoin data
- Generate CDC events that match the expected format for Neo4j mapping
- Maintain state for handling reorgs properly

## Implementation Steps

1. **Create the Transform Module**: Modify the simple-transform example to generate CDC events for Bitcoin data
2. **Configure Debshrew**: Set up Debshrew to use the transform module and output to Kafka
3. **Configure Kafka Connect**: Set up the Neo4j Sink Connector with the appropriate Cypher mappings
4. **Test and Validate**: Ensure data flows correctly from Metashrew through Debshrew and Kafka to Neo4j