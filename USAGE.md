# Usage Guide

This guide shows how to use mini-rate-limiter in your projects.

## Installation

```bash
npm install mini-rate-limiter
```

## Basic Usage

The simplest way to use the rate limiter:

```typescript
import { RateLimiter } from 'mini-rate-limiter';

// Create a limiter: 100 requests per minute
const limiter = new RateLimiter({
  capacity: 100,        // Max tokens (burst size)
  refillRate: 100,      // Tokens added per interval
  refillInterval: 60000 // Interval in ms (1 minute)
});

// Check if a request is allowed
const result = await limiter.consume('user-123');

if (result.allowed) {
  // Process the request
  console.log(`Allowed! ${result.remaining} requests remaining`);
} else {
  // Reject the request
  console.log(`Rate limited. Retry after ${result.retryAfter} seconds`);
}
```

## Express Middleware

For Express applications, use the middleware:

```typescript
import express from 'express';
import { createRateLimitMiddleware } from 'mini-rate-limiter/middleware';

const app = express();

// Apply rate limiting globally
app.use(createRateLimitMiddleware({
  capacity: 100,
  refillRate: 100,
  refillInterval: 60000, // 100 requests per minute
}));

app.get('/api/data', (req, res) => {
  res.json({ data: 'hello' });
});
```

### Middleware Options

```typescript
createRateLimitMiddleware({
  // Required: Rate limit configuration
  capacity: 100,
  refillRate: 100,
  refillInterval: 60000,

  // Optional: Custom key generator (default: req.ip)
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,

  // Optional: Skip certain requests
  skip: (req) => req.path === '/health',

  // Optional: Custom rate limit handler
  onRateLimited: (req, res, result) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: result.retryAfter
    });
  },

  // Optional: Disable rate limit headers (default: true)
  headers: false
});
```

## Response Headers

When using the middleware, these headers are automatically set:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets |
| `Retry-After` | Seconds until next request allowed (only on 429) |

## Rate Limit Result

The `consume()` and `check()` methods return:

```typescript
interface RateLimitResult {
  allowed: boolean;      // Whether the request is allowed
  remaining: number;     // Tokens remaining
  resetAt: number;       // Unix timestamp (ms) when bucket is full
  retryAfter?: number;   // Seconds until next token (only when blocked)
}
```

## Common Patterns

### Rate Limit by User ID

```typescript
app.use(authMiddleware); // Sets req.user

app.use(createRateLimitMiddleware({
  capacity: 100,
  refillRate: 100,
  refillInterval: 60000,
  keyGenerator: (req) => req.user?.id || req.ip
}));
```

### Rate Limit by API Key

```typescript
app.use(createRateLimitMiddleware({
  capacity: 1000,
  refillRate: 1000,
  refillInterval: 60000,
  keyGenerator: (req) => req.headers['x-api-key'] || 'anonymous'
}));
```

### Different Limits for Different Routes

```typescript
const strictLimiter = createRateLimitMiddleware({
  capacity: 10,
  refillRate: 10,
  refillInterval: 60000
});

const relaxedLimiter = createRateLimitMiddleware({
  capacity: 100,
  refillRate: 100,
  refillInterval: 60000
});

app.use('/api/sensitive', strictLimiter);
app.use('/api/public', relaxedLimiter);
```

### Skip Health Checks

```typescript
app.use(createRateLimitMiddleware({
  capacity: 100,
  refillRate: 100,
  refillInterval: 60000,
  skip: (req) => req.path === '/health' || req.path === '/ready'
}));
```

## Token Bucket Algorithm

This library uses the token bucket algorithm:

1. **Bucket** holds up to `capacity` tokens
2. **Tokens refill** at `refillRate` tokens per `refillInterval`
3. **Each request** consumes 1 token (or more with `consume(key, n)`)
4. **Empty bucket** = request rejected
5. **Tokens cap** at capacity (no hoarding)

Example: `capacity: 10, refillRate: 1, refillInterval: 1000` means:
- Max burst of 10 requests
- Sustained rate of 1 request/second
- After using all 10, wait 1 second for each new request

## Cleanup

When you're done with the rate limiter, clean up resources:

```typescript
const limiter = new RateLimiter({ ... });

// ... use the limiter ...

// Clean up when shutting down
limiter.destroy();
```

For middleware, this happens automatically when the process exits.
