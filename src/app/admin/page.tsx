import React from 'react';
import type { Metadata } from 'next';
import { getAdminSessionFromRequest } from '@/lib/supabase/server';
import { AdminPortalClient } from '@/components/admin/admin-portal-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Painel Administrativo | Anis Criações',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const session = await getAdminSessionFromRequest();
  return <AdminPortalClient initiallyAuthenticated={Boolean(session)} />;
}
