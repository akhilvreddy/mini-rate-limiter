import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenBucket } from '../src/algorithms/token-bucket';
import type { StorageAdapter, BucketState } from '../src/storage/types';

// Mock storage for testing
class MockStorage implements StorageAdapter {
  private store = new Map<string, BucketState>();

  async get(key: string): Promise<BucketState | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, state: BucketState): Promise<void> {
    this.store.set(key, state);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('TokenBucket', () => {
  let storage: MockStorage;
  let bucket: TokenBucket;

  beforeEach(() => {
    storage = new MockStorage();
    bucket = new TokenBucket(
      { capacity: 5, refillRate: 1, refillInterval: 1000 },
      storage
    );
    vi.useFakeTimers();
  });

  describe('initial state', () => {
    it('should start with full capacity', async () => {
      const result = await bucket.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should allow requests up to capacity', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await bucket.consume('user-1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });
  });

  describe('token consumption', () => {
    it('should decrement remaining tokens after consume', async () => {
      const result1 = await bucket.consume('user-1');
      expect(result1.remaining).toBe(4);

      const result2 = await bucket.consume('user-1');
      expect(result2.remaining).toBe(3);
    });

    it('should reject when tokens exhausted', async () => {
      // Consume all 5 tokens
      for (let i = 0; i < 5; i++) {
        await bucket.consume('user-1');
      }

      // 6th request should be rejected
      const result = await bucket.consume('user-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow consuming multiple tokens at once', async () => {
      const result = await bucket.consume('user-1', 3);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should reject if not enough tokens for multi-token consume', async () => {
      await bucket.consume('user-1', 4); // 1 remaining
      const result = await bucket.consume('user-1', 2); // needs 2
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(1);
    });
  });

  describe('token refill', () => {
    it('should refill tokens over time', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await bucket.consume('user-1');
      }

      const beforeRefill = await bucket.check('user-1');
      expect(beforeRefill.remaining).toBe(0);

      // Advance time by 1 second (1 refill interval)
      vi.advanceTimersByTime(1000);

      const afterRefill = await bucket.check('user-1');
      expect(afterRefill.remaining).toBe(1);
    });

    it('should refill multiple tokens over multiple intervals', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await bucket.consume('user-1');
      }

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000);

      const result = await bucket.check('user-1');
      expect(result.remaining).toBe(3);
    });

    it('should cap tokens at capacity', async () => {
      // Advance time way past full refill
      vi.advanceTimersByTime(10000);

      const result = await bucket.check('user-1');
      expect(result.remaining).toBe(5); // capped at capacity
    });
  });

  describe('check vs consume', () => {
    it('check should not consume tokens', async () => {
      const check1 = await bucket.check('user-1');
      const check2 = await bucket.check('user-1');
      const check3 = await bucket.check('user-1');

      expect(check1.remaining).toBe(5);
      expect(check2.remaining).toBe(5);
      expect(check3.remaining).toBe(5);
    });

    it('consume should actually remove tokens', async () => {
      await bucket.consume('user-1');
      const result = await bucket.check('user-1');
      expect(result.remaining).toBe(4);
    });
  });

  describe('multiple keys', () => {
    it('should track keys independently', async () => {
      await bucket.consume('user-1');
      await bucket.consume('user-1');
      await bucket.consume('user-2');

      const result1 = await bucket.check('user-1');
      const result2 = await bucket.check('user-2');

      expect(result1.remaining).toBe(3);
      expect(result2.remaining).toBe(4);
    });
  });

  describe('retryAfter', () => {
    it('should include retryAfter when rejected', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await bucket.consume('user-1');
      }

      const result = await bucket.consume('user-1');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should not include retryAfter when allowed', async () => {
      const result = await bucket.consume('user-1');
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });
  });

  describe('resetAt', () => {
    it('should return resetAt timestamp', async () => {
      const now = Date.now();
      const result = await bucket.consume('user-1');

      expect(result.resetAt).toBeDefined();
      expect(result.resetAt).toBeGreaterThanOrEqual(now);
    });
  });
});
