// Design system per .cursor/skills/ui-ux-pro-max:
// Typography pairing: IBM Plex Sans (UI body) + IBM Plex Mono (data, signatures,
// hashes, JSON). Single foundry, fintech-trustworthy mood, dashboard-precise.
// Loaded via next/font for self-hosting + zero CLS.

import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mikado — Decision receipts for AI agents that move money',
  description:
    'Cryptographic decision receipts for AI agents in regulated finance. Every payment decision is Ed25519-signed and independently verifiable. EU AI Act ready.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
