import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/security/rate-limiter';
import {
  createOrderAndInfinitePayCheckout,
  validateCouponForSubtotal,
} from '@/lib/store/ecommerce-service';
import { enforceRateLimit, handleApiError } from '@/lib/security/rate-limiter';
import { checkoutRequestSchema } from '@/lib/validators/schemas';

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      throw new ApiError(503, 'CHECKOUT_AWAITING_DATABASE_MIGRATION', 'Checkout desabilitado durante os testes de catálogo até migrar pedidos e estoque para PostgreSQL.');
    }
    const ip = request.headers.get('x-forwarded-for') || 'local';
    enforceRateLimit({
      keyPrefix: 'checkout_create',
      identifier: ip,
      maxRequests: 15,
      windowMs: 60_000,
    });

    const body = await request.json();
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message:
              parsed.error.issues[0]?.message ||
              'Verifique os campos obrigatórios do pedido.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;
    const result = await createOrderAndInfinitePayCheckout({
      ...parsed.data,
      appBaseUrl: origin,
    });

    return NextResponse.json(
      {
        orderNumber: result.order.orderNumber,
        lookupToken: result.order.lookupToken,
        orderId: result.order.id,
        totalCents: result.order.totalCents,
        productionDays: result.order.productionDays,
        estimatedShippingDays: result.order.estimatedShippingDays,
        pickupCode: result.order.pickupCode,
        checkoutUrl: result.checkoutUrl,
        orderNsu: result.payment.orderNsu,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    enforceRateLimit({
      keyPrefix: 'coupon_validate',
      identifier: ip,
      maxRequests: 25,
      windowMs: 60_000,
    });

    const body = (await request.json()) as { code?: string; subtotalCents?: number };
    const result = validateCouponForSubtotal(
      body.code || '',
      Number(body.subtotalCents || 0)
    );
    return NextResponse.json({
      coupon: result.coupon,
      discountCents: result.discountCents,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
