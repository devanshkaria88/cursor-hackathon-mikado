# Mikado

**The cryptographic decision trail for AI agents that move money.**

When an AI agent pays an invoice, Mikado signs *why* — and refuses to act when its own confidence wobbles.

Built for **Cursor × Briefcase London 2026** · Track 1 (Money Movement) · 30 April 2026

---

## What it does

Every Mikado-wrapped agent emits a signed **Decision Receipt** for every action — pay, refuse, escalate. The receipt contains the prompt, the retrieved context, the model output, a confidence score, and an Ed25519 signature. If confidence falls below threshold, the agent refuses to move money and signs the refusal as legal evidence of inaction.

In four months, the EU AI Act enforces audit-trail requirements for AI making consequential financial decisions. Fines reach €35M or 7% of revenue. Mikado is the receipt for every decision your agent makes.

## Demo

1. Open `/` → click **▶ RUN AGENT**
2. Watch 5 invoices flow through the queue. 3 pay, 2 refuse — confidence below 95%.
3. Click any refused receipt → opens in a Cursor-styled debugger.
4. Step through the four phases (extract → retrieve → score → decide).
5. Click **VERIFY** → green check (signature valid). Tamper a byte → red (TAMPERED).

## Stack

- Next.js 15 (App Router, TypeScript)
- Anthropic Claude Opus 4.7 (`@anthropic-ai/sdk`) for structured extraction
- Node `crypto` for real Ed25519 signing
- In-memory store, no database
- Server-Sent Events for live phase streaming

## Run locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open `http://localhost:3000`.

## Built with Cursor

This project was built end-to-end in Cursor in approximately 3 hours using:

- **Cursor background agents** running in parallel on independent files (data seeds, sprite components, score breakdown formatter)
- **Cursor Composer 2** via the SDK for the agent loop scaffolding
- A project-wide `.cursor/rules/mikado.mdc` that codifies non-negotiable architectural rules and the demo path

[Screenshot: Cursor sidebar with multiple background agents running concurrently — TODO during build]

## Repository structure

```
docs/
  PRD.md             # the product spec, demo path, pitch
  context.md         # strategic background, judges, why we win
  architecture.md    # system design, file tree, build order
  backend.md         # API routes, agent loop, signing schemas
  frontend.md        # design system, retro UI, sprite usage
  cursor_prompt.md   # the kickoff prompt for Cursor
sprites/
  sprite_prompts.md  # AI generation prompts for the 12 sprites
  *.png              # the sprites themselves
.cursor/rules/
  mikado.mdc         # project-wide Cursor rules
```

## Why "Mikado"

Mikado is a children's game where players pull sticks from a pile without disturbing the others. One wrong move and the tower collapses. The product does the same: every decision is a stick. High confidence is a safe pull. Low confidence — if the agent acts, the integrity of the audit trail falls. So the agent doesn't act. It signs the refusal instead.

---

Built solo by Devansh ([@devanshkaria88](https://github.com/devanshkaria88)) on 30 April 2026.
