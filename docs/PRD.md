# Mikado — Product Requirements Document

**Tagline:** The cryptographic decision trail for AI agents that move money.
**One-line pitch:** When an AI agent pays an invoice, Mikado signs *why* — and refuses to act when its own confidence wobbles.

## 1. Problem

In April 2026, AI agents are paying invoices, running payroll, and moving money on behalf of finance teams. When something goes wrong, nobody can prove what the agent saw, what it was told to do, or how confident it was at decision time. Liability is a legal grey area; audit trails are an afterthought.

The EU AI Act's enforcement window opens in August 2026. Any AI system making consequential financial decisions for European users needs a tamper-evident audit trail — or faces fines up to €35M or 7% of global revenue.

Today, no fintech-specific tool ships this primitive. General-purpose AI audit-trail products (Galileo, Swept, TessPay) treat agents as black boxes and log inputs/outputs. They don't capture the *decision shape* — the prompt, the retrieved context, the model output, and the agent's internal confidence — as a single signed artifact that a regulator, a counterparty, or a court can verify.

## 2. Solution

Mikado is the agent-decision audit layer for money movement.

Every time a Mikado-wrapped agent decides to pay, refuse, or escalate, it emits a **Decision Receipt** — a JSON document containing:

- The exact prompt the model received
- The retrieved context (e.g. invoice text, supplier records)
- The model output
- A confidence score (computed from logprobs + retrieval similarity)
- Model ID + version hash
- Input hash (cryptographic hash of all inputs)
- Output hash
- A timestamped Ed25519 signature over the whole receipt

If confidence falls below a configured threshold (default 95%), the agent **refuses to move money**. The refusal is itself a signed receipt — proving the agent saw the request, evaluated it, and chose inaction.

Receipts open in a Cursor-styled debugger where you step through the decision like it's code: each phase (extract → retrieve → score → decide) is a breakpoint. Hover any step to see the data the agent saw at that point.

## 3. Goals (in priority order)

1. **Win the hackathon.** £2,000 + Cursor Ultra. Track 1 (Money Movement). Score on the 7+3 rubric.
2. **Be memorable.** The Mikado-falls-over animation when confidence drops below threshold is the demo moment that gets posted on X.
3. **Pass the anti-wrapper test.** The agent visibly executes a real workflow (extract → sign → mock-pay or refuse), with cryptographic artifacts a judge can inspect.
4. **Win a side-quest.** At least one of: Best use of Cursor (use Cursor SDK / background agents during build, document the process), Best use of LLM models (use Claude Opus or GPT-4o with structured tool-use; show eval surface).

## 4. Non-goals

- **Not** a payment processor. Mock the bank.
- **Not** a real production audit trail. Postgres optional. Receipts can live in-memory + filesystem.
- **Not** mobile. Web demo only.
- **Not** a SaaS dashboard for ongoing monitoring. Single-session demo flow.
- **Not** auth-protected. Single user, no login.

## 5. The Demo Path (90 seconds, locked)

The demo is the product. Build backwards from this.

**00:00–00:10 — Open**
A retro CRT-styled terminal home screen. ASCII Mikado tower (or pixel sprite) idle in the centre. Header: `MIKADO // DECISION TRAIL FOR AGENTIC PAYMENTS`. Tagline: `Pull a stick. If the tower falls, the agent doesn't pay.`

**00:10–00:30 — Run the queue**
Click `▶ RUN AGENT`. A queue of 5 invoices appears as pixel cards stacked like Mikado sticks. Agent processes them one at a time, visibly:
- Invoice 1: clean, recurring supplier, low amount. Agent extracts → high confidence (98%) → **PAID**. Sticks light up green. Bank balance ticks down.
- Invoice 2: clean, larger amount but recurring supplier. **PAID** (97%).
- Invoice 3: new supplier, ambiguous OCR on amount. Confidence 73%. **REFUSED**. Sticks shudder, one falls. A signed REFUSED receipt drops onto the screen.
- Invoice 4: phishing-shaped (lookalike supplier name "AWS Bllling"). Agent flags via supplier-name similarity to known supplier. **REFUSED** (61%). Tower shakes.
- Invoice 5: clean. **PAID** (96%).

**00:30–01:00 — Inspect the refused receipt**
Click the REFUSED receipt for invoice 3. Screen transitions from retro view to a Cursor-styled debugger UI ("zoom into the decision"). Receipt JSON on the right pane, monospace. Left pane shows the four phases as breakpoints:
- `extract` — invoice text + extracted fields
- `retrieve` — supplier history lookup, similarity scores
- `score` — confidence calculation, broken down by signal
- `decide` — threshold check, output, signed hash

Step through each. Hover the `score` step → tooltip shows "Amount OCR confidence: 0.71 — below floor 0.85. Decision: REFUSE."

**01:00–01:20 — Verify the signature**
Click `VERIFY`. A green checkmark animates: "Receipt valid. Signed by `mikado-agent-v1`. Hash matches."  Show the public key. Drag any byte of the JSON to flip it → checkmark goes red, "TAMPERED."

**01:20–01:30 — Close**
Cut to closing slide:
- "August 2026: EU AI Act enforcement begins."
- "€35M fines for AI agents without audit trails."
- "Mikado: the receipt for every decision your agent makes."
- "Ship today."

## 6. Scoring Map (the 7+3 rubric)

The Cursor x Briefcase rubric is 7 core points + 3 bonus points (1+1+1 across three buckets: Cursor, Specter, LLMs). Below, each rubric criterion is mapped to specific Mikado features.

| Criterion (estimated) | Mikado feature delivering it |
|---|---|
| **Technical execution** | Real Ed25519 signing, real Anthropic API with logprob-based confidence, tamper-detect demo, multi-phase agent loop |
| **Impact** | EU AI Act August 2026 deadline = forced buying for every European fintech with an AI agent. Specific customer named: any team in this room shipping a Track 1 agent |
| **Relevancy & creativity** | Cryptographic receipt + Cursor-debug-the-decision is genuinely novel; Mikado metaphor + retro UI = unmistakable |
| **UX/UI** | Full retro CRT aesthetic, sprite-based decision visualisation, Cursor-styled debugger as a transition |
| **Pitch quality** | One-line opener (EU AI Act), one-line close (€35M fines), demo *is* the pitch |
| **Best use of Cursor (bonus)** | Build with Cursor background agents in parallel, document long-running runs, ship a Cursor SDK example for "decision-as-code" debugging |
| **Best use of LLMs (bonus)** | Confidence is computed from real Claude/GPT logprobs; agent uses tool-use for structured extraction; show eval-style confidence breakdown in the debugger |
| **Best use of Specter (bonus, optional)** | If time permits: when extracting a new supplier, hit Specter API for company verification; "supplier not found in registry" → contributes to confidence drop |

## 7. Out-of-scope (the cut list, in cut order)

If running behind, drop in this order:

1. **Specter integration** — add only if extraction phase is done by 7:30 PM
2. **CRT scanline shader** — pure CSS, can be a `::after` overlay; drop if it breaks readability on projector
3. **Animated Mikado tower** (sprite collapse animation) — fall back to a static pixel-art tower with sticks turning red
4. **Tamper-detection demo** — drop entirely if behind by 8:30 PM. The signature itself is enough.
5. **Verify-step UI** — collapse into the receipt view (show "✓ signature valid" inline)

Never drop:

- The 5-invoice queue runner
- Real signing (Ed25519 via Node crypto)
- Real Anthropic API call with structured output
- The receipt JSON view
- The Cursor-debug step-through view (this is the differentiator)
- The closing pitch slide

## 8. Success metrics for tomorrow night

- **9:05 PM** — submitted with a working demo URL
- **9:07 PM** — pitch landed in 2:30 with no panic
- **9:55 PM** — top 3 podium (£2,000 or Cursor Ultra)
- **9:56 PM** — at least one judge takes a photo of the Cursor-debug-the-decision view
- **Bonus** — Sergio Garcia (Corgi) or Jamesin Seidel (Chapter One) follows up

## 9. Pitch script (2:30, locked)

> "In four months, the EU AI Act takes effect. Every fintech in Europe running an AI agent needs an audit trail or faces €35 million in fines.
>
> No fintech-specific tool exists for this. General-purpose audit tools log inputs and outputs. They miss the decision shape — what the agent saw, how confident it was, why it acted.
>
> This is Mikado. *[click ▶ RUN AGENT]*
>
> Mikado wraps any payment agent. It signs every decision — the prompt, the context, the confidence, the output — with Ed25519. Receipts are tamper-evident. Verifiable.
>
> *[invoices process, three pay, one refuses]*
>
> Watch what happens when confidence falls. *[invoice 3 refuses, tower shakes]* The agent didn't pay. It signed a refusal. That refusal is now legal evidence the agent considered the decision and chose inaction.
>
> *[click into refused receipt → Cursor debug view]*
>
> Every decision opens like code in Cursor. Step through. The amount OCR was 71% confident. Below threshold. Refuse. The receipt proves the agent saw the right thing and did the right thing.
>
> *[verify → tamper → red checkmark]*
>
> Cryptographically verifiable. Audit-ready. Ship-ready.
>
> Mikado is the receipt for every decision your agent makes. Ready in August. Built tonight."
