// docs/backend.md §Phase 4 — decide
// Pure threshold check. The product's whole human-out-of-the-loop pitch lives
// in this function: when overall confidence falls below the configured floor,
// the agent doesn't act — it produces a signed REFUSE receipt instead.

import type { Decision, ScoreResult } from '@/lib/types';

export function decide(s: ScoreResult, threshold: number): Decision {
  if (s.overall >= threshold) {
    return {
      action: 'PAY',
      reason: `Confidence ${s.overall.toFixed(2)} >= threshold ${threshold.toFixed(2)}`,
    };
  }

  // Headline reason = the breakdown signal contributing the lowest weighted
  // score. Lets the debugger UI surface "the one thing that killed the deal".
  const lowest = Object.entries(s.breakdown).sort(
    (a, b) => a[1].score * a[1].weight - b[1].score * b[1].weight,
  )[0];

  return {
    action: 'REFUSE',
    reason: `Confidence ${s.overall.toFixed(2)} < threshold ${threshold.toFixed(2)}. Primary concern: ${lowest[1].reason}`,
  };
}
