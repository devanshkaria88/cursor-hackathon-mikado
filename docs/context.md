# Mikado — Context

This file gives Cursor agents (and any teammates) the strategic background. Read this before PRD.md if you're picking up the project mid-build.

## Event context

- **Hackathon:** Cursor × Briefcase — "Human out of the loop in high-risk financial workflows"
- **Date:** Thursday 30 April 2026
- **Venue:** Halkin Offices, 1-2 Paris Garden, London
- **Schedule:** 5:45 PM hacking start → 9:00 PM code freeze → demos 9:05 PM
- **Total build time:** ~3 hours 15 minutes
- **Team:** Solo (Devansh)
- **Track:** 01 — Money Movement
- **Prizes:** £2,000 + Cursor Ultra seats top 3; bonus buckets for Cursor, Specter, LLMs

## Judges and what each cares about

- **Jan Stehlik (Briefcase, CTO)** — agentic accounting, multimodal AI, real ledger work
- **Alec Barber (OpenAI, ex-Context.ai)** — evals, confidence calibration, agent quality measurement. He will love confidence-driven refusal and the tamper-evident audit trail.
- **David Gelberg (10 Downing Street AI Team)** — UK government deployment of AI; "Move Fast and Fix Things"; technical depth and shipped code
- **Jamesin Seidel (Chapter One)** — agent infrastructure investment thesis; ex-data scientist; runs hackathons; explicitly worried that vertical AI gets eaten by incumbents → values defensible primitives
- **Umberto Belluzzo (Earlybird VC)** — fintech infra (Briefcase, Sikoia, Payable, Porters, finmid); B2B; regulated
- **Sergio Garcia (Corgi)** — AI-native insurance carrier; AI liability product page live; cares about underwriting AI errors

## Why Mikado wins

- **EU AI Act (effective August 2026)** — €35M / 7% revenue fines for consequential AI without audit trails. This is a forced-buying event in 4 months. Every judge sees this risk in their portfolio.
- **Track fit** — Track 1 ("Money Movement") asks "make it obvious what they will and will not do." Mikado's signed refusal receipts *are* that surface.
- **Anti-wrapper** — Real cryptographic signing, real LLM confidence, real workflow execution. The judges' rubric explicitly punishes "wrapper around text generation."
- **Crowded space avoidance** — General-purpose AI audit tools (Galileo, Swept, TessPay) exist. Fintech-specific decision receipts with confidence-driven refusal *do not*. The Cursor-debug-the-decision angle is unique.
- **Sponsor alignment** — Briefcase needs this primitive for their own agents; White Circle's guardrails layer would consume Mikado receipts; Cursor is the natural debugger.

## Tech philosophy for this build

- **Demo > clean code.** This is a hackathon, not production.
- **Single Next.js app.** API routes, no separate backend. NestJS is overkill solo for 3 hours.
- **In-memory state.** No database. Receipts in `Map<id, Receipt>`. Persist to filesystem for cool factor (`./receipts/{id}.json`).
- **Real where it matters:**
  - Real Anthropic API for extraction + reasoning
  - Real Ed25519 signing via Node `crypto.sign`
  - Real hash verification
- **Mocked where it doesn't:**
  - Bank API (a `MockBank` class with a balance and `pay()` method)
  - Email/inbox (invoices seeded from a TS file)
  - Supplier registry (TS array, plus optional Specter API call)
- **Cursor as a force multiplier.** Run Cursor background agents on independent files (sprite assembly, mock data, JSON receipt schema) while you focus on the agent loop. Document this for the side-quest.

## The Mikado metaphor

Mikado (also "pick-up sticks") is a game where players pull sticks from a pile without disturbing the others. One wrong move and the tower collapses.

The product does the same: every decision is a stick. High confidence → safe pull. Low confidence → if you act, the tower (the audit trail's integrity) falls. So the agent doesn't act. It signs the refusal instead.

This metaphor must show up in:
- The visual UI (sticks/sprites for invoices and decisions)
- The copy ("pull a stick", "tower stable", "tower shaking")
- The pitch (the opening line and the moment of refusal)

## The "human out of the loop" framing

The theme is human-out-of-the-loop. Mikado *is* a human-out-of-the-loop primitive: by signing refusals, it lets the agent make the no-go call autonomously without a human approval step. The human only sees the receipts after the fact. This is the inversion of the usual "human approves agent action" pattern — the agent self-bounds, signs its bounds, and the human becomes an auditor rather than a gatekeeper.

That's the philosophical pitch under the technical pitch. Mention it in 30 seconds if a judge asks "how is this human-out-of-the-loop?"

## What we're not doing (and why)

- **Not building a payment processor** — mocked bank is enough; demo doesn't move real money
- **Not building auth** — single user, no login screen, no signup
- **Not building real bank integrations** — Plaid/TrueLayer would burn an hour for zero demo value
- **Not building a database layer** — in-memory + filesystem is enough for 5 invoices
- **Not building mobile** — web only, judged on a projector
- **Not using ElevenLabs / voice / LiveKit** — not relevant to this room (despite past hackathons leaning on them)
- **Not using NestJS / TypeORM / Postgres** — overhead with no demo payoff at this scale and timeline

## File map for Cursor

- `docs/PRD.md` — what we're building, the demo path, the pitch
- `docs/architecture.md` — system design, data flow, agent phases
- `docs/backend.md` — API routes, agent loop, signing, receipts
- `docs/frontend.md` — pages, components, retro aesthetic, sprite usage
- `docs/cursor_prompt.md` — the kickoff prompt to paste into Cursor at 5:50 PM
- `.cursor/rules/mikado.mdc` — project-wide Cursor rules
- `sprites/` — pixel art assets (see sprite_prompts.md for generation prompts)
