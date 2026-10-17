import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateAllDeliveryOptions,
  cancelOrRefundOrder,
  confirmLocalPickupHandover,
  confirmOrderPaymentIdempotent,
  createOrderAndInfinitePayCheckout,
  generateShipmentLabelForOrder,
  getDbState,
  getProductById,
  importProductsFromCsvText,
  listProducts,
  reconcilePendingPaymentWithProvider,
  resetTestDatabase,
  retryOrderPaymentLink,
  softDeleteProductAdmin,
  submitCustomerDesignDecision,
   uploadDesignPreviewForOrder,
  upsertProductAdmin,
  validateCouponForSubtotal,
} from '@/lib/store/ecommerce-service';
import { infinitePayAdapter } from '@/lib/integrations/infinitepay';
import { melhorEnvioAdapter } from '@/lib/integrations/melhor-envio';
import { requireAdminSession } from '@/lib/supabase/server';

const VALID_CUSTOMER = {
  fullName: 'Beatriz Helena Souza',
  email: 'beatriz@cliente.com.br',
  phone: '11988887777',
  documentCpfCnpj: '12345678901',
  lgpdAccepted: true,
};

const VALID_ADDRESS = {
  recipientName: 'Beatriz Helena Souza',
  postalCode: '01310100',
  street: 'Avenida Paulista',
  number: '1578',
  complement: 'Conjunto 42',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

describe('E-Commerce Integration Scenarios (All 22 Mandatory Scenarios)', () => {
  beforeEach(() => {
    resetTestDatabase();
    vi.restoreAllMocks();
  });

  // Scenario 1: Produto comum com estoque
  it('1. handles regular product with stock and reserves inventory on checkout', async () => {
    const quotes = await calculateAllDeliveryOptions({
      destinationPostalCode: '01310100',
      items: [{ productId: 'prod-vela-botanica', quantity: 2 }],
    });

    const result = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'melhor_envio',
      shippingQuoteId: quotes.melhorEnvioQuotes[0]!.id,
      address: VALID_ADDRESS,
      items: [
        {
          productId: 'prod-vela-botanica',
          quantity: 2,
          personalizations: [],
        },
      ],
    });

    expect(result.order.orderNumber).toMatch(/^ANIS-\d{4}-\d{6}$/);
    expect(result.order.subtotalCents).toBe(9800 * 2); // promotional price 98.00 * 2
    const productAfter = getProductById('prod-vela-botanica')!;
    expect(productAfter.reservedQuantity).toBe(2);
  });

  // Scenario 2: Produto personalizado + preservação histórica mesmo após edição do catálogo
  it('2. recalculates personalization price on server and preserves customization even after catalog product is edited', async () => {
    const quotes = await calculateAllDeliveryOptions({
      destinationPostalCode: '01310100',
      items: [{ productId: 'prod-album-linho', quantity: 1 }],
    });

    const result = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'melhor_envio',
      shippingQuoteId: quotes.melhorEnvioQuotes[0]!.id,
      address: VALID_ADDRESS,
      items: [
        {
          productId: 'prod-album-linho',
          quantity: 1,
          personalizations: [
            {
              fieldId: 'pf-album-titulo',
              fieldKey: 'titulo_capa',
              textValue: 'Memórias de Beatriz & Caio',
            },
            {
              fieldId: 'pf-album-cor-linho',
              fieldKey: 'cor_linho',
              selectedOptionValue: 'terracota_suave', // +1500 cents
            },
            {
              fieldId: 'pf-album-acabamento',
              fieldKey: 'acabamento_gravacao',
              selectedOptionValue: 'bordado_relevo', // +3500 cents
            },
            {
              fieldId: 'pf-album-dedicatoria',
              fieldKey: 'dedicatoria_interna',
              textValue: 'Para sempre em nossos corações.', // +2000 cents
            },
          ],
        },
      ],
    });

    // Base promotional price = 21900; personalizations = 1500 + 3500 + 2000 = 7000
    expect(result.order.subtotalCents).toBe(21900);
    expect(result.order.personalizationTotalCents).toBe(7000);
    expect(result.order.items[0]!.unitFinalPriceCents).toBe(28900);

    // Edit product in catalog afterwards
    upsertProductAdmin({
      id: 'prod-album-linho',
      categoryId: 'cat-papelaria',
      name: 'Álbum Reformulado 2027',
      sku: 'ANIS-ALB-002',
      priceCents: 39900,
      promotionalPriceCents: null,
      personalizationFields: [],
    });

    // Verify historical order item and customizations remain untouched!
    const savedOrder = getDbState().orders.find((o) => o.id === result.order.id)!;
    expect(savedOrder.items[0]!.productNameSnapshot).toBe(
      'Álbum de Memórias em Linho Puro com Hot Stamping'
    );
    expect(savedOrder.items[0]!.unitFinalPriceCents).toBe(28900);
    expect(savedOrder.items[0]!.customizations).toHaveLength(4);
    expect(savedOrder.items[0]!.customizations[0]!.textValue).toBe(
      'Memórias de Beatriz & Caio'
    );
  });

  // Scenario 3: Upload em produto sob encomenda
  it('3. validates required file upload on made-to-order product and stores private reference', async () => {
    const quotes = await calculateAllDeliveryOptions({
      destinationPostalCode: '01310100',
      items: [{ productId: 'prod-luminaria-acrilico', quantity: 1 }],
    });

    // Missing required photo upload must fail
    await expect(
      createOrderAndInfinitePayCheckout({
        customer: VALID_CUSTOMER,
        deliveryMethod: 'melhor_envio',
        shippingQuoteId: quotes.melhorEnvioQuotes[0]!.id,
        address: VALID_ADDRESS,
        items: [
          {
            productId: 'prod-luminaria-acrilico',
            quantity: 1,
            personalizations: [
              {
                fieldId: 'pf-lum-frase',
                fieldKey: 'frase_gravada',
                textValue: 'Nosso Dia Especial',
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/obrigatório/i);

    // With valid private bucket file upload
    const orderRes = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'melhor_envio',
      shippingQuoteId: quotes.melhorEnvioQuotes[0]!.id,
      address: VALID_ADDRESS,
      items: [
        {
          productId: 'prod-luminaria-acrilico',
          quantity: 1,
          personalizations: [
            {
              fieldId: 'pf-lum-foto',
              fieldKey: 'foto_referencia',
              uploadedFile: {
                storageBucket: 'custom-uploads-private',
                storagePath: 'personalizations/2026-10-16/retrato-casal.png',
                originalName: 'retrato-casal.png',
                mimeType: 'image/png',
                sizeBytes: 245000,
              },
            },
            {
              fieldId: 'pf-lum-frase',
              fieldKey: 'frase_gravada',
              textValue: 'Nosso Dia Especial',
            },
          ],
        },
      ],
    });

    expect(orderRes.order.items[0]!.customizations[0]!.storageBucket).toBe(
      'custom-uploads-private'
    );
  });

  // Scenario 4: Variações
  it('4. enforces variant selection and applies variant-specific pricing and stock', async () => {
    // Missing variantId on product with variants must fail
    await expect(
      createOrderAndInfinitePayCheckout({
        customer: VALID_CUSTOMER,
        deliveryMethod: 'local_pickup',
        address: VALID_ADDRESS,
        items: [
          {
            productId: 'prod-porta-joias',
            variantId: null,
            quantity: 1,
            personalizations: [
              {
                fieldId: 'pf-pj-iniciais',
                fieldKey: 'iniciais_monograma',
                textValue: 'B.S.',
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/Selecione uma variação/i);

    // Selecting Grande Duplo variant (promotionalPriceOverrideCents = 15900)
    const res = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'local_pickup',
      address: VALID_ADDRESS,
      items: [
        {
          productId: 'prod-porta-joias',
          variantId: 'var-pj-salvia-g',
          quantity: 2,
          personalizations: [
            {
              fieldId: 'pf-pj-iniciais',
              fieldKey: 'iniciais_monograma',
              textValue: 'B.S.',
            },
          ],
        },
      ],
    });

    expect(res.order.items[0]!.unitBasePriceCents).toBe(15900);
    expect(res.order.subtotalCents).toBe(31800);
  });

  // Scenario 5: Estoque insuficiente & produto indisponível
  it('5. blocks checkout when stock is insufficient or product is temporarily unavailable', async () => {
    await expect(
      createOrderAndInfinitePayCheckout({
        customer: VALID_CUSTOMER,
        deliveryMethod: 'local_pickup',
        address: VALID_ADDRESS,
        items: [
          {
            productId: 'prod-vela-botanica',
            quantity: 99, // Only 25 in stock
            personalizations: [],
          },
        ],
      })
    ).rejects.toThrow(/Estoque insuficiente/i);

    await expect(
      createOrderAndInfinitePayCheckout({
        customer: VALID_CUSTOMER,
        deliveryMethod: 'local_pickup',
        address: VALID_ADDRESS,
        items: [
          {
            productId: 'prod-caixa-musical-nogueira', // temporarily_unavailable
            quantity: 1,
            personalizations: [],
          },
        ],
      })
    ).rejects.toThrow(/temporariamente indisponível/i);
  });

  // Scenario 6: Carrinho com vários produtos (incluindo Kit Presenteável)
  it('6. processes multi-item cart combining regular product, variant product, and gift kit', async () => {
    const res = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'local_pickup',
      address: VALID_ADDRESS,
      items: [
        {
          productId: 'prod-vela-botanica',
          quantity: 1,
          personalizations: [],
        },
        {
          productId: 'prod-box-ritual-afeto',
          quantity: 1,
          personalizations: [
            {
              fieldId: 'pf-kit-nome-tampa',
              fieldKey: 'nome_tampa_caixa',
              textValue: 'Dra. Camila',
            },
            {
              fieldId: 'pf-kit-cartao',
              fieldKey: 'mensagem_cartao',
              textValue: 'Parabéns pela conquista!',
            },
          ],
        },
      ],
    });

    expect(res.order.items).toHaveLength(2);
    expect(res.order.items[1]!.kitItemsSnapshot).toHaveLength(5);
    expect(res.order.productionDays).toBe(3); // max of 0 and 3
  });

  // Scenario 7: Cupom inválido, expirado ou abaixo do pedido mínimo
  it('7. rejects invalid, expired, or below-minimum coupons and applies valid coupon accurately', () => {
    expect(() => validateCouponForSubtotal('CUPOMFALSO', 15000)).toThrow(/inválido/i);
    expect(() => validateCouponForSubtotal('NATAL2024', 15000)).toThrow(
      /inválido ou inativo/i
    );
    expect(() => validateCouponForSubtotal('AFETO25', 10000)).toThrow(
      /exige pedido mínimo/i
    );

    const valid = validateCouponForSubtotal('BEMVINDO10', 20000);
    expect(valid.discountCents).toBe(2000);
  });

  // Scenario 8: Retirada local
  it('8. handles local pickup with zero shipping fee, generates pickup code, and confirms staff handover', async () => {
    const created = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'local_pickup',
      address: VALID_ADDRESS,
      items: [{ productId: 'prod-vela-botanica', quantity: 1, personalizations: [] }],
    });

    expect(created.order.shippingCents).toBe(0);
    expect(created.order.pickupCode).toMatch(/^RET-[A-F0-9]{6}$/);

    // Confirm payment first
    confirmOrderPaymentIdempotent({
      orderNsu: created.payment.orderNsu,
      transactionNsu: 'tx-pickup-001',
      paidAmountCents: created.order.totalCents,
      rawPayload: {},
    });

    // Wrong pickup code must fail
    expect(() =>
      confirmLocalPickupHandover({
        orderId: created.order.id,
        pickupCode: 'RET-ERRADO',
        pickedUpByName: 'Beatriz',
        pickedUpByDocument: '12345678901',
      })
    ).toThrow(/código de retirada informado é inválido/i);

    // Valid pickup code confirms handover
    const handedOver = confirmLocalPickupHandover({
      orderId: created.order.id,
      pickupCode: created.order.pickupCode!,
      pickedUpByName: 'Beatriz Helena Souza',
      pickedUpByDocument: '12345678901',
    });
    expect(handedOver.operationalStatus).toBe('picked_up');
    expect(handedOver.shipment?.status).toBe('picked_up');
  });

  // Scenario 9 & 10: Cotação de frete & Frete indisponível
  it('9 & 10. calculates Mejor Envio and Own Delivery quotes by CEP and handles unavailable postal codes', async () => {
    const validQuotes = await calculateAllDeliveryOptions({
      destinationPostalCode: '01310-100',
      items: [{ productId: 'prod-vela-botanica', quantity: 2 }],
    });
    expect(validQuotes.melhorEnvioQuotes.length).toBeGreaterThanOrEqual(2);
    expect(validQuotes.ownDeliveryOptions.length).toBeGreaterThanOrEqual(1);

    // Unavailable postal code 99999-999 returns empty carrier options
    const unavailableQuotes = await calculateAllDeliveryOptions({
      destinationPostalCode: '99999-999',
      items: [{ productId: 'prod-vela-botanica', quantity: 1 }],
    });
    expect(unavailableQuotes.melhorEnvioQuotes).toHaveLength(0);
    expect(unavailableQuotes.ownDeliveryOptions).toHaveLength(0);
  });

  // Scenario 11, 12, 13, 14, 15, 16: InfinitePay Checkout, Pending, Confirmed, Duplicate Webhook, Divergent Amount, Customer Doesn't Return
  it('11-16. manages full InfinitePay lifecycle: checkout in cents, pending retry, idempotent confirmation, divergent amount rejection, and server reconciliation', async () => {
    const created = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'local_pickup',
      address: VALID_ADDRESS,
      items: [{ productId: 'prod-vela-botanica', quantity: 2, personalizations: [] }],
    });

    // 11 & 12: Order starts pending, total in cents = 19600
    expect(created.order.financialStatus).toBe('pending');
    expect(created.order.totalCents).toBe(19600);

    // Retry payment link on pending order reuses same order without duplicating
    const retried = await retryOrderPaymentLink(created.order.orderNumber);
    expect(retried.order.id).toBe(created.order.id);
    expect(getDbState().orders).toHaveLength(1);

    // 15: Divergent (lower) paid amount must be rejected
    expect(() =>
      confirmOrderPaymentIdempotent({
        orderNsu: created.payment.orderNsu,
        transactionNsu: 'tx-underpaid',
        paidAmountCents: 10000, // expected 19600
        rawPayload: { paid_amount: 10000 },
      })
    ).toThrow(/diverge do valor do pedido/i);

    // 13: Valid payment confirmation commits stock and updates status once
    const stockBefore = getProductById('prod-vela-botanica')!.stockQuantity;
    const firstConfirm = confirmOrderPaymentIdempotent({
      orderNsu: created.payment.orderNsu,
      transactionNsu: 'tx-valid-19600',
      paidAmountCents: 19600,
      captureMethod: 'pix',
      rawPayload: { paid_amount: 19600 },
      idempotencyKey: 'webhook-tx-valid-19600',
    });

    expect(firstConfirm.alreadyProcessed).toBe(false);
    expect(firstConfirm.order.financialStatus).toBe('paid');
    expect(firstConfirm.order.operationalStatus).toBe('in_production');
    const productAfterCommit = getProductById('prod-vela-botanica')!;
    expect(productAfterCommit.stockQuantity).toBe(stockBefore - 2);
    expect(productAfterCommit.reservedQuantity).toBe(0);

    // 14: Repeated webhook with same or new idempotency key must NOT deduct stock again
    const duplicateConfirm = confirmOrderPaymentIdempotent({
      orderNsu: created.payment.orderNsu,
      transactionNsu: 'tx-valid-19600',
      paidAmountCents: 19600,
      rawPayload: { paid_amount: 19600 },
      idempotencyKey: 'webhook-tx-valid-19600-retry',
    });
    expect(duplicateConfirm.alreadyProcessed).toBe(true);
    expect(getProductById('prod-vela-botanica')!.stockQuantity).toBe(stockBefore - 2);

    // 16: Customer who does not return to the store -> server-side reconciliation via /payment_check
    const secondOrder = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'local_pickup',
      address: VALID_ADDRESS,
      items: [{ productId: 'prod-vela-botanica', quantity: 1, personalizations: [] }],
    });

    vi.spyOn(infinitePayAdapter, 'checkPaymentStatus').mockResolvedValueOnce({
      success: true,
      paid: true,
      amount: secondOrder.order.totalCents,
      paid_amount: secondOrder.order.totalCents,
      installments: 1,
      capture_method: 'credit_card',
      transaction_nsu: 'tx-reconciled-999',
      order_nsu: secondOrder.payment.orderNsu,
      slug: 'inv-999',
      raw: { paid: true },
    });

    const reconciled = await reconcilePendingPaymentWithProvider({
      orderNsu: secondOrder.payment.orderNsu,
    });
    expect(reconciled.paid).toBe(true);
    expect(reconciled.order.financialStatus).toBe('paid');
  });

  // Scenario 17: Cancelamento e reembolso com devolução de estoque
  it('17. cancels or refunds an order and restores reserved or committed inventory', async () => {
    const initialStock = getProductById('prod-vela-botanica')!.stockQuantity;
    const created = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'local_pickup',
      address: VALID_ADDRESS,
      items: [{ productId: 'prod-vela-botanica', quantity: 3, personalizations: [] }],
    });

    confirmOrderPaymentIdempotent({
      orderNsu: created.payment.orderNsu,
      transactionNsu: 'tx-to-refund',
      paidAmountCents: created.order.totalCents,
      rawPayload: {},
    });
    expect(getProductById('prod-vela-botanica')!.stockQuantity).toBe(initialStock - 3);

    const refunded = cancelOrRefundOrder({
      orderId: created.order.id,
      reason: 'Reembolso solicitado pelo cliente e conciliado na InfinitePay.',
      refundAmountCents: created.order.totalCents,
      providerRefundReference: 'inf-ref-001',
    });

    expect(refunded.financialStatus).toBe('refunded');
    expect(refunded.operationalStatus).toBe('cancelled');
    expect(getProductById('prod-vela-botanica')!.stockQuantity).toBe(initialStock);
  });

  // Scenario 18: Aprovação e rejeição de arte
  it('18. executes full artwork preview, customer revision request, and final approval workflow', async () => {
    const created = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'local_pickup',
      address: VALID_ADDRESS,
      items: [
        {
          productId: 'prod-album-linho',
          quantity: 1,
          personalizations: [
            {
              fieldId: 'pf-album-titulo',
              fieldKey: 'titulo_capa',
              textValue: 'Bodas de Ouro',
            },
            {
              fieldId: 'pf-album-cor-linho',
              fieldKey: 'cor_linho',
              selectedOptionValue: 'areia_natural',
            },
            {
              fieldId: 'pf-album-acabamento',
              fieldKey: 'acabamento_gravacao',
              selectedOptionValue: 'ouro',
            },
          ],
        },
      ],
    });

    confirmOrderPaymentIdempotent({
      orderNsu: created.payment.orderNsu,
      transactionNsu: 'tx-art-01',
      paidAmountCents: created.order.totalCents,
      rawPayload: {},
    });

    const item = created.order.items[0]!;
    // Admin uploads v1 preview
    const previewV1 = uploadDesignPreviewForOrder({
      orderId: created.order.id,
      orderItemId: item.id,
      previewStoragePath: 'previews/v1-bodas.png',
      designerNotes: 'Primeira prova tipográfica em dourado.',
    });
    expect(previewV1.status).toBe('awaiting_customer');

    // Customer requests revision
    const rejected = submitCustomerDesignDecision({
      orderNumber: created.order.orderNumber,
      lookupToken: created.order.lookupToken,
      approvalId: previewV1.id,
      decision: 'revision_requested',
      customerFeedback: 'Por favor, centralizar a data logo abaixo do título.',
    });
    expect(rejected.approval.status).toBe('revision_requested');
    expect(rejected.order.operationalStatus).toBe('awaiting_art_approval');

    // Admin uploads v2 preview
    const previewV2 = uploadDesignPreviewForOrder({
      orderId: created.order.id,
      orderItemId: item.id,
      previewStoragePath: 'previews/v2-bodas.png',
      designerNotes: 'Data centralizada conforme solicitado.',
    });
    expect(previewV2.version).toBe(2);

    // Customer approves v2 -> order transitions to in_production
    const approved = submitCustomerDesignDecision({
      orderNumber: created.order.orderNumber,
      lookupToken: created.order.lookupToken,
      approvalId: previewV2.id,
      decision: 'approved',
    });
    expect(approved.approval.status).toBe('approved');
    expect(approved.order.operationalStatus).toBe('in_production');
  });

  // Scenario 19 & 20: Compra de etiqueta Mejor Envio e Rastreamento
  it('19 & 20. prevents label purchase before payment confirmation, supports manual cart insertion and automated label generation, and tracks shipment', async () => {
    const quotes = await calculateAllDeliveryOptions({
      destinationPostalCode: '01310100',
      items: [{ productId: 'prod-vela-botanica', quantity: 1 }],
    });

    const created = await createOrderAndInfinitePayCheckout({
      customer: VALID_CUSTOMER,
      deliveryMethod: 'melhor_envio',
      shippingQuoteId: quotes.melhorEnvioQuotes[0]!.id,
      address: VALID_ADDRESS,
      items: [{ productId: 'prod-vela-botanica', quantity: 1, personalizations: [] }],
    });

    // Attempting to generate label while order is still unpaid must throw!
    await expect(
      generateShipmentLabelForOrder({
        orderId: created.order.id,
        executePurchaseNow: true,
      })
    ).rejects.toThrow(/antes da confirmação do pagamento/i);

    // Confirm payment
    confirmOrderPaymentIdempotent({
      orderNsu: created.payment.orderNsu,
      transactionNsu: 'tx-me-label',
      paidAmountCents: created.order.totalCents,
      rawPayload: {},
    });

    // Insert into Mejor Envio cart for manual wallet checkout
    const manualCart = await generateShipmentLabelForOrder({
      orderId: created.order.id,
      executePurchaseNow: false,
    });
    expect(manualCart.status).toBe('cart_inserted');

    // Execute automated label purchase & generation
    const generatedLabel = await generateShipmentLabelForOrder({
      orderId: created.order.id,
      executePurchaseNow: true,
    });
    expect(generatedLabel.status).toBe('label_generated');
    expect(generatedLabel.trackingCode).toBeTruthy();

    // Track shipment
    const tracking = await melhorEnvioAdapter.trackShipment({
      melhorEnvioOrderId: generatedLabel.melhorEnvioOrderId,
      trackingCode: generatedLabel.trackingCode,
    });
    expect(tracking.trackingCode).toBe(generatedLabel.trackingCode);
    expect(tracking.events.length).toBeGreaterThan(0);
  });

  // Scenario 21 & 22: Tentativa de acesso não autorizado & CRUD administrativo
  it('21 & 22. blocks unauthorized admin access and allows authorized admin to create, edit, CSV import, and soft-delete products', async () => {
    const unauthReq = new Request('http://localhost:3000/api/admin/products');
    await expect(requireAdminSession(unauthReq)).rejects.toThrow(/Acesso restrito/i);

    const authReq = new Request('http://localhost:3000/api/admin/products', {
      headers: { 'x-admin-role-token': 'anis-admin-verified-session' },
    });
    const admin = await requireAdminSession(authReq);
    expect(admin.role).toBe('super_admin');

    const imported = importProductsFromCsvText(
      'nome,sku,preco_centavos,estoque\nDifusor Bambu Imperial,ANIS-DIF-777,13500,18'
    );
    expect(imported.importedCount).toBe(1);

    const newProd = imported.products[0]!;
    softDeleteProductAdmin(newProd.id);
    expect(listProducts().some((p) => p.id === newProd.id)).toBe(false);
  });
});
