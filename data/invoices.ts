// docs/backend.md §Seeded data + docs/PRD.md §5 (the locked demo path)
// The 5 demo invoices, hand-crafted so the agent loop produces exactly:
//   inv-001 PAY (clean recurring small)
//   inv-002 PAY (clean recurring larger but <2x last paid)
//   inv-003 REFUSE (ambiguous OCR — Apex Cl0ud Service5, mangled amount)
//   inv-004 REFUSE (phishing lookalike — "AWS Bllling")
//   inv-005 PAY (clean recurring)
// DO NOT randomise. The demo's punchlines depend on these exact ids and shapes.

import type { Invoice } from '@/lib/types';

export const INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    raw: `INVOICE #INV-2026-0431
From: Slack Technologies
Bill to: Acme Ltd
Amount: £480.00 GBP
Due: 2026-05-15
Item: Slack Business+ subscription April 2026`,
  },
  {
    id: 'inv-002',
    raw: `INVOICE #AWS-44872193
Amazon Web Services
Bill to: Acme Ltd
Amount due: $4,892.00 USD
Due date: 2026-05-10
Charges: EC2, S3, CloudFront — April`,
  },
  {
    id: 'inv-003',
    raw: `INVO!CE 2026/0413
Vendor: Apex Cl0ud Service5
Amount: £l8,4O0.00 — DUE IMMEDIATELY!
Account: 12-34-56 / 87654321
[OCR scan quality: poor]`,
  },
  {
    id: 'inv-004',
    raw: `INVOICE #AWS-99921
From: AWS Bllling Department  <billing@awscloud-secure.com>
Bill to: Acme Ltd
Amount: $14,500.00 — URGENT
Wire to: First Trust Caribbean / 0099-22-1`,
  },
  {
    id: 'inv-005',
    raw: `INVOICE #LIN-3344
Linear Software Inc
Acme Ltd — Linear Workspace
Amount: £200.00 GBP
Period: April 2026
Due: 2026-05-20`,
  },
];
