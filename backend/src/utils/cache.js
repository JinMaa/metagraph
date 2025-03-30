/**
 * Simple in-memory cache implementation
 * Provides methods for storing and retrieving data with TTL
 */
class Cache {
  /**
   * Create a new cache instance
   * @param {number} defaultTtl - Default time-to-live in milliseconds
   */
  constructor(defaultTtl = 3600000) { // Default TTL: 1 hour
    this.cache = new Map();
    this.defaultTtl = defaultTtl;
  }

  /**
   * Get an item from the cache
   * @param {string} key - Cache key
   * @returns {*|null} - Cached value or null if not found or expired
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if the item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set an item in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number|null} ttl - Time-to-live in milliseconds (optional)
   */
  set(key, value, ttl = null) {
    const expiry = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Check if an item exists in the cache and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} - True if the item exists and is not expired
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Check if the item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete an item from the cache
   * @param {string} key - Cache key
   * @returns {boolean} - True if the item was deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the number of items in the cache
   * @returns {number} - Number of items in the cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache
   * @returns {string[]} - Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get or set an item in the cache
   * If the item doesn't exist or has expired, the factory function is called to create it
   * @param {string} key - Cache key
   * @param {Function} factory - Function to create the value if not in cache
   * @param {number|null} ttl - Time-to-live in milliseconds (optional)
   * @returns {Promise<*>} - Cached or newly created value
   */
  async getOrSet(key, factory, ttl = null) {
    const cachedValue = this.get(key);
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}

module.exports = Cache;