import { NextResponse } from 'next/server';
import { verifySignedPrivateFileToken } from '@/lib/security/file-validator';
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const verified = verifySignedPrivateFileToken(token);

  if (!verified.valid || !verified.bucket || !verified.storagePath || !['custom-uploads-private', 'design-previews-private'].includes(verified.bucket)) {
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

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: { code: 'STORAGE_NOT_CONFIGURED' } }, { status: 503 });
  }
  const client = createServiceRoleClient();
  const { data, error } = await client.storage
    .from(verified.bucket)
    .download(verified.storagePath);
  if (error || !data) return NextResponse.json(
    { error: { code: 'FILE_NOT_FOUND', message: 'Arquivo não encontrado.' } }, { status: 404 }
  );
  return new NextResponse(await data.arrayBuffer(), {
    headers: { 'Content-Type': data.type || 'application/octet-stream',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
