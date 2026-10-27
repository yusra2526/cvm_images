import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || password.length < 6) return NextResponse.json({ error: 'Valid email and 6+ character password required.' }, { status: 400 });
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return NextResponse.json({ error: error?.message || 'Could not create reviewer.' }, { status: 400 });
    const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, email, role: 'reviewer', active: true });
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
    return NextResponse.json({ id: data.user.id, email });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = await request.json();
    const userId = String(body.userId || '');
    const password = String(body.password || '');
    if (!userId || password.length < 6) return NextResponse.json({ error: 'User and 6+ character password required.' }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status: 401 });
  }
}
