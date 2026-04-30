# Mikado — Demo Guide

A self-contained walkthrough of what Mikado is, why it exists, and exactly how to verify everything works in under five minutes.

> If you're a judge, scroll to **[How to test it](#how-to-test-it)** and run the 90-second demo path. Everything else is supporting context.

---

## Why it's needed

In April 2026, AI agents are paying invoices, running payroll, and moving money on behalf of finance teams. When something goes wrong, nobody can prove what the agent saw, what it was told to do, or how confident it was at decision time. Liability sits in legal grey. Audit trails are an afterthought.

The deadline forcing the issue:

- **EU AI Act enforcement opens August 2026** — four months from the build date of this project.
- Any AI system making "consequential" financial decisions for European users must produce a tamper-evident audit trail.
- Penalties: **€35M or 7% of global revenue**, whichever is greater.

Existing AI-audit products (Galileo, Swept, TessPay) treat agents as black boxes and log their text inputs and outputs. They miss the **decision shape**: the prompt, the retrieved context, the model's structured output, and the agent's internal confidence — captured as one signed artifact a regulator, counterparty, or court can verify.

No fintech-specific tool ships this primitive. That gap is what Mikado fills.

---

## What we built

Mikado is the agent-decision audit layer for money movement. Every time a Mikado-wrapped agent decides to pay, refuse, or escalate, it emits a **Decision Receipt**: a JSON document containing the prompt, the retrieved context, the model output, a confidence breakdown, an input hash, and an Ed25519 signature over the whole thing.

If overall confidence falls below a configured threshold (default `0.95`), the agent **refuses to move money**. The refusal is itself a signed receipt — proof the agent saw the request, evaluated it, and chose inaction.

### The agent loop (the product)

Four phases, one signed receipt:

```
EXTRACT  →  RETRIEVE  →  SCORE  →  DECIDE  →  SIGN  →  STORE
```

| Phase | What it does | How it's implemented |
|---|---|---|
| **extract** | Pull structured fields from raw invoice text + the model's per-field confidence | Real Anthropic call. `claude-opus-4-7` with structured tool-use. The model is instructed to be honest about ambiguous OCR and lookalike supplier names. |
| **retrieve** | Look up the supplier in the registry. Compute bigram-overlap similarity to known suppliers and their aliases. | Pure in-memory function. No LLM, no external API. Bigram similarity > 0.99 = known supplier. Alias-token containment (e.g. `"AWS Bllling Department"` contains the alias `"AWS"`) lifts similarity into the phishing band. |
| **score** | Weighted sum of four signals → overall confidence | Pure deterministic function. `extraction × 0.4 + supplier_match × 0.3 + amount_plausibility × 0.2 + phishing_signal × 0.1`. No randomness, no LLM. |
| **decide** | Threshold check → `PAY` or `REFUSE` | Pure function. If overall confidence ≥ threshold, action = `PAY`. Otherwise `REFUSE` with the lowest-contributing signal as the headline reason. |

The whole receipt is then canonicalised, hashed, and signed with **real Ed25519 via `node:crypto`**.

### What's real, what's mocked

The judges' rubric punishes wrappers. So we kept real exactly the parts where authenticity matters and mocked everything else:

| Real | Mocked |
|---|---|
| Anthropic Claude Opus 4.7 API call (extract) | Bank account (`MockBank` singleton, in-memory balance) |
| Ed25519 keypair via `node:crypto` (persisted to `.keys/`) | Supplier registry (20 suppliers in `data/suppliers.ts`) |
| Receipt hashing with canonical JSON sha256 | Invoice queue (5 hand-crafted in `data/invoices.ts`) |
| Tamper-detection (single-bit flip on the signature → verification fails) | No payment processor, no Plaid/TrueLayer/Stripe |
| Server-Sent Events streaming each phase to the UI as it completes | No database, no auth |

### Architecture

Single Next.js 15 App Router app. Node runtime for the API routes (need `crypto` + Anthropic SDK). One in-memory `Map<id, Receipt>` plus a write-through to `./receipts/{id}.json` for cool factor and dev-mode resilience.

```
/app
  /api
    /run/route.ts             POST → SSE stream of phase + receipt + bank events
    /receipts/route.ts        GET  → list all in-memory receipts
    /receipts/[id]/route.ts   GET  → one receipt by id
    /verify/route.ts          POST → Ed25519 verify any receipt blob
  /run/page.tsx               Live runner — top-bar status + Decisions ledger
  /receipt/[id]/page.tsx      Server component (fetches receipt)
  /receipt/[id]/DecisionReceipt.tsx   Story-first decision receipt (client island)
  page.tsx                    Home — editorial title page
/components
  /ui/primitives.tsx          BrandMark, TopBar, Pill, SectionHead, KeyValue, CopyButton,
                              SignalBar + format helpers (one file, ~200 lines)
/lib
  /agent                      extract, retrieve, score, decide, runAgent
  /crypto                     keys (singleton Ed25519), hash (canonical sha256), sign (sign + verify)
  /mock                       bank
  store.ts                    in-memory receipts Map
  types.ts                    single source of truth for all shapes
/data                         suppliers.ts, invoices.ts (5 hand-crafted)
/scripts/check-crypto.ts      One-off invariant check: sign↔verify round-trip + tamper detection
/docs                         The 6 specs the build was driven from
/screenshots                  PNGs of the running UI (home, run, receipt × 2)
/design-system/mikado/        MASTER.md persisted by the ui-ux-pro-max skill
```

### Design system

The UI was redesigned using the [`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) Cursor skill. Running its `--design-system` recommendation engine on `"fintech audit trail compliance enterprise cryptographic decision receipt regulated finance"` returned:

- **Pattern:** Enterprise Gateway (corporate trust, conservative accents)
- **Style:** Dark Mode (OLED) + Data-Dense Dashboard
- **Typography:** IBM Plex Sans + IBM Plex Mono (single foundry, "fintech, banking, professional, serious" mood)
- **Anti-patterns flagged:** light backgrounds, ornate decoration, missing security indicators

That's exactly what shipped: deep slate background, **gold (#F5B01B)** for the Mikado mark and the threshold ticks, **green** for PAY/VALID, **coral** for REFUSE/TAMPERED. No card chrome, hairline rules between sections, mono for every piece of cryptographic evidence.

---

## How to test it

### Prerequisites

- Node ≥ 18 (we use `node:crypto` Ed25519 + Anthropic SDK)
- An `ANTHROPIC_API_KEY` (free tier is fine; the demo makes 5 small calls)

### Setup

```bash
npm install
cp .env.local.example .env.local 2>/dev/null || true   # if a template exists
# otherwise create .env.local with:
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
echo "MIKADO_THRESHOLD=0.95"        >> .env.local
npm run dev
```

The dev server boots on `http://localhost:3000`. The Ed25519 keypair is generated on first run and persisted to `.keys/mikado-ed25519.{pem,pub.pem}` so signatures stay valid across restarts.

### One-shot smoke test (no UI)

```bash
# Crypto invariants — verifies the receipt-is-sacred properties
npx tsx scripts/check-crypto.ts
# Expected:
#   1) sign → verify: PASS
#   2) tamper body → verify: PASS (i.e. correctly rejected)
#   3) tamper signature → verify: PASS (i.e. correctly rejected)
#   All crypto invariants hold.

# Full agent run via SSE (takes ~20 seconds — five real Anthropic calls)
curl -N -X POST http://localhost:3000/api/run
# You should see a stream of `event: phase`, `event: receipt`, `event: bank`
# events ending in `event: done` with `"completed":5`.
```

You should also see five JSON files appear in `./receipts/`.

### Manual demo path (the 90-second walkthrough)

| t | Action | What you should see |
|---|---|---|
| 0:00 | Open `http://localhost:3000` | Editorial title page. Big serif-flavoured headline: "A decision receipt for every payment an **AI agent** makes." Three numbered pillars below. Single primary CTA: **Run the agent**. |
| 0:05 | Click **Run the agent** | Navigate to `/run`. The page auto-starts the agent — a `LIVE` indicator with a pulsing gold dot lights up in the top-bar. |
| 0:10–0:30 | Watch the ledger | A 4-stat strip ticks: BALANCE (gold), SIGNED (`n/5`), PAID (green), REFUSED (coral). Below, the Decisions table fills row by row — the supplier, amount, confidence percentage, current phase, and a verdict pill (`PAY` green / `REFUSE` coral). Each completed row gets a gold **inspect →** link. |
| 0:30 | Final state | **3 PAID + 2 REFUSED.** Final balance: **£94,428.00** (= 100,000 − 480 − 4,892 − 200). The `REFUSED` stat reads "human-out-of-loop kicked in." |
| 0:35 | Click **inspect →** on row 04 (`AWS Bllling Department`) | Navigate to `/receipt/<id>`. The receipt opens with a big coral **REFUSED** verdict block — `$14,500.00 withheld from AWS Bllling Department · confidence 63% · threshold 95%`. |
| 0:40 | Read the **Primary concern** | Plain-English headline: *"Lookalike of 'Amazon Web Services' — possible phishing (sim 0.85)"*. No JSON-tree spelunking required. |
| 0:45 | Skim **How the agent reasoned** | Four phase tiles, each one English sentence. Tile 02 (retrieve) reads: *"Supplier not in registry. Closest known: 'Amazon Web Services' at 85% similarity."* Tile 04 (decide) reads: *"Confidence 63% sat below the 95% threshold. Payment refused — agent kept human-out-of-loop."* |
| 0:55 | Look at **Confidence breakdown** | Four horizontal bars with a **gold tick at 95% (the threshold)**. The `phishing_signal` row has a red **KILLER SIGNAL** pill. Each row shows `score × weight = contribution`. Total: 62.5%. |
| 1:05 | Scroll to **Cryptographic proof** | Key-value table: algorithm `Ed25519`, signed by `mikado-agent-v1`, public key + signature + input hash + receipt hash, each with a `copy` button. |
| 1:10 | Click **▷ Verify signature** | Green box appears: *"✓ Signature valid. Recomputed the canonical receipt body, hashed it, and Ed25519 verified against the agent's public key. This is genuinely what the agent produced."* |
| 1:20 | Click **⚠ Tamper one byte** | Coral box with `shake-once` animation: *"✗ Signature invalid. We flipped one byte of the signature. Ed25519 rejected it. This is the security property: a single bit of tampering is detectable."* |
| 1:30 | (Optional) Click **Raw evidence — full receipt JSON** | The full machine-readable receipt unfolds below for the auditor who wants the underlying bytes. |

### What can fail and how to spot it

| Symptom | Likely cause | Fix |
|---|---|---|
| `/run` page sits forever on "awaiting agent boot" | `ANTHROPIC_API_KEY` missing or invalid | Check `.env.local`; restart `npm run dev` |
| `inv-004` refuses for "Supplier not in registry" instead of phishing | Aliases didn't load (older code) | Confirm `data/suppliers.ts` has `aliases: ['AWS', ...]` on Amazon Web Services |
| All 5 invoices PAID (no refusals) | Threshold env override too lax | `MIKADO_THRESHOLD=0.95` in `.env.local` |
| Verify button always returns red | `.keys/` directory was deleted between signing and verifying | Re-run `/api/run` to mint fresh receipts with the current keypair |
| Receipt page returns 404 after restart | In-memory `Map` was cleared and the disk fallback can't find the id | Re-run `/api/run`; new ids will be valid in both stores |

### Screenshots

Reference renders of the live UI are checked in at `/screenshots/`:

- `01-home.png` — the editorial home
- `02-run.png` — the live decisions ledger after a run completes
- `03-receipt-pay.png` — a `PAID` receipt (`inv-001`, Slack Technologies)
- `04-receipt-refuse-with-tampered.png` — the `REFUSED` phishing receipt with the `Signature invalid` banner showing
- `05-run-tablet-768.png` — `/run` at 768px (the skill's recommended tablet breakpoint)

---

## Why this wins (in 30 seconds)

Three reasons, in priority order:

1. **A forced-buying event in 4 months.** Every European fintech with an AI agent in production needs an audit-trail primitive before August 2026 enforcement. Mikado is the smallest defensible primitive that fills the gap: a signed Decision Receipt the agent produces itself.
2. **Anti-wrapper.** The cryptography is real. The Anthropic call is real. The agent visibly executes a four-phase workflow with confidence-driven refusal. The judge can flip a byte and watch verification fail in front of them. There's no "trust the LLM" handwave anywhere.
3. **The story-first decision receipt.** Other audit tools dump JSON. Mikado renders the receipt as a *document a regulator can read top-to-bottom*: a verdict, a primary concern, four phase tiles in plain English, a signal-bar breakdown with the threshold drawn on each bar, then the cryptographic proof with verify/tamper interactions. The raw JSON is collapsed at the bottom for the machines. Designed using the [`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) Cursor skill in the recommended Enterprise Gateway / Data-Dense Dashboard pattern with IBM Plex.

---

## Pitch (2:30, locked)

> "Existing AP automation handles the easy invoices — Slack, AWS, your monthly utilities. They autopay anything matching a rule.
>
> But every month, a chunk of invoices fall through — new vendors, unusual amounts, suspicious-looking suppliers. Those pile up in a human review queue. That queue is the bottleneck. And it's where business email compromise attacks succeed — a tired human rubber-stamps a lookalike invoice, and £14,000 walks out the door.
>
> Mikado is the agent that handles that queue. It reasons through every flagged invoice. It pays when it's confident. It refuses when it's not. And every decision — paid or refused — is signed.
>
> *[click ▶ RUN AGENT]*
>
> *[5 invoices process, 3 pay, 2 refuse including the AWS phishing one]*
>
> Watch what just happened. *[point at refused phishing receipt]* AWS Bllling Department, $14,500, urgent wire to a Caribbean account. Today, this lands in a human's inbox. Mikado caught the lookalike domain — 0.84 similarity to 'Amazon Web Services' but not a match — and refused.
>
> *[click into the refused receipt → debugger view]*
>
> Every decision opens like code. Step through the agent's reasoning. The supplier match scored 0.20. The amount was 4.7x last paid. Threshold not met. Refuse.
>
> The receipt is signed. When your CFO asks Monday morning 'why did we not pay AWS?', you don't dig through Slack. You read the agent's reasoning, signed and timestamped.
>
> Mikado replaces your AP review queue with an agent that reasons, decides, and signs. Built tonight."

---

## File map for reviewers

If you want to read code, here's the order:

1. `lib/types.ts` — every shape, single source of truth
2. `lib/agent/runAgent.ts` — the orchestrator (the 4 phases + signing)
3. `lib/agent/{extract,retrieve,score,decide}.ts` — each phase
4. `lib/crypto/{keys,hash,sign}.ts` — the Ed25519 + canonical JSON
5. `app/api/run/route.ts` — the SSE endpoint
6. `app/receipt/[id]/DecisionReceipt.tsx` — the story-first receipt view that judges interact with
7. `app/run/page.tsx` — the live decisions ledger
8. `components/ui/primitives.tsx` — every shared primitive in one file
9. `data/{invoices,suppliers}.ts` — the seeded demo content
10. `scripts/check-crypto.ts` — proves the sacred receipt invariants (sign↔verify, tamper detection)

Total project: ~1,400 lines of TypeScript across ~22 files. No tests (no time; verified by demo). No linting (disabled at scaffold for speed). No hidden magic.
