import type { StorageAdapter, BucketState } from './types';

interface StoredEntry {
  state: BucketState;
  expiresAt: number;
}

export interface MemoryStorageOptions {
  /** Interval in ms between cleanup runs (default: 60000) */
  cleanupInterval?: number;
}

/**
 * In-memory storage adapter using Map
 *
 * - Stores bucket state in memory
 * - Automatic TTL-based expiration
 * - Periodic cleanup of expired entries
 */
export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, StoredEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: MemoryStorageOptions = {}) {
    const cleanupInterval = options.cleanupInterval ?? 60000;
    this.startCleanup(cleanupInterval);
  }

  private startCleanup(interval: number): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, interval);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove expired entries from the store
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async get(key: string): Promise<BucketState | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.state;
  }

  async set(key: string, state: BucketState, ttlMs: number): Promise<void> {
    this.store.set(key, {
      state,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Get the number of entries in the store (for testing)
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Stop the cleanup timer and clear the store
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}
