# Mikado — Frontend

Full retro CRT aesthetic. Single Next.js App Router app. Three pages. Sprite-driven.

## Aesthetic constraints (the design system, locked)

- **Palette**
  - `--bg`: `#0a0e0a` (near-black, slight green tint)
  - `--fg`: `#9be39b` (terminal green)
  - `--fg-bright`: `#d4ffd4` (highlight)
  - `--fg-dim`: `#4a7a4a`
  - `--accent-good`: `#5cff5c` (PAID, verified)
  - `--accent-bad`: `#ff5c5c` (REFUSED, tampered)
  - `--accent-warn`: `#ffcc5c` (low confidence)
  - `--cursor-bg`: `#1e1e1e` (used only on the debugger page)
  - `--cursor-fg`: `#d4d4d4`
  - `--cursor-accent`: `#569cd6`

- **Typography**
  - Headers / branding: `"Press Start 2P"` (Google Fonts; only weight 400)
  - Body / data: `"JetBrains Mono"` (Google Fonts; weights 400, 700)
  - Never mix more than these two fonts.

- **Borders & boxes**
  - Pixel borders implemented with `box-shadow` step pattern, not `border-radius`. Example: `box-shadow: 4px 0 0 #9be39b, -4px 0 0 #9be39b, 0 4px 0 #9be39b, 0 -4px 0 #9be39b;`
  - All corners are square. No rounded corners except inside the Cursor-debug view.
  - Use double-line ASCII borders (╔╗╚╝═║) in headers where appropriate.

- **Image rendering**
  - All sprite images: `image-rendering: pixelated; image-rendering: crisp-edges;`
  - All sprites scaled by integer multiples only (1x, 2x, 4x).

- **Effects (CRT)**
  - Subtle scanlines via a `::after` overlay with `repeating-linear-gradient`. Opacity ≤ 0.08. Easy to disable for projector readability.
  - Slight green glow on text via `text-shadow: 0 0 4px var(--fg);` — sparingly, only on big headers.
  - **Optional, drop if behind:** chromatic aberration via duplicated text layers.

- **Animation**
  - Use stepwise frame-by-frame, not eased CSS transitions. Tower shake = `keyframes` with `animation-timing-function: steps(4)`.
  - Typewriter effect on initial page load — characters appear one at a time, ~30ms each.

## Page 1 — `/` (home)

```
╔══════════════════════════════════════════════════════════════╗
║  M I K A D O                                                 ║
║  THE DECISION TRAIL FOR AGENTIC PAYMENTS                     ║
╚══════════════════════════════════════════════════════════════╝

         ┃ ┃   ┃    ┃   ┃ ┃
         ┃ ┃ ┃ ┃   ┃┃ ┃ ┃ ┃    [ASCII or PNG sprite of stack]
        ━━━━━━━━━━━━━━━━━━━━

  > pull a stick. if the tower falls, the agent doesn't pay.

  ┌──────────────────────┐
  │   ▶  RUN AGENT       │
  └──────────────────────┘

  v0.1 · ed25519-signed receipts · eu ai act ready
```

- The tower is a sprite (`/sprites/tower-stable.png`) at 4x scale, centred
- The "RUN AGENT" button uses the pixel-border style; on hover, inverts colours; on click, animates to a "▷ ▷ ▷" frame and navigates to `/run`
- Marquee-style tagline at bottom uses CSS `scroll` keyframes

## Page 2 — `/run` (the live runner — the demo's main screen)

Layout: left column (60%) is the invoice queue + agent state, right column (40%) is the bank panel + receipt drawer.

```
╔════════════════════════════════════════╗  ╔══════════════════════════╗
║  AGENT QUEUE                           ║  ║  ACME LTD · OPERATING    ║
║                                        ║  ║                          ║
║  [INVOICE 001] [paid    ] [conf 0.97]  ║  ║       £ 95,108.00        ║
║  [INVOICE 002] [paid    ] [conf 0.96]  ║  ║                          ║
║  [INVOICE 003] [REFUSED ] [conf 0.71]  ║  ║       ↓ paid out         ║
║  [INVOICE 004] [REFUSED ] [conf 0.61]  ║  ║       £  4,892           ║
║  [INVOICE 005] [paid    ] [conf 0.96]  ║  ║                          ║
║                                        ║  ╚══════════════════════════╝
║      [PIXEL TOWER SPRITE — STATE]      ║
║      (stable / shaking / fallen)       ║  ╔══════════════════════════╗
║                                        ║  ║  RECEIPT DRAWER          ║
║                                        ║  ║                          ║
║                                        ║  ║  > inv-001 · paid        ║
║                                        ║  ║  > inv-002 · paid        ║
║                                        ║  ║  > inv-003 · REFUSED ◀   ║
║                                        ║  ║    └─ click to inspect   ║
╚════════════════════════════════════════╝  ╚══════════════════════════╝
```

### Components

**`<InvoiceQueue>`** — vertical stack of `<InvoiceCard>`s. Each card has:
- Status badge (`PENDING` → `EXTRACTING` → `RETRIEVING` → `SCORING` → `DECIDING` → `PAID` / `REFUSED`)
- A pixel "stick" sprite, colour:
  - grey while pending
  - yellow while processing
  - green if PAID
  - red if REFUSED
- Confidence number ticking up as it's computed (animated counter)
- On REFUSED: a slight horizontal shake animation (steps(4))

**`<MikadoTower>`** — central sprite that reflects aggregate run state:
- `stable` — all paid so far OR queue not started
- `shaking` — currently processing OR a refusal just happened
- `fallen` — three or more refusals in a row (won't happen in seeded demo, but cool if it triggers)

**`<BankPanel>`** — top right. Big seven-segment-style font for the balance. Animated decrement when a payment lands. Below the balance, a "↓ paid out £X" stamp that fades after 2s.

**`<ReceiptDrawer>`** — bottom right. List of receipts as they arrive via SSE. Click any → navigate to `/receipt/[id]`.

### Data flow

```typescript
// app/run/page.tsx (sketch)
'use client';
import { useEffect, useState } from 'react';
import type { Receipt, PhaseTrace } from '@/lib/types';

export default function RunPage() {
  const [phaseByInvoice, setPhaseByInvoice] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [bankBalance, setBankBalance] = useState(100_000);
  const [running, setRunning] = useState(false);

  const start = async () => {
    setRunning(true);
    const res = await fetch('/api/run', { method: 'POST' });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const ev of events) handleEvent(ev);
    }
    setRunning(false);
  };

  const handleEvent = (raw: string) => {
    const lines = raw.split('\n');
    const eventLine = lines.find(l => l.startsWith('event: '));
    const dataLine = lines.find(l => l.startsWith('data: '));
    if (!eventLine || !dataLine) return;
    const event = eventLine.slice(7);
    const data = JSON.parse(dataLine.slice(6));
    if (event === 'phase') {
      setPhaseByInvoice(p => ({ ...p, [data.invoiceId]: data.phase }));
    } else if (event === 'receipt') {
      setReceipts(rs => [...rs, data.receipt]);
    } else if (event === 'bank') {
      setBankBalance(data.balance);
    }
  };

  useEffect(() => { start(); }, []); // auto-start when page loads

  return (
    <div className="grid grid-cols-[60%_40%] gap-4 p-6">
      {/* left: queue + tower */}
      <section>...</section>
      {/* right: bank + drawer */}
      <aside>...</aside>
    </div>
  );
}
```

## Page 3 — `/receipt/[id]` (the Cursor-debug view — the differentiator)

This page intentionally **breaks the retro aesthetic**. The transition from `/run` to `/receipt` is a "zoom into the decision" — we leave the game UI and enter Cursor's world. This is on purpose: it's the moment the judge realises Mikado treats decisions like *code* you can debug.

```
┌─ MIKADO :: receipt/INV-003 ─────────────────────────────┐  ┌── receipt.json ──────────┐
│                                                         │  │ {                        │
│  ▼ PHASES                                               │  │   "id": "rcpt-9b2...",   │
│                                                         │  │   "timestamp": "...",    │
│  ▶ extract        ●  conf 0.62                          │  │   "agent": {             │
│  ▶ retrieve       ●  unknown supplier                   │  │     "id": "mikado-a..."  │
│  ▶ score          ●  overall 0.71                       │  │   },                     │
│  ▶ decide         ✗  REFUSE                             │  │   ...                    │
│                                                         │  │   "decision": {          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │  │     "action": "REFUSE",  │
│                                                         │  │     "reason": "..."      │
│  selected: score                                        │  │   },                     │
│  ┌──────────────────────────────────────────┐           │  │   "signature": {         │
│  │ extraction       0.62  ×  0.40  = 0.248  │           │  │     "algorithm": "Ed..."│
│  │ supplier_match   0.40  ×  0.30  = 0.120  │           │  │     "value": "MEU..."    │
│  │ amount_plaus.    1.00  ×  0.20  = 0.200  │           │  │   }                      │
│  │ phishing_signal  1.00  ×  0.10  = 0.100  │           │  │ }                        │
│  │ ─────────────────────────────────  0.668 │           │  └──────────────────────────┘
│  └──────────────────────────────────────────┘           │
│                                                         │  ┌── VERIFY ────────────────┐
│  threshold: 0.95   →   REFUSE                           │  │  [✓ valid signature]     │
│                                                         │  │   alg ed25519 · 64B sig  │
│                                                         │  │   [▷ tamper a byte]      │
│                                                         │  └──────────────────────────┘
└─────────────────────────────────────────────────────────┘
```

### Components

**`<DebuggerLayout>`** — split pane, dark Cursor-like theme, monospace, line numbers on the JSON pane.

**`<PhaseStepper>`** — left pane. Vertical list of phases. Click any → highlights that phase's data in the JSON pane (scroll/highlight) AND populates the bottom-left "selected" detail view.

**`<JsonViewer>`** — right pane. Renders the receipt JSON with syntax highlighting (use a dead-simple regex highlighter, no need for a heavy library). Each top-level key is foldable. The phase selected in the stepper auto-scrolls into view and gets a subtle yellow flash.

**`<VerifyButton>`** — bottom right. Two states:
- Default → shows green check, "valid signature, ed25519, 64-byte"
- After click "▷ tamper a byte" → flips a random character in the JSON, calls `/api/verify`, returns red, "TAMPERED."
- Reset button restores the original.

### Implementing tamper-detect cleanly

The simplest version that demos perfectly:

```typescript
const [tampered, setTampered] = useState(false);
const tamper = () => {
  const blob = JSON.parse(JSON.stringify(receipt));
  // flip the last byte of the signature
  const sigBytes = Buffer.from(blob.signature.value, 'base64');
  sigBytes[sigBytes.length - 1] ^= 0x01;
  blob.signature.value = sigBytes.toString('base64');
  fetch('/api/verify', { method: 'POST', body: JSON.stringify({ receipt: blob }) })
    .then(r => r.json())
    .then(({ valid }) => setTampered(!valid));
};
```

If you want the dragging-bytes version, do it as a fancy text input where editing any character live-recomputes the verify. It's beautiful but takes 30+ extra minutes.

## Sprite list (the assets to generate / source)

Generate these *before* the build starts if possible (tonight). Use any of: pixilart.com, aseprite, AI generators (DALL-E, Midjourney, Recraft), or hand-pixel them.

| File | Size | Description |
|---|---|---|
| `tower-stable.png` | 64×64 | Pixel-art bundle of vertical mikado sticks, neat, cylindrical pile |
| `tower-shaking.png` | 64×64 | Same tower with sticks slightly askew, motion lines |
| `tower-fallen.png` | 64×64 | Sticks scattered horizontally on the ground |
| `stick-grey.png` | 8×32 | A single mikado stick, dim grey, vertical |
| `stick-yellow.png` | 8×32 | Same, mustard yellow (processing) |
| `stick-green.png` | 8×32 | Same, lime green (paid) |
| `stick-red.png` | 8×32 | Same, blood red, slightly bent (refused) |
| `invoice-card.png` | 96×64 | A pixel-art document with a fold corner, lines for text |
| `bank-vault.png` | 48×48 | A pixel vault door, used in the bank panel header |
| `cursor-icon.png` | 16×16 | A pixel cursor (the IDE) icon for the debug page header |
| `seal-paid.png` | 32×32 | A pixel "PAID" stamp, green, slightly tilted |
| `seal-refused.png` | 32×32 | A pixel "REFUSED" stamp, red, slightly tilted |

See `sprites/sprite_prompts.md` for AI generation prompts for each.

## CSS skeleton (`app/globals.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Press+Start+2P&display=swap');

:root {
  --bg: #0a0e0a;
  --fg: #9be39b;
  --fg-bright: #d4ffd4;
  --fg-dim: #4a7a4a;
  --accent-good: #5cff5c;
  --accent-bad: #ff5c5c;
  --accent-warn: #ffcc5c;
}

html, body {
  background: var(--bg);
  color: var(--fg);
  font-family: 'JetBrains Mono', monospace;
  margin: 0;
  min-height: 100vh;
}

h1, h2, .pixel { font-family: 'Press Start 2P', monospace; }

img.sprite { image-rendering: pixelated; image-rendering: crisp-edges; }

.crt::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 2px,
    rgba(0,0,0,0.18) 2px,
    rgba(0,0,0,0.18) 3px
  );
  z-index: 999;
}

.pixel-border {
  box-shadow:
    -4px 0 0 var(--fg), 4px 0 0 var(--fg),
    0 -4px 0 var(--fg), 0 4px 0 var(--fg),
    -4px -4px 0 var(--fg), 4px -4px 0 var(--fg),
    -4px 4px 0 var(--fg), 4px 4px 0 var(--fg);
}

@keyframes shake-step {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-2px); }
  50%      { transform: translateX(2px); }
  75%      { transform: translateX(-1px); }
}
.shake { animation: shake-step 0.25s steps(4) infinite; }
```

## Performance / projector readability

- Test at 1920×1080 first, then sanity-check at 1280×720
- The CRT scanline overlay must be toggleable: `?crt=off` query param disables it
- Minimum text size on critical info (confidence numbers, decision label, balance): 24px
- Avoid pure `#000` background — black on projector reads as "off" and shows dust. The slight green tint matters.

## Cut order for frontend (if behind)

1. CRT scanline overlay → drop
2. Tower fall animation → use static `tower-fallen.png` swap instead
3. Stick colour transitions → simple instant colour swap, no animation
4. Animated balance counter → just snap to new value
5. Marquee tagline → static text
6. Tamper drag-byte UI → keep the click-to-tamper version only

Never drop:
- The split-pane Cursor-debug view (THE differentiator)
- The receipt JSON viewer
- The signed verify checkmark
- The 5-card invoice queue
- The retro home screen
