'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  MapPin,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import {
  formatBusinessDays,
  formatCentsToBRL,
  formatPostalCode,
} from '@/lib/utils';
import type { PickupLocation, ShippingQuote } from '@/types/database';

export default function CartPage() {
  const {
    items,
    coupon,
    discountCents,
    deliveryMethod,
    selectedShippingQuote,
    destinationPostalCode,
    subtotalCents,
    personalizationTotalCents,
    shippingCents,
    totalCents,
    maxProductionDays,
    removeItem,
    updateQuantity,
    applyCouponState,
    setDeliveryMethod,
    setSelectedShippingQuote,
    setDestinationPostalCode,
  } = useCart();

  const [couponInput, setCouponInput] = useState(coupon?.code || '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [quotesResult, setQuotesResult] = useState<{
    melhorEnvioQuotes: ShippingQuote[];
    localPickupLocations: PickupLocation[];
    ownDeliveryOptions: ShippingQuote[];
  } | null>(null);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotalCents: subtotalCents + personalizationTotalCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        applyCouponState(null, 0);
        throw new Error(data.error?.message || 'Cupom inválido.');
      }
      applyCouponState(data.coupon, data.discountCents);
    } catch (err) {
      setCouponError((err as Error).message);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleCalculateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    setShippingError(null);
    setShippingLoading(true);
    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationPostalCode,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao calcular frete.');
      }
      setQuotesResult(data);
      if (data.melhorEnvioQuotes?.[0]) {
        setDeliveryMethod('melhor_envio');
        setSelectedShippingQuote(data.melhorEnvioQuotes[0]);
      }
    } catch (err) {
      setShippingError((err as Error).message);
    } finally {
      setShippingLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container py-16">
        <div className="max-w-lg mx-auto rounded-3xl border border-border bg-card p-10 text-center space-y-5 shadow-sm">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-bold">Sua sacola está vazia</h1>
            <p className="text-sm text-muted-foreground">
              Explore nosso catálogo de presentes criativos, álbuns revestidos em linho e kits presenteáveis.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <span>Explorar Produtos</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold">Sua Sacola de Presentes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Confira os detalhes da personalização, calcule o frete ou selecione retirada gratuita no nosso ateliê.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cart Items List */}
        <div className="lg:col-span-7 space-y-4">
          {items.map((item) => (
            <div
              key={item.cartItemId}
              data-testid={`cart-item-${item.productSlug}`}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col sm:flex-row gap-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.productImage}
                alt={item.productName}
                className="h-24 w-24 rounded-xl object-cover border border-border shrink-0"
              />

              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/produto/${item.productSlug}`}
                      className="font-serif text-lg font-semibold hover:text-primary"
                    >
                      {item.productName}
                    </Link>
                    {item.variantName && (
                      <p className="text-xs font-medium text-muted-foreground">
                        Variação: {item.variantName}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Prazo de produção: {formatBusinessDays(item.productionDays)}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remover ${item.productName}`}
                    onClick={() => removeItem(item.cartItemId)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Personalization Summary */}
                {item.personalizations.length > 0 && (
                  <div className="rounded-xl bg-muted/60 p-3 space-y-1 text-xs">
                    <span className="font-semibold text-foreground block">
                      Personalização configurada:
                    </span>
                    {item.personalizations.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span>
                          <strong className="text-foreground">{p.fieldLabel}:</strong>{' '}
                          {p.displayValue}
                        </span>
                        {p.priceAdditionCents > 0 && (
                          <span className="text-primary font-medium">
                            +{formatCentsToBRL(p.priceAdditionCents)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="inline-flex items-center rounded-lg border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      className="px-2.5 py-1 text-xs font-bold hover:bg-muted"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-xs font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      className="px-2.5 py-1 text-xs font-bold hover:bg-muted"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold text-foreground">
                      {formatCentsToBRL(
                        (item.unitBasePriceCents + item.unitPersonalizationPriceCents) *
                          item.quantity
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary, Coupon & Delivery */}
        <div className="lg:col-span-5 space-y-5">
          {/* Coupon Box */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Cupom de Desconto</span>
            </div>
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input
                type="text"
                data-testid="cart-coupon-input"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Ex: BEMVINDO10"
                className="flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-sm uppercase"
              />
              <button
                type="submit"
                data-testid="cart-apply-coupon-btn"
                disabled={couponLoading}
                className="rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/90"
              >
                {couponLoading ? 'Validando...' : 'Aplicar'}
              </button>
            </form>
            {couponError && (
              <p data-testid="coupon-error-msg" className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{couponError}</span>
              </p>
            )}
            {coupon && (
              <p className="text-xs text-secondary font-medium">
                Cupom <strong>{coupon.code}</strong> aplicado (-{formatCentsToBRL(discountCents)})!
              </p>
            )}
          </div>

          {/* Delivery & Shipping Box */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Entrega ou Retirada Local</span>
            </div>

            <form onSubmit={handleCalculateShipping} className="flex gap-2">
              <input
                type="text"
                data-testid="cart-cep-input"
                value={formatPostalCode(destinationPostalCode)}
                onChange={(e) => setDestinationPostalCode(e.target.value)}
                placeholder="Digite seu CEP (00000-000)"
                className="flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-sm"
              />
              <button
                type="submit"
                data-testid="cart-calc-shipping-btn"
                disabled={shippingLoading}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                {shippingLoading ? 'Calculando...' : 'Calcular'}
              </button>
            </form>

            {shippingError && (
              <p className="text-xs text-destructive">{shippingError}</p>
            )}

            {/* Local Pickup Always Available */}
            <div className="space-y-2 text-xs">
              <label className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/50">
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="cart-delivery"
                    checked={deliveryMethod === 'local_pickup'}
                    onChange={() => {
                      setDeliveryMethod('local_pickup');
                      setSelectedShippingQuote(null);
                    }}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      Retirada Local — Ateliê Anis Criações (Jardins/SP)
                    </span>
                    <span className="text-muted-foreground block mt-0.5">
                      Seg a Sex 09h-18h30 | Sáb 09h-14h • Código gerado no pedido
                    </span>
                  </div>
                </div>
                <span className="font-bold text-secondary">Grátis</span>
              </label>

              {quotesResult?.ownDeliveryOptions.map((own) => (
                <label
                  key={own.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="cart-delivery"
                      checked={
                        deliveryMethod === 'own_delivery' &&
                        selectedShippingQuote?.id === own.id
                      }
                      onChange={() => {
                        setDeliveryMethod('own_delivery');
                        setSelectedShippingQuote(own);
                      }}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-semibold text-foreground block">
                        {own.serviceName}
                      </span>
                      <span className="text-muted-foreground block">
                        Prazo de transporte: +{own.deliveryDays} dia(s) útil(eis) após produção
                      </span>
                    </div>
                  </div>
                  <span className="font-bold">{formatCentsToBRL(own.priceCents)}</span>
                </label>
              ))}

              {quotesResult?.melhorEnvioQuotes.map((q) => (
                <label
                  key={q.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="cart-delivery"
                      checked={
                        deliveryMethod === 'melhor_envio' &&
                        selectedShippingQuote?.id === q.id
                      }
                      onChange={() => {
                        setDeliveryMethod('melhor_envio');
                        setSelectedShippingQuote(q);
                      }}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-semibold text-foreground block">
                        {q.companyName} — {q.serviceName}
                      </span>
                      <span className="text-muted-foreground block">
                        Prazo de transporte: +{q.deliveryDays} dias úteis após produção
                      </span>
                    </div>
                  </div>
                  <span className="font-bold">{formatCentsToBRL(q.priceCents)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Financial & Lead Time Summary */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <h2 className="font-serif text-lg font-bold">Resumo do Pedido</h2>

            <div className="rounded-xl bg-muted/70 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Prazo de Produção Artesanal:
                </span>
                <strong className="text-foreground">
                  {formatBusinessDays(maxProductionDays)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-secondary" />
                  Prazo Estimado de Transporte:
                </span>
                <strong className="text-foreground">
                  {deliveryMethod === 'local_pickup'
                    ? 'Retirada no ateliê após produção'
                    : selectedShippingQuote
                      ? `+${selectedShippingQuote.deliveryDays} dias úteis`
                      : 'Informe o CEP'}
                </strong>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-3">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal dos Produtos</span>
                <span>{formatCentsToBRL(subtotalCents)}</span>
              </div>
              {personalizationTotalCents > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Acréscimos de Personalização</span>
                  <span>{formatCentsToBRL(personalizationTotalCents)}</span>
                </div>
              )}
              {discountCents > 0 && (
                <div className="flex justify-between text-secondary font-medium">
                  <span>Desconto ({coupon?.code})</span>
                  <span>- {formatCentsToBRL(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Frete / Entrega</span>
                <span>
                  {deliveryMethod === 'local_pickup'
                    ? 'Grátis (Retirada Local)'
                    : selectedShippingQuote
                      ? formatCentsToBRL(shippingCents)
                      : 'A calcular'}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-3">
                <span>Total</span>
                <span data-testid="cart-total-value">{formatCentsToBRL(totalCents)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              data-testid="proceed-to-checkout-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
            >
              <span>Continuar para Finalização</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
