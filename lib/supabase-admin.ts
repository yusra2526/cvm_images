import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server environment variables are missing.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requireAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Unauthorized');
  const admin = getSupabaseAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new Error('Unauthorized');
  const { data: profile, error: profileError } = await admin.from('profiles').select('role, active').eq('id', userData.user.id).single();
  if (profileError || profile?.role !== 'admin' || profile.active !== true) throw new Error('Forbidden');
  return { admin, user: userData.user };
}
