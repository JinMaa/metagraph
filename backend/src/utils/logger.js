const winston = require('winston');
const { appConfig } = require('../config');

/**
 * Winston logger configuration
 * Creates a logger instance for the application
 */
const logger = winston.createLogger({
  level: appConfig.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'bitcoin-neo4j' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// If we're not in production, also log to the console
if (appConfig.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create a stream object with a 'write' function that will be used by morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;