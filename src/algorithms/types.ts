/**
 * Result returned when checking or consuming rate limit tokens
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of tokens remaining in the bucket */
  remaining: number;
  /** Unix timestamp (ms) when the bucket will be full again */
  resetAt: number;
  /** Seconds until the next token is available (only present when blocked) */
  retryAfter?: number;
}

/**
 * Configuration options for the rate limiter
 */
export interface RateLimiterOptions {
  /** Maximum number of tokens the bucket can hold (burst size) */
  capacity: number;
  /** Number of tokens to add per refill interval */
  refillRate: number;
  /** Time interval in milliseconds between refills */
  refillInterval: number;
}

/**
 * Interface for rate limiting algorithms
 */
export interface RateLimitAlgorithm {
  /**
   * Check if a request would be allowed without consuming tokens
   * @param key - Unique identifier for the rate limit bucket
   */
  check(key: string): Promise<RateLimitResult>;

  /**
   * Consume tokens from the bucket
   * @param key - Unique identifier for the rate limit bucket
   * @param tokens - Number of tokens to consume (default: 1)
   */
  consume(key: string, tokens?: number): Promise<RateLimitResult>;
}
