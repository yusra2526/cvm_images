'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronLeft, ChevronRight, ClipboardList, LogOut, Plus, RotateCcw, ShieldCheck, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type Label = 'clear' | 'unclear';
type ImageRecord = { id: number; title: string; storage_path: string; dataset_split?: string | null };
type Review = { reviewer_id: string; cephalogram_id: number; label: Label; updated_at?: string };
type Profile = { id: string; email: string; role: string; active: boolean };
type User = { id: string; email: string; role: 'admin' | 'reviewer' };

const TOTAL = 1000;

function SetupMessage({ text }: { text: string }) {
  return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">CF</div><p className="eyebrow">CEPH-FM SETUP</p><h1>Supabase is not connected.</h1><p className="muted">{text}</p><p className="demo-note"><ShieldCheck size={16} /> Add the Supabase variables from <code>.env.example</code>, run <code>supabase/schema.sql</code>, then redeploy.</p></div></main>;
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) return setError(signInError?.message || 'Unable to sign in.');
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, active').eq('id', data.user.id).single();
    if (profileError || profile?.active === false) return setError('This account is not active.');
    onLogin({ id: data.user.id, email: data.user.email || email, role: profile?.role === 'admin' ? 'admin' : 'reviewer' });
  };
  return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">CF</div><p className="eyebrow">CEPH-FM / AARIZ DATASET</p><h1>Review with confidence.</h1><p className="muted">Sign in to review cervical regions and resume your saved progress.</p><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reviewer@example.com" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required /></label>{error && <p className="error">{error}</p>}<button className="primary wide">Sign in <ChevronRight size={17} /></button></form><div className="demo-note"><ShieldCheck size={16} /><span>Reviewer accounts are created by the administrator.</span></div></div></main>;
}

function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <header className="topbar"><div className="top-brand"><div className="small-mark">CF</div><span>Ceph-FM {user.role === 'admin' && <em>Admin</em>}</span></div><div className="top-actions"><span className="user-pill">{user.email}</span><button className="icon-button" onClick={onLogout} title="Sign out"><LogOut size={18} /></button></div></header>;
}

function Reviewer({ user, onLogout }: { user: User; onLogout: () => void }) {
  const supabase = getSupabaseBrowserClient();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const image = images[index];
  const done = Object.keys(reviews).length;
  const percent = images.length ? Math.round((done / images.length) * 100) : 0;

  useEffect(() => {
    if (!supabase) return;
    const load = async () => {
      const [{ data: imageData, error: imageError }, { data: reviewData, error: reviewError }] = await Promise.all([
        supabase.from('cephalograms').select('id,title,storage_path,dataset_split').order('id'),
        supabase.from('reviews').select('reviewer_id,cephalogram_id,label,updated_at').eq('reviewer_id', user.id),
      ]);
      if (imageError || reviewError) return setError(imageError?.message || reviewError?.message || 'Could not load review data.');
      setImages((imageData || []) as ImageRecord[]);
      const mapped: Record<number, Review> = {};
      (reviewData || []).forEach((review) => { mapped[review.cephalogram_id] = review as Review; });
      setReviews(mapped);
      const first = (imageData || []).findIndex((item) => !mapped[item.id]);
      if (first >= 0) setIndex(first);
    };
    void load();
  }, [supabase, user.id]);

  useEffect(() => {
    if (!supabase || !image) return;
    const loadUrl = async () => {
      if (image.storage_path.startsWith('/')) return setImageUrl(image.storage_path);
      const { data, error: signedError } = await supabase.storage.from('cephalograms').createSignedUrl(image.storage_path, 3600);
      if (signedError) setError(signedError.message); else setImageUrl(data.signedUrl);
    };
    void loadUrl();
  }, [supabase, image]);

  const saveLabel = async (label: Label) => {
    if (!supabase || !image) return;
    const next = { reviewer_id: user.id, cephalogram_id: image.id, label, updated_at: new Date().toISOString() };
    const { error: saveError } = await supabase.from('reviews').upsert(next, { onConflict: 'reviewer_id,cephalogram_id' });
    if (saveError) return setError(saveError.message);
    setReviews((current) => ({ ...current, [image.id]: next }));
  };
  const go = (nextIndex: number) => { setZoom(1); setIndex(Math.max(0, Math.min(images.length - 1, nextIndex))); };
  const changeZoom = (amount: number) => setZoom((current) => Math.min(3, Math.max(1, Number((current + amount).toFixed(2)))));

  if (!images.length) return <main className="app-shell"><Header user={user} onLogout={onLogout} /><div className="empty-page"><p className="muted">{error || 'Loading the Aariz image set...'}</p></div></main>;

  const selected = image ? reviews[image.id] : undefined;
  return <main className="app-shell"><Header user={user} onLogout={onLogout} /><div className="review-layout"><aside className="side-panel"><p className="eyebrow">REVIEW WORKSPACE</p><h2>Good morning.</h2><p className="muted">Review each image and identify whether the cervical region is clear.</p><div className="progress-wrap"><div className="progress-label"><span>{done} of {images.length} marked</span><strong>{percent}%</strong></div><div className="progress" aria-label={`${percent}% complete`}><span style={{ width: `${percent}%` }} /></div></div><div className="side-stat"><span>Remaining</span><strong>{images.length - done}</strong></div><div className="side-stat"><span>Current image</span><strong>{index + 1}</strong></div><div className="review-tip"><ClipboardList size={18} /><div><strong>Review tip</strong><p>Use zoom controls to inspect the complete cervical region.</p></div></div></aside><section className="review-main"><div className="review-header"><div><p className="eyebrow">IMAGE {String(index + 1).padStart(4, '0')}</p><h1>{image.title}</h1></div><span className="status-badge">{selected ? 'Marked' : 'Needs review'}</span></div><div className="image-toolbar"><span>Image view</span><div className="zoom-controls"><button className="zoom-button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 1}><ZoomOut size={17} /></button><strong>{Math.round(zoom * 100)}%</strong><button className="zoom-button" onClick={() => changeZoom(0.25)} disabled={zoom >= 3}><ZoomIn size={17} /></button><button className="zoom-button" onClick={() => setZoom(1)} disabled={zoom === 1}><RotateCcw size={16} /></button></div></div><div className="image-stage"><img className="ceph-image" src={imageUrl} alt={image.title} style={{ transform: `scale(${zoom})`, maxWidth: zoom === 1 ? '100%' : 'none', maxHeight: zoom === 1 ? '100%' : 'none' }} /></div><div className="decision-row"><button className={`decision clear ${selected?.label === 'clear' ? 'active' : ''}`} onClick={() => void saveLabel('clear')}><span className="decision-icon"><Check size={22} /></span><span><strong>Clear</strong><small>Cervical region is clearly visible</small></span></button><button className={`decision unclear ${selected?.label === 'unclear' ? 'active' : ''}`} onClick={() => void saveLabel('unclear')}><span className="decision-icon"><X size={22} /></span><span><strong>Unclear</strong><small>Cervical region is not clearly visible</small></span></button></div><div className="navigation"><button className="secondary" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft size={17} /> Previous</button><span>{index + 1} / {images.length}</span><button className="primary" onClick={() => go(index + 1)} disabled={!selected || index === images.length - 1}>Next <ChevronRight size={17} /></button></div>{error && <p className="error">{error}</p>}</section></div></main>;
}

function Admin({ user, onLogout }: { user: User; onLogout: () => void }) {
  const supabase = getSupabaseBrowserClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [draftPasswords, setDraftPasswords] = useState<Record<string, string>>({});
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setError('Admin session expired.');
    const response = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || 'Could not load admin statistics.');
    else { setProfiles(payload.profiles || []); setReviews(payload.reviews || []); setImages(payload.images || []); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const imageStats = useMemo(() => images.map((image) => {
    const values = reviews.filter((review) => review.cephalogram_id === image.id);
    const clear = values.filter((review) => review.label === 'clear').length;
    const unclear = values.filter((review) => review.label === 'unclear').length;
    return { ...image, clear, unclear, total: clear + unclear, majority: clear === 0 && unclear === 0 ? 'unmarked' : clear === unclear ? 'tie' : clear > unclear ? 'clear' : 'unclear' };
  }), [images, reviews]);
  const available = imageStats.filter((image) => image.total > 0);
  const clearMajority = available.filter((image) => image.majority === 'clear');
  const unclearMajority = available.filter((image) => image.majority === 'unclear');
  const ties = available.filter((image) => image.majority === 'tie');
  const resolvedTotal = clearMajority.length + unclearMajority.length;
  const train = Math.round(resolvedTotal * .7);
  const validation = Math.round(resolvedTotal * .15);
  const test = resolvedTotal - train - validation;

  const adminRequest = async (path: string, method: string, body: Record<string, unknown>) => {
    const { data } = await supabase!.auth.getSession();
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Request failed.');
  };
  const createReviewer = async (event: React.FormEvent) => {
    event.preventDefault();
    try { await adminRequest('/api/admin/reviewers', 'POST', { email, password }); setEmail(''); setPassword(''); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not create reviewer.'); }
  };
  const resetPassword = async (reviewerId: string) => {
    try { await adminRequest('/api/admin/reviewers', 'PATCH', { userId: reviewerId, password: draftPasswords[reviewerId] }); setDraftPasswords((current) => ({ ...current, [reviewerId]: '' })); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not reset password.'); }
  };
  const resetReviews = async (reviewerId: string, imageId?: number) => {
    try { await adminRequest('/api/admin/reviews', 'DELETE', { reviewerId, imageId }); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not remove reviews.'); }
  };
  const markedByReviewer = (reviewerId: string) => reviews.filter((review) => review.reviewer_id === reviewerId).length;
  const clearByReviewer = (reviewerId: string) => reviews.filter((review) => review.reviewer_id === reviewerId && review.label === 'clear').length;
  const chartTotal = Math.max(resolvedTotal, 1);

  return <main className="app-shell"><Header user={user} onLogout={onLogout} /><div className="admin-layout"><div className="admin-heading"><div><p className="eyebrow">ADMIN CONSOLE</p><h1>Research overview</h1><p className="muted">Shared reviewer activity and image-level consensus.</p></div><span className="secure-label"><ShieldCheck size={16} /> Supabase secured</span></div>{error && <p className="error">{error}</p>}{loading ? <p className="muted">Loading statistics...</p> : <><div className="stat-grid"><div className="stat-card"><Users size={19} /><span>Reviewers</span><strong>{profiles.length}</strong><small>accounts created</small></div><div className="stat-card"><ClipboardList size={19} /><span>Total marked</span><strong>{reviews.length}</strong><small>shared submissions</small></div><div className="stat-card green-stat"><Check size={19} /><span>Clear majority</span><strong>{clearMajority.length}</strong><small>{available.length ? Math.round(clearMajority.length / available.length * 100) : 0}% of available images</small></div><div className="stat-card"><BarChart3 size={19} /><span>Resolved images</span><strong>{resolvedTotal}</strong><small>{ties.length} tied</small></div></div><div className="admin-columns"><section className="panel"><div className="panel-heading"><div><h2>Reviewer accounts</h2><p className="muted">Create and manage real Supabase accounts.</p></div><span className="count-tag">{profiles.length}</span></div><form className="add-reviewer" onSubmit={(event) => void createReviewer(event)}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reviewer@email.com" required /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password" minLength={6} required /><button className="primary"><Plus size={17} /> Add</button></form><div className="table"><div className="table-row table-head"><span>Email</span><span>Marked</span><span>Clear</span><span>Actions</span></div>{profiles.map((profile) => <div className="table-row reviewer-row" key={profile.id}><span>{profile.email}</span><span>{markedByReviewer(profile.id)} / {images.length}</span><span className="green-text">{clearByReviewer(profile.id)}</span><span className="reviewer-actions"><input className="password-reset-input" type="password" value={draftPasswords[profile.id] || ''} onChange={(event) => setDraftPasswords((current) => ({ ...current, [profile.id]: event.target.value }))} placeholder="New password" /><button className="mini-button" onClick={() => void resetPassword(profile.id)}>Reset</button><button className="mini-button danger-button" onClick={() => void resetReviews(profile.id)}>Clear all</button></span></div>)}</div></section><section className="panel split-panel"><div className="panel-heading"><div><h2>Available-image split</h2><p className="muted">70/15/15 from resolved reviewer majorities</p></div></div><div className="split-summary"><strong>{resolvedTotal}</strong><span>resolved images available</span></div><div className="split-bars"><div><span><i className="bar train" />Train <strong>{resolvedTotal ? Math.round(train / resolvedTotal * 100) : 0}%</strong></span><b>{train} images</b></div><div><span><i className="bar validation" />Validation <strong>{resolvedTotal ? Math.round(validation / resolvedTotal * 100) : 0}%</strong></span><b>{validation} images</b></div><div><span><i className="bar test" />Test <strong>{resolvedTotal ? Math.round(test / resolvedTotal * 100) : 0}%</strong></span><b>{test} images</b></div></div><div className="consensus"><h3>Majority summary</h3><div className="consensus-row"><span>Clear majority</span><strong>{clearMajority.length}</strong></div><div className="consensus-row"><span>Unclear majority</span><strong>{unclearMajority.length}</strong></div><div className="consensus-row"><span>Tied</span><strong>{ties.length}</strong></div></div></section></div><section className="panel majority-panel"><div className="panel-heading"><div><h2>Majority image results</h2><p className="muted">Clear and unclear counts for every image.</p></div><span className="count-tag">{available.length} marked</span></div><div className="majority-chart"><div className="chart-row"><span>Clear majority</span><div className="chart-track"><i className="chart-clear" style={{ width: `${clearMajority.length / chartTotal * 100}%` }} /></div><strong>{clearMajority.length}</strong></div><div className="chart-row"><span>Unclear majority</span><div className="chart-track"><i className="chart-unclear" style={{ width: `${unclearMajority.length / chartTotal * 100}%` }} /></div><strong>{unclearMajority.length}</strong></div><div className="chart-row"><span>Tied</span><div className="chart-track"><i className="chart-tie" style={{ width: `${ties.length / chartTotal * 100}%` }} /></div><strong>{ties.length}</strong></div></div><div className="image-results-toolbar"><label>Reset image for reviewer<select value={selectedReviewer} onChange={(event) => setSelectedReviewer(event.target.value)}><option value="">Select reviewer</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.email}</option>)}</select></label><span>Removing a review returns that image to unmarked for that reviewer.</span></div><div className="image-results-table"><div className="image-result-row image-result-head"><span>Image</span><span>Clear</span><span>Unclear</span><span>Majority</span><span>Status</span><span>Reset</span></div>{imageStats.map((item) => <div className="image-result-row" key={item.id}><span>Ceph {String(item.id).padStart(4, '0')}</span><span className="green-text">{item.clear}</span><span className="red-text">{item.unclear}</span><span className={item.majority === 'clear' ? 'green-text' : item.majority === 'unclear' ? 'red-text' : ''}>{item.majority === 'unmarked' ? '-' : item.majority}</span><span>{item.total ? `${item.total} marked` : 'Unmarked'}</span><span>{selectedReviewer && item.total ? <button className="mini-button danger-button" onClick={() => void resetReviews(selectedReviewer, item.id)}>Reset</button> : '-'}</span></div>)}</div></section></>}</div></main>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();
  useEffect(() => {
    if (!supabase) return setLoading(false);
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const { data: profile } = await supabase.from('profiles').select('role, active').eq('id', data.session.user.id).single();
        if (profile?.active !== false) setUser({ id: data.session.user.id, email: data.session.user.email || '', role: profile?.role === 'admin' ? 'admin' : 'reviewer' });
      }
      setLoading(false);
    };
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) setUser(null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);
  const logout = async () => { await supabase?.auth.signOut(); setUser(null); };
  if (!supabase) return <SetupMessage text="The app is configured for Supabase-backed production use, but the public Supabase URL and anon key are not configured yet." />;
  if (loading) return <main className="auth-shell"><p className="muted">Loading Ceph-FM...</p></main>;
  return user ? (user.role === 'admin' ? <Admin user={user} onLogout={logout} /> : <Reviewer user={user} onLogout={logout} />) : <Login onLogin={setUser} />;
}
