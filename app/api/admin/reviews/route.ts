import { NextResponse } from 'next/server';
import { handle, HttpError, requireAdmin } from '@/lib/auth';
import { store } from '@/lib/store';

export async function DELETE(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await request.json();
    const reviewerId = String(body.reviewerId || '');
    const imageId = body.imageId ? Number(body.imageId) : null;
    if (!reviewerId) throw new HttpError(400, 'Reviewer is required.');
    await store.deleteReviews(reviewerId, imageId);
    return NextResponse.json({ ok: true });
  });
}
