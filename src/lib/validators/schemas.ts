import { z } from 'zod';
import { isValidCpfOrCnpj, normalizePostalCode } from '@/lib/utils';

export const customerPersonalizationInputSchema = z.object({
  fieldId: z.string().min(1),
  fieldKey: z.string().min(1),
  textValue: z.string().optional(),
  selectedOptionValue: z.string().optional(),
  uploadedFile: z
    .object({
      storageBucket: z.string().min(1),
      storagePath: z.string().min(1),
      originalName: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      signedPreviewUrl: z.string().optional(),
    })
    .optional(),
});

export const cartItemRequestSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(100),
  personalizations: z.array(customerPersonalizationInputSchema).default([]),
});

export const shippingQuoteRequestSchema = z.object({
  destinationPostalCode: z
    .string()
    .transform((v) => normalizePostalCode(v))
    .refine((v) => v.length === 8, 'Informe um CEP válido com 8 dígitos.'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().nullable().optional(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, 'Adicione ao menos um item para calcular o frete.'),
});

export const checkoutRequestSchema = z.object({
  customer: z.object({
    fullName: z.string().min(3, 'Informe seu nome completo.'),
    email: z.string().email('Informe um e-mail válido.'),
    phone: z.string().min(10, 'Informe um telefone/WhatsApp válido com DDD.'),
    documentCpfCnpj: z
      .string()
      .refine((v) => isValidCpfOrCnpj(v), 'Informe um CPF ou CNPJ válido.'),
    lgpdAccepted: z.literal(true, {
      errorMap: () => ({
        message: 'É necessário concordar com a Política de Privacidade (LGPD).',
      }),
    }),
  }),
  deliveryMethod: z.enum(['melhor_envio', 'local_pickup', 'own_delivery']),
  shippingQuoteId: z.string().optional().nullable(),
  pickupLocationId: z.string().optional().nullable(),
  ownDeliveryRegionId: z.string().optional().nullable(),
  address: z.object({
    recipientName: z.string().min(2, 'Informe o nome do destinatário.'),
    postalCode: z
      .string()
      .transform((v) => normalizePostalCode(v))
      .refine((v) => v.length === 8, 'CEP inválido.'),
    street: z.string().min(2, 'Informe o logradouro.'),
    number: z.string().min(1, 'Informe o número.'),
    complement: z.string().optional(),
    neighborhood: z.string().min(2, 'Informe o bairro.'),
    city: z.string().min(2, 'Informe a cidade.'),
    state: z.string().length(2, 'Informe a UF com 2 letras.'),
    reference: z.string().optional(),
  }),
  items: z.array(cartItemRequestSchema).min(1, 'O carrinho não pode estar vazio.'),
  couponCode: z.string().optional().nullable(),
  customerNotes: z.string().max(500).optional(),
});

export const infinitePayWebhookSchema = z.object({
  order_nsu: z.string().min(1),
  transaction_nsu: z.string().min(1),
  invoice_slug: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  amount: z.number().int().positive().optional(),
  paid_amount: z.number().int().positive(),
  installments: z.number().int().min(1).optional().default(1),
  capture_method: z.string().optional().default('pix'),
  receipt_url: z.string().url().optional().nullable(),
});

export const productUpsertSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  name: z.string().min(3, 'O nome do produto deve ter no mínimo 3 caracteres.'),
  slug: z.string().min(3).optional(),
  sku: z.string().min(2, 'Informe o código SKU.'),
  shortDescription: z.string().min(10, 'Informe uma descrição curta.'),
  fullDescription: z.string().min(20, 'Informe uma descrição completa.'),
  productType: z.enum([
    'regular_stock',
    'personalized',
    'made_to_order',
    'with_variants',
    'gift_kit',
    'temporarily_unavailable',
  ]),
  priceCents: z.number().int().min(100, 'O preço mínimo é R$ 1,00.'),
  promotionalPriceCents: z.number().int().min(0).nullable().optional(),
  internalCostCents: z.number().int().min(0).nullable().optional(),
  stockQuantity: z.number().int().min(0),
  trackInventory: z.boolean().default(true),
  weightGrams: z.number().int().min(10),
  heightCm: z.number().positive(),
  widthCm: z.number().positive(),
  lengthCm: z.number().positive(),
  productionDays: z.number().int().min(0),
  requiresArtApproval: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  occasions: z.array(z.string()).default([]),
  kitItems: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().min(1),
        description: z.string().optional(),
      })
    )
    .default([]),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
});

export const designApprovalDecisionSchema = z.object({
  orderNumber: z.string().min(1),
  lookupToken: z.string().min(1),
  approvalId: z.string().min(1),
  decision: z.enum(['approved', 'revision_requested']),
  customerFeedback: z.string().max(1000).optional(),
});
