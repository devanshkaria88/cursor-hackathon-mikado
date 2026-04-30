// docs/backend.md §POST /api/run
// SSE endpoint: triggers the agent loop over the seeded queue, streams a
// `phase` event after each of the 4 phases per invoice, then a `receipt`
// event with the full signed receipt and a `bank` event with the new balance.
// Uses Node runtime (need node:crypto + Anthropic SDK).

import { NextRequest } from 'next/server';
import { runAgent } from '@/lib/agent/runAgent';
import { INVOICES } from '@/data/invoices';
import { bank } from '@/lib/mock/bank';
import { receipts } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  // Reset for a clean demo run every time the button is pressed.
  bank.reset();
  receipts.clear();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      try {
        send('bank', { balance: bank.balance });

        for (const invoice of INVOICES) {
          send('invoice_start', { invoiceId: invoice.id });

          await runAgent(invoice, {
            onPhase: (invoiceId, trace) =>
              send('phase', { invoiceId, phase: trace.phase, trace }),
            onReceipt: (receipt) => {
              send('receipt', { receipt });
              send('bank', { balance: bank.balance });
            },
          });

          // Demo pacing — gives the UI a beat to animate between invoices.
          await new Promise((r) => setTimeout(r, 350));
        }

        send('done', { completed: INVOICES.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[mikado] run failed:', err);
        send('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
