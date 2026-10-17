import crypto from 'crypto';
import { ApiError } from './rate-limiter';

export type SupportedUploadMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'application/pdf';

const MAGIC_SIGNATURES: Array<{
  mime: SupportedUploadMime;
  check: (bytes: Uint8Array) => boolean;
}> = [
  {
    mime: 'image/png',
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: 'image/jpeg',
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && // R
      b[1] === 0x49 && // I
      b[2] === 0x46 && // F
      b[3] === 0x46 && // F
      b[8] === 0x57 && // W
      b[9] === 0x45 && // E
      b[10] === 0x42 && // B
      b[11] === 0x50, // P
  },
  {
    mime: 'application/pdf',
    check: (b) =>
      b.length >= 5 &&
      b[0] === 0x25 && // %
      b[1] === 0x50 && // P
      b[2] === 0x44 && // D
      b[3] === 0x46 && // F
      b[4] === 0x2d, // -
  },
];

export function detectRealMimeType(bytes: Uint8Array): SupportedUploadMime | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.check(bytes)) {
      return sig.mime;
    }
  }
  return null;
}

export interface FileValidationOptions {
  allowedMimeTypes?: string[];
  maxFileSizeBytes?: number;
}

export interface ValidatedUploadResult {
  realMimeType: SupportedUploadMime;
  sanitizedFileName: string;
  storagePath: string;
  sizeBytes: number;
  sha256Checksum: string;
}

export function validateAndPrepareUpload(
  fileBytes: Uint8Array,
  originalFileName: string,
  declaredMimeType: string,
  folderPrefix: string,
  options?: FileValidationOptions
): ValidatedUploadResult {
  const maxBytes = options?.maxFileSizeBytes ?? 10 * 1024 * 1024; // 10MB default
  const allowedMimes = options?.allowedMimeTypes ?? [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
  ];

  if (fileBytes.byteLength === 0) {
    throw new ApiError(400, 'EMPTY_FILE', 'O arquivo enviado está vazio.');
  }

  if (fileBytes.byteLength > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    throw new ApiError(
      400,
      'FILE_TOO_LARGE',
      `O arquivo excede o tamanho máximo permitido de ${maxMb} MB.`
    );
  }

  const realMime = detectRealMimeType(fileBytes);
  if (!realMime) {
    throw new ApiError(
      400,
      'INVALID_FILE_SIGNATURE',
      'Formato real do arquivo inválido ou corrompido. Envie apenas PNG, JPG, WEBP ou PDF reais.'
    );
  }

  if (!allowedMimes.includes(realMime)) {
    throw new ApiError(
      400,
      'MIME_NOT_ALLOWED',
      `O tipo de arquivo ${realMime} não é permitido para este campo.`
    );
  }

  if (declaredMimeType && declaredMimeType !== realMime && declaredMimeType !== 'application/octet-stream') {
    throw new ApiError(
      400,
      'MIME_SPOOFING_DETECTED',
      `Divergência entre o tipo declarado (${declaredMimeType}) e a assinatura binária real (${realMime}).`
    );
  }

  const extMap: Record<SupportedUploadMime, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };

  const baseName = originalFileName
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 48) || 'arquivo';

  const ext = extMap[realMime];
  const sanitizedFileName = `${baseName}.${ext}`;
  const sha256Checksum = crypto.createHash('sha256').update(fileBytes).digest('hex');
  const uniqueId = crypto.randomUUID();
  const storagePath = `${folderPrefix}/${new Date().toISOString().slice(0, 10)}/${uniqueId}-${sanitizedFileName}`;

  return {
    realMimeType: realMime,
    sanitizedFileName,
    storagePath,
    sizeBytes: fileBytes.byteLength,
    sha256Checksum,
  };
}

export function createSignedPrivateFileToken(
  bucket: string,
  storagePath: string,
  expiresInSeconds = 900
): { token: string; expiresAt: string; signedUrl: string } {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'anis-dev-signing-secret-key';
  const expiresAtMs = Date.now() + expiresInSeconds * 1000;
  const payload = `${bucket}:${storagePath}:${expiresAtMs}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${signature}`).toString('base64url');
  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
    signedUrl: `/api/uploads/signed?token=${encodeURIComponent(token)}`,
  };
}

export function verifySignedPrivateFileToken(token: string): {
  valid: boolean;
  bucket?: string;
  storagePath?: string;
} {
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'anis-dev-signing-secret-key';
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return { valid: false };
    const [bucket, storagePath, expiresAtStr, signature] = parts;
    if (!bucket || !storagePath || !expiresAtStr || !signature) return { valid: false };
    const expiresAtMs = Number(expiresAtStr);
    if (Number.isNaN(expiresAtMs) || Date.now() > expiresAtMs) {
      return { valid: false };
    }
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${bucket}:${storagePath}:${expiresAtStr}`)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return { valid: false };
    }
    return { valid: true, bucket, storagePath };
  } catch {
    return { valid: false };
  }
}
