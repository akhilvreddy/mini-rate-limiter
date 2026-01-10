import type { Request, Response, NextFunction } from 'express';
import { RateLimiter, type RateLimiterConfig, type RateLimitResult } from '../index';

export interface RateLimitMiddlewareOptions extends RateLimiterConfig {
  /**
   * Function to extract the rate limit key from the request
   * Default: uses req.ip
   */
  keyGenerator?: (req: Request) => string;

  /**
   * Custom handler when rate limit is exceeded
   * Default: sends 429 with JSON error response
   */
  onRateLimited?: (req: Request, res: Response, result: RateLimitResult) => void;

  /**
   * Function to determine if the request should skip rate limiting
   * Default: no requests are skipped
   */
  skip?: (req: Request) => boolean;

  /**
   * Whether to send rate limit headers
   * Default: true
   */
  headers?: boolean;
}

/**
 * Default key generator using request IP
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/**
 * Default rate limit exceeded handler
 */
function defaultOnRateLimited(
  _req: Request,
  res: Response,
  result: RateLimitResult
): void {
  res.status(429).json({
    error: 'Too Many Requests',
    retryAfter: result.retryAfter,
  });
}

/**
 * Set rate limit headers on the response
 */
function setRateLimitHeaders(
  res: Response,
  result: RateLimitResult,
  capacity: number
): void {
  res.set('X-RateLimit-Limit', String(capacity));
  res.set('X-RateLimit-Remaining', String(result.remaining));
  res.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));

  if (!result.allowed && result.retryAfter !== undefined) {
    res.set('Retry-After', String(result.retryAfter));
  }
}

/**
 * Create an Express middleware for rate limiting
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createRateLimitMiddleware } from 'mini-rate-limiter/middleware';
 *
 * const app = express();
 *
 * app.use(createRateLimitMiddleware({
 *   capacity: 100,
 *   refillRate: 100,
 *   refillInterval: 60000, // 100 requests per minute
 * }));
 *
 * app.get('/api/data', (req, res) => {
 *   res.json({ data: 'hello' });
 * });
 * ```
 */
export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const limiter = new RateLimiter(options);
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator;
  const onRateLimited = options.onRateLimited ?? defaultOnRateLimited;
  const skip = options.skip;
  const sendHeaders = options.headers !== false;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if request should skip rate limiting
    if (skip && skip(req)) {
      next();
      return;
    }

    try {
      const key = keyGenerator(req);
      const result = await limiter.consume(key);

      // Set rate limit headers
      if (sendHeaders) {
        setRateLimitHeaders(res, result, options.capacity);
      }

      if (result.allowed) {
        next();
      } else {
        onRateLimited(req, res, result);
      }
    } catch (error) {
      next(error);
    }
  };
}
