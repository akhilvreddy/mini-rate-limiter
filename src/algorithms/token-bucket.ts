import type { RateLimitResult, RateLimiterOptions, RateLimitAlgorithm } from './types';
import type { StorageAdapter, BucketState } from '../storage/types';

/**
 * Token Bucket rate limiting algorithm
 *
 * - Bucket holds up to `capacity` tokens
 * - Tokens refill at `refillRate` tokens per `refillInterval` ms
 * - Each request consumes tokens from the bucket
 * - When bucket is empty, requests are rejected
 */
export class TokenBucket implements RateLimitAlgorithm {
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;
  private readonly storage: StorageAdapter;
  private readonly ttlMs: number;

  constructor(options: RateLimiterOptions, storage: StorageAdapter) {
    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.refillInterval = options.refillInterval;
    this.storage = storage;
    // TTL is time to refill from 0 to full capacity, plus buffer
    this.ttlMs = Math.ceil((this.capacity / this.refillRate) * this.refillInterval) * 2;
  }

  /**
   * Calculate the current token count based on time elapsed since last refill
   */
  private calculateTokens(state: BucketState, now: number): number {
    const elapsed = now - state.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / this.refillInterval);
    const tokensToAdd = intervalsElapsed * this.refillRate;
    return Math.min(this.capacity, state.tokens + tokensToAdd);
  }

  /**
   * Calculate the last refill time adjusted for elapsed intervals
   */
  private calculateLastRefill(state: BucketState, now: number): number {
    const elapsed = now - state.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / this.refillInterval);
    return state.lastRefill + intervalsElapsed * this.refillInterval;
  }

  /**
   * Calculate when the bucket will be full again
   */
  private calculateResetAt(tokens: number, lastRefill: number): number {
    if (tokens >= this.capacity) {
      return lastRefill;
    }
    const tokensNeeded = this.capacity - tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.refillRate);
    return lastRefill + intervalsNeeded * this.refillInterval;
  }

  /**
   * Calculate seconds until next token is available
   */
  private calculateRetryAfter(lastRefill: number, now: number): number {
    const nextRefill = lastRefill + this.refillInterval;
    return Math.max(0, Math.ceil((nextRefill - now) / 1000));
  }

  /**
   * Get or create bucket state for a key
   */
  private async getOrCreateState(key: string, now: number): Promise<BucketState> {
    const existing = await this.storage.get(key);
    if (existing) {
      return existing;
    }
    // New bucket starts full
    return {
      tokens: this.capacity,
      lastRefill: now,
    };
  }

  /**
   * Build the rate limit result
   */
  private buildResult(
    allowed: boolean,
    tokens: number,
    lastRefill: number,
    now: number
  ): RateLimitResult {
    const result: RateLimitResult = {
      allowed,
      remaining: Math.floor(tokens),
      resetAt: this.calculateResetAt(tokens, lastRefill),
    };

    if (!allowed) {
      result.retryAfter = this.calculateRetryAfter(lastRefill, now);
    }

    return result;
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const state = await this.getOrCreateState(key, now);
    const tokens = this.calculateTokens(state, now);
    const lastRefill = this.calculateLastRefill(state, now);

    return this.buildResult(tokens >= 1, tokens, lastRefill, now);
  }

  async consume(key: string, tokens: number = 1): Promise<RateLimitResult> {
    const now = Date.now();
    const state = await this.getOrCreateState(key, now);
    const currentTokens = this.calculateTokens(state, now);
    const lastRefill = this.calculateLastRefill(state, now);

    if (currentTokens < tokens) {
      // Not enough tokens - don't modify state
      return this.buildResult(false, currentTokens, lastRefill, now);
    }

    // Consume tokens and update state
    const newTokens = currentTokens - tokens;
    await this.storage.set(
      key,
      { tokens: newTokens, lastRefill },
      this.ttlMs
    );

    return this.buildResult(true, newTokens, lastRefill, now);
  }
}
