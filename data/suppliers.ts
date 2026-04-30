// docs/backend.md §Seeded data
// Hand-crafted supplier registry. The names that appear in the demo invoices
// (Slack Technologies, Amazon Web Services, Linear Software Inc) MUST be
// present and exactly spelled to make Phase 2 retrieve.is_known === true.
// Adding ~15 more for realism in the JSON viewer.

import type { Supplier } from '@/lib/types';

export const SUPPLIERS: Supplier[] = [
  { name: 'Amazon Web Services', last_paid_amount: 4892.0, last_paid_date: '2026-03-30', aliases: ['AWS', 'AWS Billing', 'Amazon AWS'] },
  { name: 'WeWork London Bridge', last_paid_amount: 1850.0, last_paid_date: '2026-04-01' },
  { name: 'Slack Technologies', last_paid_amount: 480.0, last_paid_date: '2026-04-12' },
  { name: 'Linear Software Inc', last_paid_amount: 200.0, last_paid_date: '2026-04-08' },
  { name: 'Stripe Atlas', last_paid_amount: 500.0, last_paid_date: '2026-01-15' },
  { name: 'Vercel Inc', last_paid_amount: 240.0, last_paid_date: '2026-04-05' },
  { name: 'GitHub Enterprise', last_paid_amount: 840.0, last_paid_date: '2026-04-02' },
  { name: 'Figma Inc', last_paid_amount: 180.0, last_paid_date: '2026-04-10' },
  { name: 'Notion Labs', last_paid_amount: 96.0, last_paid_date: '2026-04-11' },
  { name: 'Anthropic PBC', last_paid_amount: 1200.0, last_paid_date: '2026-04-14' },
  { name: 'OpenAI LLC', last_paid_amount: 2400.0, last_paid_date: '2026-04-09' },
  { name: 'Cloudflare', last_paid_amount: 320.0, last_paid_date: '2026-03-28' },
  { name: 'Datadog Inc', last_paid_amount: 1100.0, last_paid_date: '2026-04-07' },
  { name: 'Sentry', last_paid_amount: 290.0, last_paid_date: '2026-04-06' },
  { name: 'Mercury Bank', last_paid_amount: 35.0, last_paid_date: '2026-04-01' },
  { name: 'Brex Cards', last_paid_amount: 0.0, last_paid_date: '2026-03-15' },
  { name: 'British Gas Business', last_paid_amount: 412.0, last_paid_date: '2026-03-20' },
  { name: 'BT Business', last_paid_amount: 89.0, last_paid_date: '2026-03-22' },
  { name: 'Hiscox Insurance', last_paid_amount: 2200.0, last_paid_date: '2026-02-15' },
  { name: 'Companies House', last_paid_amount: 13.0, last_paid_date: '2026-03-05' },
];
