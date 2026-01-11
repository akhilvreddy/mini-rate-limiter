/**
 * Express middleware example for mini-rate-limiter
 *
 * Run with: npx ts-node examples/express-api.ts
 * Test with: curl http://localhost:3000/api/data (spam it to see rate limiting)
 */

import express from 'express';
import { createRateLimitMiddleware } from '../dist/middleware';

const app = express();
const PORT = 3000;

// Apply rate limiting to all routes
// Config: 5 requests allowed, refills 1 token per second
app.use(
  createRateLimitMiddleware({
    capacity: 5,
    refillRate: 1,
    refillInterval: 1000,
    // Use IP address as the rate limit key (default behavior)
    keyGenerator: (req) => req.ip ?? 'unknown',
    // Skip rate limiting for health checks
    skip: (req) => req.path === '/health',
  })
);

// Health check endpoint (not rate limited)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API endpoint (rate limited)
app.get('/api/data', (_req, res) => {
  res.json({
    message: 'Hello from the API!',
    timestamp: new Date().toISOString(),
  });
});

// API endpoint with custom key (rate limited by API key)
app.get('/api/user', (req, res) => {
  res.json({
    user: 'John Doe',
    apiKey: req.headers['x-api-key'] ?? 'none',
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('');
  console.log('Rate limit config: 5 requests/second');
  console.log('');
  console.log('Try these endpoints:');
  console.log(`  curl http://localhost:${PORT}/api/data`);
  console.log(`  curl http://localhost:${PORT}/health  (not rate limited)`);
  console.log('');
  console.log('Spam the /api/data endpoint to see rate limiting in action!');
  console.log('Check the X-RateLimit-* headers in the response.');
});
