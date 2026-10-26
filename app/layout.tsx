import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ceph-FM | Cervical Maturation Review', description: 'Structured cephalogram review for dental research teams.' };

export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
