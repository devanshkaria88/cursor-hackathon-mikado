// docs/frontend.md §Page 1 — home (post-redesign per ui-ux-pro-max).
// Editorial title page: brand mark, thesis line, single CTA.
// No game tower, no terminal chrome — just the proposition.

import Link from 'next/link';
import { BrandMark } from '@/components/ui/primitives';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <BrandMark />
        <span className="topbar-meta">v0.1 · ed25519 · 2026</span>
      </header>

      <section
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '40px 28px 80px',
        }}
      >
        <div className="container-narrow">
          <p className="eyebrow in-up in-up-1" style={{ marginBottom: 28 }}>
            Track 1 · Money Movement · Cursor × Briefcase 2026
          </p>

          <h1
            className="display in-up in-up-2"
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              margin: '0 0 20px',
              maxWidth: 880,
              color: 'var(--ink)',
            }}
          >
            The agent for your{' '}
            <span style={{ color: 'var(--gold)' }}>AP review queue</span>.
            Signed decisions, every time.
          </h1>

          {/* Mikado metaphor — kept as a smaller secondary line so the brand
              still has a poetic anchor, but the primary tagline now does the
              positioning work (we are NOT competing with Bill.com's autopay). */}
          <p
            className="in-up in-up-2"
            style={{
              margin: '0 0 28px',
              fontSize: 15,
              color: 'var(--ink-3)',
              fontStyle: 'italic',
              letterSpacing: '0.01em',
            }}
          >
            Pull a stick — if the tower falls, the agent doesn&apos;t pay.
          </p>

          <p
            className="in-up in-up-3"
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
              maxWidth: 680,
              margin: '0 0 40px',
            }}
          >
            Bill.com and Ramp autopay the easy invoices. The hard ones — new
            suppliers, unusual amounts, lookalike domains — pile up in a human
            review queue. Mikado handles that queue. It pays when it&apos;s
            confident, refuses when it&apos;s not, and signs every decision so
            you can prove what the agent saw.
          </p>

          <div
            className="in-up in-up-4"
            style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 64 }}
          >
            <Link href="/run" className="btn btn-primary" style={{ height: 44, padding: '0 22px', fontSize: 14 }}>
              Run the agent
              <span aria-hidden style={{ marginLeft: 4 }}>→</span>
            </Link>
            <a
              href="https://www.anthropic.com/news/claude-opus-4-7"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ height: 44, padding: '0 18px', fontSize: 13 }}
            >
              Powered by Claude Opus 4.7
            </a>
          </div>

          <hr className="hr" />

          <div
            className="in-up in-up-5"
            style={{
              marginTop: 32,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 28,
            }}
          >
            <Pillar
              num="01"
              title="Real LLM extraction"
              body="Claude Opus 4.7 reads the invoice with structured tool-use and returns per-field confidence."
            />
            <Pillar
              num="02"
              title="Deterministic scoring"
              body="A pure function fuses extraction, supplier match, amount sanity, and phishing signals. Reproducible by an auditor."
            />
            <Pillar
              num="03"
              title="Ed25519-signed receipts"
              body="Every decision — pay or refuse — produces a canonical receipt signed by the agent. Tamper one byte and verification fails."
            />
          </div>
        </div>
      </section>

      <footer
        style={{
          padding: '24px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--ink-3)',
          fontSize: 12,
        }}
      >
        <span className="font-mono" style={{ letterSpacing: '0.06em' }}>
          mikado · the audit trail for agentic payments
        </span>
        <span className="font-mono" style={{ letterSpacing: '0.06em' }}>
          eu ai act ready · 2026
        </span>
      </footer>
    </main>
  );
}

function Pillar({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="font-mono" style={{ color: 'var(--gold)', fontSize: 11, letterSpacing: '0.16em', marginBottom: 8 }}>
        {num}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
