import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/auth';
import { getAarizIndex } from '@/lib/aariz';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    await requireUser();
    const images = (await getAarizIndex()).map(({ id, title, file, split }) => ({ id, title, file, split }));
    return NextResponse.json({ images });
  });
}
