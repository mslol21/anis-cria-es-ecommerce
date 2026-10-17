import { NextResponse } from 'next/server';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface RateLimitConfig {
  keyPrefix: string;
  identifier: string;
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const bucketKey = `${config.keyPrefix}:${config.identifier}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    buckets.set(bucketKey, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (existing.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - existing.count),
    resetAt: existing.resetAt,
  };
}

export function enforceRateLimit(config: RateLimitConfig): void {
  const res = checkRateLimit(config);
  if (!res.allowed) {
    throw new ApiError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Muitas requisições em um curto intervalo. Aguarde alguns instantes e tente novamente.',
      { resetAt: new Date(res.resetAt).toISOString() }
    );
  }
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erro interno no processamento da requisição.',
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Ocorreu um erro inesperado.',
      },
    },
    { status: 500 }
  );
}
