# mini-rate-limiter

A lightweight rate limiter using the token bucket algorithm. Zero runtime dependencies.

## Features

- Token bucket algorithm for smooth rate limiting
- In-memory storage (single instance)
- Express middleware included
- TypeScript support
- Zero runtime dependencies

## Installation

```bash
npm install mini-rate-limiter
```

## Quick Start

### Basic Usage

```typescript
import { RateLimiter } from 'mini-rate-limiter';

const limiter = new RateLimiter({
  capacity: 100,        // Max 100 tokens
  refillRate: 10,       // Add 10 tokens
  refillInterval: 1000, // Every second (10 req/sec sustained)
});

const result = await limiter.consume('user-123');

if (result.allowed) {
  // Process request
} else {
  // Reject, retry after result.retryAfter seconds
}
```

### Express Middleware

```typescript
import express from 'express';
import { createRateLimitMiddleware } from 'mini-rate-limiter/middleware';

const app = express();

app.use(createRateLimitMiddleware({
  capacity: 100,
  refillRate: 100,
  refillInterval: 60000, // 100 req/min
}));

app.get('/api/data', (req, res) => {
  res.json({ data: 'hello' });
});
```

## API

### `RateLimiter`

```typescript
new RateLimiter({
  capacity: number,       // Max tokens (burst size)
  refillRate: number,     // Tokens added per interval
  refillInterval: number, // Interval in milliseconds
})
```

#### Methods

- `check(key: string)` - Check if allowed without consuming
- `consume(key: string, tokens?: number)` - Consume tokens
- `destroy()` - Clean up resources

#### Result Object

```typescript
{
  allowed: boolean,    // Request allowed?
  remaining: number,   // Tokens remaining
  resetAt: number,     // When bucket is full (Unix ms)
  retryAfter?: number  // Seconds until next token (if blocked)
}
```

### `createRateLimitMiddleware`

```typescript
createRateLimitMiddleware({
  capacity: number,
  refillRate: number,
  refillInterval: number,
  keyGenerator?: (req) => string,    // Default: req.ip
  skip?: (req) => boolean,           // Skip rate limiting
  onRateLimited?: (req, res, result) => void,
  headers?: boolean,                 // Send headers (default: true)
})
```

## Response Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests allowed |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Reset timestamp (Unix seconds) |
| `Retry-After` | Seconds to wait (on 429 only) |

## How Token Bucket Works

```
Config: capacity=5, refillRate=1, refillInterval=1000 (1 token/sec)

Time 0s: [*****] 5 tokens
         Request → allowed, 4 remaining
         Request → allowed, 3 remaining
         Request → allowed, 2 remaining
         Request → allowed, 1 remaining
         Request → allowed, 0 remaining
         Request → BLOCKED (retry after 1s)

Time 1s: [*    ] 1 token refilled
         Request → allowed, 0 remaining
```
