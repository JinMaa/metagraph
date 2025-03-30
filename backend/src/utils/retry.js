/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.initialDelay - Initial delay in milliseconds
 * @param {number} options.maxDelay - Maximum delay in milliseconds
 * @param {number} options.factor - Backoff factor
 * @param {number[]} options.retryableErrors - HTTP status codes to retry
 * @returns {Promise<*>} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    retryableErrors = [429, 500, 502, 503, 504]
  } = options;

  let attempt = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // Check if we should retry
      const shouldRetry = 
        attempt <= maxRetries && 
        (
          // Retry on specific HTTP status codes
          (error.response && retryableErrors.includes(error.response.status)) ||
          // Retry on network errors
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ECONNREFUSED' ||
          // Retry on rate limit errors
          error.message && error.message.includes('rate limit')
        );
      
      if (!shouldRetry) throw error;
      
      // Calculate backoff delay with jitter
      const jitter = Math.random() * 0.1 * delay;
      const backoffDelay = Math.min(delay * factor, maxDelay) + jitter;
      
      console.log(`Retry attempt ${attempt} after ${backoffDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      delay = backoffDelay;
    }
  }
}

/**
 * Custom error class for rate limit errors
 */
class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

module.exports = {
  withRetry,
  RateLimitError,
  ApiError
};