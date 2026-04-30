# Cursor Kickoff Prompt — Paste at 5:50 PM

This is the exact prompt to paste into Cursor's chat the moment you sit down. It assumes you've already created a fresh Next.js 15 project and copied the `docs/` folder into it.

---

## Setup commands (run in terminal first, while Cursor reads docs)

```bash
npx create-next-app@latest mikado --typescript --tailwind --app --no-src-dir --use-npm --no-eslint --turbopack --import-alias "@/*"
cd mikado
npm install @anthropic-ai/sdk uuid
npm install -D @types/uuid

# copy docs folder + sprites
mkdir -p docs sprites public/fonts
# (paste docs from the prep, copy sprites into ./sprites)

# environment
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
echo "MIKADO_THRESHOLD=0.95" >> .env.local

# go
npm run dev
```

---

## Paste this into Cursor chat (Cmd+L)

```
You are working on Mikado, a hackathon project for the Cursor x Briefcase London hackathon. We have ~3 hours to ship a working demo.

CRITICAL: Read these in order before writing any code:
1. docs/PRD.md — what we're building, the demo path (locked, do not deviate)
2. docs/context.md — strategic background, judges, why we win
3. docs/architecture.md — system design, file tree, build order
4. docs/backend.md — agent loop, API routes, signing, schemas
5. docs/frontend.md — retro UI design system, components, sprite usage
6. .cursor/rules/mikado.mdc — project rules

Once you've read all six, summarise back to me in 5 bullets:
- The product (one sentence)
- The demo's wow moment
- The 4 phases of the agent loop
- The two pages that absolutely must work
- The cut order if we lose time

Then start building in this exact order from architecture.md §"Build order":

PHASE A — SPINE (5:50–6:50, target 1 hour)
1. Set up the file tree as specified in architecture.md
2. Implement lib/types.ts with all TypeScript types from backend.md schemas
3. Implement lib/crypto/{keys,hash,sign}.ts — real Ed25519 via node:crypto
4. Implement lib/mock/{bank,suppliers}.ts and data/{invoices,suppliers}.ts with the seeded data from backend.md
5. Implement lib/agent/{extract,retrieve,score,decide,runAgent}.ts with REAL Anthropic API calls in extract.ts using claude-opus-4-7 + structured tool-use
6. Implement app/api/run/route.ts as a streaming SSE endpoint
7. Implement app/api/receipts/route.ts, app/api/receipts/[id]/route.ts, app/api/verify/route.ts
8. Test by curling /api/run and confirming the SSE stream emits real signed receipts

By 6:50, when I run `curl -N -X POST http://localhost:3000/api/run`, I should see all 4 phases for all 5 invoices stream as SSE events, with 3 PAID and 2 REFUSED, all with valid Ed25519 signatures.

DO NOT START PHASE B UNTIL THE SPINE WORKS END-TO-END. Stub the UI temporarily; backend correctness comes first.

PHASE B — UI WIRING (6:50–7:20, target 30 min)
1. Implement app/run/page.tsx — connect to SSE, show queue + bank balance with no styling yet
2. Implement app/receipt/[id]/page.tsx — fetch one receipt, show JSON + phases with no styling yet
3. Wire the invoice queue cards to phase events, the bank panel to bank events, the receipt drawer to receipt events
4. Confirm clicking a refused receipt navigates to /receipt/[id] and the page renders

PHASE C — RETRO STYLING (7:20–7:50, target 30 min)
1. Set up app/globals.css with the design system from frontend.md
2. Pull in Press Start 2P + JetBrains Mono fonts
3. Implement components/retro/{MikadoTower,InvoiceCard,BankPanel,Terminal,ReceiptDrawer}.tsx
4. Apply CRT overlay via the .crt class
5. Place sprites (already in /sprites/) using <img class="sprite">

PHASE D — DEBUGGER PAGE (7:50–8:20, target 30 min)
1. Implement components/debugger/{DebuggerLayout,PhaseStepper,JsonViewer}.tsx in Cursor's dark aesthetic
2. The phase stepper on the left, JSON viewer on the right
3. Click a phase → highlights its data in the JSON pane
4. Render the score breakdown as a small table when 'score' phase is selected

PHASE E — TAMPER + VERIFY (8:20–8:40)
1. Implement components/debugger/VerifyButton.tsx with the simple click-to-tamper version
2. Wire it to /api/verify

PHASE F — POLISH (8:40–8:55)
1. Sprite animations (tower shake on refusal, stick colour transitions)
2. Bank balance counter animation
3. The home page (/) — minimal: tagline, tower, RUN AGENT button → /run

PHASE G — DRESS REHEARSAL (8:55–9:00)
Run the demo end-to-end at least twice. Time it. Practice the pitch.

GROUND RULES while we work:
- Demo > clean code. Cut corners that don't show up in 90 seconds of demo.
- If I say "do X by Y time" — break X into smaller files and run Cursor background agents in parallel where possible. Document this for the Cursor side-quest submission.
- Never refactor for elegance during build. Only refactor if a bug requires it.
- Every file you create, mention which doc it implements (so I can verify).
- Confirm major architectural choices with me before deviating from docs/.
- If you hit a blocker on the Anthropic API, tell me immediately.

Begin by reading the docs and giving me the 5-bullet summary.
```

---

## When to use Cursor's background agents (for the side-quest)

Once Phase A spine is done, you can run multiple Cursor agents in parallel on independent files. Good candidates:

| Agent | Task | While you focus on |
|---|---|---|
| Agent 1 | Generate `data/suppliers.ts` with 20 realistic suppliers + last_paid amounts | Wiring the SSE client |
| Agent 2 | Implement the score breakdown formatter (the table in the debugger) | Building DebuggerLayout |
| Agent 3 | Write the `<MikadoTower>` component states based on aggregate run state | Receipt detail page |
| Agent 4 | Generate the home page with the typewriter intro animation | Final polish |

**IMPORTANT for side-quest:** Take a screenshot of the Cursor sidebar when 2+ agents are running concurrently. Include this in the project's `README.md` under a "Built with Cursor" section. Mention which files each agent owned. Easy bonus point.

## When NOT to use background agents

- Anything that touches the agent loop core (`runAgent.ts`, `extract.ts`, `score.ts`) — too critical, do it yourself
- Anything cryptographic (`sign.ts`, `keys.ts`) — must work first time
- The schemas in `types.ts` — drift here cascades into every other file

## Recovery prompts (paste these if Cursor goes off-piste)

> "Stop. Re-read docs/PRD.md §5 (the demo path). Are we on track for that exact 90-second flow? If not, what specifically are we missing?"

> "Compare what you've built to docs/architecture.md §'File tree'. List every file you've created and every file from the spec you haven't created yet."

> "I have N minutes left until 9 PM code freeze. Refer to docs/PRD.md §7 cut list. What should we drop right now to lock the demo?"

## Submission checklist (8:55 PM)

1. ✅ Demo runs end-to-end at least twice without intervention
2. ✅ Local URL is reachable from another machine on the venue WiFi (test with phone hotspot)
3. ✅ `README.md` has: project name, one-line description, "Built with Cursor" section with screenshots, `npm run dev` instructions, env var template
4. ✅ Public repo on GitHub (push from terminal)
5. ✅ Submit on the hackathon site with: team name "Mikado" (or your handle), project name "Mikado", GitHub URL, demo URL (use ngrok or vercel deploy if needed), track "Money Movement", one-line description
6. ✅ Pitch slide ready (the closing slide can be a single Notion page or even just a final route in the Next.js app)
