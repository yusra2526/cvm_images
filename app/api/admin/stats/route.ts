import { NextResponse } from 'next/server';
import { handle, requireAdmin } from '@/lib/auth';
import { getAarizIndex } from '@/lib/aariz';
import { publicUser, withDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const [{ profiles, reviews }, index] = await Promise.all([
      withDb((db) => ({ profiles: db.users.filter((user) => user.role === 'reviewer').map(publicUser), reviews: db.reviews })),
      getAarizIndex(),
    ]);
    const images = index.map(({ id, title, file, split }) => ({ id, title, file, split }));
    return NextResponse.json({ profiles, reviews, images });
  });
}
