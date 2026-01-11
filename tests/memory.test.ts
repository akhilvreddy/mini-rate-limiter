import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryStorage } from '../src/storage/memory';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = new MemoryStorage({ cleanupInterval: 60000 });
  });

  afterEach(() => {
    storage.destroy();
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should return null for non-existent key', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should store and retrieve bucket state', async () => {
      const state = { tokens: 5, lastRefill: Date.now() };
      await storage.set('key-1', state, 10000);

      const result = await storage.get('key-1');
      expect(result).toEqual(state);
    });

    it('should delete entries', async () => {
      const state = { tokens: 5, lastRefill: Date.now() };
      await storage.set('key-1', state, 10000);
      await storage.delete('key-1');

      const result = await storage.get('key-1');
      expect(result).toBeNull();
    });

    it('should overwrite existing entries', async () => {
      const state1 = { tokens: 5, lastRefill: Date.now() };
      const state2 = { tokens: 3, lastRefill: Date.now() + 1000 };

      await storage.set('key-1', state1, 10000);
      await storage.set('key-1', state2, 10000);

      const result = await storage.get('key-1');
      expect(result).toEqual(state2);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const state = { tokens: 5, lastRefill: Date.now() };
      await storage.set('key-1', state, 5000); // 5 second TTL

      // Still valid before TTL
      vi.advanceTimersByTime(4000);
      expect(await storage.get('key-1')).toEqual(state);

      // Expired after TTL
      vi.advanceTimersByTime(2000);
      expect(await storage.get('key-1')).toBeNull();
    });

    it('should handle different TTLs for different keys', async () => {
      const state1 = { tokens: 5, lastRefill: Date.now() };
      const state2 = { tokens: 3, lastRefill: Date.now() };

      await storage.set('key-1', state1, 3000);
      await storage.set('key-2', state2, 10000);

      vi.advanceTimersByTime(5000);

      expect(await storage.get('key-1')).toBeNull(); // Expired
      expect(await storage.get('key-2')).toEqual(state2); // Still valid
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      const state = { tokens: 5, lastRefill: Date.now() };
      await storage.set('key-1', state, 5000);
      await storage.set('key-2', state, 5000);
      await storage.set('key-3', state, 120000); // Long TTL

      expect(storage.size()).toBe(3);

      // Advance past the short TTLs and trigger cleanup
      vi.advanceTimersByTime(60000);

      // key-1 and key-2 should be cleaned up, key-3 should remain
      expect(storage.size()).toBe(1);
      expect(await storage.get('key-3')).toEqual(state);
    });
  });

  describe('size', () => {
    it('should return correct size', async () => {
      expect(storage.size()).toBe(0);

      await storage.set('key-1', { tokens: 5, lastRefill: Date.now() }, 10000);
      expect(storage.size()).toBe(1);

      await storage.set('key-2', { tokens: 5, lastRefill: Date.now() }, 10000);
      expect(storage.size()).toBe(2);

      await storage.delete('key-1');
      expect(storage.size()).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should clear all entries on destroy', async () => {
      await storage.set('key-1', { tokens: 5, lastRefill: Date.now() }, 10000);
      await storage.set('key-2', { tokens: 5, lastRefill: Date.now() }, 10000);

      storage.destroy();

      expect(storage.size()).toBe(0);
    });
  });

  describe('multiple storages', () => {
    it('should isolate data between storage instances', async () => {
      const storage2 = new MemoryStorage();
      const state1 = { tokens: 5, lastRefill: Date.now() };
      const state2 = { tokens: 3, lastRefill: Date.now() };

      await storage.set('key-1', state1, 10000);
      await storage2.set('key-1', state2, 10000);

      expect(await storage.get('key-1')).toEqual(state1);
      expect(await storage2.get('key-1')).toEqual(state2);

      storage2.destroy();
    });
  });
});
