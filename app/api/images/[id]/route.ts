import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/auth';
import { getAarizImage } from '@/lib/aariz';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireUser();
    const image = await getAarizImage(Number(params.id));
    if (!image) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    return new NextResponse(new Uint8Array(image.body), { headers: { 'Content-Type': image.contentType, 'Cache-Control': 'private, max-age=86400' } });
  });
}
