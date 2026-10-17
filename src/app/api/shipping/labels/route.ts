import { NextResponse } from 'next/server';
import {
  confirmLocalPickupHandover,
  generateShipmentLabelForOrder,
} from '@/lib/store/ecommerce-service';
import { melhorEnvioAdapter } from '@/lib/integrations/melhor-envio';
import { handleApiError } from '@/lib/security/rate-limiter';
import { requireAdminSession } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession(request, ['super_admin', 'admin', 'production']);
    const body = (await request.json()) as {
      action?: 'generate_label' | 'confirm_pickup' | 'track';
      orderId: string;
      executePurchaseNow?: boolean;
      pickupCode?: string;
      pickedUpByName?: string;
      pickedUpByDocument?: string;
      melhorEnvioOrderId?: string;
      trackingCode?: string;
    };

    if (body.action === 'confirm_pickup') {
      const order = confirmLocalPickupHandover({
        orderId: body.orderId,
        pickupCode: body.pickupCode || '',
        pickedUpByName: body.pickedUpByName || '',
        pickedUpByDocument: body.pickedUpByDocument || '',
        actorId: admin.userId,
      });
      return NextResponse.json({ order });
    }

    if (body.action === 'track') {
      const tracking = await melhorEnvioAdapter.trackShipment({
        melhorEnvioOrderId: body.melhorEnvioOrderId,
        trackingCode: body.trackingCode,
      });
      return NextResponse.json({ tracking });
    }

    const shipment = await generateShipmentLabelForOrder({
      orderId: body.orderId,
      executePurchaseNow: body.executePurchaseNow,
      actorId: admin.userId,
    });

    return NextResponse.json({ shipment });
  } catch (error) {
    return handleApiError(error);
  }
}
