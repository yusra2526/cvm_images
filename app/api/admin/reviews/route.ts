import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase-admin';

export async function DELETE(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = await request.json();
    const reviewerId = String(body.reviewerId || '');
    const imageId = body.imageId ? Number(body.imageId) : null;
    if (!reviewerId) return NextResponse.json({ error: 'Reviewer is required.' }, { status: 400 });
    let query = admin.from('reviews').delete().eq('reviewer_id', reviewerId);
    if (imageId) query = query.eq('cephalogram_id', imageId);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status: 401 });
  }
}
