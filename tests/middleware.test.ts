import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createRateLimitMiddleware } from '../src/middleware/express';

describe('Express Middleware', () => {
  let app: Express;

  beforeEach(() => {
    vi.useFakeTimers();
    app = express();
  });

  describe('basic rate limiting', () => {
    it('should allow requests under the limit', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 5,
          refillRate: 1,
          refillInterval: 1000,
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should reject requests over the limit', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 2,
          refillRate: 1,
          refillInterval: 1000,
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      // Use up all tokens
      await request(app).get('/test');
      await request(app).get('/test');

      // This should be rejected
      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too Many Requests');
      expect(response.body.retryAfter).toBeDefined();
    });
  });

  describe('rate limit headers', () => {
    it('should set rate limit headers', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 10,
          refillRate: 1,
          refillInterval: 1000,
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('9');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should set Retry-After header when rate limited', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 1,
          refillRate: 1,
          refillInterval: 1000,
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      await request(app).get('/test');
      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should not send headers when headers option is false', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 10,
          refillRate: 1,
          refillInterval: 1000,
          headers: false,
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
    });
  });

  describe('custom key generator', () => {
    it('should use custom key generator', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 2,
          refillRate: 1,
          refillInterval: 1000,
          keyGenerator: (req) => req.headers['x-api-key'] as string ?? 'anonymous',
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      // Requests with different API keys should have separate limits
      await request(app).get('/test').set('x-api-key', 'user-1');
      await request(app).get('/test').set('x-api-key', 'user-1');
      const user1Response = await request(app).get('/test').set('x-api-key', 'user-1');

      await request(app).get('/test').set('x-api-key', 'user-2');
      const user2Response = await request(app).get('/test').set('x-api-key', 'user-2');

      expect(user1Response.status).toBe(429); // user-1 exceeded limit
      expect(user2Response.status).toBe(200); // user-2 still under limit
    });
  });

  describe('skip option', () => {
    it('should skip rate limiting for certain requests', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 1,
          refillRate: 1,
          refillInterval: 1000,
          skip: (req) => req.path === '/health',
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));
      app.get('/health', (_req, res) => res.json({ status: 'ok' }));

      // Use up the limit
      await request(app).get('/test');

      // /test should be rate limited
      const testResponse = await request(app).get('/test');
      expect(testResponse.status).toBe(429);

      // /health should still work (skipped)
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.status).toBe(200);
    });
  });

  describe('custom rate limit handler', () => {
    it('should use custom onRateLimited handler', async () => {
      app.use(
        createRateLimitMiddleware({
          capacity: 1,
          refillRate: 1,
          refillInterval: 1000,
          onRateLimited: (_req, res, result) => {
            res.status(503).json({
              message: 'Service busy',
              waitTime: result.retryAfter,
            });
          },
        })
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      await request(app).get('/test');
      const response = await request(app).get('/test');

      expect(response.status).toBe(503);
      expect(response.body.message).toBe('Service busy');
      expect(response.body.waitTime).toBeDefined();
    });
  });
});
