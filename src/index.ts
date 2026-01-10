import { TokenBucket } from './algorithms/token-bucket';
import { MemoryStorage, type MemoryStorageOptions } from './storage/memory';
import type {
  RateLimitResult,
  RateLimiterOptions,
  RateLimitAlgorithm,
} from './algorithms/types';
import type { StorageAdapter, BucketState } from './storage/types';

export interface RateLimiterConfig extends RateLimiterOptions {
  /** Custom storage adapter (default: MemoryStorage) */
  storage?: StorageAdapter;
  /** Options for the default MemoryStorage */
  storageOptions?: MemoryStorageOptions;
}

/**
 * Rate limiter using the token bucket algorithm
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   capacity: 100,
 *   refillRate: 10,
 *   refillInterval: 1000, // 10 tokens per second
 * });
 *
 * const result = await limiter.consume('user-123');
 * if (result.allowed) {
 *   // Process request
 * } else {
 *   // Reject with result.retryAfter seconds
 * }
 * ```
 */
export class RateLimiter implements RateLimitAlgorithm {
  private readonly algorithm: TokenBucket;
  private readonly storage: StorageAdapter;
  private readonly ownsStorage: boolean;

  constructor(config: RateLimiterConfig) {
    if (config.storage) {
      this.storage = config.storage;
      this.ownsStorage = false;
    } else {
      this.storage = new MemoryStorage(config.storageOptions);
      this.ownsStorage = true;
    }

    this.algorithm = new TokenBucket(
      {
        capacity: config.capacity,
        refillRate: config.refillRate,
        refillInterval: config.refillInterval,
      },
      this.storage
    );
  }

  /**
   * Check if a request would be allowed without consuming tokens
   * @param key - Unique identifier (e.g., user ID, IP address, API key)
   */
  async check(key: string): Promise<RateLimitResult> {
    return this.algorithm.check(key);
  }

  /**
   * Consume tokens from the bucket
   * @param key - Unique identifier (e.g., user ID, IP address, API key)
   * @param tokens - Number of tokens to consume (default: 1)
   */
  async consume(key: string, tokens: number = 1): Promise<RateLimitResult> {
    return this.algorithm.consume(key, tokens);
  }

  /**
   * Clean up resources (stops cleanup timer if using default storage)
   */
  destroy(): void {
    if (this.ownsStorage && this.storage instanceof MemoryStorage) {
      this.storage.destroy();
    }
  }
}

// Re-export types
export type {
  RateLimitResult,
  RateLimiterOptions,
  RateLimitAlgorithm,
  StorageAdapter,
  BucketState,
  MemoryStorageOptions,
};

// Re-export classes for advanced usage
export { TokenBucket } from './algorithms/token-bucket';
export { MemoryStorage } from './storage/memory';
