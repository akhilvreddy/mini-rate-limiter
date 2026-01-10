/**
 * State of a token bucket
 */
export interface BucketState {
  /** Current number of tokens in the bucket */
  tokens: number;
  /** Unix timestamp (ms) of the last refill */
  lastRefill: number;
}

/**
 * Interface for storage adapters
 */
export interface StorageAdapter {
  /**
   * Get the bucket state for a key
   * @param key - Unique identifier for the bucket
   * @returns The bucket state or null if not found
   */
  get(key: string): Promise<BucketState | null>;

  /**
   * Set the bucket state for a key
   * @param key - Unique identifier for the bucket
   * @param state - The bucket state to store
   * @param ttlMs - Time-to-live in milliseconds
   */
  set(key: string, state: BucketState, ttlMs: number): Promise<void>;

  /**
   * Delete the bucket state for a key
   * @param key - Unique identifier for the bucket
   */
  delete(key: string): Promise<void>;
}
