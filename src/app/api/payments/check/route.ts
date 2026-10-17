import { NextResponse } from 'next/server';
import {
  reconcilePendingPaymentWithProvider,
  retryOrderPaymentLink,
} from '@/lib/store/ecommerce-service';
import { enforceRateLimit, handleApiError } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    enforceRateLimit({
      keyPrefix: 'payment_check',
      identifier: ip,
      maxRequests: 30,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      action?: 'reconcile' | 'retry';
      orderNsu?: string;
      orderNumber?: string;
      transactionNsu?: string;
      slug?: string;
    };

    if (body.action === 'retry') {
      const origin = new URL(request.url).origin;
      const retryRes = await retryOrderPaymentLink(
        body.orderNumber || body.orderNsu || '',
        origin
      );
      return NextResponse.json({
        orderNumber: retryRes.order.orderNumber,
        checkoutUrl: retryRes.checkoutUrl,
        financialStatus: retryRes.order.financialStatus,
      });
    }

    const result = await reconcilePendingPaymentWithProvider({
      orderNsu: body.orderNsu || body.orderNumber || '',
      transactionNsu: body.transactionNsu,
      slug: body.slug,
    });

    return NextResponse.json({
      reconciled: result.reconciled,
      paid: result.paid,
      orderNumber: result.order.orderNumber,
      financialStatus: result.order.financialStatus,
      operationalStatus: result.order.operationalStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
