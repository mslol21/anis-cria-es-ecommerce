import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDbState, saveDbState } from '@/lib/store/ecommerce-service';
import { handleApiError } from '@/lib/security/rate-limiter';
import { requireAdminSession } from '@/lib/supabase/server';
import type { Coupon, PickupLocation, StoreSettings } from '@/types/database';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);
    const db = getDbState();

    const paidOrders = db.orders.filter((o) => o.financialStatus === 'paid');
    const pendingOrders = db.orders.filter((o) => o.financialStatus === 'pending');
    const inProductionOrders = db.orders.filter(
      (o) =>
        o.operationalStatus === 'in_production' ||
        o.operationalStatus === 'awaiting_art_approval'
    );
    const awaitingShipmentOrders = db.orders.filter(
      (o) =>
        o.operationalStatus === 'ready_for_shipping' ||
        o.operationalStatus === 'ready_for_pickup' ||
        o.operationalStatus === 'out_for_own_delivery'
    );

    const paidRevenueCents = paidOrders.reduce((acc, o) => acc + o.totalCents, 0);

    return NextResponse.json({
      dashboard: {
        totalOrders: db.orders.length,
        paidRevenueCents,
        pendingOrdersCount: pendingOrders.length,
        inProductionCount: inProductionOrders.length,
        awaitingShipmentCount: awaitingShipmentOrders.length,
      },
      storeSettings: db.storeSettings,
      coupons: db.coupons.filter((c) => !c.deletedAt),
      pickupLocations: db.pickupLocations,
      payments: db.payments,
      paymentEvents: db.paymentEvents,
      shipments: db.shipments,
      designApprovals: db.designApprovals,
      auditLogs: db.auditLogs.slice(-50).reverse(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdminSession(request, ['super_admin', 'admin']);
    const body = (await request.json()) as {
      section: 'store_settings' | 'coupon_upsert' | 'pickup_location_upsert';
      storeSettings?: Partial<StoreSettings>;
      coupon?: Partial<Coupon> & { code: string; discountValue: number };
      pickupLocation?: Partial<PickupLocation> & { name: string; postalCode: string };
    };

    const db = getDbState();
    const nowIso = new Date().toISOString();

    if (body.section === 'store_settings' && body.storeSettings) {
      db.storeSettings = {
        ...db.storeSettings,
        ...body.storeSettings,
        themeConfig: {
          ...db.storeSettings.themeConfig,
          ...(body.storeSettings.themeConfig || {}),
        },
        infinitepayConfig: {
          ...db.storeSettings.infinitepayConfig,
          ...(body.storeSettings.infinitepayConfig || {}),
        },
        melhorEnvioConfig: {
          ...db.storeSettings.melhorEnvioConfig,
          ...(body.storeSettings.melhorEnvioConfig || {}),
        },
        ownDeliveryConfig: {
          ...db.storeSettings.ownDeliveryConfig,
          ...(body.storeSettings.ownDeliveryConfig || {}),
        },
        seoConfig: {
          ...db.storeSettings.seoConfig,
          ...(body.storeSettings.seoConfig || {}),
        },
        updatedAt: nowIso,
      };
      db.auditLogs.push({
        id: `aud-${crypto.randomUUID()}`,
        actorId: admin.userId,
        actorRole: admin.role,
        action: 'STORE_SETTINGS_UPDATED',
        entityTable: 'store_settings',
        entityId: db.storeSettings.id,
        createdAt: nowIso,
      });
      saveDbState();
      return NextResponse.json({ storeSettings: db.storeSettings });
    }

    if (body.section === 'coupon_upsert' && body.coupon) {
      const code = body.coupon.code.trim().toUpperCase();
      const existing = db.coupons.find((c) => c.code.toUpperCase() === code && !c.deletedAt);
      if (existing) {
        existing.description = body.coupon.description ?? existing.description;
        existing.discountType = body.coupon.discountType ?? existing.discountType;
        existing.discountValue = body.coupon.discountValue ?? existing.discountValue;
        existing.minOrderCents = body.coupon.minOrderCents ?? existing.minOrderCents;
        existing.isActive = body.coupon.isActive ?? existing.isActive;
        saveDbState();
        return NextResponse.json({ coupon: existing });
      }
      const newCoupon: Coupon = {
        id: `cup-${crypto.randomUUID()}`,
        code,
        description: body.coupon.description || `Cupom ${code}`,
        discountType: body.coupon.discountType || 'percentage',
        discountValue: body.coupon.discountValue,
        minOrderCents: body.coupon.minOrderCents ?? 0,
        maxDiscountCents: body.coupon.maxDiscountCents ?? null,
        usageLimit: body.coupon.usageLimit ?? null,
        usageCount: 0,
        startsAt: nowIso,
        expiresAt: body.coupon.expiresAt ?? null,
        isActive: body.coupon.isActive ?? true,
      };
      db.coupons.push(newCoupon);
      saveDbState();
      return NextResponse.json({ coupon: newCoupon }, { status: 201 });
    }

    if (body.section === 'pickup_location_upsert' && body.pickupLocation) {
      const loc = db.pickupLocations[0];
      if (loc) {
        Object.assign(loc, body.pickupLocation);
        saveDbState();
        return NextResponse.json({ pickupLocation: loc });
      }
    }

    return NextResponse.json({ storeSettings: db.storeSettings });
  } catch (error) {
    return handleApiError(error);
  }
}
