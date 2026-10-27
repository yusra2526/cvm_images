'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

type Label = 'clear' | 'unclear';
type Review = { label: Label; updatedAt: string };
type ImageRecord = { id: number; title: string; url: string };
type Majority = Label | 'tie' | 'unmarked';
type ImageStats = { id: number; clear: number; unclear: number; total: number; majority: Majority };

const ADMIN_EMAIL = 'kingdomwise11@gmail.com';
const ADMIN_PASSWORD = 'Password123!';
const accountsKey = 'ceph-fm:accounts';
const TOTAL = 1000;
const makeImages = (): ImageRecord[] =>
  Array.from({ length: TOTAL }, (_, i) => ({
    id: i + 1,
    title: `Aariz cephalogram ${String(i + 1).padStart(4, '0')}`,
    url: `/dataset/${String(i + 1).padStart(4, '0')}.png`,
  }));
const key = (email: string) => `ceph-fm:${email.toLowerCase()}`;

function useReviews(email: string) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  useEffect(() => {
    try {
      setReviews(JSON.parse(localStorage.getItem(key(email)) || '{}'));
    } catch {
      setReviews({});
    }
  }, [email]);
  const save = (next: Record<string, Review>) => {
    setReviews(next);
    localStorage.setItem(key(email), JSON.stringify(next));
  };
  return [reviews, save] as const;
}

function getImageStats(reviewers: string[]): ImageStats[] {
  const counts = Array.from({ length: TOTAL }, () => ({ clear: 0, unclear: 0 }));
  reviewers.forEach((reviewer) => {
    try {
      const reviews = JSON.parse(localStorage.getItem(key(reviewer)) || '{}') as Record<string, Review>;
      Object.entries(reviews).forEach(([id, review]) => {
        const imageId = Number(id);
        if (imageId >= 1 && imageId <= TOTAL && (review?.label === 'clear' || review?.label === 'unclear')) {
          counts[imageId - 1][review.label] += 1;
        }
      });
    } catch {
      // Ignore malformed local demo data.
    }
  });
  return counts.map((count, index) => ({
    id: index + 1,
    ...count,
    total: count.clear + count.unclear,
    majority: count.clear === 0 && count.unclear === 0
      ? 'unmarked'
      : count.clear === count.unclear
        ? 'tie'
        : count.clear > count.unclear
          ? 'clear'
          : 'unclear',
  }));
}

function Login({ onLogin }: { onLogin: (email: string, admin: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) return onLogin(ADMIN_EMAIL, true);
    try {
      const accounts = JSON.parse(localStorage.getItem(accountsKey) || '{}') as Record<string, string>;
      if (accounts[email.toLowerCase()] === password) return onLogin(email.toLowerCase(), false);
    } catch {
      // Ignore malformed local demo accounts.
    }
    setError('Your reviewer email or password is incorrect.');
  };
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark">CF</div>
        <p className="eyebrow">CEPH-FM / AARIZ DATASET</p>
        <h1>Review with confidence.</h1>
        <p className="muted">Help classify cervical regions in cephalograms for reliable research data.</p>
        <form onSubmit={submit}>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reviewer@example.com" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" required /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary wide">Sign in <ChevronRight size={17} /></button>
        </form>
        <div className="demo-note"><ShieldCheck size={16} /><span>Admin access is configured for the supplied credentials. Reviewer accounts are created from the admin panel.</span></div>
      </div>
    </main>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="progress-wrap">
      <div className="progress-label"><span>{done} of {total} marked</span><strong>{percent}%</strong></div>
      <div className="progress" aria-label={`${percent}% complete`}><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function Reviewer({ email, onLogout }: { email: string; onLogout: () => void }) {
  const images = useMemo(makeImages, []);
  const [reviews, save] = useReviews(email);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const image = images[index];
  const selected = reviews[image.id];
  const done = Object.keys(reviews).filter((id) => Boolean(reviews[id]?.label)).length;

  useEffect(() => {
    const firstUnmarked = images.findIndex((item) => !reviews[item.id]);
    if (firstUnmarked >= 0) setIndex(firstUnmarked);
  }, [reviews, images]);

  const choose = (label: Label) => save({ ...reviews, [image.id]: { label, updatedAt: new Date().toISOString() } });
  const next = () => { setZoom(1); setIndex((current) => Math.min(TOTAL - 1, current + 1)); };
  const previous = () => { setZoom(1); setIndex((current) => Math.max(0, current - 1)); };
  const changeZoom = (amount: number) => setZoom((current) => Math.min(3, Math.max(1, Number((current + amount).toFixed(1)))));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="top-brand"><div className="small-mark">CF</div><span>Ceph-FM</span></div>
        <div className="top-actions"><span className="user-pill">{email}</span><button className="icon-button" onClick={onLogout} title="Sign out"><LogOut size={18} /></button></div>
      </header>
      <div className="review-layout">
        <aside className="side-panel">
          <p className="eyebrow">REVIEW WORKSPACE</p>
          <h2>Good morning.</h2>
          <p className="muted">Review each image and identify whether the cervical region is clear.</p>
          <Progress done={done} total={images.length} />
          <div className="side-stat"><span>Remaining</span><strong>{images.length - done}</strong></div>
          <div className="side-stat"><span>Current image</span><strong>{index + 1}</strong></div>
          <div className="review-tip"><ClipboardList size={18} /><div><strong>Review tip</strong><p>Use zoom controls to inspect the complete cervical region carefully.</p></div></div>
        </aside>
        <section className="review-main">
          <div className="review-header">
            <div><p className="eyebrow">IMAGE {String(index + 1).padStart(4, '0')}</p><h1>{image.title}</h1></div>
            <span className="status-badge">{selected ? 'Marked' : 'Needs review'}</span>
          </div>
          <div className="image-toolbar">
            <span>Image view</span>
            <div className="zoom-controls">
              <button className="zoom-button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 1} title="Zoom out"><ZoomOut size={17} /></button>
              <strong>{Math.round(zoom * 100)}%</strong>
              <button className="zoom-button" onClick={() => changeZoom(0.25)} disabled={zoom >= 3} title="Zoom in"><ZoomIn size={17} /></button>
              <button className="zoom-button" onClick={() => setZoom(1)} disabled={zoom === 1} title="Reset zoom"><RotateCcw size={16} /></button>
            </div>
          </div>
          <div className="image-stage">
            <img className="ceph-image" src={image.url} alt={image.title} style={{ transform: `scale(${zoom})`, maxWidth: zoom === 1 ? '100%' : 'none', maxHeight: zoom === 1 ? '100%' : 'none' }} />
          </div>
          <div className="decision-row">
            <button className={`decision clear ${selected?.label === 'clear' ? 'active' : ''}`} onClick={() => choose('clear')}><span className="decision-icon"><Check size={22} /></span><span><strong>Clear</strong><small>Cervical region is clearly visible</small></span></button>
            <button className={`decision unclear ${selected?.label === 'unclear' ? 'active' : ''}`} onClick={() => choose('unclear')}><span className="decision-icon"><X size={22} /></span><span><strong>Unclear</strong><small>Cervical region is not clearly visible</small></span></button>
          </div>
          <div className="navigation">
            <button className="secondary" onClick={previous} disabled={index === 0}><ChevronLeft size={17} /> Previous</button>
            <span>{index + 1} / {TOTAL}</span>
            <button className="primary" onClick={next} disabled={!selected || index === TOTAL - 1}>Next <ChevronRight size={17} /></button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Admin({ onLogout }: { onLogout: () => void }) {
  const [reviewers, setReviewers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('ceph-fm:reviewers') || '[]'); } catch { return []; }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [selectedReviewer, setSelectedReviewer] = useState('');

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || password.length < 6) return;
    const next = Array.from(new Set([...reviewers, email.toLowerCase()]));
    setReviewers(next);
    localStorage.setItem('ceph-fm:reviewers', JSON.stringify(next));
    const accounts = JSON.parse(localStorage.getItem(accountsKey) || '{}') as Record<string, string>;
    accounts[email.toLowerCase()] = password;
    localStorage.setItem(accountsKey, JSON.stringify(accounts));
    setEmail('');
    setPassword('');
  };

  const resetPassword = (reviewer: string) => {
    const nextPassword = passwords[reviewer] || '';
    if (nextPassword.length < 6) return;
    const accounts = JSON.parse(localStorage.getItem(accountsKey) || '{}') as Record<string, string>;
    accounts[reviewer] = nextPassword;
    localStorage.setItem(accountsKey, JSON.stringify(accounts));
    setPasswords((current) => ({ ...current, [reviewer]: '' }));
  };

  const resetReviews = (reviewer: string, imageId?: number) => {
    const data = JSON.parse(localStorage.getItem(key(reviewer)) || '{}') as Record<string, Review>;
    if (imageId) delete data[String(imageId)]; else Object.keys(data).forEach((id) => delete data[id]);
    localStorage.setItem(key(reviewer), JSON.stringify(data));
    setRefreshKey((value) => value + 1);
  };

  const imageStats = useMemo(() => getImageStats(reviewers), [reviewers, refreshKey]);
  const available = imageStats.filter((item) => item.total > 0);
  const clearMajority = available.filter((item) => item.majority === 'clear');
  const unclearMajority = available.filter((item) => item.majority === 'unclear');
  const ties = available.filter((item) => item.majority === 'tie');
  const totalMarked = available.reduce((sum, item) => sum + item.total, 0);
  const clearPercentage = available.length ? Math.round((clearMajority.length / available.length) * 100) : 0;
  const medianClear = reviewers.length
    ? [...reviewers.map((reviewer) => {
        try {
          const data = JSON.parse(localStorage.getItem(key(reviewer)) || '{}') as Record<string, Review>;
          return Object.values(data).filter((review) => review.label === 'clear').length;
        } catch { return 0; }
      })].sort((a, b) => a - b)[Math.floor(reviewers.length / 2)]
    : 0;
  const splitTotal = clearMajority.length + unclearMajority.length;
  const split = {
    train: Math.round(splitTotal * 0.7),
    validation: Math.round(splitTotal * 0.15),
    test: splitTotal - Math.round(splitTotal * 0.7) - Math.round(splitTotal * 0.15),
  };
  const chartTotal = Math.max(splitTotal, 1);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="top-brand"><div className="small-mark">CF</div><span>Ceph-FM <em>Admin</em></span></div>
        <div className="top-actions"><span className="user-pill">Administrator</span><button className="icon-button" onClick={onLogout}><LogOut size={18} /></button></div>
      </header>
      <div className="admin-layout">
        <div className="admin-heading"><div><p className="eyebrow">ADMIN CONSOLE</p><h1>Research overview</h1><p className="muted">Track reviewer activity and image-level consensus.</p></div><span className="secure-label"><ShieldCheck size={16} /> Secure workspace</span></div>
        <div className="stat-grid">
          <div className="stat-card"><Users size={19} /><span>Reviewers</span><strong>{reviewers.length}</strong><small>accounts created</small></div>
          <div className="stat-card"><ClipboardList size={19} /><span>Total marked</span><strong>{totalMarked.toLocaleString()}</strong><small>reviewer selections</small></div>
          <div className="stat-card green-stat"><Check size={19} /><span>Clear majority</span><strong>{clearMajority.length.toLocaleString()}</strong><small>{clearPercentage}% of available images</small></div>
          <div className="stat-card"><BarChart3 size={19} /><span>Median clear cephs</span><strong>{medianClear}</strong><small>per reviewer</small></div>
        </div>
        <div className="admin-columns">
          <section className="panel">
            <div className="panel-heading"><div><h2>Reviewer accounts</h2><p className="muted">Create accounts and share credentials privately.</p></div><span className="count-tag">{reviewers.length}</span></div>
            <form className="add-reviewer" onSubmit={add}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reviewer@email.com" required /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password" minLength={6} required /><button className="primary"><Plus size={17} /> Add</button></form>
            <div className="table"><div className="table-row table-head"><span>Email</span><span>Marked</span><span>Clear</span><span>Account actions</span></div>{reviewers.length ? reviewers.map((reviewer) => { const data = (() => { try { return JSON.parse(localStorage.getItem(key(reviewer)) || '{}') as Record<string, Review>; } catch { return {}; } })(); const clear = Object.values(data).filter((review) => review.label === 'clear').length; return <div className="table-row reviewer-row" key={reviewer}><span>{reviewer}</span><span>{Object.keys(data).length} / {TOTAL}</span><span className="green-text">{clear}</span><span className="reviewer-actions"><input className="password-reset-input" type="password" value={passwords[reviewer] || ""} onChange={(event) => setPasswords((current) => ({ ...current, [reviewer]: event.target.value }))} placeholder="New password" /><button className="mini-button" onClick={() => resetPassword(reviewer)}>Reset</button><button className="mini-button danger-button" onClick={() => resetReviews(reviewer)}>Clear all</button></span></div>; }) : <div className="empty">No reviewer accounts yet.</div>}</div>
          </section>
          <section className="panel split-panel">
            <div className="panel-heading"><div><h2>Available-image split</h2><p className="muted">70/15/15 split from resolved reviewer majorities</p></div></div>
            <div className="split-summary"><strong>{splitTotal}</strong><span>resolved images available for splitting</span></div>
            <div className="split-bars">
              <div><span><i className="bar train" />Train <strong>{splitTotal ? Math.round((split.train / splitTotal) * 100) : 0}%</strong></span><b>{split.train} images</b></div>
              <div><span><i className="bar validation" />Validation <strong>{splitTotal ? Math.round((split.validation / splitTotal) * 100) : 0}%</strong></span><b>{split.validation} images</b></div>
              <div><span><i className="bar test" />Test <strong>{splitTotal ? Math.round((split.test / splitTotal) * 100) : 0}%</strong></span><b>{split.test} images</b></div>
            </div>
            <div className="consensus"><h3>Majority summary</h3><div className="consensus-row"><span>Clear majority</span><strong>{clearMajority.length}</strong></div><div className="consensus-row"><span>Unclear majority</span><strong>{unclearMajority.length}</strong></div><div className="consensus-row"><span>Tied images</span><strong>{ties.length}</strong></div></div>
          </section>
        </div>
        <section className="panel majority-panel">
          <div className="panel-heading"><div><h2>Majority image results</h2><p className="muted">Clear/unclear counts are calculated from all reviewer submissions.</p></div><span className="count-tag">{available.length} marked</span></div>
          <div className="majority-chart">
            <div className="chart-row"><span>Clear majority</span><div className="chart-track"><i className="chart-clear" style={{ width: `${(clearMajority.length / chartTotal) * 100}%` }} /></div><strong>{clearMajority.length}</strong></div>
            <div className="chart-row"><span>Unclear majority</span><div className="chart-track"><i className="chart-unclear" style={{ width: `${(unclearMajority.length / chartTotal) * 100}%` }} /></div><strong>{unclearMajority.length}</strong></div>
            <div className="chart-row"><span>Tied</span><div className="chart-track"><i className="chart-tie" style={{ width: `${(ties.length / chartTotal) * 100}%` }} /></div><strong>{ties.length}</strong></div>
          </div>
          <div className="image-results-toolbar"><label>Reset image for reviewer<select value={selectedReviewer} onChange={(event) => setSelectedReviewer(event.target.value)}><option value="">Select reviewer</option>{reviewers.map((reviewer) => <option key={reviewer} value={reviewer}>{reviewer}</option>)}</select></label><span>Removing a review returns that image to Unmarked for the selected reviewer.</span></div><div className="image-results-table">
            <div className="image-result-row image-result-head"><span>Image</span><span>Clear</span><span>Unclear</span><span>Majority</span><span>Status</span><span>Reset</span></div>
            {imageStats.map((item) => <div className="image-result-row" key={item.id}><span>Ceph {String(item.id).padStart(4, '0')}</span><span className="green-text">{item.clear}</span><span className="red-text">{item.unclear}</span><span className={item.majority === 'clear' ? 'green-text' : item.majority === 'unclear' ? 'red-text' : ''}>{item.majority === 'unmarked' ? '-' : item.majority}</span><span>{item.total ? `${item.total} marked` : 'Unmarked'}</span><span>{selectedReviewer && item.total ? <button className="mini-button danger-button" onClick={() => resetReviews(selectedReviewer, item.id)}>Reset</button> : '-'}</span></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<{ email: string; admin: boolean } | null>(null);
  return session ? (session.admin ? <Admin onLogout={() => setSession(null)} /> : <Reviewer email={session.email} onLogout={() => setSession(null)} />) : <Login onLogin={(email, admin) => setSession({ email, admin })} />;
}
