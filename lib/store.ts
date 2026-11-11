import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Accounts and reviews live in a local JSON file. No external database is needed.
const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join('data', 'ceph-fm.json'));

export type Label = 'clear' | 'unclear';
export type Role = 'admin' | 'reviewer';
export type StoredUser = { id: string; email: string; role: Role; active: boolean; created_at: string; password: string };
export type Review = { reviewer_id: string; cephalogram_id: number; label: Label; updated_at: string };
type Db = { secret: string; users: StoredUser[]; reviews: Review[] };

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

async function load(): Promise<Db> {
  let db: Db;
  try {
    db = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch {
    db = { secret: crypto.randomBytes(32).toString('hex'), users: [], reviews: [] };
  }
  const adminEmail = (process.env.ADMIN_EMAIL || 'kingdomwise11@gmail.com').toLowerCase();
  if (!db.users.some((user) => user.role === 'admin')) {
    db.users.push({ id: crypto.randomUUID(), email: adminEmail, role: 'admin', active: true, created_at: new Date().toISOString(), password: hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'Password123!') });
    await save(db);
  }
  return db;
}

async function save(db: Db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const temp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(db, null, 2));
  await fs.rename(temp, DATA_FILE);
}

let queue: Promise<unknown> = Promise.resolve();

// Serialises every read-modify-write so concurrent requests never clobber each other.
export function withDb<T>(fn: (db: Db) => T | Promise<T>, write = false): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    if (write) await save(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function publicUser(user: StoredUser) {
  return { id: user.id, email: user.email, role: user.role, active: user.active, created_at: user.created_at };
}
