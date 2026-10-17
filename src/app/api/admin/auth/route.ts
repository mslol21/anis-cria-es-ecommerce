import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseConfigured, requireAdminSession } from '@/lib/supabase/server';
import { ApiError, enforceRateLimit, handleApiError } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    enforceRateLimit({
      keyPrefix: 'admin_login',
      identifier: request.headers.get('x-forwarded-for') || 'local',
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Configure o Supabase Auth antes de acessar o painel.');
    }
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      throw new ApiError(400, 'INVALID_CREDENTIALS', 'Informe e-mail e senha.');
    }
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });
    if (error) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.');
    try {
      const admin = await requireAdminSession(request);
      return NextResponse.json({ authenticated: true, admin: { email: admin.email, role: admin.role } });
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  if (isSupabaseConfigured()) await createSupabaseServerClient().auth.signOut();
  return NextResponse.json({ authenticated: false });
}
