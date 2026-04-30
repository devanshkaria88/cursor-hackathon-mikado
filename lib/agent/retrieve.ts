// docs/backend.md §Phase 2 — retrieve
// Pure in-memory bigram-overlap similarity. No LLM, no API.
//
// Two-pass match:
//   1. Try canonical supplier names. If we exact-match (>0.99), it's known.
//   2. Otherwise also score aliases (e.g. "AWS" for Amazon Web Services).
//      An alias match — especially a high-similarity alias on text that
//      doesn't match the canonical name — is the *spicy* phishing signal:
//      the document claims to be from a known brand by referring to its
//      colloquial name, but doesn't actually match the registered supplier.

import { SUPPLIERS } from '@/data/suppliers';
import type { RetrieveResult } from '@/lib/types';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function similarity(a: string, b: string): number {
  const A = normalize(a);
  const B = normalize(b);
  if (A === B) return 1;
  const ba = bigrams(A);
  const bb = bigrams(B);
  if (ba.size === 0 || bb.size === 0) return 0;
  let intersect = 0;
  ba.forEach((x) => {
    if (bb.has(x)) intersect++;
  });
  return (2 * intersect) / (ba.size + bb.size);
}

// Token-level "contains" check: is any alias a token within the supplier
// name? Catches "AWS Bllling Department" → contains "AWS" → flags as a
// lookalike of Amazon Web Services even though the bigram similarity to
// the canonical name is low.
function containsAliasToken(supplierName: string, alias: string): boolean {
  const tokens = normalize(supplierName).split(/[^a-z0-9]+/).filter(Boolean);
  const aliasNorm = normalize(alias);
  return tokens.includes(aliasNorm);
}

export async function retrieve(supplierName: string): Promise<RetrieveResult> {
  let bestCanonical = {
    similar_known_supplier: '',
    similarity_to_known: 0,
    last_paid_amount: 0,
    last_paid_date: '',
  };

  for (const s of SUPPLIERS) {
    const sim = similarity(supplierName, s.name);
    if (sim > bestCanonical.similarity_to_known) {
      bestCanonical = {
        similar_known_supplier: s.name,
        similarity_to_known: sim,
        last_paid_amount: s.last_paid_amount,
        last_paid_date: s.last_paid_date,
      };
    }
  }

  // Exact canonical match: this is a known supplier, no further work.
  if (bestCanonical.similarity_to_known > 0.99) {
    return {
      is_known: true,
      similarity_to_known: bestCanonical.similarity_to_known,
      last_paid_amount: bestCanonical.last_paid_amount,
      last_paid_date: bestCanonical.last_paid_date,
    };
  }

  // Not a clean canonical match. Look for alias hits — especially the
  // "contains alias as a token" case which is the phishing pattern.
  let bestViaAlias = bestCanonical;
  for (const s of SUPPLIERS) {
    for (const alias of s.aliases ?? []) {
      const aliasSim = similarity(supplierName, alias);
      if (containsAliasToken(supplierName, alias)) {
        // Strong signal: the doc *contains* the alias as a token but isn't
        // an exact canonical match — score it 0.85 to land in the phishing
        // band (>0.6, <0.99).
        const score = Math.max(0.85, aliasSim);
        if (score > bestViaAlias.similarity_to_known) {
          bestViaAlias = {
            similar_known_supplier: s.name,
            similarity_to_known: score,
            last_paid_amount: s.last_paid_amount,
            last_paid_date: s.last_paid_date,
          };
        }
      } else if (aliasSim > bestViaAlias.similarity_to_known) {
        bestViaAlias = {
          similar_known_supplier: s.name,
          similarity_to_known: aliasSim,
          last_paid_amount: s.last_paid_amount,
          last_paid_date: s.last_paid_date,
        };
      }
    }
  }

  return {
    is_known: false,
    similarity_to_known: bestViaAlias.similarity_to_known,
    similar_known_supplier: bestViaAlias.similar_known_supplier || undefined,
  };
}
