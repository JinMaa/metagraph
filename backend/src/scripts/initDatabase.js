/**
 * Initialize Neo4j database
 * Creates constraints and indexes
 */
require('dotenv').config();
const { Neo4jService } = require('../services');
const { logger } = require('../utils');

async function initDatabase() {
  logger.info('Initializing Neo4j database');
  
  const neo4jService = new Neo4jService();
  
  try {
    // Initialize database with constraints and indexes
    await neo4jService.initializeDatabase();
    
    logger.info('Neo4j database initialized successfully');
  } catch (error) {
    logger.error('Error initializing Neo4j database', error);
    process.exit(1);
  } finally {
    // Close Neo4j driver
    await neo4jService.close();
  }
}

// Run the initialization
initDatabase();