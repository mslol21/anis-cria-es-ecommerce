import { NextResponse } from 'next/server';
import { createServiceRoleClient, createSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase/server';
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });
    if (error || !data.user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }

    // Validate the identity returned by Supabase Auth, not the cookie that is
    // being created on this same HTTP response.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabase.auth.signOut();
      throw new ApiError(503, 'ADMIN_AUTH_NOT_CONFIGURED', 'Chave privada do Supabase não configurada.');
    }
    const serviceClient = createServiceRoleClient();
    const { data: staff, error: staffError } = await serviceClient
      .from('staff_roles')
      .select('role, is_active')
      .eq('user_id', data.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (staffError) {
      await supabase.auth.signOut();
      throw new ApiError(503, 'ADMIN_ROLE_CHECK_FAILED', 'Não foi possível verificar a permissão administrativa.');
    }
    if (!staff) {
      await supabase.auth.signOut();
      throw new ApiError(403, 'ADMIN_ROLE_REQUIRED', 'Usuário autenticado sem permissão administrativa. Verifique staff_roles.');
    }

    return NextResponse.json({
      authenticated: true,
      admin: { email: data.user.email || '', role: staff.role },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  if (isSupabaseConfigured()) await createSupabaseServerClient().auth.signOut();
  return NextResponse.json({ authenticated: false });
}
