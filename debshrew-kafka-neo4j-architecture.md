# Debshrew Kafka Neo4j Architecture

## System Architecture Diagram

```mermaid
graph TD
    subgraph Bitcoin
        BTC[Bitcoin Blockchain]
    end

    subgraph Metashrew
        MS[Metashrew Service]
        MSV[Metashrew Views]
        MSDB[(Metashrew DB)]
    end

    subgraph Debshrew
        DS[Debshrew Service]
        TM[WASM Transform Module]
        DSC[Debshrew Cache]
    end

    subgraph Kafka
        KB[Kafka Broker]
        SR[Schema Registry]
        subgraph Topics
            BT[blocks Topic]
            TT[transactions Topic]
            IT[inputs Topic]
            OT[outputs Topic]
        end
    end

    subgraph KafkaConnect
        KC[Kafka Connect]
        N4JC[Neo4j Connector]
    end

    subgraph Neo4j
        N4J[(Neo4j Database)]
        subgraph GraphModel
            BN[Block Nodes]
            TN[Transaction Nodes]
            ON[Output Nodes]
            AN[Address Nodes]
            BR[Block Relationships]
            TR[Transaction Relationships]
        end
    end

    BTC -->|Block Data| MS
    MS -->|Indexes| MSDB
    MS -->|Exposes| MSV
    
    DS -->|Queries| MSV
    DS -->|Uses| TM
    DS -->|Maintains| DSC
    TM -->|Generates CDC Events| DS
    
    DS -->|CDC Block Events| BT
    DS -->|CDC Transaction Events| TT
    DS -->|CDC Input Events| IT
    DS -->|CDC Output Events| OT
    
    BT & TT & IT & OT -->|Events| KC
    KC -->|Uses| N4JC
    N4JC -->|Cypher Queries| N4J
    
    N4JC -->|Creates/Updates| BN
    N4JC -->|Creates/Updates| TN
    N4JC -->|Creates/Updates| ON
    N4JC -->|Creates/Updates| AN
    N4JC -->|Creates/Updates| BR
    N4JC -->|Creates/Updates| TR
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant BTC as Bitcoin Blockchain
    participant MS as Metashrew
    participant DS as Debshrew
    participant TM as Transform Module
    participant KB as Kafka Broker
    participant KC as Kafka Connect
    participant N4J as Neo4j

    BTC->>MS: New Block
    MS->>MS: Index Block Data
    DS->>MS: Query Latest Block Height
    MS->>DS: Return Block Height
    DS->>MS: Query Block Data
    MS->>DS: Return Block Data
    DS->>TM: Process Block
    TM->>DS: Generate CDC Events
    DS->>KB: Publish Block CDC Event
    DS->>KB: Publish Transaction CDC Events
    DS->>KB: Publish Input CDC Events
    DS->>KB: Publish Output CDC Events
    KB->>KC: Consume CDC Events
    KC->>N4J: Execute Cypher Queries
    N4J->>N4J: Update Graph Model
```

## CDC Event Flow

```mermaid
flowchart LR
    subgraph Debshrew
        B[Block Processing]
        T[Transaction Processing]
        I[Input Processing]
        O[Output Processing]
    end

    subgraph Kafka
        BT[blocks Topic]
        TT[transactions Topic]
        IT[inputs Topic]
        OT[outputs Topic]
    end

    subgraph Neo4j
        BN[Block Nodes]
        TN[Transaction Nodes]
        IN[Input Relationships]
        ON[Output Nodes]
        AN[Address Nodes]
    end

    B -->|CDC Create/Update Events| BT
    T -->|CDC Create/Update Events| TT
    I -->|CDC Create/Update Events| IT
    O -->|CDC Create/Update Events| OT

    BT -->|"MERGE (block:block {hash: ...})..."| BN
    TT -->|"MERGE (tx:tx {txid: ...})..."| TN
    IT -->|"MATCH (tx) MERGE (output)-[:in]->..."| IN
    OT -->|"MATCH (tx) MERGE (output:output)..."| ON
    OT -->|"MERGE (address:address)..."| AN
```

## Reorg Handling

```mermaid
flowchart TD
    subgraph Detection
        D1[Compare Block Hash at Height]
        D2[Detect Hash Mismatch]
        D3[Find Common Ancestor]
    end

    subgraph Rollback
        R1[Generate Inverse CDC Events]
        R2[Delete/Update Records]
    end

    subgraph Reprocessing
        P1[Process New Chain]
        P2[Generate New CDC Events]
    end

    D1 --> D2
    D2 --> D3
    D3 --> R1
    R1 --> R2
    R2 --> P1
    P1 --> P2
```

## Neo4j Graph Model

```mermaid
classDiagram
    class Block {
        +String hash
        +int height
        +String prevblock
        +int size
        +int txcount
        +int version
        +String merkleroot
        +int time
        +String bits
        +int nonce
    }
    
    class Transaction {
        +String txid
        +int version
        +int locktime
        +int size
        +int weight
        +int fee
    }
    
    class Output {
        +String index
        +int value
        +String scriptPubKey
        +boolean unspent
    }
    
    class Address {
        +String address
    }
    
    Block "1" --> "1" Block : chain
    Transaction "n" --> "1" Block : inc
    Transaction "1" --> "n" Output : out
    Output "n" --> "1" Transaction : in
    Output "n" --> "1" Address : locked
```

## Component Interactions

### 1. Metashrew to Debshrew

Metashrew indexes the Bitcoin blockchain and provides views that Debshrew can query. Debshrew polls Metashrew for new blocks and processes them using the transform module.

### 2. Debshrew to Kafka

Debshrew generates CDC events for blocks, transactions, inputs, and outputs, and publishes them to Kafka topics. Each event contains the necessary data to update the Neo4j graph model.

### 3. Kafka to Neo4j

Kafka Connect consumes CDC events from Kafka topics and uses the Neo4j Sink Connector to execute Cypher queries against Neo4j. These queries create or update nodes and relationships in the graph model.

### 4. Neo4j Graph Model

The Neo4j graph model represents the Bitcoin blockchain as a graph, with blocks, transactions, outputs, and addresses as nodes, and various relationships between them.

## Data Transformation Process

1. **Bitcoin Block** → **Metashrew View** → **Debshrew CDC Event** → **Kafka Topic** → **Neo4j Cypher Query** → **Neo4j Graph Node/Relationship**

2. For each block:
   - Create a block node
   - Link it to the previous block
   - Process all transactions in the block

3. For each transaction:
   - Create a transaction node
   - Link it to the block
   - Process all inputs and outputs

4. For each input:
   - Find the referenced output
   - Create an input relationship from the output to the transaction
   - Mark the output as spent

5. For each output:
   - Create an output node
   - Link it to the transaction
   - If there's an address, create an address node and link the output to it