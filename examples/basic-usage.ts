/**
 * Basic usage example for mini-rate-limiter
 *
 * Run with: npx ts-node examples/basic-usage.ts
 */

import { RateLimiter } from '../src';

async function main() {
  // Create a rate limiter: 5 requests allowed, refills 1 token per second
  const limiter = new RateLimiter({
    capacity: 5,
    refillRate: 1,
    refillInterval: 1000,
  });

  console.log('Rate Limiter Example');
  console.log('====================');
  console.log('Config: 5 tokens capacity, 1 token/second refill\n');

  // Simulate some requests
  for (let i = 1; i <= 7; i++) {
    const result = await limiter.consume('user-123');

    if (result.allowed) {
      console.log(`Request ${i}: ✓ Allowed (${result.remaining} tokens remaining)`);
    } else {
      console.log(`Request ${i}: ✗ Rejected (retry after ${result.retryAfter}s)`);
    }
  }

  console.log('\nWaiting 3 seconds for tokens to refill...\n');

  // Wait for some tokens to refill
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Try again
  for (let i = 8; i <= 10; i++) {
    const result = await limiter.consume('user-123');

    if (result.allowed) {
      console.log(`Request ${i}: ✓ Allowed (${result.remaining} tokens remaining)`);
    } else {
      console.log(`Request ${i}: ✗ Rejected (retry after ${result.retryAfter}s)`);
    }
  }

  // Clean up
  limiter.destroy();
}

main().catch(console.error);
