'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type {
  Coupon,
  CustomerPersonalizationInput,
  DeliveryMethod,
  ShippingQuote,
} from '@/types/database';

export interface CartItemEntry {
  cartItemId: string;
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string;
  sku: string;
  variantId?: string | null;
  variantName?: string | null;
  quantity: number;
  unitBasePriceCents: number;
  unitPersonalizationPriceCents: number;
  productionDays: number;
  requiresArtApproval: boolean;
  personalizations: Array<
    CustomerPersonalizationInput & {
      fieldLabel: string;
      displayValue: string;
      priceAdditionCents: number;
    }
  >;
}

interface CartContextValue {
  items: CartItemEntry[];
  isHydrated: boolean;
  coupon: Coupon | null;
  discountCents: number;
  deliveryMethod: DeliveryMethod;
  selectedShippingQuote: ShippingQuote | null;
  destinationPostalCode: string;
  subtotalCents: number;
  personalizationTotalCents: number;
  shippingCents: number;
  totalCents: number;
  maxProductionDays: number;
  totalItemsCount: number;
  addItem: (item: Omit<CartItemEntry, 'cartItemId'>) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  applyCouponState: (coupon: Coupon | null, discountCents: number) => void;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  setSelectedShippingQuote: (quote: ShippingQuote | null) => void;
  setDestinationPostalCode: (cep: string) => void;
}

const STORAGE_KEY = 'anis_criacoes_cart_v1';

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItemEntry[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [discountCents, setDiscountCents] = useState<number>(0);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('melhor_envio');
  const [selectedShippingQuote, setSelectedShippingQuote] =
    useState<ShippingQuote | null>(null);
  const [destinationPostalCode, setDestinationPostalCode] = useState<string>('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          items?: CartItemEntry[];
          destinationPostalCode?: string;
          deliveryMethod?: DeliveryMethod;
        };
        if (Array.isArray(parsed.items)) {
          setItems(parsed.items);
        }
        if (parsed.destinationPostalCode) {
          setDestinationPostalCode(parsed.destinationPostalCode);
        }
        if (parsed.deliveryMethod) {
          setDeliveryMethod(parsed.deliveryMethod);
        }
      }
    } catch {
      // Ignore storage parse failure
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          items,
          destinationPostalCode,
          deliveryMethod,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [items, destinationPostalCode, deliveryMethod, isHydrated]);

  const addItem = (newItem: Omit<CartItemEntry, 'cartItemId'>) => {
    const personalizationSignature = JSON.stringify(
      newItem.personalizations.map((p) => ({
        k: p.fieldKey,
        t: p.textValue,
        o: p.selectedOptionValue,
        f: p.uploadedFile?.storagePath,
      }))
    );
    const deterministicKey = `${newItem.productId}::${newItem.variantId || 'base'}::${personalizationSignature}`;

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.cartItemId === deterministicKey);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const current = updated[existingIdx]!;
        updated[existingIdx] = {
          ...current,
          quantity: current.quantity + newItem.quantity,
        };
        return updated;
      }
      return [...prev, { ...newItem, cartItemId: deterministicKey }];
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.cartItemId === cartItemId ? { ...i, quantity: Math.min(99, quantity) } : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setCoupon(null);
    setDiscountCents(0);
    setSelectedShippingQuote(null);
  };

  const applyCouponState = (newCoupon: Coupon | null, newDiscountCents: number) => {
    setCoupon(newCoupon);
    setDiscountCents(newDiscountCents);
  };

  const totals = useMemo(() => {
    let subtotalCents = 0;
    let personalizationTotalCents = 0;
    let maxProductionDays = 0;
    let totalItemsCount = 0;

    for (const item of items) {
      subtotalCents += item.unitBasePriceCents * item.quantity;
      personalizationTotalCents += item.unitPersonalizationPriceCents * item.quantity;
      maxProductionDays = Math.max(maxProductionDays, item.productionDays);
      totalItemsCount += item.quantity;
    }

    const shippingCents =
      deliveryMethod === 'local_pickup'
        ? 0
        : selectedShippingQuote
          ? selectedShippingQuote.priceCents
          : 0;

    const effectiveDiscount = Math.min(
      discountCents,
      subtotalCents + personalizationTotalCents
    );

    const totalCents = Math.max(
      0,
      subtotalCents + personalizationTotalCents - effectiveDiscount + shippingCents
    );

    return {
      subtotalCents,
      personalizationTotalCents,
      shippingCents,
      discountCents: effectiveDiscount,
      totalCents,
      maxProductionDays,
      totalItemsCount,
    };
  }, [items, deliveryMethod, selectedShippingQuote, discountCents]);

  return (
    <CartContext.Provider
      value={{
        items,
        isHydrated,
        coupon,
        discountCents: totals.discountCents,
        deliveryMethod,
        selectedShippingQuote,
        destinationPostalCode,
        subtotalCents: totals.subtotalCents,
        personalizationTotalCents: totals.personalizationTotalCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        maxProductionDays: totals.maxProductionDays,
        totalItemsCount: totals.totalItemsCount,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        applyCouponState,
        setDeliveryMethod,
        setSelectedShippingQuote,
        setDestinationPostalCode,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
