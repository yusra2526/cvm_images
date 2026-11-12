import { NextResponse } from 'next/server';
import { handle, requireAdmin } from '@/lib/auth';
import { getAarizIndex } from '@/lib/aariz';
import { publicUser, store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const [users, reviews, index] = await Promise.all([store.users(), store.reviews(), getAarizIndex()]);
    const profiles = users.filter((user) => user.role === 'reviewer').sort((a, b) => a.created_at.localeCompare(b.created_at)).map(publicUser);
    const images = index.map(({ id, title, file, split }) => ({ id, title, file, split }));
    return NextResponse.json({ profiles, reviews, images });
  });
}
