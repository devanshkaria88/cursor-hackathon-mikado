// docs/architecture.md §State management (server-side)
// In-memory receipts store. Module-level singleton. Insertion order preserved
// by Map so the receipt list reads in chronological order in the UI.

import type { Receipt } from '@/lib/types';

export const receipts = new Map<string, Receipt>();
