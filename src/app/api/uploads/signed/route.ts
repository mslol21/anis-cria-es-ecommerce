import { NextResponse } from 'next/server';
import { verifySignedPrivateFileToken } from '@/lib/security/file-validator';
import { getDbState } from '@/lib/store/ecommerce-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const verified = verifySignedPrivateFileToken(token);

  if (!verified.valid || !verified.bucket || !verified.storagePath) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_OR_EXPIRED_SIGNED_URL',
          message: 'A URL assinada para acesso ao arquivo privado é inválida ou expirou.',
        },
      },
      { status: 403 }
    );
  }

  const db = getDbState();
  const stored = db.uploadedFiles[`${verified.bucket}:${verified.storagePath}`];
  if (!stored) {
    return NextResponse.json(
      {
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Arquivo não encontrado no bucket privado.',
        },
      },
      { status: 404 }
    );
  }

  const buffer = Buffer.from(stored.base64Data, 'base64');
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': stored.mimeType,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, max-age=300',
    },
  });
}
