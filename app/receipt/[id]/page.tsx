// docs/architecture.md §Page structure + docs/frontend.md §Page 3
// Server component fetches the receipt. Falls back to disk because Next.js
// server components and route handlers can land in separate module instances
// in dev — the in-memory Map can't be the only source of truth.

import { notFound } from 'next/navigation';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { receipts } from '@/lib/store';
import type { Receipt } from '@/lib/types';
import DecisionReceipt from './DecisionReceipt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function loadReceipt(id: string): Receipt | undefined {
  const fromMem = receipts.get(id);
  if (fromMem) return fromMem;
  const diskPath = join(process.cwd(), 'receipts', `${id}.json`);
  if (!existsSync(diskPath)) return undefined;
  try {
    return JSON.parse(readFileSync(diskPath, 'utf8')) as Receipt;
  } catch {
    return undefined;
  }
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = loadReceipt(id);
  if (!receipt) notFound();
  return <DecisionReceipt receipt={receipt} />;
}
