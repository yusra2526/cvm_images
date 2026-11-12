import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { store, type StoredUser } from '@/lib/store';

export const SESSION_COOKIE = 'cf_session';
const SESSION_DAYS = 7;

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const sign = (value: string, secret: string) => crypto.createHmac('sha256', process.env.SESSION_SECRET || secret).update(value).digest('base64url');

export function createSessionToken(userId: string, secret: string) {
  const value = `${userId}.${Date.now() + SESSION_DAYS * 86400000}`;
  return `${value}.${sign(value, secret)}`;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_DAYS * 86400 });
}

export async function getSessionUser(): Promise<StoredUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [userId, expires, signature] = token.split('.');
  if (!userId || !expires || !signature || Number(expires) < Date.now()) return null;
  const expected = sign(`${userId}.${expires}`, await store.secret());
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  const user = (await store.users()).find((item) => item.id === userId);
  return user?.active ? user : null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, 'Unauthorized');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new HttpError(403, 'Forbidden');
  return user;
}

export async function handle(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed.' }, { status });
  }
}
