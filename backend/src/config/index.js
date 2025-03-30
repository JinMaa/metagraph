const { neo4jConfig, createDriver } = require('./neo4j');
const { sandshrewConfig } = require('./sandshrew');
const { appConfig } = require('./app');

module.exports = {
  neo4jConfig,
  createDriver,
  sandshrewConfig,
  appConfig
};