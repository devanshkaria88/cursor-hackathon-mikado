// docs/backend.md §Crypto module — hash.ts
// Canonical JSON hashing. Sort keys recursively so that {a,b} and {b,a}
// hash identically — without this, signatures wouldn't round-trip.

import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => [k, canonicalize(v)] as const);
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = v;
  return out;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function hashJson(value: unknown): string {
  const canonical = canonicalJson(value);
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}
