// docs/frontend.md §Page 3 — the decision receipt (post-redesign per ui-ux-pro-max).
//
// Story-first layout. We ditched the IDE clone because the user is right —
// auditors don't want a JSON tree, they want to know IN PLAIN ENGLISH:
//   1. What did the agent decide?
//   2. Why?  (single primary concern, not a forest of signals)
//   3. How did it reason?  (4 phase tiles, each one sentence)
//   4. Where did the score come from?  (4 bars + threshold tick)
//   5. Can I cryptographically prove this is the agent's actual output?  (sig + verify + tamper)
//   6. (only if asked) Show me the raw JSON.

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

// Sentinel that tells /run "you got here because the user inspected a receipt
// in this same tab — restore the cached ledger instead of re-running the
// agent." Anywhere else (typed URL, reload, link from home) the flag is
// absent and /run runs fresh. Kept as a string here to avoid a shared module
// just for one constant.
const FROM_INSPECT_FLAG = 'mikado:fromInspect';
import {
  TopBar,
  Pill,
  SectionHead,
  SignalBar,
  KeyValue,
  CopyButton,
  fmtMoney,
  fmtPct,
  fmtTime,
  shortHash,
  shortPubKey,
} from '@/components/ui/primitives';
import type {
  PhaseName,
  Receipt,
  ScoreSignal,
  ExtractedFields,
  RetrieveResult,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers (intentionally local — they only make sense in this view)

function killerSignalKey(
  breakdown: Record<string, ScoreSignal>,
): string | null {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort(
    (a, b) => a[1].score * a[1].weight - b[1].score * b[1].weight,
  );
  return sorted[0][0];
}

function signalLabel(key: string) {
  return key.replace(/_/g, ' ');
}

// One-sentence narrator per phase. Sourced from the actual phase output where
// possible — but rendered as English, not JSON. This is the "clearer than Cursor"
// transformation.
function phaseSummary(receipt: Receipt, phase: PhaseName): string {
  const t = receipt.phases[phase];
  if (!t) return '';
  if (phase === 'extract') {
    const out = t.output as { confidence?: number; fields?: ExtractedFields };
    const conf = out.confidence ?? 0;
    return `Read the invoice with Claude Opus 4.7. Per-field confidence averaged ${fmtPct(conf, 0)}.`;
  }
  if (phase === 'retrieve') {
    const out = t.output as RetrieveResult;
    if (out.is_known) {
      return `Matched the supplier registry exactly: "${receipt.invoice.extracted.supplier_name}".`;
    }
    if (out.similar_known_supplier) {
      return `Supplier not in registry. Closest known: "${out.similar_known_supplier}" at ${fmtPct(out.similarity_to_known, 0)} similarity.`;
    }
    return `Supplier "${receipt.invoice.extracted.supplier_name}" not in registry. No close match.`;
  }
  if (phase === 'score') {
    const out = t.output as { overall: number };
    return `Fused four deterministic signals into an overall confidence of ${fmtPct(out.overall, 0)}.`;
  }
  if (phase === 'decide') {
    const overall = receipt.confidence.overall;
    const thr = receipt.confidence.threshold;
    return receipt.decision.action === 'PAY'
      ? `Confidence ${fmtPct(overall, 0)} cleared the ${fmtPct(thr, 0)} threshold. Payment authorised.`
      : `Confidence ${fmtPct(overall, 0)} sat below the ${fmtPct(thr, 0)} threshold. Payment refused — agent kept human-out-of-loop.`;
  }
  return '';
}

// Headline "primary concern" — one or two sentences explaining WHY the agent
// refused, in plain English. For PAY decisions, gives a positive summary instead.
function primaryConcernText(receipt: Receipt): string {
  if (receipt.decision.action === 'PAY') {
    const supplier = receipt.invoice.extracted.supplier_name;
    return `Every signal cleared the bar. The supplier (${supplier}) matches the registry, the amount is in range, and extraction was high-confidence. The agent paid.`;
  }
  const killer = killerSignalKey(receipt.confidence.breakdown);
  if (!killer) return receipt.decision.reason;
  const sig = receipt.confidence.breakdown[killer];
  return sig.reason;
}

// ─────────────────────────────────────────────────────────────────────────────

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'valid'; tampered: false }
  | { kind: 'invalid'; tampered: boolean; reason?: string };

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function tamperReceipt(r: Receipt): Receipt {
  const clone: Receipt = JSON.parse(JSON.stringify(r));
  const sigBytes = base64ToBytes(clone.signature.value);
  // Flip the last byte; one bit is enough to invalidate Ed25519. That's the
  // property the demo is showing off.
  sigBytes[sigBytes.length - 1] ^= 0x01;
  clone.signature.value = bytesToBase64(sigBytes);
  return clone;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DecisionReceipt({ receipt }: { receipt: Receipt }) {
  const verdict = receipt.decision.action;
  const isPay = verdict === 'PAY';
  const overall = receipt.confidence.overall;
  const threshold = receipt.confidence.threshold;
  const killer = killerSignalKey(receipt.confidence.breakdown);
  const breakdownEntries = Object.entries(receipt.confidence.breakdown);
  const concern = primaryConcernText(receipt);

  const phases: PhaseName[] = ['extract', 'retrieve', 'score', 'decide'];

  const [verify, setVerify] = useState<VerifyState>({ kind: 'idle' });
  const [showRaw, setShowRaw] = useState(false);

  // Mark that the user is currently on a receipt — when they navigate back
  // to /run (Link, button, or browser back), the page will hydrate from the
  // session-cached run instead of kicking off a fresh agent run.
  useEffect(() => {
    try {
      sessionStorage.setItem(FROM_INSPECT_FLAG, '1');
    } catch {
      /* sessionStorage unavailable — fall through; /run will just re-run */
    }
  }, []);

  const runVerify = async (tamper: boolean) => {
    setVerify({ kind: 'checking' });
    const payload = tamper ? tamperReceipt(receipt) : receipt;
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ receipt: payload }),
      });
      const data = (await res.json()) as { valid: boolean; reason?: string };
      if (data.valid) {
        setVerify({ kind: 'valid', tampered: false });
      } else {
        setVerify({ kind: 'invalid', tampered: tamper, reason: data.reason });
      }
    } catch (err) {
      setVerify({ kind: 'invalid', tampered: tamper, reason: (err as Error).message });
    }
  };

  // Memoise raw JSON for the collapsed drawer
  const rawJson = useMemo(() => JSON.stringify(receipt, null, 2), [receipt]);

  return (
    <>
      <TopBar
        meta={
          <>
            / receipt &nbsp;·&nbsp;{' '}
            <span style={{ color: 'var(--ink-2)' }}>
              {receipt.invoice.raw_id}
            </span>
          </>
        }
        right={
          <Link
            href="/run"
            className="btn btn-ghost btn-sm"
            style={{ borderBottom: '1px solid var(--border-2)' }}
          >
            ← back to run
          </Link>
        }
      />

      <main className="container-narrow" style={{ padding: '40px 28px 100px' }}>
        {/* ── EYEBROW + RECEIPT ID ─────────────────────────────────────── */}
        <div className="in-up in-up-1" style={{ marginBottom: 18 }}>
          <span className="eyebrow">Decision receipt</span>
          <div
            className="font-mono"
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--ink-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>id: {receipt.id}</span>
            <CopyButton value={receipt.id} />
            <span style={{ color: 'var(--ink-faint)' }}>·</span>
            <span>{fmtTime(receipt.timestamp)}</span>
          </div>
        </div>

        {/* ── VERDICT BLOCK ────────────────────────────────────────────── */}
        <section
          className={`verdict ${isPay ? 'verdict-pay' : 'verdict-refuse'} in-up in-up-2`}
          style={{ marginBottom: 40 }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                {isPay ? 'Verdict — paid' : 'Verdict — refused'}
              </div>
              <div
                className="display"
                style={{
                  fontSize: 56,
                  color: isPay ? 'var(--pay)' : 'var(--refuse)',
                  marginBottom: 12,
                  letterSpacing: '-0.02em',
                }}
              >
                {isPay ? 'PAID' : 'REFUSED'}
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: 'var(--ink-2)',
                }}
              >
                <span className="font-mono tabular" style={{ fontSize: 18, color: 'var(--ink)' }}>
                  {fmtMoney(receipt.invoice.extracted.amount, receipt.invoice.extracted.currency)}
                </span>
                {isPay ? ' transferred to ' : ' withheld from '}
                <span style={{ color: 'var(--ink)' }}>
                  {receipt.invoice.extracted.supplier_name}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'flex-end',
                minWidth: 200,
              }}
            >
              <div className="eyebrow">Confidence</div>
              <div
                className="display tabular"
                style={{
                  fontSize: 36,
                  color: isPay ? 'var(--pay)' : 'var(--refuse)',
                }}
              >
                {fmtPct(overall, 0)}
              </div>
              <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                threshold {fmtPct(threshold, 0)}
              </div>
            </div>
          </div>
        </section>

        {/* ── PRIMARY CONCERN ──────────────────────────────────────────── */}
        <section className="in-up in-up-3" style={{ marginBottom: 48 }}>
          <SectionHead>
            {isPay ? 'Why the agent paid' : 'Primary concern'}
          </SectionHead>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: 'var(--ink)',
              margin: 0,
              maxWidth: 680,
            }}
          >
            {concern}
          </p>
        </section>

        {/* ── HOW THE AGENT REASONED ───────────────────────────────────── */}
        <section className="in-up in-up-4" style={{ marginBottom: 48 }}>
          <SectionHead>How the agent reasoned</SectionHead>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            {phases.map((p, i) => (
              <div
                key={p}
                className={`phase-tile${killer === 'phishing_signal' && p === 'retrieve' ? ' is-killer' : ''}`}
              >
                <div className="phase-tile-head">
                  <span className="phase-tile-name">
                    {String(i + 1).padStart(2, '0')} · {p}
                  </span>
                  {p === 'extract' && (
                    <Pill kind="info" noDot>LLM</Pill>
                  )}
                  {(p === 'score' || p === 'decide') && (
                    <Pill kind="mute" noDot>pure</Pill>
                  )}
                  {p === 'retrieve' && (
                    <Pill kind="mute" noDot>db</Pill>
                  )}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--ink-2)',
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {phaseSummary(receipt, p)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CONFIDENCE BREAKDOWN ─────────────────────────────────────── */}
        <section className="in-up in-up-5" style={{ marginBottom: 48 }}>
          <SectionHead>Confidence breakdown</SectionHead>

          <div
            className="panel"
            style={{
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            {breakdownEntries.map(([key, sig]) => {
              const isKiller = key === killer && !isPay;
              const contrib = sig.score * sig.weight;
              return (
                <div key={key}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 8,
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 12,
                          color: isKiller ? 'var(--refuse)' : 'var(--ink)',
                          letterSpacing: '0.04em',
                          textTransform: 'lowercase',
                        }}
                      >
                        {signalLabel(key)}
                      </span>
                      {isKiller && (
                        <Pill kind="refuse" noDot>killer signal</Pill>
                      )}
                    </div>
                    <div
                      className="font-mono tabular"
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-3)',
                      }}
                    >
                      <span style={{ color: isKiller ? 'var(--refuse)' : 'var(--ink-2)' }}>
                        {fmtPct(sig.score, 0)}
                      </span>
                      {' × '}
                      <span style={{ color: 'var(--ink-3)' }}>
                        {fmtPct(sig.weight, 0)} weight
                      </span>
                      {' = '}
                      <span style={{ color: 'var(--ink)' }}>
                        {contrib.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <SignalBar value={sig.score} threshold={threshold} killer={isKiller} />
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: 12,
                      color: 'var(--ink-3)',
                      lineHeight: 1.5,
                    }}
                  >
                    {sig.reason}
                  </p>
                </div>
              );
            })}

            <hr className="hr" />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div className="eyebrow">Overall (weighted sum)</div>
              <div
                className="font-mono tabular display"
                style={{
                  fontSize: 22,
                  color: isPay ? 'var(--pay)' : 'var(--refuse)',
                }}
              >
                {fmtPct(overall, 1)}
              </div>
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                letterSpacing: '0.04em',
                marginTop: -10,
                textAlign: 'right',
              }}
            >
              gold tick on each bar = required threshold ({fmtPct(threshold, 0)})
            </div>
          </div>
        </section>

        {/* ── CRYPTOGRAPHIC PROOF ──────────────────────────────────────── */}
        <section className="in-up in-up-6" style={{ marginBottom: 40 }}>
          <SectionHead>Cryptographic proof</SectionHead>

          <div className="panel" style={{ padding: '24px 28px' }}>
            <div className="kv" style={{ marginBottom: 24 }}>
              <KeyValue k="algorithm">{receipt.signature.algorithm}</KeyValue>
              <KeyValue k="signed by">
                <span style={{ color: 'var(--ink)' }}>
                  {receipt.agent.id}
                </span>
                <span style={{ color: 'var(--ink-3)', marginLeft: 8 }}>
                  · build {receipt.agent.version_hash.replace(/^sha256:/, '').slice(0, 10)}
                </span>
              </KeyValue>
              <KeyValue
                k="public key"
                copy={receipt.signature.public_key}
              >
                {shortPubKey(receipt.signature.public_key)}
              </KeyValue>
              <KeyValue
                k="signature"
                copy={receipt.signature.value}
              >
                {shortHash(receipt.signature.value, 16, 8)}
                <span style={{ color: 'var(--ink-3)', marginLeft: 8 }}>· 64 bytes</span>
              </KeyValue>
              <KeyValue
                k="input hash"
                copy={receipt.hashes.input_hash}
              >
                {shortHash(receipt.hashes.input_hash, 14, 10)}
              </KeyValue>
              <KeyValue
                k="receipt hash"
                copy={receipt.hashes.receipt_hash}
              >
                {shortHash(receipt.hashes.receipt_hash, 14, 10)}
              </KeyValue>
            </div>

            {/* VERIFY ROW */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginBottom: verify.kind === 'idle' ? 0 : 18,
              }}
            >
              <button
                className="btn btn-primary btn-sm"
                onClick={() => runVerify(false)}
                disabled={verify.kind === 'checking'}
              >
                ▷ Verify signature
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => runVerify(true)}
                disabled={verify.kind === 'checking'}
              >
                ⚠ Tamper one byte
              </button>
              {verify.kind !== 'idle' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setVerify({ kind: 'idle' })}
                >
                  reset
                </button>
              )}
            </div>

            {/* RESULT BANNER */}
            {verify.kind === 'checking' && (
              <div
                className="in-up font-mono"
                style={{
                  padding: '10px 14px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--gold)',
                  fontSize: 12,
                }}
              >
                … recomputing canonical body and verifying Ed25519
              </div>
            )}
            {verify.kind === 'valid' && (
              <div
                className="in-up"
                style={{
                  padding: '12px 16px',
                  background: 'var(--pay-soft)',
                  border: '1px solid var(--pay-edge)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--pay)',
                  fontSize: 13,
                }}
              >
                <strong>✓ Signature valid.</strong>{' '}
                <span style={{ color: 'var(--ink-2)' }}>
                  Recomputed the canonical receipt body, hashed it, and Ed25519
                  verified against the agent&apos;s public key. This is genuinely
                  what the agent produced.
                </span>
              </div>
            )}
            {verify.kind === 'invalid' && (
              <div
                className="in-up shake-once"
                style={{
                  padding: '12px 16px',
                  background: 'var(--refuse-soft)',
                  border: '1px solid var(--refuse-edge)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--refuse)',
                  fontSize: 13,
                }}
              >
                <strong>✗ Signature invalid.</strong>{' '}
                <span style={{ color: 'var(--ink-2)' }}>
                  {verify.tampered
                    ? 'We flipped one byte of the signature. Ed25519 rejected it. This is the security property: a single bit of tampering is detectable.'
                    : (verify.reason ?? 'verification failed')}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── RAW EVIDENCE (collapsed by default) ──────────────────────── */}
        <section className="in-up in-up-6">
          <button
            onClick={() => setShowRaw((s) => !s)}
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              marginBottom: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ color: 'var(--gold)' }}>{showRaw ? '▾' : '▸'}</span>
            Raw evidence — full receipt JSON
            <span style={{ color: 'var(--ink-faint)' }}>
              ({rawJson.length.toLocaleString()} bytes)
            </span>
          </button>

          {showRaw && (
            <pre
              className="panel font-mono in-up"
              style={{
                margin: 0,
                padding: 20,
                fontSize: 11.5,
                lineHeight: 1.6,
                color: 'var(--ink-2)',
                maxHeight: 480,
                overflow: 'auto',
                whiteSpace: 'pre',
              }}
            >
              {rawJson}
            </pre>
          )}
        </section>
      </main>
    </>
  );
}
