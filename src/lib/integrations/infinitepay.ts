import { ApiError } from '@/lib/security/rate-limiter';
import { maskSensitiveData } from '@/lib/utils';

export interface InfinitePayCheckoutItem {
  quantity: number;
  price: number; // integer in cents
  description: string;
}

export interface InfinitePayCreateLinkPayload {
  handle: string;
  order_nsu: string;
  items: InfinitePayCheckoutItem[];
  redirect_url: string;
  webhook_url: string;
  customer?: {
    name?: string;
    email?: string;
    phone_number?: string;
  };
  address?: {
    cep?: string;
    number?: string;
    complement?: string;
  };
}

export interface InfinitePayCreateLinkResponse {
  url: string;
  slug?: string;
  order_nsu: string;
  raw: Record<string, unknown>;
}

export interface InfinitePayPaymentCheckRequest {
  handle: string;
  order_nsu: string;
  transaction_nsu?: string;
  slug?: string;
}

export interface InfinitePayPaymentCheckResponse {
  success: boolean;
  paid: boolean;
  amount: number;
  paid_amount: number;
  installments: number;
  capture_method: string;
  transaction_nsu?: string;
  order_nsu: string;
  slug?: string;
  receipt_url?: string;
  raw: Record<string, unknown>;
}

export class InfinitePayAdapter {
  private readonly baseUrl: string;
  private readonly defaultHandle: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; handle?: string; timeoutMs?: number }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.INFINITEPAY_API_BASE_URL ||
      'https://api.checkout.infinitepay.io'
    ).replace(/\/+$/, '');
    this.defaultHandle = (
      options?.handle ||
      process.env.INFINITEPAY_HANDLE ||
      'aniscriacoes'
    ).replace(/^\$/, '');
    this.timeoutMs = options?.timeoutMs ?? 12000;
  }

  /**
   * Requests an official Brazilian InfinitePay Checkout link via
   * POST https://api.checkout.infinitepay.io/links
   */
  async createCheckoutLink(params: {
    handle?: string;
    orderNsu: string;
    items: InfinitePayCheckoutItem[];
    redirectUrl: string;
    webhookUrl: string;
    customer?: {
      name: string;
      email: string;
      phone: string;
    };
    address?: {
      cep: string;
      number: string;
      complement?: string;
    };
  }): Promise<InfinitePayCreateLinkResponse> {
    const handle = (params.handle || this.defaultHandle).replace(/^\$/, '');
    if (!handle) {
      throw new ApiError(
        500,
        'INFINITEPAY_HANDLE_MISSING',
        'InfiniteTag (handle) da InfinitePay não configurada.'
      );
    }

    for (const item of params.items) {
      if (!Number.isInteger(item.price) || item.price <= 0) {
        throw new ApiError(
          400,
          'INVALID_ITEM_CENTS',
          `O valor do item "${item.description}" deve ser um inteiro positivo em centavos.`
        );
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ApiError(
          400,
          'INVALID_ITEM_QUANTITY',
          `A quantidade do item "${item.description}" deve ser um inteiro positivo.`
        );
      }
    }

    const payload: InfinitePayCreateLinkPayload = {
      handle,
      order_nsu: params.orderNsu,
      items: params.items,
      redirect_url: params.redirectUrl,
      webhook_url: params.webhookUrl,
      ...(params.customer
        ? {
            customer: {
              name: params.customer.name,
              email: params.customer.email,
              phone_number: params.customer.phone.replace(/\D/g, ''),
            },
          }
        : {}),
      ...(params.address
        ? {
            address: {
              cep: params.address.cep.replace(/\D/g, ''),
              number: params.address.number,
              complement: params.address.complement,
            },
          }
        : {}),
    };

    const hasLiveHandle =
      Boolean(process.env.INFINITEPAY_HANDLE) &&
      process.env.INFINITEPAY_HANDLE !== 'sua-infinite-tag';

    if (!hasLiveHandle && process.env.NODE_ENV !== 'production') {
      // Controlled deterministic link when live credentials are not yet set in local dev
      const fallbackUrl = `${params.redirectUrl}${params.redirectUrl.includes('?') ? '&' : '?'}order_nsu=${encodeURIComponent(params.orderNsu)}&slug=inv_${encodeURIComponent(params.orderNsu)}`;
      return {
        url: fallbackUrl,
        slug: `inv_${params.orderNsu}`,
        order_nsu: params.orderNsu,
        raw: {
          simulated_dev_mode: true,
          endpoint: `${this.baseUrl}/links`,
          request_payload: maskSensitiveData(payload as unknown as Record<string, unknown>),
          url: fallbackUrl,
        },
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok || typeof data.url !== 'string') {
        throw new ApiError(
          502,
          'INFINITEPAY_CREATE_LINK_FAILED',
          'Não foi possível gerar o link de pagamento na InfinitePay no momento.',
          {
            status: response.status,
            orderNsu: params.orderNsu,
          }
        );
      }

      return {
        url: data.url,
        slug: typeof data.slug === 'string' ? data.slug : undefined,
        order_nsu: params.orderNsu,
        raw: data,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(
          504,
          'INFINITEPAY_TIMEOUT',
          'Tempo limite excedido ao comunicar com o Checkout InfinitePay.'
        );
      }
      throw new ApiError(
        502,
        'INFINITEPAY_COMMUNICATION_ERROR',
        'Falha de comunicação com o provedor de pagamento InfinitePay.'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Queries transaction state directly on InfinitePay server via
   * POST https://api.checkout.infinitepay.io/payment_check
   */
  async checkPaymentStatus(
    params: InfinitePayPaymentCheckRequest
  ): Promise<InfinitePayPaymentCheckResponse> {
    const handle = (params.handle || this.defaultHandle).replace(/^\$/, '');
    const payload = {
      handle,
      order_nsu: params.order_nsu,
      ...(params.transaction_nsu ? { transaction_nsu: params.transaction_nsu } : {}),
      ...(params.slug ? { slug: params.slug } : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/payment_check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        throw new ApiError(
          502,
          'INFINITEPAY_PAYMENT_CHECK_FAILED',
          'Falha ao consultar status da transação na InfinitePay.',
          { status: response.status, orderNsu: params.order_nsu }
        );
      }

      return {
        success: Boolean(data.success ?? true),
        paid: Boolean(data.paid),
        amount: Number(data.amount ?? 0),
        paid_amount: Number(data.paid_amount ?? 0),
        installments: Number(data.installments ?? 1),
        capture_method: String(data.capture_method ?? 'pix'),
        transaction_nsu:
          typeof data.transaction_nsu === 'string'
            ? data.transaction_nsu
            : params.transaction_nsu,
        order_nsu: params.order_nsu,
        slug: typeof data.slug === 'string' ? data.slug : params.slug,
        receipt_url: typeof data.receipt_url === 'string' ? data.receipt_url : undefined,
        raw: data,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(
          504,
          'INFINITEPAY_CHECK_TIMEOUT',
          'Tempo limite excedido ao consultar pagamento na InfinitePay.'
        );
      }
      throw new ApiError(
        502,
        'INFINITEPAY_CHECK_NETWORK_ERROR',
        'Erro de rede ao consultar status de pagamento na InfinitePay.'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export const infinitePayAdapter = new InfinitePayAdapter();
