/**
 * Simple rate limiter implementation
 * Limits the number of requests within a time window
 */
class RateLimiter {
  /**
   * Create a new rate limiter instance
   * @param {number} maxRequests - Maximum number of requests allowed in the time window
   * @param {number} timeWindow - Time window in milliseconds
   */
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requestTimestamps = [];
  }

  /**
   * Throttle requests to respect the rate limit
   * @returns {Promise<void>} - Resolves when the request can proceed
   */
  async throttle() {
    // Remove timestamps outside the window
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    // If we've hit the limit, wait until we can make another request
    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.timeWindow - (now - oldestTimestamp);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Add current timestamp and proceed
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Check if the rate limit has been reached
   * @returns {boolean} - True if the rate limit has been reached
   */
  isLimited() {
    // Remove timestamps outside the window
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    // Check if we've hit the limit
    return this.requestTimestamps.length >= this.maxRequests;
  }

  /**
   * Get the number of requests remaining in the current time window
   * @returns {number} - Number of requests remaining
   */
  remaining() {
    // Remove timestamps outside the window
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    // Calculate remaining requests
    return Math.max(0, this.maxRequests - this.requestTimestamps.length);
  }

  /**
   * Get the time in milliseconds until the rate limit resets
   * @returns {number} - Time in milliseconds until reset
   */
  resetTime() {
    if (this.requestTimestamps.length === 0) {
      return 0;
    }

    const now = Date.now();
    const oldestTimestamp = this.requestTimestamps[0];
    return Math.max(0, this.timeWindow - (now - oldestTimestamp));
  }
}

module.exports = RateLimiter;