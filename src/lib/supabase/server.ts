import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { ApiError } from '@/lib/security/rate-limiter';
import type { StaffRoleType } from '@/types/database';


export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      anonKey &&
      !url.includes('seu-projeto') &&
      !url.includes('placeholder') &&
      !anonKey.includes('sua-chave')
  );
}

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        } catch {
          // Server component read-only context
        }
      },
    },
  });
}

/**
 * Service Role client exclusively for server-side privileged operations
 * (Webhooks, Stock Reservations, Payment Confirmation, Audit Logging).
 */
export function createServiceRoleClient() {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: Service role client cannot be instantiated in browser');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface AuthenticatedAdmin {
  userId: string;
  email: string;
  role: StaffRoleType;
}

export async function getAdminSessionFromRequest(_req?: Request): Promise<AuthenticatedAdmin | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const serviceClient = createServiceRoleClient();
      const { data: roleRow } = await serviceClient
        .from('staff_roles')
        .select('role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!roleRow) return null;
      return {
        userId: user.id,
        email: user.email || '',
        role: roleRow.role as StaffRoleType,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function requireAdminSession(
  req?: Request,
  allowedRoles: StaffRoleType[] = ['super_admin', 'admin', 'production', 'support']
): Promise<AuthenticatedAdmin> {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin) {
    throw new ApiError(
      401,
      'UNAUTHORIZED_ADMIN',
      'Acesso restrito. Autentique-se com uma conta administrativa autorizada.'
    );
  }
  if (!allowedRoles.includes(admin.role)) {
    throw new ApiError(
      403,
      'FORBIDDEN_ROLE',
      `Seu perfil (${admin.role}) não possui permissão para executar esta operação.`
    );
  }
  return admin;
}
