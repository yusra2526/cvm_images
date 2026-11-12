import { NextResponse } from 'next/server';
import { createSessionToken, handle, HttpError, setSessionCookie } from '@/lib/auth';
import { publicUser, store, verifyPassword } from '@/lib/store';

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = (await store.users()).find((item) => item.email === email);
    if (!user || !verifyPassword(password, user.password)) throw new HttpError(401, 'Invalid email or password.');
    if (!user.active) throw new HttpError(403, 'This account is not active.');
    const response = NextResponse.json({ user: publicUser(user) });
    setSessionCookie(response, createSessionToken(user.id, await store.secret()));
    return response;
  });
}
