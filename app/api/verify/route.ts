// docs/backend.md §POST /api/verify
// Verifies an Ed25519 receipt signature. Caller posts the full Receipt blob;
// we recompute the canonical body and ed25519Verify against the embedded
// public key. Powers the green-check / red-tampered demo on /receipt/[id].

import { verifyReceipt } from '@/lib/crypto/sign';
import type { Receipt } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { receipt?: Receipt };
    if (!body?.receipt) {
      return Response.json(
        { valid: false, reason: 'No receipt in body' },
        { status: 400 },
      );
    }
    const valid = verifyReceipt(body.receipt);
    return Response.json({
      valid,
      reason: valid
        ? 'Signature matches canonical receipt body'
        : 'Signature does not match — receipt has been tampered with',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ valid: false, reason: message }, { status: 400 });
  }
}
