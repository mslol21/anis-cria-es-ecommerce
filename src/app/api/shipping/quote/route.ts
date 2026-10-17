import { NextResponse } from 'next/server';
import {
  calculateAllDeliveryOptions,
} from '@/lib/store/ecommerce-service';
import { enforceRateLimit, handleApiError } from '@/lib/security/rate-limiter';
import { shippingQuoteRequestSchema } from '@/lib/validators/schemas';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    enforceRateLimit({
      keyPrefix: 'shipping_quote',
      identifier: ip,
      maxRequests: 30,
      windowMs: 60_000,
    });

    const body = await request.json();
    const parsed = shippingQuoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Dados inválidos para cotação de frete.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const result = await calculateAllDeliveryOptions(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
