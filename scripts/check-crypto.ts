// One-off invariant check per .cursor/rules/mikado.mdc §"The receipt is sacred":
//   1. signReceipt → verifyReceipt → true
//   2. signReceipt → tamper any byte → verifyReceipt → false
//   3. tamper signature byte → verifyReceipt → false
// Run with: npx tsx scripts/check-crypto.ts (or node --import tsx ...)

import { signReceipt, verifyReceipt } from '../lib/crypto/sign';
import { hashJson } from '../lib/crypto/hash';
import { getPublicKey } from '../lib/crypto/keys';
import type { Receipt, ReceiptBody } from '../lib/types';

const body: ReceiptBody = {
  id: 'test-receipt-1',
  timestamp: '2026-04-30T18:00:00.000Z',
  agent: { id: 'mikado-agent-v1', version_hash: 'sha256:test' },
  invoice: {
    raw_id: 'inv-001',
    extracted: {
      supplier_name: 'Slack Technologies',
      amount: 480.0,
      currency: 'GBP',
      due_date: '2026-05-15',
      invoice_number: 'INV-2026-0431',
      line_items: [],
    },
  },
  phases: {
    extract: {
      phase: 'extract',
      started_at: '2026-04-30T18:00:00.000Z',
      ended_at: '2026-04-30T18:00:01.000Z',
      input: { raw: 'INVOICE...' },
      output: { fields: {} },
    },
    retrieve: {
      phase: 'retrieve',
      started_at: '2026-04-30T18:00:01.000Z',
      ended_at: '2026-04-30T18:00:01.100Z',
      input: { supplier_name: 'Slack Technologies' },
      output: { is_known: true, similarity_to_known: 1 },
    },
    score: {
      phase: 'score',
      started_at: '2026-04-30T18:00:01.100Z',
      ended_at: '2026-04-30T18:00:01.110Z',
      input: {},
      output: { overall: 0.97 },
    },
    decide: {
      phase: 'decide',
      started_at: '2026-04-30T18:00:01.110Z',
      ended_at: '2026-04-30T18:00:01.120Z',
      input: { threshold: 0.95 },
      output: { action: 'PAY', reason: 'ok' },
    },
  },
  confidence: { overall: 0.97, breakdown: {}, threshold: 0.95 },
  decision: { action: 'PAY', reason: 'ok' },
  hashes: { input_hash: hashJson({ raw: 'INVOICE...' }), receipt_hash: '' },
};
body.hashes.receipt_hash = hashJson({
  ...body,
  hashes: { ...body.hashes, receipt_hash: '' },
});

const signature = signReceipt(body);
const receipt: Receipt = {
  ...body,
  signature: { algorithm: 'Ed25519', public_key: getPublicKey(), value: signature },
};

const ok = verifyReceipt(receipt);
console.log('1) sign → verify:', ok ? 'PASS' : 'FAIL');

// Tamper a body byte (flip a character in the supplier name)
const tampered: Receipt = JSON.parse(JSON.stringify(receipt));
tampered.invoice.extracted.supplier_name = 'Slack Technologie5';
const okTampered = verifyReceipt(tampered);
console.log('2) tamper body → verify:', okTampered ? 'FAIL' : 'PASS');

// Tamper the signature itself
const tamperedSig: Receipt = JSON.parse(JSON.stringify(receipt));
const sigBytes = Buffer.from(tamperedSig.signature.value, 'base64');
sigBytes[sigBytes.length - 1] ^= 0x01;
tamperedSig.signature.value = sigBytes.toString('base64');
const okSig = verifyReceipt(tamperedSig);
console.log('3) tamper signature → verify:', okSig ? 'FAIL' : 'PASS');

if (!ok || okTampered || okSig) {
  console.error('CRYPTO INVARIANTS BROKEN — stop and fix');
  process.exit(1);
}
console.log('All crypto invariants hold.');
