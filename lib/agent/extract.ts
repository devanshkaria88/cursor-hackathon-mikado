// docs/backend.md §Phase 1 — extract
// REAL Anthropic call. Structured tool-use to force a typed object back. The
// model is asked to also rate its own per-field confidence; we average those
// to get an extraction confidence (no logprobs available on Claude messages).
// Per .cursor/rules/mikado.mdc: never mock this call. Bound stochasticity
// here so score/decide downstream stay deterministic.

import Anthropic from '@anthropic-ai/sdk';
import type { ExtractResult, Invoice } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-opus-4-7';

const EXTRACT_TOOL = {
  name: 'submit_invoice_extraction',
  description: 'Submit the structured extraction of an invoice document.',
  input_schema: {
    type: 'object' as const,
    properties: {
      supplier_name: { type: 'string' },
      amount: {
        type: 'number',
        description:
          'Amount in major units (e.g. 1500.00 for £1,500.00). If the amount is unreadable due to OCR damage, take your best numeric guess and rate the field with low confidence.',
      },
      currency: { type: 'string', enum: ['GBP', 'USD', 'EUR'] },
      due_date: { type: 'string', description: 'ISO-8601 date' },
      invoice_number: { type: 'string' },
      line_items: { type: 'array', items: { type: 'object' } },
      per_field_confidence: {
        type: 'object',
        description:
          'Your honest confidence (0.0-1.0) for each extracted field. BE HONEST — drop confidence below 0.85 if a field looks OCR-damaged, ambiguous, or the supplier name looks like a lookalike of a well-known company.',
        properties: {
          supplier_name: { type: 'number' },
          amount: { type: 'number' },
          currency: { type: 'number' },
          due_date: { type: 'number' },
          invoice_number: { type: 'number' },
        },
        required: [
          'supplier_name',
          'amount',
          'currency',
          'due_date',
          'invoice_number',
        ],
      },
    },
    required: [
      'supplier_name',
      'amount',
      'currency',
      'due_date',
      'invoice_number',
      'line_items',
      'per_field_confidence',
    ],
  },
};

type ToolInput = {
  supplier_name: string;
  amount: number;
  currency: 'GBP' | 'USD' | 'EUR';
  due_date: string;
  invoice_number: string;
  line_items: unknown[];
  per_field_confidence: {
    supplier_name: number;
    amount: number;
    currency: number;
    due_date: number;
    invoice_number: number;
  };
};

export async function extract(invoice: Invoice): Promise<ExtractResult> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_invoice_extraction' },
    messages: [
      {
        role: 'user',
        content: `Extract the structured fields from this invoice. For each field, also report your confidence (0.0-1.0) — BE HONEST, especially for OCR-damaged amounts or unusual supplier names that look like lookalikes of well-known companies.

INVOICE:
${invoice.raw}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  if (!toolUse) throw new Error('Anthropic returned no tool_use block');

  const fields = toolUse.input as ToolInput;
  const pf = fields.per_field_confidence;
  const confidence =
    (pf.supplier_name +
      pf.amount +
      pf.currency +
      pf.due_date +
      pf.invoice_number) /
    5;

  return {
    fields: {
      supplier_name: fields.supplier_name,
      amount: fields.amount,
      currency: fields.currency,
      due_date: fields.due_date,
      invoice_number: fields.invoice_number,
      line_items: fields.line_items ?? [],
    },
    per_field_confidence: pf,
    confidence,
  };
}
