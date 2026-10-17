'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { Order } from '@/types/database';
import { formatBusinessDays, formatCentsToBRL } from '@/lib/utils';

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') || searchParams.get('order_nsu') || '';
  const token = searchParams.get('token') || '';
  const transactionNsu = searchParams.get('transaction_nsu') || '';
  const slug = searchParams.get('slug') || '';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const fetchOrder = async () => {
    if (!orderNumber) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/orders?orderNumber=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (res.ok && data.order) {
        setOrder(data.order);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, token]);

  const handleReconcileStatus = async () => {
    if (!orderNumber) return;
    setReconciling(true);
    try {
      await fetch('/api/payments/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile',
          orderNsu: orderNumber,
          transactionNsu: transactionNsu || undefined,
          slug: slug || undefined,
        }),
      });
      await fetchOrder();
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground mt-3">
          Carregando informações do seu pedido...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container py-16 max-w-xl text-center space-y-4">
        <h1 className="font-serif text-2xl font-bold">Pedido registrado</h1>
        <p className="text-sm text-muted-foreground">
          Consulte o status atualizado utilizando o número do pedido e seu e-mail.
        </p>
        <Link
          href="/pedidos/consulta"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Consultar Pedido
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-12 max-w-3xl space-y-8">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-start gap-3.5">
            <div className="rounded-full bg-secondary/15 p-3 text-secondary">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Pedido Registrado com Sucesso
              </span>
              <h1
                data-testid="confirmation-order-number"
                className="font-serif text-2xl sm:text-3xl font-bold"
              >
                {order.orderNumber}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enviamos o resumo para <strong>{order.customer.email}</strong>
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-muted-foreground block">Status Financeiro</span>
            <span
              data-testid="confirmation-financial-status"
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold mt-1 ${
                order.financialStatus === 'paid'
                  ? 'bg-secondary/15 text-secondary'
                  : 'bg-accent/20 text-foreground'
              }`}
            >
              {order.financialStatus === 'paid'
                ? 'Pagamento Confirmado'
                : 'Aguardando Confirmação InfinitePay'}
            </span>
          </div>
        </div>

        {/* Security Notice: Redirect alone does not confirm payment */}
        {order.financialStatus !== 'paid' && (
          <div className="rounded-2xl border border-border bg-muted/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <strong className="text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Validação Segura no Servidor (InfinitePay)
              </strong>
              <p className="text-muted-foreground">
                Por segurança, seu pagamento é confirmado automaticamente pelo webhook ou conciliação direta no servidor da InfinitePay.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReconcileStatus}
                disabled={reconciling}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 font-semibold hover:bg-muted"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${reconciling ? 'animate-spin' : ''}`}
                />
                <span>Verificar Pagamento</span>
              </button>
              {order.payments[0]?.checkoutUrl && (
                <a
                  href={order.payments[0].checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
                >
                  <span>Abrir Link InfinitePay</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Pickup Code Highlight if Local Pickup */}
        {order.deliveryMethod === 'local_pickup' && order.pickupCode && (
          <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <MapPin className="h-4 w-4 text-secondary" />
              <span>Código de Retirada no Ateliê: {order.pickupCode}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Apresente este código e um documento com foto após a conclusão da produção na Rua Oscar Freire, 1240 - Jardins, São Paulo/SP.
            </p>
          </div>
        )}

        {/* Production vs Shipping Deadlines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-border p-4 space-y-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              Prazo de Produção Artesanal
            </span>
            <strong className="text-base text-foreground block">
              {formatBusinessDays(order.productionDays)}
            </strong>
          </div>
          <div className="rounded-xl border border-border p-4 space-y-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              Prazo Estimado de Transporte
            </span>
            <strong className="text-base text-foreground block">
              {order.deliveryMethod === 'local_pickup'
                ? 'Retirada Local no Ateliê'
                : `+${order.estimatedShippingDays} dia(s) útil(eis) após produção`}
            </strong>
          </div>
        </div>

        {/* Order Items & Customizations */}
        <div className="space-y-3">
          <h2 className="font-serif text-lg font-semibold">Itens e Personalizações Registradas</h2>
          <div className="divide-y divide-border rounded-2xl border border-border p-4 space-y-3 text-xs">
            {order.items.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 space-y-1.5">
                <div className="flex justify-between font-semibold text-sm">
                  <span>
                    {item.quantity}x {item.productNameSnapshot}
                    {item.variantNameSnapshot ? ` (${item.variantNameSnapshot})` : ''}
                  </span>
                  <span>{formatCentsToBRL(item.totalPriceCents)}</span>
                </div>
                {item.customizations.map((c) => (
                  <div key={c.id} className="text-muted-foreground pl-3 border-l-2 border-primary/40">
                    <strong>{c.fieldLabelSnapshot}:</strong> {c.textValue}
                  </div>
                ))}
              </div>
            ))}
            <div className="pt-3 flex justify-between text-base font-bold text-foreground">
              <span>Total do Pedido</span>
              <span>{formatCentsToBRL(order.totalCents)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <Link
            href={`/pedidos/consulta?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.lookupToken)}`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-semibold text-primary-foreground"
          >
            <PackageSearch className="h-4 w-4" />
            <span>Acompanhar Produção e Aprovar Arte</span>
          </Link>
          <Link
            href="/catalogo"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Voltar para a Loja
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="container py-16 text-center">Carregando...</div>}>
      <OrderConfirmationContent />
    </Suspense>
  );
}
