// docs/frontend.md §Page 2 — /run (post-redesign per ui-ux-pro-max).
// "Decision ledger" pattern: top status row + table of decisions, one row
// per invoice. No game queue, no terminal chrome — this is what an auditor
// sitting next to a treasury manager would actually want to look at.

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TopBar,
  Pill,
  SectionHead,
  fmtMoney,
  fmtPct,
} from '@/components/ui/primitives';
import type { PhaseName, Receipt } from '@/lib/types';

type Row = {
  id: string;
  supplier?: string;
  amount?: number;
  currency?: 'GBP' | 'USD' | 'EUR';
  phase?: PhaseName;
  confidence?: number;
  decision?: 'PAY' | 'REFUSE';
  receiptId?: string;
};

type StreamEvent =
  | { type: 'invoice_start'; id: string }
  | { type: 'phase'; id: string; phase: PhaseName }
  | { type: 'receipt'; id: string; receipt: Receipt }
  | { type: 'bank'; balance: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

const INITIAL_BALANCE = 100_000;
const THRESHOLD = 0.95;

// Cache key for the most-recent completed run within this tab session.
// We store the full receipts (not just IDs) so we can rebuild the ledger
// without round-tripping to /api/receipts/[id], which lives in a separate
// module instance from the in-memory Map in dev. Restored on remount when
// the user came back from a receipt page (see FROM_INSPECT_FLAG below) so
// the agent doesn't pointlessly re-run; any other arrival on /run starts
// fresh.
const SESSION_KEY = 'mikado:lastRun';

// Set by DecisionReceipt on mount; consumed (and cleared) here. Presence of
// this flag is the *only* signal that says "the user wants to come back to
// the previous ledger, not start a new run". Anywhere else — typed URL,
// reload, link from home, fresh tab — the flag is missing and we run fresh.
const FROM_INSPECT_FLAG = 'mikado:fromInspect';

type CachedRun = {
  receipts: Receipt[];
  finalBalance: number;
  endedAt: string;
};

export default function RunPage() {
  const [bank, setBank] = useState(INITIAL_BALANCE);
  const [order, setOrder] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<{ ts: string; line: string }[]>([]);
  const [showStream, setShowStream] = useState(false);
  const autoStartedRef = useRef(false);
  // Refs so the 'done' handler can read the final values synchronously from
  // its closure regardless of when React batches the corresponding state.
  const receiptsRef = useRef<Receipt[]>([]);
  const latestBalanceRef = useRef<number>(INITIAL_BALANCE);

  const upsert = useCallback((id: string, patch: Partial<Row>) => {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { id }), ...patch } }));
    setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const log = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString('en-GB', {
      hour12: false,
    });
    setEvents((prev) => [...prev, { ts, line }].slice(-200));
  }, []);

  const handle = useCallback(
    (event: string, data: Record<string, unknown>) => {
      if (event === 'bank') {
        const balance = data.balance as number;
        setBank(balance);
        latestBalanceRef.current = balance;
        log(`bank · balance now ${fmtMoney(balance, 'GBP')}`);
      } else if (event === 'invoice_start') {
        const id = data.invoiceId as string;
        upsert(id, { id });
        log(`${id} · pulled from queue`);
      } else if (event === 'phase') {
        const id = data.invoiceId as string;
        const phase = data.phase as PhaseName;
        const trace = data.trace as { output: unknown };
        const patch: Partial<Row> = { phase };
        if (phase === 'extract') {
          const out = trace.output as { fields?: { supplier_name?: string; amount?: number; currency?: 'GBP' | 'USD' | 'EUR' } };
          if (out.fields) {
            patch.supplier = out.fields.supplier_name;
            patch.amount = out.fields.amount;
            patch.currency = out.fields.currency;
          }
        }
        if (phase === 'score') {
          patch.confidence = (trace.output as { overall: number }).overall;
        }
        if (phase === 'decide') {
          patch.decision = (trace.output as { action: 'PAY' | 'REFUSE' }).action;
        }
        upsert(id, patch);
        log(`${id} · ${phase}`);
      } else if (event === 'receipt') {
        const r = data.receipt as Receipt;
        receiptsRef.current.push(r);
        upsert(r.invoice.raw_id, {
          phase: 'decide',
          decision: r.decision.action,
          confidence: r.confidence.overall,
          receiptId: r.id,
          supplier: r.invoice.extracted.supplier_name,
          amount: r.invoice.extracted.amount,
          currency: r.invoice.extracted.currency,
        });
        log(`${r.invoice.raw_id} · receipt signed (${r.decision.action})`);
      } else if (event === 'done') {
        setDone(true);
        setRunning(false);
        log('all decisions signed.');
        // Persist the run so 'back from receipt' doesn't trigger a re-run.
        try {
          const cached: CachedRun = {
            receipts: receiptsRef.current,
            finalBalance: latestBalanceRef.current,
            endedAt: new Date().toISOString(),
          };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(cached));
        } catch {
          /* sessionStorage may be disabled (private mode); fail silent. */
        }
      } else if (event === 'error') {
        setError(String(data.message ?? 'unknown error'));
        setRunning(false);
        log(`error: ${String(data.message)}`);
      }
    },
    [upsert, log],
  );

  // Rebuild the completed-run view from a cached payload. Used when the user
  // navigates back to /run after inspecting a receipt — the agent doesn't
  // re-run, the ledger is restored exactly as the user left it.
  const hydrateFromCache = useCallback((cached: CachedRun) => {
    const newRows: Record<string, Row> = {};
    const newOrder: string[] = [];
    for (const r of cached.receipts) {
      const id = r.invoice.raw_id;
      newRows[id] = {
        id,
        supplier: r.invoice.extracted.supplier_name,
        amount: r.invoice.extracted.amount,
        currency: r.invoice.extracted.currency,
        confidence: r.confidence.overall,
        decision: r.decision.action,
        receiptId: r.id,
        phase: 'decide',
      };
      newOrder.push(id);
    }
    setRows(newRows);
    setOrder(newOrder);
    setBank(cached.finalBalance);
    setDone(true);
    setRunning(false);
    setRestored(true);
    receiptsRef.current = cached.receipts;
    latestBalanceRef.current = cached.finalBalance;
    setEvents([
      {
        ts: new Date(cached.endedAt).toLocaleTimeString('en-GB', { hour12: false }),
        line: 'restored from cache · run completed earlier this session',
      },
    ]);
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    // A fresh run invalidates the cached one — clearing first ensures we
    // never present a stale ledger if the new run errors mid-stream.
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* fail silent if sessionStorage is unavailable */
    }
    receiptsRef.current = [];
    latestBalanceRef.current = INITIAL_BALANCE;
    setRunning(true);
    setDone(false);
    setRestored(false);
    setError(null);
    setBank(INITIAL_BALANCE);
    setRows({});
    setOrder([]);
    setEvents([]);
    log('starting agent run…');

    try {
      const res = await fetch('/api/run', { method: 'POST' });
      if (!res.body) throw new Error('No SSE response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          const evLine = lines.find((l) => l.startsWith('event: '));
          const dataLine = lines.find((l) => l.startsWith('data: '));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice('event: '.length).trim();
          try {
            handle(event, JSON.parse(dataLine.slice('data: '.length)));
          } catch (e) {
            console.warn('[mikado] SSE parse failure', e);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
      setRunning(false);
    }
  }, [running, handle, log]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;

    // Only restore from cache if the user is coming *back* from a receipt
    // page. Reloads, direct URL hits, and links from elsewhere should
    // behave like a clean entry: the agent runs. Otherwise the demo gets
    // stuck on a stale ledger forever.
    let cameFromInspect = false;
    try {
      cameFromInspect = sessionStorage.getItem(FROM_INSPECT_FLAG) === '1';
      // Consume the flag immediately so subsequent /run mounts in this tab
      // are treated as "fresh entries" again.
      sessionStorage.removeItem(FROM_INSPECT_FLAG);
    } catch {
      /* sessionStorage disabled — fall through; we'll just run fresh */
    }

    if (cameFromInspect) {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CachedRun;
          if (Array.isArray(parsed.receipts) && parsed.receipts.length > 0) {
            hydrateFromCache(parsed);
            return;
          }
        }
      } catch {
        /* parse error — fall through to fresh run */
      }
    }

    start();
    // No abort on cleanup — see prior fix for React 19 StrictMode dev double-invoke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderedRows = order.map((id) => rows[id]).filter(Boolean) as Row[];
  const signedCount = orderedRows.filter((r) => r.receiptId).length;
  const refusedCount = orderedRows.filter((r) => r.decision === 'REFUSE').length;
  const paidCount = orderedRows.filter((r) => r.decision === 'PAY').length;
  const totalQueued = 5; // demo path, locked

  return (
    <>
      <TopBar
        meta={`/ run · ${
          running ? 'streaming' : restored ? 'cached' : done ? 'complete' : 'idle'
        }`}
        right={
          <>
            {running && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="live-dot" />
                <span className="topbar-meta" style={{ color: 'var(--gold)' }}>LIVE</span>
              </span>
            )}
            <button
              onClick={start}
              disabled={running}
              className={`btn btn-sm ${running || done ? 'btn-ghost' : 'btn-primary'}`}
            >
              {running ? '… running' : done ? '↻ run again' : '▶ run agent'}
            </button>
          </>
        }
      />

      <main className="container" style={{ padding: '32px 28px 80px' }}>
        {/* STATUS STRIP */}
        <section className="in-up in-up-1" style={{ marginBottom: 36 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 0,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            <Stat
              label="balance"
              value={fmtMoney(bank, 'GBP')}
              sub={
                bank !== INITIAL_BALANCE
                  ? `${bank > INITIAL_BALANCE ? '+' : '−'}${fmtMoney(Math.abs(bank - INITIAL_BALANCE), 'GBP')} since start`
                  : `start: ${fmtMoney(INITIAL_BALANCE, 'GBP')}`
              }
              accent="gold"
            />
            <Stat
              label="signed"
              value={`${signedCount} / ${totalQueued}`}
              sub={running ? 'streaming…' : done ? 'complete' : 'idle'}
            />
            <Stat
              label="paid"
              value={String(paidCount)}
              sub={paidCount === 0 ? '—' : 'verified by signature'}
              accent="pay"
            />
            <Stat
              label="refused"
              value={String(refusedCount)}
              sub={refusedCount === 0 ? '—' : 'human-out-of-loop kicked in'}
              accent="refuse"
              isLast
            />
          </div>
        </section>

        {error && (
          <div
            className="shake-once in-up"
            style={{
              padding: '12px 16px',
              border: '1px solid var(--refuse-edge)',
              background: 'var(--refuse-soft)',
              borderRadius: 'var(--r-md)',
              color: 'var(--refuse)',
              fontSize: 13,
              marginBottom: 28,
              fontFamily: 'var(--font-mono), ui-monospace, monospace',
            }}
          >
            error: {error}
          </div>
        )}

        {/* DECISIONS LEDGER */}
        <section className="in-up in-up-2" style={{ marginBottom: 40 }}>
          <SectionHead>Decisions</SectionHead>

          {/* Framing line — explicitly position these as flagged review items,
              not the full AP firehose. Mikado handles what falls through
              autopay; it does not compete with Bill.com's recurring rails. */}
          <p
            style={{
              margin: '-6px 0 16px',
              fontSize: 13,
              color: 'var(--ink-3)',
              lineHeight: 1.55,
            }}
          >
            {totalQueued} invoices flagged for review.{' '}
            {running ? (
              <span style={{ color: 'var(--gold)' }}>Running agent…</span>
            ) : restored ? (
              <span style={{ color: 'var(--ink-2)' }}>
                Showing previous run · click <em>run again</em> to re-run.
              </span>
            ) : done ? (
              <span style={{ color: 'var(--ink-2)' }}>Agent run complete.</span>
            ) : (
              <span style={{ color: 'var(--ink-2)' }}>Awaiting agent.</span>
            )}
          </p>

          <div className="panel" style={{ overflow: 'hidden' }}>
            <table className="ledger">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ width: 120 }}>Invoice</th>
                  <th>Supplier</th>
                  <th style={{ width: 140, textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Confidence</th>
                  <th style={{ width: 110 }}>Phase</th>
                  <th style={{ width: 140 }}>Verdict</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '40px 0' }}>
                      <span className="font-mono" style={{ fontSize: 12 }}>awaiting agent…</span>
                    </td>
                  </tr>
                )}
                {orderedRows.map((row, i) => (
                  <LedgerRow key={row.id} index={i + 1} row={row} threshold={THRESHOLD} />
                ))}
                {/* placeholder rows for queued invoices not yet started */}
                {Array.from({ length: Math.max(0, totalQueued - orderedRows.length) }).map(
                  (_, i) => (
                    <tr key={`pending-${i}`} className="is-pending">
                      <td className="font-mono tabular" style={{ color: 'var(--ink-faint)' }}>
                        {orderedRows.length + i + 1}
                      </td>
                      <td colSpan={6} className="font-mono" style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
                        queued
                      </td>
                      <td></td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* EVENT STREAM (collapsed by default — power users only) */}
        <section className="in-up in-up-3">
          <button
            onClick={() => setShowStream((s) => !s)}
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
            <span style={{ color: 'var(--gold)' }}>{showStream ? '▾' : '▸'}</span>
            Event stream ({events.length})
          </button>

          {showStream && (
            <pre
              className="panel font-mono in-up"
              style={{
                margin: 0,
                padding: 16,
                fontSize: 11.5,
                lineHeight: 1.7,
                color: 'var(--ink-2)',
                maxHeight: 320,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {events.length === 0
                ? '(no events yet)'
                : events
                    .map((e) => `${e.ts}  ${e.line}`)
                    .join('\n')}
            </pre>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  isLast,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: 'gold' | 'pay' | 'refuse';
  isLast?: boolean;
}) {
  const valColor =
    accent === 'gold' ? 'var(--gold)' : accent === 'pay' ? 'var(--pay)' : accent === 'refuse' ? 'var(--refuse)' : 'var(--ink)';
  return (
    <div
      style={{
        padding: '20px 24px',
        borderRight: isLast ? 'none' : '1px solid var(--border)',
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 10 }}>{label}</div>
      <div
        className="display tabular"
        style={{ fontSize: 24, color: valColor, marginBottom: 4 }}
      >
        {value}
      </div>
      <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
        {sub}
      </div>
    </div>
  );
}

function LedgerRow({ index, row, threshold }: { index: number; row: Row; threshold: number }) {
  const isDone = !!row.receiptId;
  const isInflight = !isDone && !!row.phase;
  const phaseLabel = row.phase ?? 'queued';
  const verdict = row.decision;

  const content = (
    <>
      <td className="font-mono tabular" style={{ color: 'var(--ink-3)' }}>
        {String(index).padStart(2, '0')}
      </td>
      <td className="font-mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
        {row.id}
      </td>
      <td>
        {row.supplier ? (
          <span style={{ color: 'var(--ink)' }}>{row.supplier}</span>
        ) : (
          <span className="font-mono" style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>
        )}
      </td>
      <td className="font-mono tabular" style={{ textAlign: 'right', color: 'var(--ink)' }}>
        {row.amount !== undefined && row.currency ? fmtMoney(row.amount, row.currency) : (
          <span style={{ color: 'var(--ink-faint)' }}>—</span>
        )}
      </td>
      <td className="font-mono tabular" style={{ textAlign: 'right', color: 'var(--ink-2)' }}>
        {row.confidence !== undefined ? (
          <span style={{ color: row.confidence >= threshold ? 'var(--pay)' : 'var(--refuse)' }}>
            {fmtPct(row.confidence, 0)}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-faint)' }}>—</span>
        )}
      </td>
      <td>
        {isInflight && !isDone ? (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '0.1em' }}>
            … {phaseLabel}
          </span>
        ) : isDone ? (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            done
          </span>
        ) : (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>queued</span>
        )}
      </td>
      <td>
        {verdict === 'PAY' ? (
          <Pill kind="pay">PAY</Pill>
        ) : verdict === 'REFUSE' ? (
          <Pill kind="refuse">REFUSE</Pill>
        ) : (
          <Pill kind="mute" noDot>—</Pill>
        )}
      </td>
      <td>
        {row.receiptId ? (
          <Link
            href={`/receipt/${row.receiptId}`}
            className="font-mono"
            style={{
              fontSize: 11,
              color: 'var(--gold)',
              letterSpacing: '0.06em',
              borderBottom: '1px solid var(--gold-edge)',
            }}
          >
            inspect →
          </Link>
        ) : null}
      </td>
    </>
  );

  return <tr className={isInflight ? 'is-active' : ''}>{content}</tr>;
}
