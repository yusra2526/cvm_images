import { NextResponse } from 'next/server';
import { handle, HttpError, requireUser } from '@/lib/auth';
import { withDb, type Review } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const reviews = await withDb((db) => db.reviews.filter((review) => review.reviewer_id === user.id));
    return NextResponse.json({ reviews });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await request.json();
    const cephalogramId = Number(body.cephalogramId);
    const label = body.label;
    if (!Number.isInteger(cephalogramId) || cephalogramId < 1 || (label !== 'clear' && label !== 'unclear')) throw new HttpError(400, 'Valid image and label required.');
    const review: Review = { reviewer_id: user.id, cephalogram_id: cephalogramId, label, updated_at: new Date().toISOString() };
    await withDb((db) => {
      db.reviews = db.reviews.filter((item) => !(item.reviewer_id === user.id && item.cephalogram_id === cephalogramId));
      db.reviews.push(review);
    }, true);
    return NextResponse.json({ review });
  });
}
