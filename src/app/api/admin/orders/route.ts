import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  cancelOrRefundOrder,
  getDbState,
  saveDbState,
  uploadDesignPreviewForOrder,
} from '@/lib/store/ecommerce-service';
import { ApiError, handleApiError } from '@/lib/security/rate-limiter';
import { requireAdminSession } from '@/lib/supabase/server';
import type { OrderOperationalStatus } from '@/types/database';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);
    const db = getDbState();
    const { searchParams } = new URL(request.url);
    const financialStatus = searchParams.get('financialStatus');
    const operationalStatus = searchParams.get('operationalStatus');
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    let orders = [...db.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (financialStatus) {
      orders = orders.filter((o) => o.financialStatus === financialStatus);
    }
    if (operationalStatus) {
      orders = orders.filter((o) => o.operationalStatus === operationalStatus);
    }
    if (q) {
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.fullName.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ orders });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminSession(request);
    const body = (await request.json()) as {
      action: 'update_operational_status' | 'upload_design_preview' | 'cancel_or_refund';
      orderId: string;
      operationalStatus?: OrderOperationalStatus;
      reason?: string;
      orderItemId?: string;
      previewStoragePath?: string;
      designerNotes?: string;
      refundAmountCents?: number;
      providerRefundReference?: string;
    };

    const db = getDbState();
    const order = db.orders.find((o) => o.id === body.orderId);
    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
    }

    if (body.action === 'cancel_or_refund') {
      const updated = cancelOrRefundOrder({
        orderId: order.id,
        reason: body.reason || 'Cancelado/reembolsado administrativamente.',
        refundAmountCents: body.refundAmountCents,
        providerRefundReference: body.providerRefundReference,
        actorId: admin.userId,
        actorRole: admin.role,
      });
      return NextResponse.json({ order: updated });
    }

    if (body.action === 'upload_design_preview') {
      if (!body.orderItemId || !body.previewStoragePath) {
        throw new ApiError(
          400,
          'MISSING_PREVIEW_PARAMS',
          'Informe o item do pedido e o arquivo da prévia da arte.'
        );
      }
      const approval = uploadDesignPreviewForOrder({
        orderId: order.id,
        orderItemId: body.orderItemId,
        previewStoragePath: body.previewStoragePath,
        designerNotes: body.designerNotes,
        actorId: admin.userId,
      });
      return NextResponse.json({ approval, order });
    }

    if (body.action === 'update_operational_status' && body.operationalStatus) {
      const prevOp = order.operationalStatus;
      order.operationalStatus = body.operationalStatus;
      order.updatedAt = new Date().toISOString();

      if (body.operationalStatus === 'shipped' && order.shipment) {
        order.shipment.status = 'in_transit';
        order.shipment.shippedAt = new Date().toISOString();
      }
      if (body.operationalStatus === 'delivered' && order.shipment) {
        order.shipment.status = 'delivered';
        order.shipment.deliveredAt = new Date().toISOString();
      }

      order.statusHistory.push({
        id: `osh-${crypto.randomUUID()}`,
        orderId: order.id,
        previousFinancialStatus: order.financialStatus,
        newFinancialStatus: order.financialStatus,
        previousOperationalStatus: prevOp,
        newOperationalStatus: body.operationalStatus,
        changedBy: admin.userId,
        reason: body.reason || `Status operacional atualizado para ${body.operationalStatus}.`,
        createdAt: new Date().toISOString(),
      });

      saveDbState();
      return NextResponse.json({ order });
    }

    throw new ApiError(400, 'INVALID_ORDER_ACTION', 'Ação de pedido inválida.');
  } catch (error) {
    return handleApiError(error);
  }
}
