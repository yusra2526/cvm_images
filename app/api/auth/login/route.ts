import { NextResponse } from 'next/server';
import { createSessionToken, handle, HttpError, setSessionCookie } from '@/lib/auth';
import { publicUser, verifyPassword, withDb } from '@/lib/store';

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const result = await withDb((db) => {
      const user = db.users.find((item) => item.email === email);
      if (!user || !verifyPassword(password, user.password)) throw new HttpError(401, 'Invalid email or password.');
      if (!user.active) throw new HttpError(403, 'This account is not active.');
      return { user: publicUser(user), token: createSessionToken(user.id, db.secret) };
    });
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.token);
    return response;
  });
}
