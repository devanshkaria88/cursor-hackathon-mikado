// docs/architecture.md §Cryptographic signing + docs/backend.md §Crypto module
// Ed25519 sign + verify. Uses canonicalJson so the signature is stable across
// any property reordering by JSON.stringify (it isn't deterministic in JS).

import {
  sign as ed25519Sign,
  verify as ed25519Verify,
  createPublicKey,
} from 'node:crypto';
import { getPrivateKey } from '@/lib/crypto/keys';
import { canonicalJson } from '@/lib/crypto/hash';
import type { Receipt, ReceiptBody } from '@/lib/types';

export function signReceipt(body: ReceiptBody): string {
  const canonical = canonicalJson(body);
  const sig = ed25519Sign(null, Buffer.from(canonical), getPrivateKey());
  return sig.toString('base64');
}

export function verifyReceipt(receipt: Receipt): boolean {
  const { signature, ...body } = receipt;
  const canonical = canonicalJson(body);
  try {
    const pub = createPublicKey(signature.public_key);
    return ed25519Verify(
      null,
      Buffer.from(canonical),
      pub,
      Buffer.from(signature.value, 'base64'),
    );
  } catch {
    return false;
  }
}
