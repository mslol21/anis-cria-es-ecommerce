'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import {
  formatBusinessDays,
  formatCentsToBRL,
  formatPostalCode,
  normalizePostalCode,
} from '@/lib/utils';
import type { PickupLocation, ShippingQuote } from '@/types/database';

export default function CheckoutPage() {
  const router = useRouter();
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
    setDeliveryMethod,
    setSelectedShippingQuote,
    setDestinationPostalCode,
    clearCart,
  } = useCart();

  // Customer minimal fields (guest checkout — no mandatory account registration)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [documentCpfCnpj, setDocumentCpfCnpj] = useState('');
  const [lgpdAccepted, setLgpdAccepted] = useState(true);

  // Address fields
  const [postalCode, setPostalCode] = useState(destinationPostalCode || '01310100');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [stateUf, setStateUf] = useState('SP');
  const [customerNotes, setCustomerNotes] = useState('');

  const [quotes, setQuotes] = useState<{
    melhorEnvioQuotes: ShippingQuote[];
    localPickupLocations: PickupLocation[];
    ownDeliveryOptions: ShippingQuote[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const cepDigits = normalizePostalCode(postalCode);
    if (cepDigits.length === 8 && items.length > 0) {
      setDestinationPostalCode(cepDigits);
      fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationPostalCode: cepDigits,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) {
            setQuotes(data);
            if (
              deliveryMethod === 'melhor_envio' &&
              !selectedShippingQuote &&
              data.melhorEnvioQuotes?.[0]
            ) {
              setSelectedShippingQuote(data.melhorEnvioQuotes[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [postalCode, items, deliveryMethod, selectedShippingQuote, setDestinationPostalCode, setSelectedShippingQuote]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const payload = {
        customer: {
          fullName,
          email,
          phone,
          documentCpfCnpj,
          lgpdAccepted,
        },
        deliveryMethod,
        shippingQuoteId:
          deliveryMethod === 'local_pickup' ? null : selectedShippingQuote?.id || null,
        pickupLocationId:
          deliveryMethod === 'local_pickup'
            ? quotes?.localPickupLocations?.[0]?.id || null
            : null,
        address: {
          recipientName: fullName,
          postalCode: normalizePostalCode(postalCode),
          street:
            deliveryMethod === 'local_pickup' && !street
              ? 'Retirada no Ateliê Anis Criações'
              : street,
          number: deliveryMethod === 'local_pickup' && !number ? '1240' : number,
          complement,
          neighborhood:
            deliveryMethod === 'local_pickup' && !neighborhood
              ? 'Jardins'
              : neighborhood,
          city: deliveryMethod === 'local_pickup' && !city ? 'São Paulo' : city,
          state: deliveryMethod === 'local_pickup' && !stateUf ? 'SP' : stateUf,
        },
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          personalizations: item.personalizations.map((p) => ({
            fieldId: p.fieldId,
            fieldKey: p.fieldKey,
            textValue: p.textValue,
            selectedOptionValue: p.selectedOptionValue,
            uploadedFile: p.uploadedFile,
          })),
        })),
        couponCode: coupon?.code || null,
        customerNotes,
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || 'Não foi possível concluir o pedido.'
        );
      }

      clearCart();
      if (data.checkoutUrl && data.checkoutUrl.startsWith('http')) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push(
          `/pedido/confirmacao?order=${encodeURIComponent(data.orderNumber)}&token=${encodeURIComponent(data.lookupToken)}`
        );
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container py-16 text-center space-y-4">
        <h1 className="font-serif text-2xl font-bold">Nenhum item para finalizar</h1>
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Voltar ao Catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-8">
      <div>
        <Link
          href="/carrinho"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Voltar para a Sacola</span>
        </Link>
        <h1 className="font-serif text-3xl font-bold">Finalização Segura do Pedido</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Não exigimos criação de senha. Informe apenas os dados essenciais para emissão do pedido, entrega e pagamento oficial via InfinitePay.
        </p>
      </div>

      <form
        onSubmit={handleCheckoutSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left Column: Customer & Delivery Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Customer Identification */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <h2 className="font-serif text-xl font-semibold">
              1. Dados de Contato e Identificação
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="chk-name" className="block text-xs font-semibold mb-1">
                  Nome Completo *
                </label>
                <input
                  id="chk-name"
                  data-testid="checkout-name"
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Maria Clara Oliveira"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="chk-email" className="block text-xs font-semibold mb-1">
                  E-mail para acompanhamento e prévia de arte *
                </label>
                <input
                  id="chk-email"
                  data-testid="checkout-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@exemplo.com.br"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="chk-phone" className="block text-xs font-semibold mb-1">
                  WhatsApp / Telefone com DDD *
                </label>
                <input
                  id="chk-phone"
                  data-testid="checkout-phone"
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="chk-doc" className="block text-xs font-semibold mb-1">
                  CPF ou CNPJ (para Nota Fiscal e Etiqueta de Transporte) *
                </label>
                <input
                  id="chk-doc"
                  data-testid="checkout-document"
                  required
                  type="text"
                  value={documentCpfCnpj}
                  onChange={(e) => setDocumentCpfCnpj(e.target.value)}
                  placeholder="123.456.789-01"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
          </section>

          {/* 2. Delivery Method & Address */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <h2 className="font-serif text-xl font-semibold">
              2. Modalidade de Entrega ou Retirada
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                data-testid="delivery-mode-melhor-envio"
                onClick={() => {
                  setDeliveryMethod('melhor_envio');
                  if (quotes?.melhorEnvioQuotes?.[0]) {
                    setSelectedShippingQuote(quotes.melhorEnvioQuotes[0]);
                  }
                }}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  deliveryMethod === 'melhor_envio'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-background'
                }`}
              >
                <Truck className="h-4 w-4 text-primary mb-1" />
                <strong className="block text-foreground">Transportadora / Correios</strong>
                <span className="text-muted-foreground">Via Melhor Envio</span>
              </button>

              <button
                type="button"
                data-testid="delivery-mode-local-pickup"
                onClick={() => {
                  setDeliveryMethod('local_pickup');
                  setSelectedShippingQuote(null);
                }}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  deliveryMethod === 'local_pickup'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-background'
                }`}
              >
                <MapPin className="h-4 w-4 text-secondary mb-1" />
                <strong className="block text-foreground">Retirada no Ateliê</strong>
                <span className="text-secondary font-semibold">Taxa Zero (Grátis)</span>
              </button>

              <button
                type="button"
                data-testid="delivery-mode-own-delivery"
                onClick={() => {
                  setDeliveryMethod('own_delivery');
                  if (quotes?.ownDeliveryOptions?.[0]) {
                    setSelectedShippingQuote(quotes.ownDeliveryOptions[0]);
                  }
                }}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  deliveryMethod === 'own_delivery'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-background'
                }`}
              >
                <ShieldCheck className="h-4 w-4 text-primary mb-1" />
                <strong className="block text-foreground">Entrega Própria SP</strong>
                <span className="text-muted-foreground">Mensageiro do Ateliê</span>
              </button>
            </div>

            {deliveryMethod === 'local_pickup' ? (
              <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-xs space-y-1.5">
                <strong className="text-foreground block text-sm">
                  Ponto de Retirada: Ateliê Anis Criações — Jardins/SP
                </strong>
                <p className="text-muted-foreground">
                  Endereço: Rua Oscar Freire, 1240 - Loja 02 - Jardins, São Paulo/SP (CEP 01426-001)
                </p>
                <p className="text-muted-foreground">
                  Horário: Segunda a Sexta das 09h às 18h30 | Sábado das 09h às 14h
                </p>
                <p className="text-foreground font-medium">
                  Um código exclusivo de retirada será gerado na confirmação do pedido.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="chk-cep" className="block text-xs font-semibold mb-1">
                      CEP *
                    </label>
                    <input
                      id="chk-cep"
                      data-testid="checkout-cep"
                      required
                      type="text"
                      value={formatPostalCode(postalCode)}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="01310-100"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="chk-street" className="block text-xs font-semibold mb-1">
                      Rua / Avenida *
                    </label>
                    <input
                      id="chk-street"
                      data-testid="checkout-street"
                      required
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Av. Paulista"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="chk-num" className="block text-xs font-semibold mb-1">
                      Número *
                    </label>
                    <input
                      id="chk-num"
                      data-testid="checkout-number"
                      required
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="1000"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="chk-comp" className="block text-xs font-semibold mb-1">
                      Complemento (Apto, Bloco)
                    </label>
                    <input
                      id="chk-comp"
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto 82"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="chk-neigh" className="block text-xs font-semibold mb-1">
                      Bairro *
                    </label>
                    <input
                      id="chk-neigh"
                      data-testid="checkout-neighborhood"
                      required
                      type="text"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Bela Vista"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-city" className="block text-xs font-semibold mb-1">
                      Cidade *
                    </label>
                    <input
                      id="chk-city"
                      data-testid="checkout-city"
                      required
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-uf" className="block text-xs font-semibold mb-1">
                      Estado (UF) *
                    </label>
                    <input
                      id="chk-uf"
                      data-testid="checkout-state"
                      required
                      maxLength={2}
                      type="text"
                      value={stateUf}
                      onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm uppercase"
                    />
                  </div>
                </div>

                {/* Available Carrier Services */}
                {deliveryMethod === 'melhor_envio' && quotes?.melhorEnvioQuotes && (
                  <div className="space-y-2 pt-2">
                    <span className="block text-xs font-semibold">
                      Selecione o Serviço do Melhor Envio:
                    </span>
                    {quotes.melhorEnvioQuotes.map((q) => (
                      <label
                        key={q.id}
                        className="flex items-center justify-between rounded-xl border border-border p-3 text-xs cursor-pointer hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="me-quote"
                            checked={selectedShippingQuote?.id === q.id}
                            onChange={() => setSelectedShippingQuote(q)}
                          />
                          <span>
                            <strong>
                              {q.companyName} — {q.serviceName}
                            </strong>{' '}
                            (+{q.deliveryDays} dias úteis de transporte)
                          </span>
                        </div>
                        <span className="font-bold">{formatCentsToBRL(q.priceCents)}</span>
                      </label>
                    ))}
                  </div>
                )}

                {deliveryMethod === 'own_delivery' && quotes?.ownDeliveryOptions && (
                  <div className="space-y-2 pt-2">
                    <span className="block text-xs font-semibold">
                      Região de Entrega Própria Atendida:
                    </span>
                    {quotes.ownDeliveryOptions.length > 0 ? (
                      quotes.ownDeliveryOptions.map((own) => (
                        <label
                          key={own.id}
                          className="flex items-center justify-between rounded-xl border border-border p-3 text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="own-quote"
                              checked={selectedShippingQuote?.id === own.id}
                              onChange={() => setSelectedShippingQuote(own)}
                            />
                            <span>
                              <strong>{own.serviceName}</strong> (+{own.deliveryDays} dia útil)
                            </span>
                          </div>
                          <span className="font-bold">{formatCentsToBRL(own.priceCents)}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-destructive">
                        Entrega própria indisponível para este CEP. Selecione Melhor Envio ou Retirada Local.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="chk-notes" className="block text-xs font-semibold mb-1">
                Observações do Pedido (Opcional)
              </label>
              <textarea
                id="chk-notes"
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Ex: Embalar para presente sem nota fiscal de valor aparente..."
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm"
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer pt-2">
              <input
                type="checkbox"
                required
                checked={lgpdAccepted}
                onChange={(e) => setLgpdAccepted(e.target.checked)}
                className="mt-0.5 rounded border-input text-primary"
              />
              <span>
                Concordo com o tratamento dos meus dados exclusivamente para produção, faturamento e entrega deste pedido, conforme a{' '}
                <Link href="/politicas/privacidade" className="text-primary underline">
                  Política de Privacidade (LGPD)
                </Link>
                .
              </span>
            </label>
          </section>
        </div>

        {/* Right Column: Order Review & InfinitePay Trigger */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <h2 className="font-serif text-xl font-bold">Revisão Final & Prazos</h2>

            {/* Separated Production vs Shipping Time Box */}
            <div
              data-testid="checkout-deadlines-box"
              className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  1. Prazo de Produção:
                </span>
                <strong className="text-foreground">
                  {formatBusinessDays(maxProductionDays)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-secondary" />
                  2. Prazo de Transporte:
                </span>
                <strong className="text-foreground">
                  {deliveryMethod === 'local_pickup'
                    ? 'Retirada no Ateliê (0 dias de transporte)'
                    : selectedShippingQuote
                      ? `+${selectedShippingQuote.deliveryDays} dia(s) útil(eis)`
                      : 'Selecione o frete'}
                </strong>
              </div>
            </div>

            <ul className="divide-y divide-border/60 text-xs space-y-2.5">
              {items.map((item) => (
                <li key={item.cartItemId} className="pt-2.5 first:pt-0 flex justify-between gap-3">
                  <div>
                    <strong className="text-foreground block">
                      {item.quantity}x {item.productName}
                    </strong>
                    {item.variantName && (
                      <span className="text-muted-foreground block">
                        Opção: {item.variantName}
                      </span>
                    )}
                    {item.personalizations.length > 0 && (
                      <span className="text-primary block">
                        Personalizado ({item.personalizations.length} campo(s))
                      </span>
                    )}
                  </div>
                  <span className="font-semibold shrink-0">
                    {formatCentsToBRL(
                      (item.unitBasePriceCents + item.unitPersonalizationPriceCents) *
                        item.quantity
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal + Personalizações</span>
                <span>{formatCentsToBRL(subtotalCents + personalizationTotalCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-secondary font-medium">
                  <span>Desconto ({coupon?.code})</span>
                  <span>- {formatCentsToBRL(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Entrega</span>
                <span>
                  {deliveryMethod === 'local_pickup'
                    ? 'Grátis'
                    : formatCentsToBRL(shippingCents)}
                </span>
              </div>
              <div className="flex justify-between text-xl font-bold text-foreground border-t border-border pt-3">
                <span>Total a Pagar</span>
                <span data-testid="checkout-total-cents">{formatCentsToBRL(totalCents)}</span>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              data-testid="submit-checkout-btn"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando Estoque e Gerando Checkout InfinitePay...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span>Ir para Pagamento Seguro InfinitePay</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-muted-foreground">
              Você será redirecionado para o Checkout Oficial Brasileiro da InfinitePay (PIX ou Cartão em até 12x). Nenhuma informação de cartão é capturada neste site.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
