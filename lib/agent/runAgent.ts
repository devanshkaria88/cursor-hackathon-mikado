// docs/backend.md §The agent loop
// Orchestrates extract → retrieve → score → decide for ONE invoice, signs the
// receipt, persists to the in-memory store + filesystem, and emits per-phase
// callbacks so the SSE route can stream phase events as they happen.

import { v4 as uuid } from 'uuid';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { extract } from '@/lib/agent/extract';
import { retrieve } from '@/lib/agent/retrieve';
import { score } from '@/lib/agent/score';
import { decide } from '@/lib/agent/decide';
import { signReceipt } from '@/lib/crypto/sign';
import { getPublicKey } from '@/lib/crypto/keys';
import { hashJson } from '@/lib/crypto/hash';
import { bank } from '@/lib/mock/bank';
import { receipts } from '@/lib/store';
import type {
  Invoice,
  PhaseTrace,
  Phases,
  Receipt,
  ReceiptBody,
} from '@/lib/types';

// Hardcoded "version hash of the agent code". In production this would be a
// real hash of the bundled agent code at build time; for the demo it just
// needs to be a stable identifier baked into every receipt.
const AGENT_VERSION_HASH = 'sha256:9e8b2f4a1c2b3d4e5f60718293a4b5c6d7e8f9001';
const AGENT_ID = 'mikado-agent-v1';

const RECEIPTS_DIR = join(process.cwd(), 'receipts');

function thresholdFromEnv(): number {
  const v = parseFloat(process.env.MIKADO_THRESHOLD ?? '0.95');
  return Number.isFinite(v) ? v : 0.95;
}

function persistReceipt(r: Receipt) {
  if (!existsSync(RECEIPTS_DIR)) mkdirSync(RECEIPTS_DIR, { recursive: true });
  writeFileSync(
    join(RECEIPTS_DIR, `${r.id}.json`),
    JSON.stringify(r, null, 2),
  );
}

export type RunCallbacks = {
  onPhase: (invoiceId: string, trace: PhaseTrace) => void;
  onReceipt: (receipt: Receipt) => void;
};

export async function runAgent(
  invoice: Invoice,
  callbacks: RunCallbacks,
): Promise<Receipt> {
  const THRESHOLD = thresholdFromEnv();
  const phases = {} as Phases;

  // Phase 1 — extract (real Anthropic)
  const t1Start = new Date().toISOString();
  const extractResult = await extract(invoice);
  phases.extract = {
    phase: 'extract',
    started_at: t1Start,
    ended_at: new Date().toISOString(),
    input: { raw: invoice.raw },
    output: extractResult,
    notes: `Extracted ${Object.keys(extractResult.fields).length} fields with overall confidence ${extractResult.confidence.toFixed(2)}`,
  };
  callbacks.onPhase(invoice.id, phases.extract);

  // Phase 2 — retrieve
  const t2Start = new Date().toISOString();
  const retrieveResult = await retrieve(extractResult.fields.supplier_name);
  phases.retrieve = {
    phase: 'retrieve',
    started_at: t2Start,
    ended_at: new Date().toISOString(),
    input: { supplier_name: extractResult.fields.supplier_name },
    output: retrieveResult,
    notes: retrieveResult.is_known
      ? `Known supplier — last paid ${retrieveResult.last_paid_amount} on ${retrieveResult.last_paid_date}`
      : `Unknown supplier${retrieveResult.similar_known_supplier ? ` — close to "${retrieveResult.similar_known_supplier}" (sim ${retrieveResult.similarity_to_known.toFixed(2)})` : ''}`,
  };
  callbacks.onPhase(invoice.id, phases.retrieve);

  // Phase 3 — score (pure)
  const t3Start = new Date().toISOString();
  const scoreResult = score(extractResult, retrieveResult);
  phases.score = {
    phase: 'score',
    started_at: t3Start,
    ended_at: new Date().toISOString(),
    input: { extract: extractResult, retrieve: retrieveResult },
    output: scoreResult,
    notes: `Overall confidence: ${scoreResult.overall.toFixed(2)} (threshold ${THRESHOLD.toFixed(2)})`,
  };
  callbacks.onPhase(invoice.id, phases.score);

  // Phase 4 — decide (pure)
  const t4Start = new Date().toISOString();
  const decision = decide(scoreResult, THRESHOLD);
  phases.decide = {
    phase: 'decide',
    started_at: t4Start,
    ended_at: new Date().toISOString(),
    input: { score: scoreResult, threshold: THRESHOLD },
    output: decision,
    notes:
      decision.action === 'PAY'
        ? 'Confidence above threshold — paying'
        : `Confidence below threshold — refusing. Reason: ${decision.reason}`,
  };
  callbacks.onPhase(invoice.id, phases.decide);

  // Side effect: only commit a payment when the decision is PAY.
  if (decision.action === 'PAY') {
    bank.pay(extractResult.fields.supplier_name, extractResult.fields.amount);
  }

  // Build receipt body. We hash everything except the signature, then sign.
  const body: ReceiptBody = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    agent: { id: AGENT_ID, version_hash: AGENT_VERSION_HASH },
    invoice: { raw_id: invoice.id, extracted: extractResult.fields },
    phases,
    confidence: {
      overall: scoreResult.overall,
      breakdown: scoreResult.breakdown,
      threshold: THRESHOLD,
    },
    decision,
    hashes: {
      input_hash: hashJson({ raw: invoice.raw }),
      receipt_hash: '',
    },
  };
  body.hashes.receipt_hash = hashJson({
    ...body,
    hashes: { ...body.hashes, receipt_hash: '' },
  });

  const signatureValue = signReceipt(body);

  const receipt: Receipt = {
    ...body,
    signature: {
      algorithm: 'Ed25519',
      public_key: getPublicKey(),
      value: signatureValue,
    },
  };

  receipts.set(receipt.id, receipt);
  persistReceipt(receipt);
  callbacks.onReceipt(receipt);

  return receipt;
}
