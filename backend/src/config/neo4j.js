const neo4j = require('neo4j-driver');
require('dotenv').config();

/**
 * Neo4j configuration
 * Creates a driver instance for connecting to the Neo4j database
 */
const neo4jConfig = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  user: process.env.NEO4J_USER || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password'
};

/**
 * Create a Neo4j driver instance
 * @returns {neo4j.Driver} Neo4j driver instance
 */
const createDriver = () => {
  const driver = neo4j.driver(
    neo4jConfig.uri,
    neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password),
    {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000 // 2 minutes
    }
  );

  // Register a shutdown hook to close the driver when the application exits
  process.on('exit', () => {
    driver.close();
  });

  return driver;
};

module.exports = {
  neo4jConfig,
  createDriver
};