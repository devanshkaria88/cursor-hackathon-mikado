# Mikado — Architecture

Single Next.js 15 (App Router) application. No external services beyond the Anthropic API. Designed for a 3-hour solo build.

## High-level diagram

```
+---------------------------------------------------------------+
|                    BROWSER (Next.js client)                   |
|                                                               |
|   /             — retro home, "RUN AGENT" button              |
|   /run          — live queue runner, sprite-based UI          |
|   /receipt/:id  — receipt detail (Cursor-debug view)          |
|                                                               |
|         POST /api/run  ──► triggers agent loop                |
|         GET  /api/receipts                                    |
|         GET  /api/receipts/:id                                |
|         POST /api/verify                                      |
+-----------------------------┬---------------------------------+
                              │
+-----------------------------▼---------------------------------+
|                   API ROUTES (Next.js server)                 |
|                                                               |
|   /api/run            — orchestrates the agent loop           |
|   /api/receipts       — list all receipts (in-memory store)   |
|   /api/receipts/:id   — fetch one receipt                     |
|   /api/verify         — verify a receipt's signature          |
+----┬---------┬----------┬-----------┬-----------┬-------------+
     │         │          │           │           │
     ▼         ▼          ▼           ▼           ▼
  ┌─────┐  ┌──────┐  ┌────────┐  ┌────────┐  ┌─────────┐
  │Agent│  │Crypto│  │ Bank   │  │Receipts│  │Suppliers│
  │loop │  │ Ed25 │  │ (mock) │  │ store  │  │ (mock)  │
  └──┬──┘  └──────┘  └────────┘  └────────┘  └─────────┘
     │
     ▼
  ┌──────────────────┐
  │ Anthropic API    │ (real, via @anthropic-ai/sdk)
  │ claude-opus-4-7  │
  │  - extraction    │
  │  - reasoning     │
  │  - logprob/conf  │
  └──────────────────┘
```

## Agent loop (the core primitive)

This is the most important piece of code in the project. It runs four phases per invoice and emits a signed receipt.

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ EXTRACT  │ → │ RETRIEVE │ → │  SCORE   │ → │  DECIDE  │ → SIGN → STORE
└──────────┘   └──────────┘   └──────────┘   └──────────┘
   ↓ inputs:    ↓ inputs:      ↓ inputs:      ↓ inputs:
   raw invoice  extracted      all phases     score
   text/HTML    fields +       output         + threshold
                supplier
                history
```

### Phase 1 — EXTRACT
Input: raw invoice (text, mocked HTML/email body)
Action: Anthropic API call with structured tool-use to extract `{supplier_name, amount, currency, due_date, line_items, invoice_number}`
Output: structured fields + per-field OCR/extraction confidence (derived from logprobs of the structured-output tokens)

### Phase 2 — RETRIEVE
Input: extracted supplier name
Action: lookup in mock supplier registry; compute string similarity vs known suppliers; (optional) Specter API call
Output: `{is_known: bool, similarity_to_known: number, last_paid_amount?: number, last_paid_date?: string, similar_known_supplier?: string}`

### Phase 3 — SCORE
Input: all phase outputs
Action: weighted sum of confidence signals
- `extraction_confidence` (from Anthropic logprobs) — weight 0.4
- `supplier_match_confidence` (1.0 if known, else fuzzy similarity) — weight 0.3
- `amount_plausibility` (compare to last_paid_amount, flag if >2x) — weight 0.2
- `phishing_signal` (lookalike detection — if similarity_to_known is high but not 1.0, this is suspicious) — weight 0.1
Output: `{overall: number, breakdown: Record<string, {score, weight, reason}>}`

### Phase 4 — DECIDE
Input: score + threshold (default 0.95)
Action: if `score.overall >= threshold` → action = PAY; else → action = REFUSE
Output: `{action: 'PAY' | 'REFUSE', reason: string}`

If PAY: call `MockBank.pay(supplier, amount)` to update the displayed balance.

### Sign + Store
Compute hash of full decision context. Sign with Ed25519 private key (loaded from env var, generated at first boot). Build the Receipt object. Store in-memory + write to `./receipts/{id}.json` (cool factor for the demo).

## Receipt schema

```typescript
type Receipt = {
  id: string;                    // uuid
  timestamp: string;             // ISO-8601
  agent: {
    id: string;                  // 'mikado-agent-v1'
    version_hash: string;        // sha256 of agent code (faked: hardcoded constant)
  };
  invoice: {
    raw_id: string;              // input id
    extracted: ExtractedFields;
  };
  phases: {
    extract: PhaseTrace;
    retrieve: PhaseTrace;
    score: PhaseTrace;
    decide: PhaseTrace;
  };
  confidence: {
    overall: number;
    breakdown: Record<string, {score: number; weight: number; reason: string}>;
    threshold: number;
  };
  decision: {
    action: 'PAY' | 'REFUSE';
    reason: string;
  };
  hashes: {
    input_hash: string;          // sha256 of phases.extract input
    receipt_hash: string;        // sha256 of everything above (excl. signature)
  };
  signature: {
    algorithm: 'Ed25519';
    public_key: string;          // base64
    value: string;               // base64
  };
};

type PhaseTrace = {
  phase: 'extract' | 'retrieve' | 'score' | 'decide';
  started_at: string;
  ended_at: string;
  input: any;
  output: any;
  notes?: string;                // human-readable reasoning, used for the debugger tooltip
};
```

## Data flow per invoice (sequence)

```
Browser            Next.js API           Anthropic           MockBank
   │                  │                     │                   │
   │ POST /api/run    │                     │                   │
   ├─────────────────►│                     │                   │
   │                  │ for each invoice:   │                   │
   │                  │                     │                   │
   │                  │ EXTRACT (tool-use)  │                   │
   │                  ├────────────────────►│                   │
   │                  │◄────────────────────┤ structured + logp │
   │                  │                     │                   │
   │                  │ RETRIEVE (in-mem)   │                   │
   │                  │                     │                   │
   │                  │ SCORE (pure fn)     │                   │
   │                  │                     │                   │
   │                  │ DECIDE              │                   │
   │                  │                     │                   │
   │                  │ if PAY:             │                   │
   │                  ├──────────────────────────────────────►  │ pay()
   │                  │                     │                   │
   │                  │ SIGN + STORE        │                   │
   │                  │                     │                   │
   │ ◄────────────────┤ stream receipt as   │                   │
   │   SSE event      │ each phase finishes │                   │
   │                  │                     │                   │
```

The streaming is what makes the demo feel alive. Use Server-Sent Events (SSE) so the client renders each phase as it completes, not all at once.

## Cryptographic signing

```typescript
import { generateKeyPairSync, sign, verify } from 'node:crypto';

// Generate keypair on server boot, persist to env var across requests
const { publicKey, privateKey } = generateKeyPairSync('ed25519');

// Sign a receipt body
function signReceipt(receiptWithoutSignature: object): string {
  const canonical = JSON.stringify(receiptWithoutSignature); // canonicalize keys for stability
  const sig = sign(null, Buffer.from(canonical), privateKey);
  return sig.toString('base64');
}

// Verify
function verifyReceipt(receipt: Receipt): boolean {
  const { signature, ...body } = receipt;
  const canonical = JSON.stringify(body);
  return verify(null, Buffer.from(canonical), publicKey, Buffer.from(signature.value, 'base64'));
}
```

**Important:** the keypair must persist across hot-reloads in dev. Use a singleton pattern in a module-level variable, or write the key to disk on first generation.

## State management (server-side)

In-memory singleton:
```typescript
// app/lib/store.ts
const receipts = new Map<string, Receipt>();
const bank = { balance: 100_000, history: [] };
const suppliers = SEEDED_SUPPLIERS; // from data/suppliers.ts
```

Module-level state survives across API route invocations within a single Next.js server process. Good enough for a demo.

## State management (client-side)

Plain React state. No Redux. The `/run` page subscribes to the SSE stream and accumulates receipts as they arrive.

```typescript
// /app/run/page.tsx
const [receipts, setReceipts] = useState<Receipt[]>([]);
const [bankBalance, setBankBalance] = useState<number>(100_000);
const [activeIdx, setActiveIdx] = useState<number | null>(null);

// EventSource subscription, append on each event
```

## Page structure

| Route | Purpose | Key components |
|---|---|---|
| `/` | Retro home + "RUN AGENT" CTA | `<MikadoTower />`, `<RunButton />`, `<TaglineMarquee />` |
| `/run` | Live agent run | `<InvoiceQueue />`, `<MikadoTower mode="active" />`, `<BankPanel />`, `<ReceiptDrawer />` |
| `/receipt/[id]` | Cursor-debug view | `<DebuggerLayout />`, `<PhaseStepper />`, `<JsonViewer />`, `<VerifyButton />` |

## File tree

```
/app
  /api
    /run/route.ts             # POST — runs the agent over the queue, streams SSE
    /receipts/route.ts        # GET — list
    /receipts/[id]/route.ts   # GET — one
    /verify/route.ts          # POST — verify a receipt blob
  /run/page.tsx               # the main runner UI
  /receipt/[id]/page.tsx      # the debugger UI
  page.tsx                    # home
  layout.tsx                  # root, fonts, retro shell
  globals.css                 # CRT scanlines, pixel-perfect rendering
/components
  /retro
    MikadoTower.tsx           # ASCII / pixel sprite tower
    InvoiceCard.tsx           # pixel-art invoice card
    BankPanel.tsx             # balance display, retro digit font
    Terminal.tsx              # CRT-styled wrapper
  /debugger
    DebuggerLayout.tsx        # split pane, Cursor-styled
    PhaseStepper.tsx          # left pane, breakpoints
    JsonViewer.tsx            # right pane, syntax-highlighted
    VerifyButton.tsx          # green check → red on tamper
/lib
  /agent
    extract.ts                # phase 1: Anthropic call
    retrieve.ts               # phase 2: supplier lookup
    score.ts                  # phase 3: weighted sum
    decide.ts                 # phase 4: threshold check
    runAgent.ts               # orchestrator
  /crypto
    keys.ts                   # singleton keypair
    sign.ts                   # signReceipt, verifyReceipt
  /mock
    bank.ts                   # MockBank class
    suppliers.ts              # seeded supplier registry
    invoices.ts               # the 5 demo invoices
  store.ts                    # in-memory receipts map
/data
  invoices.ts                 # 5 hand-crafted invoices for the demo
  suppliers.ts                # ~20 known suppliers
/sprites
  tower-stable.png
  tower-shaking.png
  tower-fallen.png
  invoice-card.png
  stick-green.png
  stick-yellow.png
  stick-red.png
  cursor-icon.png
/public/fonts
  PressStart2P-Regular.ttf
  JetBrainsMono-Regular.ttf
```

## Build order (within the 3-hour window)

This is the order that minimises risk of an unfinished demo. Build the spine first, then thicken.

| Time | Block |
|---|---|
| 5:50–6:10 | Bootstrap Next.js, install deps (`@anthropic-ai/sdk`, fonts), set up file tree, paste seed invoices and suppliers |
| 6:10–6:50 | Agent loop end-to-end (extract via Anthropic → retrieve → score → decide → sign → store). Test with curl. **Spine done.** |
| 6:50–7:20 | `/run` page basic version: queue + live updates via SSE, no styling. Confirm the loop visibly works. |
| 7:20–7:50 | Retro styling pass: fonts, palette, terminal wrapper, CRT scanlines, pixel borders |
| 7:50–8:20 | Receipt detail page (`/receipt/[id]`) with Cursor-debug aesthetic. The phase stepper. |
| 8:20–8:40 | Verify-button + tamper-detect demo. The "drag a byte to flip it" interaction. |
| 8:40–8:55 | Sprite integration: tower states, stick colours, animations on transitions |
| 8:55–9:00 | **Final dress rehearsal.** Run the demo end-to-end at least twice. |

If you're behind at any checkpoint, drop from the bottom of the cut list (PRD §7).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Anthropic API slow → demo lags | Use streaming + show "agent thinking…" sprite during latency; pre-warm with a dummy call on page load |
| Sprite generation takes too long | Have ASCII fallbacks for every sprite (the tower is just `|` characters arranged) |
| Tamper-detect demo is fiddly | Wrap in a try/catch, fall back to a hardcoded "tamper detected" flow if dragging bytes is too clever |
| Cursor-debug view is too ambitious | Minimum viable: split pane, JSON on right, four phase buttons on left, hover for tooltip. No actual stepping animation needed if time-pressed. |
| SSE connection drops | Fallback to polling every 500ms |
| Real Anthropic key in env | Use server-side only, never expose to client; double-check `.env.local` is gitignored |
