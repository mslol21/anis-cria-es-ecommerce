'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  Truck,
} from 'lucide-react';
import type { Order } from '@/types/database';
import { formatBusinessDays, formatCentsToBRL } from '@/lib/utils';

const FINANCIAL_LABELS: Record<Order['financialStatus'], string> = {
  pending: 'Pagamento Pendente',
  paid: 'Pagamento Confirmado',
  failed: 'Falha no Pagamento',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolsado Parcialmente',
};

const OPERATIONAL_LABELS: Record<Order['operationalStatus'], string> = {
  awaiting_payment: 'Aguardando Pagamento',
  awaiting_art_approval: 'Aguardando Aprovação de Arte',
  in_production: 'Em Produção no Ateliê',
  ready_for_shipping: 'Pronto para Envio',
  ready_for_pickup: 'Pronto para Retirada Local',
  out_for_own_delivery: 'Saiu para Entrega Própria',
  shipped: 'Enviado / Em Trânsito',
  delivered: 'Entregue',
  picked_up: 'Retirado no Ateliê',
  cancelled: 'Cancelado',
};

function OrderLookupContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(
    searchParams.get('order') || ''
  );
  const [email, setEmail] = useState('');
  const [token] = useState(searchParams.get('token') || '');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const lookupOrder = async (num: string, mail: string, tok: string) => {
    if (!num) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/orders?orderNumber=${encodeURIComponent(num.trim())}&email=${encodeURIComponent(mail.trim())}&token=${encodeURIComponent(tok.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Pedido não encontrado.');
      }
      setOrder(data.order);
    } catch (err) {
      setError((err as Error).message);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialOrder = searchParams.get('order');
    const initialToken = searchParams.get('token');
    if (initialOrder && initialToken) {
      lookupOrder(initialOrder, '', initialToken);
    }
  }, [searchParams]);

  const handleDecision = async (
    approvalId: string,
    decision: 'approved' | 'revision_requested'
  ) => {
    if (!order) return;
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          lookupToken: order.lookupToken,
          approvalId,
          decision,
          customerFeedback: feedbackInput[approvalId] || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao registrar decisão da arte.');
      }
      setOrder(data.order);
      setActionMsg(
        decision === 'approved'
          ? 'Arte aprovada com sucesso! Seu pedido seguiu para produção.'
          : 'Solicitação de revisão enviada aos nossos designers.'
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRetryPayment = async () => {
    if (!order) return;
    const res = await fetch('/api/payments/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'retry',
        orderNumber: order.orderNumber,
        lookupToken: order.lookupToken,
      }),
    });
    const data = await res.json();
    if (res.ok && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  };

  return (
    <div className="container py-10 max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-bold flex items-center gap-2.5">
          <PackageSearch className="h-7 w-7 text-primary" />
          <span>Consultar Pedido & Aprovar Arte</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o status financeiro e operacional, aprove a prévia digital da sua personalização e acesse o código de rastreamento.
        </p>
      </div>

      {/* Search Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookupOrder(orderNumber, email, token);
        }}
        className="rounded-2xl border border-border bg-card p-6 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-4 items-end"
      >
        <div className="sm:col-span-5">
          <label htmlFor="lookup-order" className="block text-xs font-semibold mb-1">
            Número do Pedido *
          </label>
          <input
            id="lookup-order"
            data-testid="lookup-order-input"
            required
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="Ex: ANIS-2026-001001"
            className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm uppercase"
          />
        </div>

        <div className="sm:col-span-5">
          <label htmlFor="lookup-email" className="block text-xs font-semibold mb-1">
            E-mail utilizado na compra *
          </label>
          <input
            id="lookup-email"
            data-testid="lookup-email-input"
            required={!token}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seuemail@exemplo.com.br"
            className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            data-testid="lookup-submit-btn"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Search className="h-4 w-4" />
            <span>{loading ? '...' : 'Buscar'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive font-medium">
          {error}
        </div>
      )}

      {actionMsg && (
        <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-xs text-foreground font-semibold">
          {actionMsg}
        </div>
      )}

      {order && (
        <div className="space-y-6">
          {/* Status Cards */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="text-xs text-muted-foreground">Pedido Comercial</span>
                <h2 className="font-serif text-2xl font-bold">{order.orderNumber}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                  Financeiro: {FINANCIAL_LABELS[order.financialStatus]}
                </span>
                <span
                  data-testid="order-operational-status"
                  className="rounded-full bg-secondary/15 px-3.5 py-1 text-xs font-bold text-secondary"
                >
                  Operacional: {OPERATIONAL_LABELS[order.operationalStatus]}
                </span>
              </div>
            </div>

            {order.financialStatus === 'pending' && (
              <div className="rounded-xl border border-accent bg-accent/10 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <strong className="block text-foreground">
                    Pagamento pendente de confirmação
                  </strong>
                  <span>
                    Caso tenha fechado a janela do pagamento, você pode gerar uma nova tentativa sem duplicar seu pedido.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Pagar Agora via InfinitePay</span>
                </button>
              </div>
            )}

            {/* Artwork Approval Section */}
            {order.designApprovals.length > 0 && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Aprovação de Prévia Digital da Arte</span>
                </div>

                {order.designApprovals.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        Versão da Arte #{app.version} — Status:{' '}
                        <span className="text-primary uppercase">{app.status}</span>
                      </span>
                      {app.previewSignedUrl && (
                        <a
                          href={app.previewSignedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary font-semibold underline"
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          <span>Visualizar Arquivo da Prévia</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {app.designerNotes && (
                      <p className="text-muted-foreground">
                        <strong>Notas do Designer:</strong> {app.designerNotes}
                      </p>
                    )}

                    {(app.status === 'awaiting_customer' ||
                      app.status === 'pending_preview') && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <textarea
                          rows={2}
                          value={feedbackInput[app.id] || ''}
                          onChange={(e) =>
                            setFeedbackInput((prev) => ({
                              ...prev,
                              [app.id]: e.target.value,
                            }))
                          }
                          placeholder="Caso deseje solicitar ajustes na arte, descreva aqui..."
                          className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid={`approve-art-btn-${app.id}`}
                            onClick={() => handleDecision(app.id, 'approved')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 font-semibold text-secondary-foreground"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Aprovar Arte e Liberar Produção</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`reject-art-btn-${app.id}`}
                            onClick={() => handleDecision(app.id, 'revision_requested')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 font-semibold text-foreground hover:bg-muted"
                          >
                            <span>Solicitar Revisão</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Logistics & Tracking Info */}
            {order.shipment && (
              <div className="rounded-xl border border-border p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-sm">
                    {order.deliveryMethod === 'local_pickup' ? (
                      <MapPin className="h-4 w-4 text-primary" />
                    ) : (
                      <Truck className="h-4 w-4 text-primary" />
                    )}
                    {order.shipment.serviceName}
                  </span>
                  <span className="text-muted-foreground">
                    Status Logístico: <strong>{order.shipment.status}</strong>
                  </span>
                </div>
                {order.pickupCode && (
                  <p className="text-secondary font-semibold">
                    Código de Retirada Local: {order.pickupCode}
                  </p>
                )}
                {order.shipment.trackingCode && (
                  <p>
                    Código de Rastreamento:{' '}
                    <strong className="text-primary">{order.shipment.trackingCode}</strong>
                  </p>
                )}
                <p className="text-muted-foreground">
                  Prazo de produção: {formatBusinessDays(order.productionDays)} • Prazo de transporte estimado: +{order.estimatedShippingDays} dia(s) útil(eis).
                </p>
              </div>
            )}

            {/* Order Status Timeline */}
            <div className="space-y-2">
              <h3 className="font-serif text-base font-semibold">
                Histórico do Pedido
              </h3>
              <ul className="space-y-2 text-xs border-l-2 border-primary/30 pl-4">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="space-y-0.5">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(h.createdAt).toLocaleString('pt-BR')}
                    </span>
                    <p className="font-medium text-foreground">{h.reason}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border pt-4 flex justify-between font-bold text-base">
              <span>Total do Pedido</span>
              <span>{formatCentsToBRL(order.totalCents)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderLookupPage() {
  return (
    <Suspense fallback={<div className="container py-16 text-center">Carregando...</div>}>
      <OrderLookupContent />
    </Suspense>
  );
}
