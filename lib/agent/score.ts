// docs/backend.md §Phase 3 — score + .cursor/rules/mikado.mdc §"agent loop is sacred"
// PURE. NO RANDOMNESS. NO LLM. Weighted sum of four signals; output is the
// Decision Receipt's confidence. Determinism here is the whole pitch — the
// signature is only meaningful if the score function is reproducible by an
// auditor with the same inputs.

import type { ExtractResult, RetrieveResult, ScoreResult } from '@/lib/types';

export function score(
  ex: ExtractResult,
  rt: RetrieveResult,
): ScoreResult {
  const breakdown: ScoreResult['breakdown'] = {};

  breakdown.extraction = {
    score: ex.confidence,
    weight: 0.4,
    reason: `Average per-field extraction confidence: ${ex.confidence.toFixed(2)}`,
  };

  breakdown.supplier_match = {
    score: rt.is_known ? 1.0 : Math.max(0, rt.similarity_to_known - 0.3),
    weight: 0.3,
    reason: rt.is_known
      ? 'Supplier matches known registry'
      : `Supplier not in registry${
          rt.similar_known_supplier
            ? ` (closest: "${rt.similar_known_supplier}", sim ${rt.similarity_to_known.toFixed(2)})`
            : ''
        }`,
  };

  let amountScore = 1.0;
  let amountReason = 'Amount within expected range';
  if (rt.is_known && rt.last_paid_amount) {
    const ratio = ex.fields.amount / rt.last_paid_amount;
    if (ratio > 2.5) {
      amountScore = 0.4;
      amountReason = `Amount ${ex.fields.amount} is ${ratio.toFixed(1)}x last paid (${rt.last_paid_amount})`;
    } else if (ratio > 1.5) {
      amountScore = 0.7;
      amountReason = `Amount ${ex.fields.amount} is ${ratio.toFixed(1)}x last paid (${rt.last_paid_amount})`;
    }
  }
  breakdown.amount_plausibility = {
    score: amountScore,
    weight: 0.2,
    reason: amountReason,
  };

  // Phishing: high similarity but NOT exact match is the spicy pattern.
  // "AWS Bllling" sits ~0.75 against "Amazon Web Services"-style names — close
  // enough to look legitimate, not close enough to be the actual supplier.
  let phishingScore = 1.0;
  let phishingReason = 'No phishing pattern detected';
  if (
    !rt.is_known &&
    rt.similarity_to_known > 0.6 &&
    rt.similarity_to_known < 0.99
  ) {
    phishingScore = 0.2;
    phishingReason = `Lookalike of "${rt.similar_known_supplier}" — possible phishing (sim ${rt.similarity_to_known.toFixed(2)})`;
  }
  breakdown.phishing_signal = {
    score: phishingScore,
    weight: 0.1,
    reason: phishingReason,
  };

  const overall =
    breakdown.extraction.score * breakdown.extraction.weight +
    breakdown.supplier_match.score * breakdown.supplier_match.weight +
    breakdown.amount_plausibility.score * breakdown.amount_plausibility.weight +
    breakdown.phishing_signal.score * breakdown.phishing_signal.weight;

  return { overall, breakdown };
}
