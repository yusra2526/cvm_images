import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const [{ data: profiles, error: profilesError }, { data: reviews, error: reviewsError }, { data: images, error: imagesError }] = await Promise.all([
      admin.from('profiles').select('id, email, role, active, created_at').eq('role', 'reviewer').order('created_at'),
      admin.from('reviews').select('reviewer_id, cephalogram_id, label, updated_at'),
      admin.from('cephalograms').select('id, title, storage_path, dataset_split').order('id'),
    ]);
    if (profilesError || reviewsError || imagesError) throw new Error(profilesError?.message || reviewsError?.message || imagesError?.message);
    return NextResponse.json({ profiles: profiles || [], reviews: reviews || [], images: images || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status: 401 });
  }
}
