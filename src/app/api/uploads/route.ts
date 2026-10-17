import { NextResponse } from 'next/server';
import {
  createSignedPrivateFileToken,
  validateAndPrepareUpload,
} from '@/lib/security/file-validator';
import {
  ApiError,
  enforceRateLimit,
  handleApiError,
} from '@/lib/security/rate-limiter';
import { getDbState, saveDbState } from '@/lib/store/ecommerce-service';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    enforceRateLimit({
      keyPrefix: 'file_upload',
      identifier: ip,
      maxRequests: 25,
      windowMs: 60_000,
    });

    const formData = await request.formData();
    const file = formData.get('file');
    const bucket = String(formData.get('bucket') || 'custom-uploads-private');
    const folder = String(formData.get('folder') || 'personalizations');

    if (!file || !(file instanceof File)) {
      throw new ApiError(400, 'MISSING_FILE', 'Selecione um arquivo válido para envio.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const validated = validateAndPrepareUpload(
      fileBytes,
      file.name,
      file.type,
      folder,
      {
        maxFileSizeBytes: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
      }
    );

    const db = getDbState();
    db.uploadedFiles[`${bucket}:${validated.storagePath}`] = {
      bucket,
      storagePath: validated.storagePath,
      mimeType: validated.realMimeType,
      sizeBytes: validated.sizeBytes,
      base64Data: Buffer.from(fileBytes).toString('base64'),
      createdAt: new Date().toISOString(),
    };
    saveDbState();

    const signed = createSignedPrivateFileToken(bucket, validated.storagePath, 900);

    return NextResponse.json(
      {
        storageBucket: bucket,
        storagePath: validated.storagePath,
        originalName: validated.sanitizedFileName,
        mimeType: validated.realMimeType,
        sizeBytes: validated.sizeBytes,
        sha256Checksum: validated.sha256Checksum,
        signedPreviewUrl: signed.signedUrl,
        expiresAt: signed.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
