// docs/architecture.md §Receipt schema + docs/backend.md schemas
// Single source of truth for shapes that cross the agent loop / API / UI boundary.
// Any drift here cascades into every other file — keep tight.

export type Currency = 'GBP' | 'USD' | 'EUR';

export type Invoice = {
  id: string;
  raw: string;
};

export type ExtractedFields = {
  supplier_name: string;
  amount: number;
  currency: Currency;
  due_date: string;
  invoice_number: string;
  line_items: unknown[];
};

export type PerFieldConfidence = {
  supplier_name: number;
  amount: number;
  currency: number;
  due_date: number;
  invoice_number: number;
};

export type ExtractResult = {
  fields: ExtractedFields;
  per_field_confidence: PerFieldConfidence;
  confidence: number;
};

export type RetrieveResult = {
  is_known: boolean;
  similarity_to_known: number;
  similar_known_supplier?: string;
  last_paid_amount?: number;
  last_paid_date?: string;
};

export type ScoreSignal = {
  score: number;
  weight: number;
  reason: string;
};

export type ScoreResult = {
  overall: number;
  breakdown: Record<string, ScoreSignal>;
};

export type DecisionAction = 'PAY' | 'REFUSE';

export type Decision = {
  action: DecisionAction;
  reason: string;
};

export type PhaseName = 'extract' | 'retrieve' | 'score' | 'decide';

export type PhaseTrace = {
  phase: PhaseName;
  started_at: string;
  ended_at: string;
  input: unknown;
  output: unknown;
  notes?: string;
};

export type Phases = {
  extract: PhaseTrace;
  retrieve: PhaseTrace;
  score: PhaseTrace;
  decide: PhaseTrace;
};

export type ReceiptBody = {
  id: string;
  timestamp: string;
  agent: {
    id: string;
    version_hash: string;
  };
  invoice: {
    raw_id: string;
    extracted: ExtractedFields;
  };
  phases: Phases;
  confidence: {
    overall: number;
    breakdown: Record<string, ScoreSignal>;
    threshold: number;
  };
  decision: Decision;
  hashes: {
    input_hash: string;
    receipt_hash: string;
  };
};

export type Signature = {
  algorithm: 'Ed25519';
  public_key: string;
  value: string;
};

export type Receipt = ReceiptBody & {
  signature: Signature;
};

export type SseEventName = 'phase' | 'receipt' | 'bank' | 'done' | 'error';

export type Supplier = {
  name: string;
  last_paid_amount: number;
  last_paid_date: string;
  // Common abbreviations / colloquial names the supplier is also known by.
  // retrieve.ts checks similarity against these so "AWS Bllling Department"
  // gets flagged as a lookalike of "Amazon Web Services" (alias: "AWS")
  // instead of a wholly-unknown supplier.
  aliases?: string[];
};
