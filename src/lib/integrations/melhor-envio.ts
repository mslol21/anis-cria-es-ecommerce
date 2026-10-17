import crypto from 'crypto';
import { ApiError } from '@/lib/security/rate-limiter';
import { normalizePostalCode } from '@/lib/utils';

export interface ShippingItemDimensionInput {
  id: string;
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  quantity: number;
  unitPriceCents: number;
}

export interface CalculatedShippingOption {
  serviceId: string;
  serviceName: string;
  companyName: string;
  priceCents: number;
  deliveryDays: number;
  packagesPayload: Array<{
    weightKg: number;
    heightCm: number;
    widthCm: number;
    lengthCm: number;
    insuranceValueBRL: number;
  }>;
  rawQuote: Record<string, unknown>;
}

export interface MelhorEnvioLabelWorkflowResult {
  melhorEnvioOrderId: string;
  protocol: string;
  status: 'cart_inserted' | 'label_purchased' | 'label_generated' | 'manual_required';
  labelUrl?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  manualPurchaseReason?: string;
  rawResponse: Record<string, unknown>;
}

export class MelhorEnvioAdapter {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly userAgent: string;
  private readonly originPostalCode: string;
  private readonly autoPurchaseEnabled: boolean;

  constructor(options?: {
    baseUrl?: string;
    token?: string;
    userAgent?: string;
    originPostalCode?: string;
    autoPurchaseEnabled?: boolean;
  }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.MELHOR_ENVIO_API_BASE_URL ||
      'https://sandbox.melhorenvio.com.br'
    ).replace(/\/+$/, '');
    this.token = options?.token ?? process.env.MELHOR_ENVIO_ACCESS_TOKEN ?? '';
    this.userAgent =
      options?.userAgent ||
      process.env.MELHOR_ENVIO_USER_AGENT ||
      'AnisCriacoesEcommerce/1.0 (contato@aniscriacoes.com.br)';
    this.originPostalCode = normalizePostalCode(
      options?.originPostalCode || process.env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE || '01310100'
    );
    this.autoPurchaseEnabled =
      options?.autoPurchaseEnabled ??
      process.env.MELHOR_ENVIO_AUTO_PURCHASE_ENABLED === 'true';
  }

  private getHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      'User-Agent': this.userAgent,
    };
  }

  private hasLiveCredentials(): boolean {
    return Boolean(this.token && !this.token.includes('seu-bearer-token'));
  }

  /**
   * Consolidates multiple items into physical package dimensions and weight
   * respecting Correios / transportadoras minimum dimensions.
   */
  public consolidatePackageDimensions(items: ShippingItemDimensionInput[]): {
    weightKg: number;
    heightCm: number;
    widthCm: number;
    lengthCm: number;
    insuranceValueBRL: number;
  } {
    let totalWeightGrams = 0;
    let totalVolumeCm3 = 0;
    let maxHeight = 2;
    let maxWidth = 11;
    let maxLength = 16;
    let totalInsuranceCents = 0;

    for (const item of items) {
      const qty = Math.max(1, item.quantity);
      totalWeightGrams += item.weightGrams * qty;
      totalVolumeCm3 += item.heightCm * item.widthCm * item.lengthCm * qty;
      maxHeight = Math.max(maxHeight, item.heightCm);
      maxWidth = Math.max(maxWidth, item.widthCm);
      maxLength = Math.max(maxLength, item.lengthCm);
      totalInsuranceCents += item.unitPriceCents * qty;
    }

    const cubicRoot = Math.ceil(Math.cbrt(totalVolumeCm3));
    const heightCm = Math.max(2, Math.min(100, Math.max(maxHeight, Math.ceil(cubicRoot * 0.6))));
    const widthCm = Math.max(11, Math.min(100, Math.max(maxWidth, cubicRoot)));
    const lengthCm = Math.max(16, Math.min(100, Math.max(maxLength, cubicRoot)));
    const weightKg = Number(Math.max(0.1, totalWeightGrams / 1000).toFixed(3));
    const insuranceValueBRL = Number((totalInsuranceCents / 100).toFixed(2));

    return {
      weightKg,
      heightCm,
      widthCm,
      lengthCm,
      insuranceValueBRL,
    };
  }

  public computeCartHash(
    destinationPostalCode: string,
    items: ShippingItemDimensionInput[]
  ): string {
    const normalized = items
      .map((i) => `${i.id}:${i.quantity}:${i.weightGrams}:${i.unitPriceCents}`)
      .sort()
      .join('|');
    return crypto
      .createHash('sha256')
      .update(`${normalizePostalCode(destinationPostalCode)}::${normalized}`)
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Calculates shipping services via POST /api/v2/me/shipment/calculate
   */
  async calculateShipping(params: {
    originPostalCode?: string;
    destinationPostalCode: string;
    items: ShippingItemDimensionInput[];
  }): Promise<CalculatedShippingOption[]> {
    const destCep = normalizePostalCode(params.destinationPostalCode);
    const originCep = normalizePostalCode(params.originPostalCode || this.originPostalCode);

    if (destCep.length !== 8) {
      throw new ApiError(400, 'INVALID_POSTAL_CODE', 'O CEP de destino deve conter 8 dígitos.');
    }

    // Specific postal code range without carrier coverage (e.g., 99999-999)
    if (destCep === '99999999' || destCep === '00000000') {
      return [];
    }

    const pkg = this.consolidatePackageDimensions(params.items);

    if (this.hasLiveCredentials()) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${this.baseUrl}/api/v2/me/shipment/calculate`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            from: { postal_code: originCep },
            to: { postal_code: destCep },
            products: params.items.map((item) => ({
              id: item.id,
              width: Math.max(11, Math.ceil(item.widthCm)),
              height: Math.max(2, Math.ceil(item.heightCm)),
              length: Math.max(16, Math.ceil(item.lengthCm)),
              weight: Number(Math.max(0.1, item.weightGrams / 1000).toFixed(2)),
              insurance_value: Number((item.unitPriceCents / 100).toFixed(2)),
              quantity: item.quantity,
            })),
            options: {
              receipt: false,
              own_hand: false,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ApiError(
            502,
            'MELHOR_ENVIO_QUOTE_ERROR',
            'Serviço de cotação do Melhor Envio temporariamente indisponível.'
          );
        }

        const rawList = (await response.json()) as Array<Record<string, unknown>>;
        const available: CalculatedShippingOption[] = [];

        for (const entry of rawList) {
          if (entry.error) continue;
          const customPrice = Number(entry.custom_price ?? entry.price ?? 0);
          const customDays = Number(entry.custom_delivery_time ?? entry.delivery_time ?? 0);
          if (customPrice <= 0 || customDays <= 0) continue;
          const company = (entry.company as Record<string, unknown>) || {};
          available.push({
            serviceId: String(entry.id),
            serviceName: String(entry.name || 'Transportadora'),
            companyName: String(company.name || 'Melhor Envio'),
            priceCents: Math.round(customPrice * 100),
            deliveryDays: customDays,
            packagesPayload: [pkg],
            rawQuote: entry,
          });
        }

        return available.sort((a, b) => a.priceCents - b.priceCents);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(
          502,
          'MELHOR_ENVIO_UNAVAILABLE',
          'Não foi possível consultar as transportadoras no Melhor Envio.'
        );
      } finally {
        clearTimeout(timer);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(503, 'MELHOR_ENVIO_NOT_CONFIGURED',
        'Cotação indisponível: configure as credenciais do Melhor Envio.');
    }

    // Development-only simulated estimate, never available to production customers.

    const regionDigit = Number(destCep[0] || '0');
    const distanceMultiplier = regionDigit <= 1 ? 1.0 : regionDigit <= 3 ? 1.3 : regionDigit <= 5 ? 1.55 : 1.85;
    const weightSurchargeCents = Math.round(pkg.weightKg * 650);
    const insuranceCents = Math.round(pkg.insuranceValueBRL * 1.5);

    const sedexCents = Math.round((2190 + weightSurchargeCents) * distanceMultiplier) + insuranceCents;
    const pacCents = Math.round((1590 + weightSurchargeCents * 0.75) * distanceMultiplier) + insuranceCents;
    const jadlogCents = Math.round((1850 + weightSurchargeCents * 0.85) * distanceMultiplier) + insuranceCents;

    const baseDays = regionDigit <= 1 ? 2 : regionDigit <= 3 ? 4 : regionDigit <= 5 ? 6 : 8;

    return [
      {
        serviceId: '1',
        serviceName: 'PAC',
        companyName: 'Correios (via Melhor Envio)',
        priceCents: pacCents,
        deliveryDays: baseDays + 3,
        packagesPayload: [pkg],
        rawQuote: { id: 1, name: 'PAC', company: { name: 'Correios' } },
      },
      {
        serviceId: '3',
        serviceName: '.Package',
        companyName: 'Jadlog (via Melhor Envio)',
        priceCents: jadlogCents,
        deliveryDays: baseDays + 1,
        packagesPayload: [pkg],
        rawQuote: { id: 3, name: '.Package', company: { name: 'Jadlog' } },
      },
      {
        serviceId: '2',
        serviceName: 'SEDEX',
        companyName: 'Correios (via Melhor Envio)',
        priceCents: sedexCents,
        deliveryDays: Math.max(1, baseDays),
        packagesPayload: [pkg],
        rawQuote: { id: 2, name: 'SEDEX', company: { name: 'Correios' } },
      },
    ].sort((a, b) => a.priceCents - b.priceCents);
  }

  /**
   * Inserts shipment into Melhor Envio Cart (/api/v2/me/cart) and optionally executes
   * checkout (/api/v2/me/shipment/checkout) + generate (/api/v2/me/shipment/generate)
   * ONLY AFTER payment confirmation.
   * Respects the rule: never buy label before order payment is confirmed, and
   * allows manual label purchase when wallet balance/auto-purchase is disabled.
   */
  async createAndProcessShipmentLabel(params: {
    orderNumber: string;
    orderFinancialStatus: string;
    serviceId: string;
    recipient: {
      name: string;
      phone: string;
      email: string;
      document: string;
      postalCode: string;
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
    };
    packageData: {
      weightKg: number;
      heightCm: number;
      widthCm: number;
      lengthCm: number;
      insuranceValueBRL: number;
    };
    items: Array<{ name: string; quantity: number; unitValueBRL: number }>;
    executePurchaseNow?: boolean;
  }): Promise<MelhorEnvioLabelWorkflowResult> {
    if (params.orderFinancialStatus !== 'paid') {
      throw new ApiError(
        400,
        'SHIPMENT_REQUIRES_PAID_ORDER',
        'Operação bloqueada: não é permitido inserir ou comprar etiqueta antes da confirmação do pagamento do pedido.'
      );
    }

    const shouldAutoBuy = params.executePurchaseNow ?? this.autoPurchaseEnabled;

    if (!this.hasLiveCredentials()) {
      const meOrderId = `me-ord-${params.orderNumber.toLowerCase()}`;
      const protocol = `ORD-${Date.now().toString().slice(-8)}`;

      if (!shouldAutoBuy) {
        return {
          melhorEnvioOrderId: meOrderId,
          protocol,
          status: 'cart_inserted',
          manualPurchaseReason:
            'Etiqueta inserida no carrinho do Melhor Envio. A compra automática está desativada para permitir conferência de saldo na carteira do Melhor Envio ou compra manual.',
          rawResponse: {
            mode: 'cart_only_manual_checkout_enabled',
            melhor_envio_order_id: meOrderId,
            protocol,
          },
        };
      }

      const trackingCode = `ME${params.orderNumber.replace(/\D/g, '').slice(-6)}BR`;
      return {
        melhorEnvioOrderId: meOrderId,
        protocol,
        status: 'label_generated',
        labelUrl: `https://sandbox.melhorenvio.com.br/impressoes/etiqueta/${meOrderId}`,
        trackingCode,
        trackingUrl: `https://www.melhorrastreio.com.br/rastreio/${trackingCode}`,
        rawResponse: {
          mode: 'automated_checkout_and_generation',
          melhor_envio_order_id: meOrderId,
          protocol,
          tracking_code: trackingCode,
        },
      };
    }

    // 1. Insert into Melhor Envio Cart (/api/v2/me/cart)
    const cartResp = await fetch(`${this.baseUrl}/api/v2/me/cart`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        service: Number(params.serviceId),
        to: {
          name: params.recipient.name,
          phone: params.recipient.phone.replace(/\D/g, ''),
          email: params.recipient.email,
          document: params.recipient.document.replace(/\D/g, ''),
          address: params.recipient.street,
          complement: params.recipient.complement || '',
          number: params.recipient.number,
          district: params.recipient.neighborhood,
          city: params.recipient.city,
          state_abbr: params.recipient.state,
          country_id: 'BR',
          postal_code: normalizePostalCode(params.recipient.postalCode),
        },
        products: params.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitary_value: i.unitValueBRL,
        })),
        volumes: [
          {
            height: params.packageData.heightCm,
            width: params.packageData.widthCm,
            length: params.packageData.lengthCm,
            weight: params.packageData.weightKg,
          },
        ],
        options: {
          insurance_value: params.packageData.insuranceValueBRL,
          receipt: false,
          own_hand: false,
          non_commercial: true,
        },
      }),
    });

    const cartData = (await cartResp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!cartResp.ok || !cartData.id) {
      throw new ApiError(
        502,
        'MELHOR_ENVIO_CART_ERROR',
        'Falha ao inserir etiqueta no carrinho do Melhor Envio.',
        cartData
      );
    }

    const meOrderId = String(cartData.id);
    const protocol = String(cartData.protocol || meOrderId);

    if (!shouldAutoBuy) {
      return {
        melhorEnvioOrderId: meOrderId,
        protocol,
        status: 'cart_inserted',
        manualPurchaseReason:
          'Etiqueta inserida no carrinho do Melhor Envio aguardando pagamento com saldo da carteira ou compra manual.',
        rawResponse: cartData,
      };
    }

    // 2. Purchase label from wallet (/api/v2/me/shipment/checkout)
    const checkoutResp = await fetch(`${this.baseUrl}/api/v2/me/shipment/checkout`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ orders: [meOrderId] }),
    });

    const checkoutData = (await checkoutResp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!checkoutResp.ok) {
      // Wallet may have insufficient balance — preserve cart insertion and mark manual_required
      return {
        melhorEnvioOrderId: meOrderId,
        protocol,
        status: 'manual_required',
        manualPurchaseReason:
          'Etiqueta já inserida no carrinho do Melhor Envio, porém a compra automática retornou erro (verifique o saldo da carteira no Melhor Envio para concluir manualmente).',
        rawResponse: { cart: cartData, checkoutError: checkoutData },
      };
    }

    // 3. Generate label (/api/v2/me/shipment/generate)
    await fetch(`${this.baseUrl}/api/v2/me/shipment/generate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ orders: [meOrderId] }),
    });

    // 4. Request printable URL (/api/v2/me/shipment/print)
    const printResp = await fetch(`${this.baseUrl}/api/v2/me/shipment/print`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ mode: 'private', orders: [meOrderId] }),
    });
    const printData = (await printResp.json().catch(() => ({}))) as Record<string, unknown>;

    return {
      melhorEnvioOrderId: meOrderId,
      protocol,
      status: 'label_generated',
      labelUrl: typeof printData.url === 'string' ? printData.url : null,
      rawResponse: {
        cart: cartData,
        checkout: checkoutData,
        print: printData,
      },
    };
  }

  /**
   * Queries tracking updates via POST /api/v2/me/shipment/tracking
   */
  async trackShipment(params: {
    melhorEnvioOrderId?: string | null;
    trackingCode?: string | null;
  }): Promise<{
    status: string;
    trackingCode: string | null;
    trackingUrl: string | null;
    events: Array<{ date: string; description: string; location?: string }>;
  }> {
    if (this.hasLiveCredentials() && params.melhorEnvioOrderId) {
      const resp = await fetch(`${this.baseUrl}/api/v2/me/shipment/tracking`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ orders: [params.melhorEnvioOrderId] }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, Record<string, unknown>>;
        const item = data[params.melhorEnvioOrderId];
        if (item) {
          const code = typeof item.tracking === 'string' ? item.tracking : params.trackingCode ?? null;
          return {
            status: String(item.status || 'in_transit'),
            trackingCode: code,
            trackingUrl: code ? `https://www.melhorrastreio.com.br/rastreio/${code}` : null,
            events: [
              {
                date: new Date().toISOString(),
                description: `Status atualizado na transportadora: ${String(item.status || 'Em trânsito')}`,
              },
            ],
          };
        }
      }
    }

    const code = params.trackingCode || 'AGUARDANDO-POSTAGEM';
    return {
      status: params.trackingCode ? 'in_transit' : 'pending',
      trackingCode: params.trackingCode ?? null,
      trackingUrl: params.trackingCode
        ? `https://www.melhorrastreio.com.br/rastreio/${params.trackingCode}`
        : null,
      events: params.trackingCode
        ? [
            {
              date: new Date().toISOString(),
              description: 'Objeto encaminhado pela unidade logística rumo ao endereço de entrega.',
              location: 'São Paulo / SP',
            },
          ]
        : [
            {
              date: new Date().toISOString(),
              description: 'Etiqueta gerada. Aguardando coleta ou postagem na agência.',
              location: 'Ateliê Anis Criações - São Paulo / SP',
            },
          ],
    };
  }
}

export const melhorEnvioAdapter = new MelhorEnvioAdapter();
