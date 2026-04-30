# Mikado — Backend

All backend lives in Next.js API routes. Single process. Module-level singletons for state.

## Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.30.0",
  "uuid": "^10.0.0"
}
```

That's it. Crypto is from `node:crypto`. No database driver. No express. No nest.

## Environment variables (`.env.local`)

```
ANTHROPIC_API_KEY=sk-ant-...
MIKADO_THRESHOLD=0.95
SPECTER_API_KEY=optional-skip-for-mvp
```

## API routes

### `POST /api/run`

Triggers the agent loop over the seeded invoice queue. Returns a Server-Sent Events stream where each event is a phase update or a completed receipt.

**Request body:** `{}` (empty — uses seeded invoices)

**Response:** `text/event-stream` with events:

```
event: phase
data: {"invoiceId": "inv-1", "phase": "extract", "trace": {...}}

event: phase
data: {"invoiceId": "inv-1", "phase": "retrieve", "trace": {...}}

event: phase
data: {"invoiceId": "inv-1", "phase": "score", "trace": {...}}

event: phase
data: {"invoiceId": "inv-1", "phase": "decide", "trace": {...}}

event: receipt
data: {"receipt": {...full Receipt object...}}

event: bank
data: {"balance": 95108}

event: done
data: {"completed": 5}
```

**Implementation skeleton:**

```typescript
// app/api/run/route.ts
import { NextRequest } from 'next/server';
import { runAgent } from '@/lib/agent/runAgent';
import { INVOICES } from '@/data/invoices';
import { bank } from '@/lib/mock/bank';

export const runtime = 'nodejs'; // need crypto + Anthropic SDK
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        for (const invoice of INVOICES) {
          await runAgent(invoice, {
            onPhase: (trace) => send('phase', { invoiceId: invoice.id, phase: trace.phase, trace }),
            onReceipt: (receipt) => {
              send('receipt', { receipt });
              send('bank', { balance: bank.balance });
            },
          });
          await new Promise(r => setTimeout(r, 300)); // demo pacing
        }
        send('done', { completed: INVOICES.length });
      } catch (err: any) {
        send('error', { message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
```

### `GET /api/receipts`
Returns all receipts as JSON array. Used after a run to populate the queue view if the user reloads.

### `GET /api/receipts/[id]`
Returns a single receipt. Used by the `/receipt/[id]` page.

### `POST /api/verify`
Body: `{ receipt: Receipt }`. Returns `{ valid: boolean, reason?: string }`.

This is what the green/red checkmark in the UI calls when the user clicks VERIFY or drags a byte.

## The agent loop (`lib/agent/runAgent.ts`)

```typescript
import { v4 as uuid } from 'uuid';
import { extract } from './extract';
import { retrieve } from './retrieve';
import { score } from './score';
import { decide } from './decide';
import { signReceipt } from '@/lib/crypto/sign';
import { getPublicKey } from '@/lib/crypto/keys';
import { bank } from '@/lib/mock/bank';
import { receipts } from '@/lib/store';
import { hashJson } from '@/lib/crypto/hash';
import type { Invoice, Receipt, PhaseTrace } from '@/lib/types';

const AGENT_VERSION_HASH = 'sha256:9e8b2f...'; // hardcoded constant for demo
const THRESHOLD = parseFloat(process.env.MIKADO_THRESHOLD ?? '0.95');

export async function runAgent(
  invoice: Invoice,
  callbacks: {
    onPhase: (trace: PhaseTrace) => void;
    onReceipt: (receipt: Receipt) => void;
  }
): Promise<Receipt> {
  const traces: Record<string, PhaseTrace> = {};

  // Phase 1
  const t1Start = new Date().toISOString();
  const extractResult = await extract(invoice);
  traces.extract = {
    phase: 'extract',
    started_at: t1Start,
    ended_at: new Date().toISOString(),
    input: { raw: invoice.raw },
    output: extractResult,
    notes: `Extracted ${Object.keys(extractResult.fields).length} fields with overall confidence ${extractResult.confidence.toFixed(2)}`,
  };
  callbacks.onPhase(traces.extract);

  // Phase 2
  const t2Start = new Date().toISOString();
  const retrieveResult = await retrieve(extractResult.fields.supplier_name);
  traces.retrieve = {
    phase: 'retrieve',
    started_at: t2Start,
    ended_at: new Date().toISOString(),
    input: { supplier_name: extractResult.fields.supplier_name },
    output: retrieveResult,
    notes: retrieveResult.is_known
      ? `Known supplier — last paid £${retrieveResult.last_paid_amount} on ${retrieveResult.last_paid_date}`
      : `Unknown supplier${retrieveResult.similar_known_supplier ? ` — close to "${retrieveResult.similar_known_supplier}" (sim ${retrieveResult.similarity_to_known.toFixed(2)})` : ''}`,
  };
  callbacks.onPhase(traces.retrieve);

  // Phase 3
  const t3Start = new Date().toISOString();
  const scoreResult = score(extractResult, retrieveResult);
  traces.score = {
    phase: 'score',
    started_at: t3Start,
    ended_at: new Date().toISOString(),
    input: { extract: extractResult, retrieve: retrieveResult },
    output: scoreResult,
    notes: `Overall confidence: ${scoreResult.overall.toFixed(2)} (threshold ${THRESHOLD.toFixed(2)})`,
  };
  callbacks.onPhase(traces.score);

  // Phase 4
  const t4Start = new Date().toISOString();
  const decision = decide(scoreResult, THRESHOLD);
  traces.decide = {
    phase: 'decide',
    started_at: t4Start,
    ended_at: new Date().toISOString(),
    input: { score: scoreResult, threshold: THRESHOLD },
    output: decision,
    notes: decision.action === 'PAY'
      ? `Confidence above threshold — paying`
      : `Confidence below threshold — refusing. Reason: ${decision.reason}`,
  };
  callbacks.onPhase(traces.decide);

  // Side effect: pay the bank if decision is PAY
  if (decision.action === 'PAY') {
    bank.pay(extractResult.fields.supplier_name, extractResult.fields.amount);
  }

  // Build the receipt
  const receiptBody = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    agent: { id: 'mikado-agent-v1', version_hash: AGENT_VERSION_HASH },
    invoice: { raw_id: invoice.id, extracted: extractResult.fields },
    phases: traces as Receipt['phases'],
    confidence: {
      overall: scoreResult.overall,
      breakdown: scoreResult.breakdown,
      threshold: THRESHOLD,
    },
    decision,
    hashes: {
      input_hash: hashJson(invoice.raw),
      receipt_hash: '', // filled below
    },
  };
  receiptBody.hashes.receipt_hash = hashJson({ ...receiptBody, hashes: { ...receiptBody.hashes, receipt_hash: '' } });

  const signature = signReceipt(receiptBody);

  const receipt: Receipt = {
    ...receiptBody,
    signature: {
      algorithm: 'Ed25519',
      public_key: getPublicKey(),
      value: signature,
    },
  };

  receipts.set(receipt.id, receipt);
  callbacks.onReceipt(receipt);

  return receipt;
}
```

## Phase 1 — extract (`lib/agent/extract.ts`)

Real Anthropic call with structured tool-use. The trick to getting confidence is: prompt the model to also rate its confidence per field, then take the *weighted average*. Optionally enrich with logprobs if you switch to OpenAI for the bonus.

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Invoice } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACT_TOOL = {
  name: 'submit_invoice_extraction',
  description: 'Submit the structured extraction of an invoice document.',
  input_schema: {
    type: 'object' as const,
    properties: {
      supplier_name: { type: 'string' },
      amount: { type: 'number', description: 'Amount in major units (e.g. 1500.00 for £1,500.00)' },
      currency: { type: 'string', enum: ['GBP', 'USD', 'EUR'] },
      due_date: { type: 'string', description: 'ISO-8601 date' },
      invoice_number: { type: 'string' },
      line_items: { type: 'array', items: { type: 'object' } },
      per_field_confidence: {
        type: 'object',
        description: 'Your confidence (0.0-1.0) for each extracted field.',
        properties: {
          supplier_name: { type: 'number' },
          amount: { type: 'number' },
          currency: { type: 'number' },
          due_date: { type: 'number' },
          invoice_number: { type: 'number' },
        },
        required: ['supplier_name', 'amount', 'currency', 'due_date', 'invoice_number'],
      },
    },
    required: ['supplier_name', 'amount', 'currency', 'due_date', 'invoice_number', 'line_items', 'per_field_confidence'],
  },
};

export async function extract(invoice: Invoice) {
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_invoice_extraction' },
    messages: [
      {
        role: 'user',
        content: `Extract the structured fields from this invoice. For each field, also report your confidence (0.0-1.0) — be honest, especially for ambiguous OCR or unusual supplier names.

INVOICE:
${invoice.raw}`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool use block in response');

  const fields = toolUse.input as any;
  const perField = fields.per_field_confidence;
  const confidence = (perField.supplier_name + perField.amount + perField.currency + perField.due_date + perField.invoice_number) / 5;

  return {
    fields: {
      supplier_name: fields.supplier_name,
      amount: fields.amount,
      currency: fields.currency,
      due_date: fields.due_date,
      invoice_number: fields.invoice_number,
      line_items: fields.line_items,
    },
    per_field_confidence: perField,
    confidence,
  };
}
```

## Phase 2 — retrieve (`lib/agent/retrieve.ts`)

Pure in-memory string similarity. Use Jaro-Winkler or a dead-simple character-overlap ratio.

```typescript
import { SUPPLIERS } from '@/data/suppliers';

function similarity(a: string, b: string): number {
  // Lightweight: lowercase, normalize spaces, then character bigram overlap
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const A = normalize(a);
  const B = normalize(b);
  if (A === B) return 1;
  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const ba = bigrams(A);
  const bb = bigrams(B);
  let intersect = 0;
  ba.forEach(x => { if (bb.has(x)) intersect++; });
  return (2 * intersect) / (ba.size + bb.size);
}

export async function retrieve(supplierName: string) {
  let best = { similar_known_supplier: '', similarity_to_known: 0, last_paid_amount: 0, last_paid_date: '' };
  for (const s of SUPPLIERS) {
    const sim = similarity(supplierName, s.name);
    if (sim > best.similarity_to_known) {
      best = {
        similar_known_supplier: s.name,
        similarity_to_known: sim,
        last_paid_amount: s.last_paid_amount,
        last_paid_date: s.last_paid_date,
      };
    }
  }

  const is_known = best.similarity_to_known > 0.99;
  return {
    is_known,
    similarity_to_known: best.similarity_to_known,
    similar_known_supplier: is_known ? undefined : best.similar_known_supplier,
    last_paid_amount: is_known ? best.last_paid_amount : undefined,
    last_paid_date: is_known ? best.last_paid_date : undefined,
  };
}
```

## Phase 3 — score (`lib/agent/score.ts`)

Pure function. Weighted sum of signals, with the phishing detector being the spicy bit.

```typescript
type ExtractResult = Awaited<ReturnType<typeof import('./extract').extract>>;
type RetrieveResult = Awaited<ReturnType<typeof import('./retrieve').retrieve>>;

export function score(ex: ExtractResult, rt: RetrieveResult) {
  const breakdown: Record<string, { score: number; weight: number; reason: string }> = {};

  // Signal 1: extraction confidence
  breakdown.extraction = {
    score: ex.confidence,
    weight: 0.4,
    reason: `Average per-field extraction confidence: ${ex.confidence.toFixed(2)}`,
  };

  // Signal 2: supplier match
  breakdown.supplier_match = {
    score: rt.is_known ? 1.0 : Math.max(0, rt.similarity_to_known - 0.3), // unknown but similar still gets some credit
    weight: 0.3,
    reason: rt.is_known
      ? 'Supplier matches known registry'
      : `Supplier not in registry${rt.similar_known_supplier ? ` (closest: "${rt.similar_known_supplier}", sim ${rt.similarity_to_known.toFixed(2)})` : ''}`,
  };

  // Signal 3: amount plausibility
  let amountScore = 1.0;
  let amountReason = 'Amount within expected range';
  if (rt.is_known && rt.last_paid_amount) {
    const ratio = ex.fields.amount / rt.last_paid_amount;
    if (ratio > 2.5) {
      amountScore = 0.4;
      amountReason = `Amount £${ex.fields.amount} is ${ratio.toFixed(1)}x last paid (£${rt.last_paid_amount})`;
    } else if (ratio > 1.5) {
      amountScore = 0.7;
      amountReason = `Amount £${ex.fields.amount} is ${ratio.toFixed(1)}x last paid (£${rt.last_paid_amount})`;
    }
  }
  breakdown.amount_plausibility = { score: amountScore, weight: 0.2, reason: amountReason };

  // Signal 4: phishing — high similarity but not exact match is the spicy phishing pattern
  let phishingScore = 1.0;
  let phishingReason = 'No phishing pattern detected';
  if (!rt.is_known && rt.similarity_to_known > 0.7 && rt.similarity_to_known < 0.99) {
    phishingScore = 0.2;
    phishingReason = `Lookalike of "${rt.similar_known_supplier}" — possible phishing`;
  }
  breakdown.phishing_signal = { score: phishingScore, weight: 0.1, reason: phishingReason };

  const overall =
    breakdown.extraction.score * breakdown.extraction.weight +
    breakdown.supplier_match.score * breakdown.supplier_match.weight +
    breakdown.amount_plausibility.score * breakdown.amount_plausibility.weight +
    breakdown.phishing_signal.score * breakdown.phishing_signal.weight;

  return { overall, breakdown };
}
```

## Phase 4 — decide (`lib/agent/decide.ts`)

Trivial threshold check.

```typescript
type ScoreResult = ReturnType<typeof import('./score').score>;

export function decide(s: ScoreResult, threshold: number) {
  if (s.overall >= threshold) {
    return { action: 'PAY' as const, reason: `Confidence ${s.overall.toFixed(2)} >= threshold ${threshold.toFixed(2)}` };
  }
  // Find the lowest-scoring breakdown signal as the headline reason
  const lowest = Object.entries(s.breakdown).sort((a, b) => a[1].score * a[1].weight - b[1].score * b[1].weight)[0];
  return {
    action: 'REFUSE' as const,
    reason: `Confidence ${s.overall.toFixed(2)} < threshold ${threshold.toFixed(2)}. Primary concern: ${lowest[1].reason}`,
  };
}
```

## Crypto module (`lib/crypto/`)

```typescript
// keys.ts
import { generateKeyPairSync, KeyObject } from 'node:crypto';

let keypair: { publicKey: KeyObject; privateKey: KeyObject } | null = null;

function get() {
  if (!keypair) keypair = generateKeyPairSync('ed25519');
  return keypair;
}

export function getPublicKey(): string {
  return get().publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

export function getPrivateKey(): KeyObject {
  return get().privateKey;
}
```

```typescript
// hash.ts
import { createHash } from 'node:crypto';
export function hashJson(value: any): string {
  const canonical = JSON.stringify(value, Object.keys(value ?? {}).sort());
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}
```

```typescript
// sign.ts
import { sign as ed25519Sign, verify as ed25519Verify, createPublicKey } from 'node:crypto';
import { getPrivateKey } from './keys';
import type { Receipt } from '@/lib/types';

export function signReceipt(body: Omit<Receipt, 'signature'>): string {
  const canonical = JSON.stringify(body);
  const sig = ed25519Sign(null, Buffer.from(canonical), getPrivateKey());
  return sig.toString('base64');
}

export function verifyReceipt(receipt: Receipt): boolean {
  const { signature, ...body } = receipt;
  const canonical = JSON.stringify(body);
  const pub = createPublicKey(signature.public_key);
  try {
    return ed25519Verify(null, Buffer.from(canonical), pub, Buffer.from(signature.value, 'base64'));
  } catch {
    return false;
  }
}
```

## Mock bank (`lib/mock/bank.ts`)

```typescript
type Tx = { supplier: string; amount: number; at: string };

class MockBank {
  balance = 100_000;
  history: Tx[] = [];

  pay(supplier: string, amount: number) {
    this.balance -= amount;
    this.history.push({ supplier, amount, at: new Date().toISOString() });
  }
}

export const bank = new MockBank();
```

## Seeded data (`data/invoices.ts`, `data/suppliers.ts`)

The 5 demo invoices are *hand-crafted* for a great demo. Don't randomise.

```typescript
// data/suppliers.ts
export const SUPPLIERS = [
  { name: 'Amazon Web Services',     last_paid_amount: 4892.00, last_paid_date: '2026-03-30' },
  { name: 'WeWork London Bridge',    last_paid_amount: 1850.00, last_paid_date: '2026-04-01' },
  { name: 'Slack Technologies',      last_paid_amount: 480.00,  last_paid_date: '2026-04-12' },
  { name: 'Linear Software Inc',     last_paid_amount: 200.00,  last_paid_date: '2026-04-08' },
  { name: 'Stripe Atlas',            last_paid_amount: 500.00,  last_paid_date: '2026-01-15' },
  // ... maybe 15 more for realism
];
```

```typescript
// data/invoices.ts
export const INVOICES = [
  // 1. Clean recurring small — should pay
  {
    id: 'inv-001',
    raw: `INVOICE #INV-2026-0431
From: Slack Technologies
Bill to: Acme Ltd
Amount: £480.00 GBP
Due: 2026-05-15
Item: Slack Business+ subscription April 2026`,
  },
  // 2. Clean recurring larger — should pay (still <2x last)
  {
    id: 'inv-002',
    raw: `INVOICE #AWS-44872193
Amazon Web Services
Bill to: Acme Ltd
Amount due: $4,892.00 USD
Due date: 2026-05-10
Charges: EC2, S3, CloudFront — April`,
  },
  // 3. Ambiguous OCR on amount — extraction conf low → REFUSE
  {
    id: 'inv-003',
    raw: `INVO!CE 2026/0413
Vendor: Apex Cl0ud Service5
Amount: £l8,4O0.00 — DUE IMMEDIATELY!
Account: 12-34-56 / 87654321
[OCR scan quality: poor]`,
  },
  // 4. Phishing — lookalike of AWS (note "Bllling" misspelling) — REFUSE
  {
    id: 'inv-004',
    raw: `INVOICE #AWS-99921
From: AWS Bllling Department  <billing@awscloud-secure.com>
Bill to: Acme Ltd
Amount: $14,500.00 — URGENT
Wire to: First Trust Caribbean / 0099-22-1`,
  },
  // 5. Clean recurring — should pay
  {
    id: 'inv-005',
    raw: `INVOICE #LIN-3344
Linear Software Inc
Acme Ltd — Linear Workspace
Amount: £200.00 GBP
Period: April 2026
Due: 2026-05-20`,
  },
];
```

## Invariants

1. Every API response is JSON or SSE. No HTML rendering from API routes.
2. Every receipt is signed before being added to the store. There is no such thing as an unsigned receipt.
3. The keypair is generated once per server process. Never log the private key.
4. The agent is **deterministic in its policy logic** (score, decide). Only the LLM call introduces stochasticity, and that's bounded by structured tool-use.
5. The mock bank balance is the single source of truth for what's been paid; it must update *only* when a `PAY` decision is committed.
