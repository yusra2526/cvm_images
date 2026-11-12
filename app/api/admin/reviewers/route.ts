import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { handle, HttpError, requireAdmin } from '@/lib/auth';
import { hashPassword, store, type StoredUser } from '@/lib/store';

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || password.length < 6) throw new HttpError(400, 'Valid email and 6+ character password required.');
    const user: StoredUser = { id: crypto.randomUUID(), email, role: 'reviewer', active: true, created_at: new Date().toISOString(), password: hashPassword(password) };
    if (!await store.addUser(user)) throw new HttpError(400, 'A user with this email already exists.');
    return NextResponse.json({ id: user.id, email: user.email });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await request.json();
    const userId = String(body.userId || '');
    const password = String(body.password || '');
    if (!userId || password.length < 6) throw new HttpError(400, 'User and 6+ character password required.');
    const user = (await store.users()).find((item) => item.id === userId);
    if (!user) throw new HttpError(404, 'User not found.');
    await store.saveUser({ ...user, password: hashPassword(password) });
    return NextResponse.json({ ok: true });
  });
}
