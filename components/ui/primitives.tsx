// Shared primitives for the data-dense fintech aesthetic.
// Single file on purpose — 8 tiny components, all leaning on globals.css classes.
// Anything fancier graduates to its own file.

'use client';

import Link from 'next/link';
import { useState } from 'react';

// ── BRAND MARK ──────────────────────────────────────────────────────────────

export function BrandMark({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderBottom: 'none',
        textDecoration: 'none',
      }}
    >
      <span className="diamond" />
      <span className="brand">MIKADO</span>
    </Link>
  );
}

// ── TOP BAR ────────────────────────────────────────────────────────────────
// Used on /run and /receipt. Home gets its own bigger header.

export function TopBar({
  meta,
  right,
}: {
  meta?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <BrandMark />
        {meta && <span className="topbar-meta">{meta}</span>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

// ── PILL / STATUS BADGE ────────────────────────────────────────────────────

type PillKind = 'pay' | 'refuse' | 'warn' | 'info' | 'gold' | 'mute';

export function Pill({
  kind = 'mute',
  noDot,
  children,
}: {
  kind?: PillKind;
  noDot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`pill pill-${kind}${noDot ? ' no-dot' : ''}`}>
      {children}
    </span>
  );
}

// ── SECTION HEAD ───────────────────────────────────────────────────────────

export function SectionHead({ children }: { children: React.ReactNode }) {
  return <h2 className="section-head">{children}</h2>;
}

// ── KEY-VALUE ROW ──────────────────────────────────────────────────────────

export function KeyValue({
  k,
  children,
  copy,
}: {
  k: string;
  children: React.ReactNode;
  copy?: string;
}) {
  return (
    <>
      <div className="kv-key">{k}</div>
      <div className="kv-val">{children}</div>
      <div>{copy ? <CopyButton value={copy} /> : null}</div>
    </>
  );
}

// ── COPY BUTTON ────────────────────────────────────────────────────────────

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard might be denied; silently no-op */
        }
      }}
      aria-label="copy to clipboard"
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}

// ── SIGNAL BAR ─────────────────────────────────────────────────────────────
// Horizontal bar with a gold tick at the threshold. The whole reason for
// existence: communicate "this signal scored X, threshold for ALL was Y" in
// a single glance.

export function SignalBar({
  value,
  threshold,
  killer = false,
}: {
  value: number;
  threshold?: number;
  killer?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const cls = killer ? 'bar-fill bar-killer' : value < 0.5 ? 'bar-fill weak' : value < 0.8 ? 'bar-fill mid' : 'bar-fill ok';
  const tPct =
    typeof threshold === 'number'
      ? Math.max(0, Math.min(1, threshold)) * 100
      : null;
  return (
    <div className="bar-track">
      <div className={cls} style={{ width: `${pct}%` }} />
      {tPct !== null && (
        <div
          className="bar-thresh"
          style={{ left: `calc(${tPct}% - 1px)` }}
          title={`threshold ${tPct.toFixed(0)}%`}
        />
      )}
    </div>
  );
}

// ── FORMAT HELPERS ─────────────────────────────────────────────────────────

export function fmtMoney(amount: number, currency: 'GBP' | 'USD' | 'EUR') {
  const sym = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
  return (
    sym +
    amount.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtPct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function shortHash(s: string, head = 8, tail = 6): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function shortPubKey(pem: string): string {
  const stripped = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  return shortHash(stripped, 16, 8);
}
