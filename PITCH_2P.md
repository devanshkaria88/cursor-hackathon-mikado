# Mikado — 2-person demo script (~2:30)

> Companion to `DEMO.md`. The 1-person pitch lives there. This is the staged
> version with two presenters: a **Pitcher** facing the audience, a **Driver**
> at the laptop.
>
> **Goal of this script: convince the business case, not show off the tech.**
> No model names. No phase names. No "Ed25519". No confidence-threshold
> numbers. We're selling time saved, money not lost, and a paper trail the
> CFO can read on Monday morning.

---

## Roles

- **A — Pitcher.** Faces the audience. Owns the story. Never touches the
  keyboard. Never looks at the screen while talking.
- **B — Driver.** At the laptop. Clicks, points, narrates what's happening
  live. Stands to the side of the laptop so they don't block the screen.

## Setup before walking on

- Fresh Chrome tab on `http://localhost:3000/` (the home page, **not**
  `/run`).
- Either a clean session (judges watch the agent run live, ~20 s of
  streaming) or do a dry-run beforehand — the cached state restores
  instantly when you open `/run`.
- Mac dock hidden, browser console closed, Grammarly disabled if possible.
- Sound off — there's no audio.

---

## The script

> **t = 0:00 — home page on screen**

**A** *(to audience):* "Every AP team in this room has a review queue.
Bill.com, Ramp, Brex — they autopay the easy invoices. Slack. AWS. The
utilities. Anything that matches a rule."

**B** *(still at home, gestures at screen):* "But every month, a chunk of
invoices fall through. New vendors. Unusual amounts. Lookalike domains."

**A:** "Those land in a human's inbox for review. And that queue is where
business email compromise wins. A tired AP clerk at 4pm rubber-stamps a
phishing invoice — and fourteen thousand pounds walks out the door, to a
Caribbean account, and your insurance doesn't cover it."

**B** *(reads tagline off the home page):* "Mikado is the agent for your AP
review queue."

> **t = 0:25 — B clicks "Run the agent" → `/run`**

**B** *(as the ledger fills row by row):* "Five invoices that would normally
sit in a human's inbox waiting for review. Watch Mikado work through them."

> **t = 0:30 – 0:50 — let the agent stream visibly. Don't fill the silence;
> let the table fill itself.**
>
> If the wait feels long, **A** says one line:
> *"Each row is the agent making a call: pay it, or refuse it."*

**A** *(once complete):* "Three paid. Two refused. The two it didn't pay are
exactly the two a human should still look at."

> **t = 1:00 — B hovers row 04 (AWS Bllling Department)**

**A:** "Look at row four."

**B** *(reads):* "AWS Bllling Department. Fourteen thousand five hundred
dollars. Urgent wire to a Caribbean account."

**A:** "Today, this lands in your AP clerk's inbox. They squint at the
misspelling. They're tired. The amount is plausible — AWS bills run high.
They approve it. The money is gone in three minutes, and you find out two
weeks later when your real AWS bill arrives."

> **t = 1:25 — B clicks `inspect →` on row 04 → receipt page opens**

**B** *(scrolls to Primary Concern):* "Mikado refused it. Here's why, in
one sentence."

**A** *(reads off the screen):* "*Lookalike of Amazon Web Services —
possible phishing.*"

> **t = 1:40 — B gestures across the four phase tiles**

**B:** "The agent shows its work, in plain English. It read the invoice.
It checked your supplier list — the real AWS isn't in there under that
name. It noticed the lookalike. It refused to pay."

**A:** "It didn't pay. It didn't escalate to a tired human at 4pm. It just
refused, and wrote down exactly what it saw and why."

> **t = 2:05 — B scrolls past the breakdown to the receipt footer**

**B** *(brief, doesn't dwell):* "Every decision is signed. Tamper-proof.
Your auditor can verify it months from now."

> **t = 2:15 — closer**

**A** *(turns fully to audience):* "Monday morning. Your CFO walks in.
*'Why didn't we pay AWS?'* You don't dig through Slack. You don't pull the
clerk out of a meeting. You open the receipt. The agent's reasoning is
right there — exactly what it saw, exactly what it decided, signed and
timestamped."

**B:** "Mikado pays the easy invoices in your queue. Refuses the dangerous
ones. And leaves a paper trail your CFO can read in thirty seconds."

**A:** "Faster decisions. Fewer payouts to fraudsters. And when the next
BEC attack lands in your AP inbox — it doesn't get paid."

> **t ≈ 2:30 — end**

---

## Practice notes

- **The 20-second streaming wait is the only awkward beat.** Either rehearse
  A's filler line, or pre-cache the run with `sessionStorage` so back-from-
  receipt loads instantly when you flip to `/run`. B clicks "↻ run again"
  only if you want it live.
- **Don't dwell on the signature footer.** It's a credibility marker, not
  the climax. The climax is "the agent caught the lookalike."
- **The handoff at 1:25** (B clicks into the receipt) is the highest-leverage
  moment. Practice it as a single fluid beat: B clicks → page loads → A
  reads the primary concern aloud. Don't talk over the page transition.
- **Speakers do not echo each other.** If A says "three paid, two refused",
  B doesn't repeat it.
- **A never looks at the screen while talking.** Stay engaged with the
  judges. B is the one who watches and points.
- **Use the AP clerk, not "the user".** Specific roles read more credible
  than abstractions.

---

## The business case in three numbers

If a judge wants the value-prop in one sentence, any of these work:

- **AP review costs hours.** A mid-size company has one AP person spending
  six to ten hours a week on manual invoice review. Mikado handles the
  routine ones; the human only opens the refusals.
- **BEC losses are real.** The FBI's IC3 report puts BEC losses at $2.9B in
  2023. Average loss per successful invoice scam: ~$50k. One blocked attack
  pays for the system many times over.
- **Audits are slow today.** When something goes wrong in AP, reconstructing
  what happened takes days of digging. Mikado makes every decision
  investigable in thirty seconds — open the receipt, read the reasoning.

---

## If a judge interrupts mid-demo

- *"How is this different from Bill.com?"* —
  **A:** "Bill.com autopays the easy ones. We handle what falls through.
  Complementary, not competitive. They sit on top of each other."

- *"Why not just escalate every flagged invoice to a human?"* —
  **A:** "Because the human queue **is** the bottleneck. Today, every
  flagged invoice waits for a clerk. Mikado clears the routine ones and
  saves the human's attention for the ones that actually need it."

- *"What stops the agent from being wrong?"* —
  **A:** "It's tuned to refuse before it pays. We'd rather false-refuse
  than false-pay — refusals get a quick human look; payments are
  irreversible. The cost asymmetry is the whole point."

- *"How do you handle disputes — what if a supplier insists they should
  have been paid?"* —
  **A:** "Open the receipt. The agent's reasoning is signed and
  timestamped. No 'he said, she said'. Either Mikado caught a real signal
  the supplier needs to address — or the supplier list needs updating, and
  the next invoice will go through."

- *"Is the signature important?"* —
  **B:** "It means a year later, your auditor can verify nobody changed
  the receipt after the fact. That's the difference between a Slack
  message and audit evidence."

- *"What about volume — what if I run a thousand invoices a day?"* —
  **A:** "The slow part of AP isn't the agent — it's the human review
  queue. The agent processes them in seconds. The bottleneck this removes
  scales with your team, not your invoice volume."

---

## Beat sheet (one-glance reference for under stage lights)

| t      | who    | what                                          |
| ------ | ------ | --------------------------------------------- |
| 0:00   | A      | "Every AP team has a review queue."           |
| 0:10   | B      | "Invoices fall through."                      |
| 0:15   | A      | BEC threat — phishing, £14k                   |
| 0:22   | B      | Reads tagline                                 |
| 0:25   | B      | **Click → /run**                              |
| 0:30   | B      | "Five invoices a human would have to review." |
| 0:30   | —      | *streaming wait, ~20 s*                       |
| 0:50   | A      | "Three paid, two refused — exactly the two."  |
| 1:00   | A      | "Look at row four."                           |
| 1:05   | B      | Reads AWS phishing row                        |
| 1:12   | A      | "Today this lands in your clerk's inbox..."   |
| 1:25   | B      | **Click inspect → receipt page**              |
| 1:30   | B / A  | Read Primary Concern out loud                 |
| 1:40   | B      | "It read it. Checked. Noticed. Refused."      |
| 1:55   | A      | "Didn't pay. Didn't escalate. Wrote it down." |
| 2:05   | B      | Receipt footer: "signed, tamper-proof"        |
| 2:15   | A      | CFO Monday-morning closer                     |
| 2:25   | B / A  | "Pays the easy. Refuses the dangerous."       |
| 2:30   | —      | END                                           |
