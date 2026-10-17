import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@/lib/supabase/server';
import { ApiError, enforceRateLimit, handleApiError } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    enforceRateLimit({
      keyPrefix: 'admin_login',
      identifier: ip,
      maxRequests: 10,
      windowMs: 60_000,
    });

    const body = (await request.json()) as { email?: string; password?: string };
    const expectedEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@aniscriacoes.com.br';
    const expectedPass = process.env.ADMIN_DEFAULT_PASSWORD || 'AnisAdmin@2026';

    if (
      !body.email ||
      !body.password ||
      body.email.trim().toLowerCase() !== expectedEmail.toLowerCase() ||
      body.password !== expectedPass
    ) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha administrativa inválidos.');
    }

    const sessionPayload = {
      userId: '00000000-0000-0000-0000-000000000099',
      email: expectedEmail,
      role: 'super_admin',
      exp: Date.now() + 12 * 60 * 60 * 1000,
    };

    const encoded = Buffer.from(JSON.stringify(sessionPayload), 'utf8').toString('base64url');
    const cookieStore = cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, encoded, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });

    return NextResponse.json({
      authenticated: true,
      admin: {
        email: sessionPayload.email,
        role: sessionPayload.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  return NextResponse.json({ authenticated: false });
}
