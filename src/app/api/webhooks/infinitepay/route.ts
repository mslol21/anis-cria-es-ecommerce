import { NextResponse } from 'next/server';
import { reconcilePendingPaymentWithProvider } from '@/lib/store/ecommerce-service';
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

    // Treat webhook as an untrusted signal. Only the provider's server-to-server
    // payment_check may authorize a paid transition.
    const result = await reconcilePendingPaymentWithProvider({
      orderNsu: parsed.data.order_nsu,
      transactionNsu: parsed.data.transaction_nsu,
      slug: parsed.data.invoice_slug || parsed.data.slug,
    });
    return NextResponse.json({
      received: true,
      paid: result.paid,
      orderNumber: result.order.orderNumber,
      financialStatus: result.order.financialStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
