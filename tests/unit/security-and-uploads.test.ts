import { describe, expect, it, beforeEach } from 'vitest';
import {
  createSignedPrivateFileToken,
  detectRealMimeType,
  validateAndPrepareUpload,
  verifySignedPrivateFileToken,
} from '@/lib/security/file-validator';
import {
  checkRateLimit,
  enforceRateLimit,
  resetRateLimitBuckets,
} from '@/lib/security/rate-limiter';

describe('Security, Binary File Upload Validation & Signed Private URLs', () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it('validates genuine PNG magic bytes and generates sanitized storage path', () => {
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(detectRealMimeType(pngBytes)).toBe('image/png');

    const res = validateAndPrepareUpload(
      pngBytes,
      'Minha Arte Casamento!!.png',
      'image/png',
      'personalizations'
    );
    expect(res.realMimeType).toBe('image/png');
    expect(res.sanitizedFileName).toBe('Minha-Arte-Casamento--.png');
    expect(res.storagePath).toContain('personalizations/');
    expect(res.sha256Checksum).toHaveLength(64);
  });

  it('validates genuine PDF magic bytes (%PDF-)', () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const res = validateAndPrepareUpload(
      pdfBytes,
      'brasao-noivos.pdf',
      'application/pdf',
      'arts'
    );
    expect(res.realMimeType).toBe('application/pdf');
    expect(res.sanitizedFileName).toBe('brasao-noivos.pdf');
  });

  it('rejects spoofed executable or text files disguised as PNG', () => {
    const fakeBytes = new TextEncoder().encode('MZ-executable-payload-not-an-image');
    expect(() =>
      validateAndPrepareUpload(fakeBytes, 'malware.png', 'image/png', 'uploads')
    ).toThrow(/Formato real do arquivo inválido/i);
  });

  it('rejects files exceeding maximum allowed byte size', () => {
    const pngHeader = new Uint8Array(2048);
    pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    expect(() =>
      validateAndPrepareUpload(pngHeader, 'grande.png', 'image/png', 'uploads', {
        maxFileSizeBytes: 1024,
      })
    ).toThrow(/excede o tamanho máximo/i);
  });

  it('creates and verifies time-limited signed tokens for private storage buckets', () => {
    const signed = createSignedPrivateFileToken(
      'custom-uploads-private',
      'personalizations/2026-10-16/foto.png',
      600
    );
    expect(signed.signedUrl).toContain('/api/uploads/signed?token=');

    const verified = verifySignedPrivateFileToken(signed.token);
    expect(verified.valid).toBe(true);
    expect(verified.bucket).toBe('custom-uploads-private');
    expect(verified.storagePath).toBe('personalizations/2026-10-16/foto.png');

    // Expired token must fail verification
    const expired = createSignedPrivateFileToken(
      'custom-uploads-private',
      'personalizations/2026-10-16/foto.png',
      -10
    );
    expect(verifySignedPrivateFileToken(expired.token).valid).toBe(false);
  });

  it('enforces rate limiting on sensitive endpoints', () => {
    for (let i = 0; i < 3; i++) {
      const state = checkRateLimit({
        keyPrefix: 'test_endpoint',
        identifier: '127.0.0.1',
        maxRequests: 3,
        windowMs: 60_000,
      });
      expect(state.allowed).toBe(true);
    }

    expect(() =>
      enforceRateLimit({
        keyPrefix: 'test_endpoint',
        identifier: '127.0.0.1',
        maxRequests: 3,
        windowMs: 60_000,
      })
    ).toThrow(/Muitas requisições/i);
  });
});
