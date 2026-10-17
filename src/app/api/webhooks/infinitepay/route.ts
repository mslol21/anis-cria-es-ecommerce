import { NextResponse } from 'next/server';
import { confirmOrderPaymentIdempotent } from '@/lib/store/ecommerce-service';
import { enforceRateLimit, handleApiError } from '@/lib/security/rate-limiter';
import { infinitePayWebhookSchema } from '@/lib/validators/schemas';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'infinitepay';
    enforceRateLimit({
      keyPrefix: 'webhook_infinitepay',
      identifier: ip,
      maxRequests: 120,
      windowMs: 60_000,
    });

    const rawBody = (await request.json()) as Record<string, unknown>;
    const parsed = infinitePayWebhookSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_WEBHOOK_PAYLOAD',
            message: 'Payload de webhook InfinitePay inválido.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const {
      order_nsu,
      transaction_nsu,
      invoice_slug,
      slug,
      paid_amount,
      capture_method,
      receipt_url,
    } = parsed.data;

    const result = confirmOrderPaymentIdempotent({
      orderNsu: order_nsu,
      transactionNsu: transaction_nsu,
      invoiceSlug: invoice_slug || slug || null,
      paidAmountCents: paid_amount,
      captureMethod: capture_method,
      receiptUrl: receipt_url || null,
      rawPayload: rawBody,
      idempotencyKey: `webhook:${order_nsu}:${transaction_nsu}`,
    });

    return NextResponse.json({
      received: true,
      alreadyProcessed: result.alreadyProcessed,
      orderNumber: result.order.orderNumber,
      financialStatus: result.order.financialStatus,
      operationalStatus: result.order.operationalStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
