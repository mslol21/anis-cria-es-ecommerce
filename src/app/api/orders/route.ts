import { NextResponse } from 'next/server';
import {
  getDbState,
  submitCustomerDesignDecision,
} from '@/lib/store/ecommerce-service';
import { ApiError, enforceRateLimit, handleApiError } from '@/lib/security/rate-limiter';
import { designApprovalDecisionSchema } from '@/lib/validators/schemas';

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    enforceRateLimit({
      keyPrefix: 'order_lookup',
      identifier: ip,
      maxRequests: 30,
      windowMs: 60_000,
    });

    const { searchParams } = new URL(request.url);
    const orderNumber = (searchParams.get('orderNumber') || '').trim().toUpperCase();
    const token = (searchParams.get('token') || '').trim();

    if (!orderNumber) {
      throw new ApiError(400, 'MISSING_ORDER_NUMBER', 'Informe o número do pedido.');
    }

    const db = getDbState();
    const order = db.orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === orderNumber &&
        (token && o.lookupToken === token)
    );

    if (!order) {
      throw new ApiError(
        404,
        'ORDER_NOT_FOUND',
        'Pedido não encontrado para os dados informados. Verifique o número do pedido e seu e-mail.'
      );
    }

    return NextResponse.json({ order }, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceRateLimit({ keyPrefix: 'design_approval', identifier: request.headers.get('x-forwarded-for') || 'local', maxRequests: 12, windowMs: 60_000 });
    const body = await request.json();
    const parsed = designApprovalDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message:
              parsed.error.issues[0]?.message || 'Dados inválidos para aprovação de arte.',
          },
        },
        { status: 400 }
      );
    }

    const result = submitCustomerDesignDecision(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
