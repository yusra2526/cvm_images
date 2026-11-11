'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Check, ChevronLeft, ChevronRight, ClipboardList, Layers, LogOut, Plus, RotateCcw, ShieldCheck, Users, X, ZoomIn, ZoomOut } from 'lucide-react';

type Label = 'clear' | 'unclear';
type ImageRecord = { id: number; title: string; file: string; split?: string | null };
type Review = { reviewer_id: string; cephalogram_id: number; label: Label; updated_at?: string };
type Profile = { id: string; email: string; role: string; active: boolean };
type User = { id: string; email: string; role: 'admin' | 'reviewer' };

const BATCH_SIZE = 250;
const BATCH_COUNT = 4;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload as T;
}
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try { const { user } = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onLogin(user); } catch (loginError) { setError(message(loginError, 'Unable to sign in.')); }
  };
  return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">CF</div><p className="eyebrow">CEPH-FM / AARIZ DATASET</p><h1>Review with confidence.</h1><p className="muted">Sign in to review cervical regions and resume your saved progress.</p><form onSubmit={(event) => void submit(event)}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reviewer@example.com" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required /></label>{error && <p className="error">{error}</p>}<button className="primary wide">Sign in <ChevronRight size={17} /></button></form><div className="demo-note"><ShieldCheck size={16} /><span>Reviewer accounts are created by the administrator.</span></div></div></main>;
}

function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <header className="topbar"><div className="top-brand"><div className="small-mark">CF</div><span>Ceph-FM {user.role === 'admin' && <em>Admin</em>}</span></div><div className="top-actions"><span className="user-pill">{user.email}</span><button className="icon-button" onClick={onLogout} title="Sign out"><LogOut size={18} /></button></div></header>;
}

function BatchPicker({ images, reviews, onPick }: { images: ImageRecord[]; reviews: Record<number, Review>; onPick: (batch: number) => void }) {
  return <div className="batch-page"><p className="eyebrow">REVIEW WORKSPACE</p><h1>Choose a batch</h1><p className="muted">The {images.length} Aariz cephalograms are split into {BATCH_COUNT} batches of {BATCH_SIZE}. Your progress is saved per image, so you can switch batches at any time.</p><div className="batch-grid">{Array.from({ length: BATCH_COUNT }, (_, batch) => {
    const items = images.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE);
    const done = items.filter((item) => reviews[item.id]).length;
    const percent = items.length ? Math.round(done / items.length * 100) : 0;
    return <button className="batch-card" key={batch} onClick={() => onPick(batch)} disabled={!items.length}><span className="batch-icon"><Layers size={18} /></span><strong>Batch {batch + 1}</strong><small>Images {batch * BATCH_SIZE + 1}–{batch * BATCH_SIZE + items.length}</small><div className="progress"><span style={{ width: `${percent}%` }} /></div><span className="batch-meta"><span>{done} / {items.length} marked</span><b>{percent === 100 ? 'Complete' : done ? 'Continue' : 'Start'} <ChevronRight size={14} /></b></span></button>;
  })}</div></div>;
}

function Reviewer({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [batch, setBatch] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loadedId, setLoadedId] = useState<number>();
  const [error, setError] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const batchImages = useMemo(() => batch === null ? [] : images.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE), [images, batch]);
  const image = batchImages[index];
  const imageLoading = loadedId !== image?.id;
  const done = batchImages.filter((item) => reviews[item.id]).length;
  const percent = batchImages.length ? Math.round((done / batchImages.length) * 100) : 0;

  useEffect(() => {
    const load = async () => {
      try {
        const [{ images: imageData }, { reviews: reviewData }] = await Promise.all([api<{ images: ImageRecord[] }>('/api/images'), api<{ reviews: Review[] }>('/api/reviews')]);
        const mapped: Record<number, Review> = {};
        reviewData.forEach((review) => { mapped[review.cephalogram_id] = review; });
        setReviews(mapped);
        setImages(imageData);
      } catch (loadError) { setError(message(loadError, 'Could not load review data.')); }
    };
    void load();
  }, [user.id]);

  useEffect(() => {
    if (!image) return;
    const next = batchImages[index + 1];
    if (next) new Image().src = `/api/images/${next.id}`;
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [image?.id]);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage) { stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2; stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2; }
  }, [zoom]);

  const pickBatch = (nextBatch: number) => {
    const items = images.slice(nextBatch * BATCH_SIZE, (nextBatch + 1) * BATCH_SIZE);
    const first = items.findIndex((item) => !reviews[item.id]);
    setBatch(nextBatch); setZoom(1); setIndex(first >= 0 ? first : 0);
  };
  const saveLabel = async (label: Label) => {
    if (!image) return;
    const previous = reviews[image.id];
    setReviews((current) => ({ ...current, [image.id]: { reviewer_id: user.id, cephalogram_id: image.id, label } }));
    try { await api('/api/reviews', { method: 'PUT', body: JSON.stringify({ cephalogramId: image.id, label }) }); setError(''); } catch (saveError) {
      setReviews((current) => { const copy = { ...current }; if (previous) copy[image.id] = previous; else delete copy[image.id]; return copy; });
      setError(message(saveError, 'Could not save review.'));
    }
  };
  const go = (nextIndex: number) => { setZoom(1); setIndex(Math.max(0, Math.min(batchImages.length - 1, nextIndex))); };
  const changeZoom = (amount: number) => setZoom((current) => Math.min(3, Math.max(1, Number((current + amount).toFixed(2)))));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (batch === null || (event.target as HTMLElement).tagName === 'INPUT') return;
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!images.length) return <main className="app-shell"><Header user={user} onLogout={onLogout} /><div className="empty-page"><p className="muted">{error || 'Loading the Aariz image set...'}</p></div></main>;
  if (batch === null || !image) return <main className="app-shell"><Header user={user} onLogout={onLogout} /><div className="scroll-page"><BatchPicker images={images} reviews={reviews} onPick={pickBatch} /></div></main>;

  const selected = reviews[image.id];
  const start = batch * BATCH_SIZE;
  return <main className="app-shell"><Header user={user} onLogout={onLogout} /><div className="review-layout"><aside className="side-panel"><button className="back-link" onClick={() => setBatch(null)}><ArrowLeft size={15} /> All batches</button><h2>Batch {batch + 1}</h2><p className="muted">Images {start + 1}–{start + batchImages.length}</p><div className="progress-wrap"><div className="progress-label"><span>{done} of {batchImages.length} marked</span><strong>{percent}%</strong></div><div className="progress" aria-label={`${percent}% complete`}><span style={{ width: `${percent}%` }} /></div></div><div className="image-list" ref={listRef}>{batchImages.map((item, itemIndex) => {
    const label = reviews[item.id]?.label;
    return <button key={item.id} className={`image-list-item ${itemIndex === index ? 'active' : ''}`} onClick={() => go(itemIndex)}><i className={`dot ${label || 'none'}`} /><span>Ceph {String(item.id).padStart(4, '0')}</span><small className={label === 'clear' ? 'green-text' : label === 'unclear' ? 'red-text' : ''}>{label || '—'}</small></button>;
  })}</div></aside><section className="review-main"><div className="review-header"><div><p className="eyebrow">IMAGE {String(image.id).padStart(4, '0')} · {image.split?.toUpperCase()}</p><h1>{image.title}</h1></div><span className={`status-badge ${selected ? '' : 'pending'}`}>{selected ? `Marked ${selected.label}` : 'Needs review'}</span></div><div className="image-toolbar"><span>{imageLoading ? 'Loading from the Aariz archive...' : 'Whole image shown · zoom to inspect'}</span><div className="zoom-controls"><button className="zoom-button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 1}><ZoomOut size={17} /></button><strong>{Math.round(zoom * 100)}%</strong><button className="zoom-button" onClick={() => changeZoom(0.25)} disabled={zoom >= 3}><ZoomIn size={17} /></button><button className="zoom-button" onClick={() => setZoom(1)} disabled={zoom === 1}><RotateCcw size={16} /></button></div></div><div className={`image-stage ${zoom > 1 ? 'zoomed' : ''}`} ref={stageRef}>{imageLoading && <div className="image-loading"><span className="spinner" /></div>}<img key={image.id} className="ceph-image" src={`/api/images/${image.id}`} alt={image.title} onLoad={() => setLoadedId(image.id)} onError={() => { setLoadedId(image.id); setError('Could not load this image from the Aariz archive.'); }} style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }} /></div><div className="decision-row"><button className={`decision clear ${selected?.label === 'clear' ? 'active' : ''}`} onClick={() => void saveLabel('clear')}><span className="decision-icon"><Check size={20} /></span><span><strong>Clear</strong><small>Cervical region is clearly visible</small></span></button><button className={`decision unclear ${selected?.label === 'unclear' ? 'active' : ''}`} onClick={() => void saveLabel('unclear')}><span className="decision-icon"><X size={20} /></span><span><strong>Unclear</strong><small>Cervical region is not clearly visible</small></span></button></div><div className="navigation"><button className="secondary" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft size={17} /> Previous</button><span>{error ? <span className="error">{error}</span> : `${index + 1} / ${batchImages.length} · use ← → keys`}</span><button className="primary" onClick={() => go(index + 1)} disabled={index === batchImages.length - 1}>Next <ChevronRight size={17} /></button></div></section></div></main>;
}

function Admin({ user, onLogout }: { user: User; onLogout: () => void }) {
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
    setLoading(true);
    try { const payload = await api<{ profiles: Profile[]; reviews: Review[]; images: ImageRecord[] }>('/api/admin/stats'); setProfiles(payload.profiles); setReviews(payload.reviews); setImages(payload.images); } catch (loadError) { setError(message(loadError, 'Could not load admin statistics.')); }
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

  const adminRequest = (path: string, method: string, body: Record<string, unknown>) => api(path, { method, body: JSON.stringify(body) });
  const createReviewer = async (event: React.FormEvent) => {
    event.preventDefault();
    try { await adminRequest('/api/admin/reviewers', 'POST', { email, password }); setEmail(''); setPassword(''); await load(); } catch (requestError) { setError(message(requestError, 'Could not create reviewer.')); }
  };
  const resetPassword = async (reviewerId: string) => {
    try { await adminRequest('/api/admin/reviewers', 'PATCH', { userId: reviewerId, password: draftPasswords[reviewerId] }); setDraftPasswords((current) => ({ ...current, [reviewerId]: '' })); } catch (requestError) { setError(message(requestError, 'Could not reset password.')); }
  };
  const resetReviews = async (reviewerId: string, imageId?: number) => {
    try { await adminRequest('/api/admin/reviews', 'DELETE', { reviewerId, imageId }); await load(); } catch (requestError) { setError(message(requestError, 'Could not remove reviews.')); }
  };
  const markedByReviewer = (reviewerId: string) => reviews.filter((review) => review.reviewer_id === reviewerId).length;
  const clearByReviewer = (reviewerId: string) => reviews.filter((review) => review.reviewer_id === reviewerId && review.label === 'clear').length;
  const chartTotal = Math.max(resolvedTotal, 1);

  return <main className="app-shell"><Header user={user} onLogout={onLogout} /><div className="admin-layout"><div className="admin-heading"><div><p className="eyebrow">ADMIN CONSOLE</p><h1>Research overview</h1><p className="muted">Shared reviewer activity and image-level consensus.</p></div><span className="secure-label"><ShieldCheck size={16} /> Self-hosted storage</span></div>{error && <p className="error">{error}</p>}{loading ? <p className="muted">Loading statistics...</p> : <><div className="stat-grid"><div className="stat-card"><Users size={19} /><span>Reviewers</span><strong>{profiles.length}</strong><small>accounts created</small></div><div className="stat-card"><ClipboardList size={19} /><span>Total marked</span><strong>{reviews.length}</strong><small>shared submissions</small></div><div className="stat-card green-stat"><Check size={19} /><span>Clear majority</span><strong>{clearMajority.length}</strong><small>{available.length ? Math.round(clearMajority.length / available.length * 100) : 0}% of available images</small></div><div className="stat-card"><BarChart3 size={19} /><span>Resolved images</span><strong>{resolvedTotal}</strong><small>{ties.length} tied</small></div></div><div className="admin-columns"><section className="panel"><div className="panel-heading"><div><h2>Reviewer accounts</h2><p className="muted">Create and manage reviewer accounts.</p></div><span className="count-tag">{profiles.length}</span></div><form className="add-reviewer" onSubmit={(event) => void createReviewer(event)}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reviewer@email.com" required /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password" minLength={6} required /><button className="primary"><Plus size={17} /> Add</button></form><div className="table"><div className="table-row table-head"><span>Email</span><span>Marked</span><span>Clear</span><span>Actions</span></div>{profiles.map((profile) => <div className="table-row reviewer-row" key={profile.id}><span>{profile.email}</span><span>{markedByReviewer(profile.id)} / {images.length}</span><span className="green-text">{clearByReviewer(profile.id)}</span><span className="reviewer-actions"><input className="password-reset-input" type="password" value={draftPasswords[profile.id] || ''} onChange={(event) => setDraftPasswords((current) => ({ ...current, [profile.id]: event.target.value }))} placeholder="New password" /><button className="mini-button" onClick={() => void resetPassword(profile.id)}>Reset</button><button className="mini-button danger-button" onClick={() => void resetReviews(profile.id)}>Clear all</button></span></div>)}</div></section><section className="panel split-panel"><div className="panel-heading"><div><h2>Available-image split</h2><p className="muted">70/15/15 from resolved reviewer majorities</p></div></div><div className="split-summary"><strong>{resolvedTotal}</strong><span>resolved images available</span></div><div className="split-bars"><div><span><i className="bar train" />Train <strong>{resolvedTotal ? Math.round(train / resolvedTotal * 100) : 0}%</strong></span><b>{train} images</b></div><div><span><i className="bar validation" />Validation <strong>{resolvedTotal ? Math.round(validation / resolvedTotal * 100) : 0}%</strong></span><b>{validation} images</b></div><div><span><i className="bar test" />Test <strong>{resolvedTotal ? Math.round(test / resolvedTotal * 100) : 0}%</strong></span><b>{test} images</b></div></div><div className="consensus"><h3>Majority summary</h3><div className="consensus-row"><span>Clear majority</span><strong>{clearMajority.length}</strong></div><div className="consensus-row"><span>Unclear majority</span><strong>{unclearMajority.length}</strong></div><div className="consensus-row"><span>Tied</span><strong>{ties.length}</strong></div></div></section></div><section className="panel majority-panel"><div className="panel-heading"><div><h2>Majority image results</h2><p className="muted">Clear and unclear counts for every image.</p></div><span className="count-tag">{available.length} marked</span></div><div className="majority-chart"><div className="chart-row"><span>Clear majority</span><div className="chart-track"><i className="chart-clear" style={{ width: `${clearMajority.length / chartTotal * 100}%` }} /></div><strong>{clearMajority.length}</strong></div><div className="chart-row"><span>Unclear majority</span><div className="chart-track"><i className="chart-unclear" style={{ width: `${unclearMajority.length / chartTotal * 100}%` }} /></div><strong>{unclearMajority.length}</strong></div><div className="chart-row"><span>Tied</span><div className="chart-track"><i className="chart-tie" style={{ width: `${ties.length / chartTotal * 100}%` }} /></div><strong>{ties.length}</strong></div></div><div className="image-results-toolbar"><label>Reset image for reviewer<select value={selectedReviewer} onChange={(event) => setSelectedReviewer(event.target.value)}><option value="">Select reviewer</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.email}</option>)}</select></label><span>Removing a review returns that image to unmarked for that reviewer.</span></div><div className="image-results-table"><div className="image-result-row image-result-head"><span>Image</span><span>Clear</span><span>Unclear</span><span>Majority</span><span>Status</span><span>Reset</span></div>{imageStats.map((item) => <div className="image-result-row" key={item.id}><span>Ceph {String(item.id).padStart(4, '0')}</span><span className="green-text">{item.clear}</span><span className="red-text">{item.unclear}</span><span className={item.majority === 'clear' ? 'green-text' : item.majority === 'unclear' ? 'red-text' : ''}>{item.majority === 'unmarked' ? '-' : item.majority}</span><span>{item.total ? `${item.total} marked` : 'Unmarked'}</span><span>{selectedReviewer && item.total ? <button className="mini-button danger-button" onClick={() => void resetReviews(selectedReviewer, item.id)}>Reset</button> : '-'}</span></div>)}</div></section></>}</div></main>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ user: User | null }>('/api/auth/me').then(({ user: current }) => setUser(current)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); setUser(null); };
  if (loading) return <main className="auth-shell"><p className="muted">Loading Ceph-FM...</p></main>;
  return user ? (user.role === 'admin' ? <Admin user={user} onLogout={logout} /> : <Reviewer user={user} onLogout={logout} />) : <Login onLogin={setUser} />;
}
