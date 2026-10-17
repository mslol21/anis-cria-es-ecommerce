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
import { createServiceRoleClient, isSupabaseConfigured, requireAdminSession } from '@/lib/supabase/server';

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

    if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'Armazenamento ainda não configurado.');
    }
    const allowedBuckets = ['custom-uploads-private', 'design-previews-private', 'catalog-public'];
    if (!allowedBuckets.includes(bucket)) {
      throw new ApiError(400, 'INVALID_BUCKET', 'Destino de arquivo inválido.');
    }
    if (bucket !== 'custom-uploads-private') await requireAdminSession(request);
    const supabase = createServiceRoleClient();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(
      validated.storagePath, fileBytes, {
        contentType: validated.realMimeType,
        cacheControl: '3600',
        upsert: false,
      }
    );
    if (uploadError) throw new ApiError(502, 'STORAGE_UPLOAD_FAILED', 'Não foi possível salvar o arquivo.');

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
