import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

// Accounts and reviews live in Upstash Redis when it is configured (required on Vercel, whose
// filesystem is read-only), otherwise in a local JSON file for development and self-hosting.
export type Label = 'clear' | 'unclear';
export type Role = 'admin' | 'reviewer';
export type StoredUser = { id: string; email: string; role: Role; active: boolean; created_at: string; password: string };
export type Review = { reviewer_id: string; cephalogram_id: number; label: Label; updated_at: string };

type Backend = {
  secret(): Promise<string>;
  users(): Promise<StoredUser[]>;
  addUser(user: StoredUser): Promise<boolean>;
  saveUser(user: StoredUser): Promise<void>;
  reviews(reviewerId?: string): Promise<Review[]>;
  putReview(review: Review): Promise<void>;
  deleteReviews(reviewerId: string, imageId: number | null): Promise<void>;
};

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

function fileBackend(): Backend {
  type Db = { secret: string; users: StoredUser[]; reviews: Review[] };
  const dataFile = path.resolve(process.env.DATA_FILE || path.join('data', 'ceph-fm.json'));
  let queue: Promise<unknown> = Promise.resolve();
  // Serialises every read-modify-write so concurrent requests never clobber each other.
  const withDb = <T>(fn: (db: Db) => T, write = false): Promise<T> => {
    const run = queue.then(async () => {
      let db: Db;
      try { db = JSON.parse(await fs.readFile(dataFile, 'utf8')); } catch { db = { secret: crypto.randomBytes(32).toString('hex'), users: [], reviews: [] }; write = true; }
      const result = fn(db);
      if (write) {
        await fs.mkdir(path.dirname(dataFile), { recursive: true });
        const temp = `${dataFile}.${process.pid}.tmp`;
        await fs.writeFile(temp, JSON.stringify(db, null, 2));
        await fs.rename(temp, dataFile);
      }
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    secret: () => withDb((db) => db.secret),
    users: () => withDb((db) => db.users),
    addUser: (user) => withDb((db) => { if (db.users.some((item) => item.email === user.email)) return false; db.users.push(user); return true; }, true),
    saveUser: (user) => withDb((db) => { db.users = db.users.map((item) => item.id === user.id ? user : item); }, true),
    reviews: (reviewerId) => withDb((db) => reviewerId ? db.reviews.filter((review) => review.reviewer_id === reviewerId) : db.reviews),
    putReview: (review) => withDb((db) => { db.reviews = db.reviews.filter((item) => !(item.reviewer_id === review.reviewer_id && item.cephalogram_id === review.cephalogram_id)); db.reviews.push(review); }, true),
    deleteReviews: (reviewerId, imageId) => withDb((db) => { db.reviews = db.reviews.filter((review) => !(review.reviewer_id === reviewerId && (imageId === null || review.cephalogram_id === imageId))); }, true),
  };
}

function redisBackend(redis: Redis): Backend {
  // cf:users = id -> user, cf:emails = email -> id, cf:reviews:<reviewer> = image id -> review.
  // Each write touches a single hash field, so concurrent serverless instances cannot lose updates.
  const parse = <T>(value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value) as T;
  const values = <T>(hash: Record<string, unknown> | null) => Object.values(hash || {}).map((value) => parse<T>(value));
  return {
    async secret() {
      await redis.set('cf:secret', crypto.randomBytes(32).toString('hex'), { nx: true });
      return String(await redis.get('cf:secret'));
    },
    users: async () => values<StoredUser>(await redis.hgetall('cf:users')),
    async addUser(user) {
      if (!await redis.hsetnx('cf:emails', user.email, user.id)) return false;
      await redis.hset('cf:users', { [user.id]: JSON.stringify(user) });
      return true;
    },
    saveUser: async (user) => { await redis.hset('cf:users', { [user.id]: JSON.stringify(user) }); },
    async reviews(reviewerId) {
      const ids = reviewerId ? [reviewerId] : (await this.users()).map((user) => user.id);
      if (!ids.length) return [];
      const pipeline = redis.pipeline();
      ids.forEach((id) => pipeline.hgetall(`cf:reviews:${id}`));
      return (await pipeline.exec<(Record<string, unknown> | null)[]>()).flatMap((hash) => values<Review>(hash));
    },
    putReview: async (review) => { await redis.hset(`cf:reviews:${review.reviewer_id}`, { [review.cephalogram_id]: JSON.stringify(review) }); },
    deleteReviews: async (reviewerId, imageId) => { if (imageId === null) await redis.del(`cf:reviews:${reviewerId}`); else await redis.hdel(`cf:reviews:${reviewerId}`, String(imageId)); },
  };
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (process.env.VERCEL && !(redisUrl && redisToken)) console.error('Ceph-FM: Upstash Redis is not configured. Vercel cannot store accounts or reviews on disk.');
const backend = redisUrl && redisToken ? redisBackend(new Redis({ url: redisUrl, token: redisToken })) : fileBackend();

let seeded: Promise<void> | undefined;

// Creates the initial admin account the first time the store is used.
function ensureAdmin() {
  if (process.env.VERCEL && !(redisUrl && redisToken)) throw new Error('Storage is not configured. Connect Upstash Redis to this Vercel project (Storage > Upstash for Redis) and redeploy.');
  seeded ??= (async () => {
    if ((await backend.users()).some((user) => user.role === 'admin')) return;
    const email = (process.env.ADMIN_EMAIL || 'kingdomwise11@gmail.com').toLowerCase();
    await backend.addUser({ id: crypto.randomUUID(), email, role: 'admin', active: true, created_at: new Date().toISOString(), password: hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'Password123!') });
  })().catch((error) => { seeded = undefined; throw error; });
  return seeded;
}

export const store: Backend = Object.fromEntries(Object.entries(backend).map(([name, fn]) => [name, async (...args: unknown[]) => { await ensureAdmin(); return (fn as (...a: unknown[]) => unknown).apply(backend, args); }])) as Backend;

export function publicUser(user: StoredUser) {
  return { id: user.id, email: user.email, role: user.role, active: user.active, created_at: user.created_at };
}
