import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AuditLogEntry,
  Category,
  Coupon,
  CustomerPersonalizationInput,
  CustomerRecord,
  DeliveryMethod,
  DesignApproval,
  InventoryMovement,
  Order,
  OrderFinancialStatus,
  OrderItem,
  OrderItemCustomizationSnapshot,
  OrderOperationalStatus,
  PaymentEventRecord,
  PaymentRecord,
  PersonalizationField,
  PickupLocation,
  Product,
  ShipmentRecord,
  ShippingQuote,
  StoreSettings,
} from '@/types/database';
import {
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_PICKUP_LOCATIONS,
  INITIAL_PRODUCTS,
  INITIAL_STORE_SETTINGS,
} from './initial-data';
import { ApiError } from '@/lib/security/rate-limiter';
import { createSignedPrivateFileToken } from '@/lib/security/file-validator';
import { infinitePayAdapter, type InfinitePayCheckoutItem } from '@/lib/integrations/infinitepay';
import { melhorEnvioAdapter, type ShippingItemDimensionInput } from '@/lib/integrations/melhor-envio';
import { normalizeDocument, normalizePostalCode, slugify } from '@/lib/utils';

export interface PersistentDatabaseState {
  storeSettings: StoreSettings;
  categories: Category[];
  products: Product[];
  pickupLocations: PickupLocation[];
  coupons: Coupon[];
  shippingQuotes: ShippingQuote[];
  customers: CustomerRecord[];
  orders: Order[];
  payments: PaymentRecord[];
  paymentEvents: PaymentEventRecord[];
  shipments: ShipmentRecord[];
  designApprovals: DesignApproval[];
  inventoryMovements: InventoryMovement[];
  auditLogs: AuditLogEntry[];
  uploadedFiles: Record<
    string,
    {
      bucket: string;
      storagePath: string;
      mimeType: string;
      sizeBytes: number;
      base64Data: string;
      createdAt: string;
    }
  >;
  orderSeq: number;
}

function createFreshState(): PersistentDatabaseState {
  return {
    storeSettings: structuredClone(INITIAL_STORE_SETTINGS),
    categories: structuredClone(INITIAL_CATEGORIES),
    products: structuredClone(INITIAL_PRODUCTS),
    pickupLocations: structuredClone(INITIAL_PICKUP_LOCATIONS),
    coupons: structuredClone(INITIAL_COUPONS),
    shippingQuotes: [],
    customers: [],
    orders: [],
    payments: [],
    paymentEvents: [],
    shipments: [],
    designApprovals: [],
    inventoryMovements: [],
    auditLogs: [],
    uploadedFiles: {},
    orderSeq: 1001,
  };
}

let memoryState: PersistentDatabaseState | null = null;

function getDbFilePath(): string {
  const dir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore read-only environments
    }
  }
  return path.join(dir, 'anis-store-db.json');
}

export function getDbState(): PersistentDatabaseState {
  if (process.env.VITEST) {
    if (!memoryState) {
      memoryState = createFreshState();
    }
    return memoryState;
  }

  if (memoryState) return memoryState;

  const filePath = getDbFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      memoryState = JSON.parse(raw) as PersistentDatabaseState;
      return memoryState;
    } catch {
      memoryState = createFreshState();
      return memoryState;
    }
  }

  memoryState = createFreshState();
  saveDbState();
  return memoryState;
}

export function saveDbState(): void {
  if (process.env.VITEST || !memoryState) return;
  try {
    const filePath = getDbFilePath();
    fs.writeFileSync(filePath, JSON.stringify(memoryState, null, 2), 'utf8');
  } catch {
    // Serverless environment fallback keeps memoryState active
  }
}

export function resetTestDatabase(): void {
  memoryState = createFreshState();
}

// ==============================================================================
// 1. CATALOG & PRODUCT QUERIES
// ==============================================================================
export interface CatalogFilterOptions {
  search?: string;
  categorySlug?: string;
  occasion?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  onlyAvailable?: boolean;
  includeHiddenForAdmin?: boolean;
  sortBy?: 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'name_asc';
}

export function getEffectiveProductBasePriceCents(
  product: Product,
  variantId?: string | null
): number {
  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId && !v.deletedAt);
    if (variant) {
      if (
        variant.promotionalPriceOverrideCents !== null &&
        variant.promotionalPriceOverrideCents > 0
      ) {
        return variant.promotionalPriceOverrideCents;
      }
      if (variant.priceOverrideCents !== null && variant.priceOverrideCents > 0) {
        return variant.priceOverrideCents;
      }
    }
  }
  if (product.promotionalPriceCents !== null && product.promotionalPriceCents > 0) {
    return product.promotionalPriceCents;
  }
  return product.priceCents;
}

export function isProductAvailableForPurchase(
  product: Product,
  variantId?: string | null,
  requestedQty = 1
): { available: boolean; reason?: string; availableStock: number } {
  if (product.deletedAt || !product.isVisible) {
    return { available: false, reason: 'Produto não encontrado no catálogo.', availableStock: 0 };
  }

  if (!product.isAvailable || product.productType === 'temporarily_unavailable') {
    return {
      available: false,
      reason: `O produto "${product.name}" está temporariamente indisponível.`,
      availableStock: 0,
    };
  }

  if (product.productType === 'with_variants' && product.variants.length > 0 && !variantId) {
    return {
      available: false,
      reason: `Selecione uma variação para o produto "${product.name}".`,
      availableStock: 0,
    };
  }

  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId && !v.deletedAt);
    if (!variant || !variant.isAvailable) {
      return {
        available: false,
        reason: 'A variação selecionada não está disponível.',
        availableStock: 0,
      };
    }
    const availableStock = Math.max(0, variant.stockQuantity - variant.reservedQuantity);
    if (product.trackInventory && availableStock < requestedQty) {
      return {
        available: false,
        reason: `Estoque insuficiente para "${product.name} (${variant.name})". Disponível: ${availableStock}.`,
        availableStock,
      };
    }
    return { available: true, availableStock };
  }

  if (product.productType === 'made_to_order' || !product.trackInventory) {
    return { available: true, availableStock: 999 };
  }

  const availableStock = Math.max(0, product.stockQuantity - product.reservedQuantity);
  if (availableStock < requestedQty) {
    return {
      available: false,
      reason: `Estoque insuficiente para "${product.name}". Disponível: ${availableStock}.`,
      availableStock,
    };
  }

  return { available: true, availableStock };
}

export function listCategories(includeInactive = false): Category[] {
  const db = getDbState();
  return db.categories
    .filter((c) => !c.deletedAt && (includeInactive || c.isActive))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function listProducts(filters: CatalogFilterOptions = {}): Product[] {
  const db = getDbState();
  const categoriesById = new Map(db.categories.map((c) => [c.id, c]));

  let items = db.products
    .filter((p) => !p.deletedAt && (filters.includeHiddenForAdmin || p.isVisible))
    .map((p) => ({
      ...p,
      category: categoriesById.get(p.categoryId),
    }));

  if (filters.categorySlug) {
    items = items.filter((p) => p.category?.slug === filters.categorySlug);
  }

  if (filters.occasion) {
    const occLower = filters.occasion.toLowerCase();
    items = items.filter((p) => p.occasions.some((o) => o.toLowerCase() === occLower));
  }

  if (filters.search && filters.search.trim() !== '') {
    const q = filters.search.toLowerCase().trim();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.occasions.some((o) => o.toLowerCase().includes(q))
    );
  }

  if (filters.onlyAvailable) {
    items = items.filter((p) => isProductAvailableForPurchase(p, p.variants[0]?.id, 1).available);
  }

  if (typeof filters.minPriceCents === 'number') {
    const min = filters.minPriceCents;
    items = items.filter((p) => getEffectiveProductBasePriceCents(p) >= min);
  }

  if (typeof filters.maxPriceCents === 'number') {
    const max = filters.maxPriceCents;
    items = items.filter((p) => getEffectiveProductBasePriceCents(p) <= max);
  }

  const sortBy = filters.sortBy || 'featured';
  items.sort((a, b) => {
    if (sortBy === 'price_asc') {
      return getEffectiveProductBasePriceCents(a) - getEffectiveProductBasePriceCents(b);
    }
    if (sortBy === 'price_desc') {
      return getEffectiveProductBasePriceCents(b) - getEffectiveProductBasePriceCents(a);
    }
    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name, 'pt-BR');
    }
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // featured default
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  return items;
}

export function getProductBySlug(slug: string, includeHidden = false): Product | null {
  const db = getDbState();
  const product = db.products.find(
    (p) => p.slug === slug && !p.deletedAt && (includeHidden || p.isVisible)
  );
  if (!product) return null;
  const category = db.categories.find((c) => c.id === product.categoryId);
  return { ...product, category };
}

export function getProductById(id: string, includeDeleted = false): Product | null {
  const db = getDbState();
  const product = db.products.find((p) => p.id === id && (includeDeleted || !p.deletedAt));
  if (!product) return null;
  const category = db.categories.find((c) => c.id === product.categoryId);
  return { ...product, category };
}

// ==============================================================================
// 2. PERSONALIZATION VALIDATION & SERVER-SIDE PRICE RECALCULATION
// ==============================================================================
export function validateAndBuildPersonalizationSnapshot(
  product: Product,
  inputs: CustomerPersonalizationInput[]
): {
  unitPersonalizationPriceCents: number;
  snapshots: Omit<OrderItemCustomizationSnapshot, 'id' | 'orderItemId'>[];
} {
  const activeFields = product.personalizationFields.filter((f) => f.isActive);
  let unitPersonalizationPriceCents = 0;
  const snapshots: Omit<OrderItemCustomizationSnapshot, 'id' | 'orderItemId'>[] = [];

  for (const field of activeFields) {
    const submitted = inputs.find(
      (i) => i.fieldId === field.id || i.fieldKey === field.fieldKey
    );

    const hasText = Boolean(submitted?.textValue && submitted.textValue.trim() !== '');
    const hasOption = Boolean(
      submitted?.selectedOptionValue && submitted.selectedOptionValue.trim() !== ''
    );
    const hasFile = Boolean(submitted?.uploadedFile && submitted.uploadedFile.storagePath);

    const isProvided = hasText || hasOption || hasFile;

    if (field.isRequired && !isProvided) {
      throw new ApiError(
        400,
        'MISSING_REQUIRED_PERSONALIZATION',
        `O campo obrigatório "${field.label}" do produto "${product.name}" deve ser preenchido.`
      );
    }

    if (!isProvided) continue;

    // Validate text & date fields
    if (
      field.fieldType === 'short_text' ||
      field.fieldType === 'long_text' ||
      field.fieldType === 'additional_notes' ||
      field.fieldType === 'date'
    ) {
      const val = (submitted?.textValue || '').trim();
      if (field.maxLength && val.length > field.maxLength) {
        throw new ApiError(
          400,
          'PERSONALIZATION_MAX_LENGTH_EXCEEDED',
          `O campo "${field.label}" excede o limite de ${field.maxLength} caracteres.`
        );
      }
      unitPersonalizationPriceCents += field.priceAdditionCents;
      snapshots.push({
        fieldId: field.id,
        fieldKeySnapshot: field.fieldKey,
        fieldLabelSnapshot: field.label,
        fieldTypeSnapshot: field.fieldType,
        textValue: val,
        selectedOptionSnapshot: null,
        priceAdditionCentsSnapshot: field.priceAdditionCents,
      });
    }

    // Validate option_select & color_select
    if (field.fieldType === 'option_select' || field.fieldType === 'color_select') {
      const optVal = submitted?.selectedOptionValue || '';
      const matchedOpt = field.options.find((o) => o.value === optVal || o.id === optVal);
      if (!matchedOpt) {
        throw new ApiError(
          400,
          'INVALID_PERSONALIZATION_OPTION',
          `Opção inválida selecionada para o campo "${field.label}".`
        );
      }
      const addition = field.priceAdditionCents + (matchedOpt.priceAdditionCents || 0);
      unitPersonalizationPriceCents += addition;
      snapshots.push({
        fieldId: field.id,
        fieldKeySnapshot: field.fieldKey,
        fieldLabelSnapshot: field.label,
        fieldTypeSnapshot: field.fieldType,
        textValue: matchedOpt.label,
        selectedOptionSnapshot: structuredClone(matchedOpt),
        priceAdditionCentsSnapshot: addition,
      });
    }

    // Validate image_upload & art_upload
    if (field.fieldType === 'image_upload' || field.fieldType === 'art_upload') {
      const file = submitted?.uploadedFile;
      if (!file || !file.storagePath) {
        throw new ApiError(
          400,
          'MISSING_PERSONALIZATION_FILE',
          `Envie o arquivo obrigatório para "${field.label}".`
        );
      }
      if (
        field.allowedMimeTypes.length > 0 &&
        !field.allowedMimeTypes.includes(file.mimeType)
      ) {
        throw new ApiError(
          400,
          'INVALID_UPLOAD_MIME',
          `Tipo de arquivo (${file.mimeType}) não permitido para "${field.label}".`
        );
      }
      if (field.maxFileSizeBytes > 0 && file.sizeBytes > field.maxFileSizeBytes) {
        throw new ApiError(
          400,
          'UPLOAD_SIZE_EXCEEDED',
          `O arquivo enviado para "${field.label}" excede o tamanho máximo permitido.`
        );
      }
      unitPersonalizationPriceCents += field.priceAdditionCents;
      snapshots.push({
        fieldId: field.id,
        fieldKeySnapshot: field.fieldKey,
        fieldLabelSnapshot: field.label,
        fieldTypeSnapshot: field.fieldType,
        textValue: file.originalName,
        storageBucket: file.storageBucket || 'custom-uploads-private',
        storagePath: file.storagePath,
        fileOriginalName: file.originalName,
        fileMimeType: file.mimeType,
        fileSizeBytes: file.sizeBytes,
        priceAdditionCentsSnapshot: field.priceAdditionCents,
      });
    }
  }

  return { unitPersonalizationPriceCents, snapshots };
}

// ==============================================================================
// 3. COUPON VALIDATION
// ==============================================================================
export function validateCouponForSubtotal(
  code: string,
  subtotalPlusPersonalizationCents: number
): { coupon: Coupon; discountCents: number } {
  const db = getDbState();
  const normalizedCode = code.trim().toUpperCase();
  const coupon = db.coupons.find(
    (c) => c.code.toUpperCase() === normalizedCode && !c.deletedAt
  );

  if (!coupon || !coupon.isActive) {
    throw new ApiError(400, 'INVALID_COUPON', `O cupom "${normalizedCode}" é inválido ou inativo.`);
  }

  const now = Date.now();
  if (new Date(coupon.startsAt).getTime() > now) {
    throw new ApiError(400, 'COUPON_NOT_STARTED', 'Este cupom ainda não está vigente.');
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) {
    throw new ApiError(400, 'COUPON_EXPIRED', `O cupom "${normalizedCode}" está expirado.`);
  }
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw new ApiError(
      400,
      'COUPON_USAGE_LIMIT_REACHED',
      `O cupom "${normalizedCode}" atingiu o limite máximo de utilizações.`
    );
  }
  if (subtotalPlusPersonalizationCents < coupon.minOrderCents) {
    const minBRL = (coupon.minOrderCents / 100).toFixed(2).replace('.', ',');
    throw new ApiError(
      400,
      'COUPON_MIN_ORDER_NOT_MET',
      `O cupom "${normalizedCode}" exige pedido mínimo de R$ ${minBRL}.`
    );
  }

  let discountCents = 0;
  if (coupon.discountType === 'percentage') {
    discountCents = Math.round((subtotalPlusPersonalizationCents * coupon.discountValue) / 100);
    if (coupon.maxDiscountCents && discountCents > coupon.maxDiscountCents) {
      discountCents = coupon.maxDiscountCents;
    }
  } else {
    discountCents = coupon.discountValue;
  }

  discountCents = Math.min(discountCents, subtotalPlusPersonalizationCents);
  return { coupon, discountCents };
}

// ==============================================================================
// 4. SHIPPING QUOTES, LOCAL PICKUP & OWN DELIVERY
// ==============================================================================
export async function calculateAllDeliveryOptions(params: {
  destinationPostalCode: string;
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
}): Promise<{
  melhorEnvioQuotes: ShippingQuote[];
  localPickupLocations: PickupLocation[];
  ownDeliveryOptions: ShippingQuote[];
  maxProductionDays: number;
}> {
  const db = getDbState();
  const destCep = normalizePostalCode(params.destinationPostalCode);
  if (destCep.length !== 8) {
    throw new ApiError(400, 'INVALID_CEP', 'Informe um CEP válido com 8 dígitos.');
  }

  const dimensionItems: ShippingItemDimensionInput[] = [];
  let maxProductionDays = 0;

  for (const cartItem of params.items) {
    const product = getProductById(cartItem.productId);
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado para cálculo de frete.');
    }
    maxProductionDays = Math.max(maxProductionDays, product.productionDays);
    const variant = cartItem.variantId
      ? product.variants.find((v) => v.id === cartItem.variantId)
      : undefined;

    dimensionItems.push({
      id: variant ? `${product.id}:${variant.id}` : product.id,
      weightGrams: variant?.weightGrams ?? product.weightGrams,
      heightCm: product.heightCm,
      widthCm: product.widthCm,
      lengthCm: product.lengthCm,
      quantity: cartItem.quantity,
      unitPriceCents: getEffectiveProductBasePriceCents(product, cartItem.variantId),
    });
  }

  const cartHash = melhorEnvioAdapter.computeCartHash(destCep, dimensionItems);
  const rawQuotes = await melhorEnvioAdapter.calculateShipping({
    originPostalCode: db.storeSettings.originPostalCode,
    destinationPostalCode: destCep,
    items: dimensionItems,
  });

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const melhorEnvioQuotes: ShippingQuote[] = rawQuotes.map((rq) => {
    const quote: ShippingQuote = {
      id: `sq-${crypto.randomUUID()}`,
      customerPostalCode: destCep,
      cartHash,
      deliveryMethod: 'melhor_envio',
      serviceId: rq.serviceId,
      serviceName: rq.serviceName,
      companyName: rq.companyName,
      priceCents: rq.priceCents,
      deliveryDays: rq.deliveryDays,
      packagesPayload: rq.packagesPayload,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    db.shippingQuotes.push(quote);
    return quote;
  });

  // Own delivery check by CEP prefix
  const ownDeliveryOptions: ShippingQuote[] = [];
  if (db.storeSettings.ownDeliveryConfig.enabled) {
    const cepPrefix5 = destCep.slice(0, 5);
    for (const region of db.storeSettings.ownDeliveryConfig.regions) {
      if (
        region.isActive &&
        cepPrefix5 >= region.cepPrefixStart &&
        cepPrefix5 <= region.cepPrefixEnd
      ) {
        const ownQuote: ShippingQuote = {
          id: `sq-own-${crypto.randomUUID()}`,
          customerPostalCode: destCep,
          cartHash,
          deliveryMethod: 'own_delivery',
          serviceId: region.id,
          serviceName: `Entrega Própria — ${region.name}`,
          companyName: region.driverName,
          priceCents: region.feeCents,
          deliveryDays: region.estimatedDays,
          packagesPayload: [],
          expiresAt,
          createdAt: new Date().toISOString(),
        };
        db.shippingQuotes.push(ownQuote);
        ownDeliveryOptions.push(ownQuote);
      }
    }
  }

  const localPickupLocations = db.pickupLocations.filter((loc) => loc.isActive);
  saveDbState();

  return {
    melhorEnvioQuotes,
    localPickupLocations,
    ownDeliveryOptions,
    maxProductionDays,
  };
}

// ==============================================================================
// 5. CHECKOUT, STOCK RESERVATION & INFINITEPAY LINK CREATION
// ==============================================================================
export interface CreateOrderAndCheckoutInput {
  customer: {
    fullName: string;
    email: string;
    phone: string;
    documentCpfCnpj: string;
    lgpdAccepted: boolean;
  };
  deliveryMethod: DeliveryMethod;
  shippingQuoteId?: string | null;
  pickupLocationId?: string | null;
  address: {
    recipientName: string;
    postalCode: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    reference?: string;
  };
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    personalizations: CustomerPersonalizationInput[];
  }>;
  couponCode?: string | null;
  customerNotes?: string;
  appBaseUrl?: string;
}

export async function createOrderAndInfinitePayCheckout(
  input: CreateOrderAndCheckoutInput
): Promise<{
  order: Order;
  payment: PaymentRecord;
  checkoutUrl: string;
}> {
  const db = getDbState();

  // Release any expired stock reservations first
  releaseExpiredReservationsInternal();

  // 1. Validate all items, stock availability, and calculate server-side prices
  let subtotalCents = 0;
  let personalizationTotalCents = 0;
  let maxProductionDays = 0;
  const builtItems: OrderItem[] = [];
  const dimensionItems: ShippingItemDimensionInput[] = [];

  for (const reqItem of input.items) {
    const product = db.products.find((p) => p.id === reqItem.productId && !p.deletedAt);
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Um dos produtos selecionados não existe mais.');
    }

    const availCheck = isProductAvailableForPurchase(
      product,
      reqItem.variantId,
      reqItem.quantity
    );
    if (!availCheck.available) {
      throw new ApiError(
        409,
        'INSUFFICIENT_STOCK_OR_UNAVAILABLE',
        availCheck.reason || 'Produto sem estoque disponível.'
      );
    }

    const variant = reqItem.variantId
      ? product.variants.find((v) => v.id === reqItem.variantId && !v.deletedAt)
      : undefined;

    const unitBasePriceCents = getEffectiveProductBasePriceCents(product, reqItem.variantId);
    const { unitPersonalizationPriceCents, snapshots } =
      validateAndBuildPersonalizationSnapshot(product, reqItem.personalizations || []);

    const unitFinalPriceCents = unitBasePriceCents + unitPersonalizationPriceCents;
    const itemTotalCents = unitFinalPriceCents * reqItem.quantity;

    subtotalCents += unitBasePriceCents * reqItem.quantity;
    personalizationTotalCents += unitPersonalizationPriceCents * reqItem.quantity;
    maxProductionDays = Math.max(maxProductionDays, product.productionDays);

    const orderItemId = `oi-${crypto.randomUUID()}`;
    builtItems.push({
      id: orderItemId,
      orderId: '', // filled once orderId created
      productId: product.id,
      variantId: variant?.id ?? null,
      productNameSnapshot: product.name,
      variantNameSnapshot: variant?.name ?? null,
      skuSnapshot: variant?.sku ?? product.sku,
      quantity: reqItem.quantity,
      unitBasePriceCents,
      unitPersonalizationPriceCents,
      unitFinalPriceCents,
      totalPriceCents: itemTotalCents,
      productionDaysSnapshot: product.productionDays,
      requiresArtApproval: product.requiresArtApproval,
      kitItemsSnapshot: structuredClone(product.kitItems || []),
      customizations: snapshots.map((s) => ({
        ...s,
        id: `oic-${crypto.randomUUID()}`,
        orderItemId,
      })),
    });

    dimensionItems.push({
      id: variant ? `${product.id}:${variant.id}` : product.id,
      weightGrams: variant?.weightGrams ?? product.weightGrams,
      heightCm: product.heightCm,
      widthCm: product.widthCm,
      lengthCm: product.lengthCm,
      quantity: reqItem.quantity,
      unitPriceCents: unitFinalPriceCents,
    });
  }

  // 2. Validate & calculate coupon discount
  let discountCents = 0;
  let appliedCoupon: Coupon | null = null;
  if (input.couponCode && input.couponCode.trim() !== '') {
    const res = validateCouponForSubtotal(
      input.couponCode,
      subtotalCents + personalizationTotalCents
    );
    appliedCoupon = res.coupon;
    discountCents = res.discountCents;
  }

  // 3. Revalidate delivery method & shipping quote on server before charging
  let shippingCents = 0;
  let estimatedShippingDays = 0;
  let selectedQuote: ShippingQuote | null = null;
  let pickupLocation: PickupLocation | null = null;
  let pickupCode: string | null = null;

  const destCep = normalizePostalCode(input.address.postalCode);

  if (input.deliveryMethod === 'local_pickup') {
    pickupLocation =
      db.pickupLocations.find(
        (l) => l.isActive && (!input.pickupLocationId || l.id === input.pickupLocationId)
      ) || null;
    if (!pickupLocation) {
      throw new ApiError(
        400,
        'PICKUP_LOCATION_UNAVAILABLE',
        'Nenhum ponto de retirada local ativo disponível.'
      );
    }
    shippingCents = pickupLocation.feeCents;
    estimatedShippingDays = pickupLocation.minPrepDays;
    maxProductionDays = Math.max(maxProductionDays, pickupLocation.minPrepDays);
    pickupCode = `RET-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  } else if (input.deliveryMethod === 'melhor_envio' || input.deliveryMethod === 'own_delivery') {
    if (!input.shippingQuoteId) {
      throw new ApiError(
        400,
        'SHIPPING_QUOTE_REQUIRED',
        'Selecione uma opção de frete válida antes de finalizar o pedido.'
      );
    }
    selectedQuote = db.shippingQuotes.find((q) => q.id === input.shippingQuoteId) || null;
    if (!selectedQuote) {
      throw new ApiError(
        400,
        'SHIPPING_QUOTE_NOT_FOUND',
        'A cotação de frete selecionada expirou ou não foi encontrada. Recalcule o frete.'
      );
    }
    if (new Date(selectedQuote.expiresAt).getTime() < Date.now()) {
      throw new ApiError(
        400,
        'SHIPPING_QUOTE_EXPIRED',
        'A cotação de frete expirou. Por favor, recalcule o frete.'
      );
    }
    if (normalizePostalCode(selectedQuote.customerPostalCode) !== destCep) {
      throw new ApiError(
        400,
        'SHIPPING_CEP_MISMATCH',
        'O CEP do endereço diverge do CEP utilizado na cotação do frete.'
      );
    }
    shippingCents = selectedQuote.priceCents;
    estimatedShippingDays = selectedQuote.deliveryDays;
  }

  const totalCents = Math.max(
    100,
    subtotalCents + personalizationTotalCents - discountCents + shippingCents
  );

  // 4. Reserve stock atomically
  const orderId = `ord-${crypto.randomUUID()}`;
  const reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  for (const reqItem of input.items) {
    const product = db.products.find((p) => p.id === reqItem.productId)!;
    if (product.trackInventory && product.productType !== 'made_to_order') {
      if (reqItem.variantId) {
        const variant = product.variants.find((v) => v.id === reqItem.variantId)!;
        const prevAvailable = variant.stockQuantity - variant.reservedQuantity;
        variant.reservedQuantity += reqItem.quantity;
        db.inventoryMovements.push({
          id: `imov-${crypto.randomUUID()}`,
          productId: product.id,
          variantId: variant.id,
          orderId,
          movementType: 'reservation',
          quantity: reqItem.quantity,
          previousStock: prevAvailable,
          newStock: prevAvailable - reqItem.quantity,
          expiresAt: reservationExpiresAt,
          notes: 'Reserva automática para pedido pendente',
          createdAt: new Date().toISOString(),
        });
      } else {
        const prevAvailable = product.stockQuantity - product.reservedQuantity;
        product.reservedQuantity += reqItem.quantity;
        db.inventoryMovements.push({
          id: `imov-${crypto.randomUUID()}`,
          productId: product.id,
          variantId: null,
          orderId,
          movementType: 'reservation',
          quantity: reqItem.quantity,
          previousStock: prevAvailable,
          newStock: prevAvailable - reqItem.quantity,
          expiresAt: reservationExpiresAt,
          notes: 'Reserva automática para pedido pendente',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  if (appliedCoupon) {
    appliedCoupon.usageCount += 1;
  }

  // 5. Create Customer & Order
  const customer: CustomerRecord = {
    id: `cust-${crypto.randomUUID()}`,
    fullName: input.customer.fullName.trim(),
    email: input.customer.email.trim().toLowerCase(),
    phone: input.customer.phone.trim(),
    documentCpfCnpj: normalizeDocument(input.customer.documentCpfCnpj),
    lgpdAcceptedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.customers.push(customer);

  const orderNumber = `ANIS-${new Date().getFullYear()}-${String(db.orderSeq++).padStart(6, '0')}`;
  const lookupToken = crypto.randomBytes(16).toString('hex');

  for (const item of builtItems) {
    item.orderId = orderId;
  }

  // Create initial Design Approvals for items that require art approval
  const orderApprovals: DesignApproval[] = [];
  for (const item of builtItems) {
    if (item.requiresArtApproval) {
      const approval: DesignApproval = {
        id: `da-${crypto.randomUUID()}`,
        orderId,
        orderItemId: item.id,
        version: 1,
        status: 'pending_preview',
        previewStorageBucket: 'design-previews-private',
        previewStoragePath: null,
        designerNotes: 'Aguardando confirmação do pagamento para elaboração da prévia da arte.',
        internalDeadline: new Date(
          Date.now() + Math.max(1, item.productionDaysSnapshot) * 24 * 60 * 60 * 1000
        ).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.designApprovals.push(approval);
      orderApprovals.push(approval);
    }
  }

  // Create initial Shipment record
  const pkgConsolidated = melhorEnvioAdapter.consolidatePackageDimensions(dimensionItems);
  const shipment: ShipmentRecord = {
    id: `ship-${crypto.randomUUID()}`,
    orderId,
    shippingQuoteId: selectedQuote?.id ?? null,
    deliveryMethod: input.deliveryMethod,
    provider:
      input.deliveryMethod === 'local_pickup'
        ? 'local_pickup'
        : input.deliveryMethod === 'own_delivery'
          ? 'own_delivery'
          : 'melhor_envio',
    serviceId: selectedQuote?.serviceId ?? 'pickup',
    serviceName:
      input.deliveryMethod === 'local_pickup'
        ? `Retirada Local — ${pickupLocation?.name}`
        : selectedQuote?.serviceName || 'Entrega',
    companyName:
      input.deliveryMethod === 'local_pickup'
        ? 'Ateliê Anis Criações'
        : selectedQuote?.companyName || 'Transportadora',
    shippingCostCents: shippingCents,
    declaredValueCents: subtotalCents + personalizationTotalCents,
    weightGrams: Math.round(pkgConsolidated.weightKg * 1000),
    heightCm: pkgConsolidated.heightCm,
    widthCm: pkgConsolidated.widthCm,
    lengthCm: pkgConsolidated.lengthCm,
    status: 'pending',
    pickupCode,
    ownDeliveryDriver:
      input.deliveryMethod === 'own_delivery' ? selectedQuote?.companyName ?? null : null,
    ownDeliveryRegion:
      input.deliveryMethod === 'own_delivery' ? selectedQuote?.serviceName ?? null : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.shipments.push(shipment);

  // 6. Build InfinitePay items in cents (strictly matching totalCents)
  const infinitePayItems: InfinitePayCheckoutItem[] = builtItems.map((bi) => ({
    quantity: bi.quantity,
    price: bi.unitFinalPriceCents,
    description: bi.variantNameSnapshot
      ? `${bi.productNameSnapshot} (${bi.variantNameSnapshot})`
      : bi.productNameSnapshot,
  }));

  if (shippingCents > 0) {
    infinitePayItems.push({
      quantity: 1,
      price: shippingCents,
      description: `Frete (${shipment.serviceName})`,
    });
  }

  // If discountCents > 0, adjust item prices proportionally in cents so sum of items == totalCents
  if (discountCents > 0) {
    const singleConsolidatedItem: InfinitePayCheckoutItem[] = [
      {
        quantity: 1,
        price: totalCents,
        description: `Pedido ${orderNumber} (com desconto cupom ${appliedCoupon?.code})`,
      },
    ];
    infinitePayItems.splice(0, infinitePayItems.length, ...singleConsolidatedItem);
  }

  const baseUrl = (
    input.appBaseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  const orderNsu = orderNumber;
  const redirectUrl = `${baseUrl}/pedido/confirmacao?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(lookupToken)}`;
  const webhookUrl = `${baseUrl}/api/webhooks/infinitepay`;

  const linkResp = await infinitePayAdapter.createCheckoutLink({
    handle: db.storeSettings.infinitepayConfig.handle,
    orderNsu,
    items: infinitePayItems,
    redirectUrl,
    webhookUrl,
    customer: {
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
    },
    address: {
      cep: destCep,
      number: input.address.number,
      complement: input.address.complement,
    },
  });

  const payment: PaymentRecord = {
    id: `pay-${crypto.randomUUID()}`,
    orderId,
    provider: 'infinitepay',
    orderNsu,
    invoiceSlug: linkResp.slug ?? null,
    checkoutUrl: linkResp.url,
    amountCents: totalCents,
    status: 'pending',
    providerPayload: linkResp.raw,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.payments.push(payment);

  const initialHistory = {
    id: `osh-${crypto.randomUUID()}`,
    orderId,
    previousFinancialStatus: null,
    newFinancialStatus: 'pending' as OrderFinancialStatus,
    previousOperationalStatus: null,
    newOperationalStatus: 'awaiting_payment' as OrderOperationalStatus,
    reason: 'Pedido criado e aguardando confirmação de pagamento via InfinitePay.',
    createdAt: new Date().toISOString(),
  };

  const order: Order = {
    id: orderId,
    orderNumber,
    lookupToken,
    customerId: customer.id,
    customer,
    shippingAddressSnapshot: {
      recipientName: input.address.recipientName,
      postalCode: destCep,
      street: input.address.street,
      number: input.address.number,
      complement: input.address.complement,
      neighborhood: input.address.neighborhood,
      city: input.address.city,
      state: input.address.state.toUpperCase(),
      reference: input.address.reference,
    },
    deliveryMethod: input.deliveryMethod,
    pickupLocationId: pickupLocation?.id ?? null,
    shippingQuoteId: selectedQuote?.id ?? null,
    financialStatus: 'pending',
    operationalStatus: 'awaiting_payment',
    subtotalCents,
    personalizationTotalCents,
    shippingCents,
    discountCents,
    totalCents,
    couponId: appliedCoupon?.id ?? null,
    couponCodeSnapshot: appliedCoupon?.code ?? null,
    productionDays: maxProductionDays,
    estimatedShippingDays,
    stockReservationExpiresAt: reservationExpiresAt,
    pickupCode,
    customerNotes: input.customerNotes ?? null,
    items: builtItems,
    statusHistory: [initialHistory],
    designApprovals: orderApprovals,
    payments: [payment],
    shipment,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.orders.push(order);
  saveDbState();

  return {
    order,
    payment,
    checkoutUrl: linkResp.url,
  };
}

// ==============================================================================
// 6. IDEMPOTENT INFINITEPAY PAYMENT CONFIRMATION, RETRY & RECONCILIATION
// ==============================================================================
export interface ConfirmPaymentParams {
  orderNsu: string;
  transactionNsu: string;
  invoiceSlug?: string | null;
  paidAmountCents: number;
  captureMethod?: string;
  receiptUrl?: string | null;
  rawPayload: Record<string, unknown>;
  idempotencyKey?: string;
}

export function confirmOrderPaymentIdempotent(params: ConfirmPaymentParams): {
  alreadyProcessed: boolean;
  order: Order;
  payment: PaymentRecord;
} {
  const db = getDbState();
  const idemKey =
    params.idempotencyKey || `${params.orderNsu}:${params.transactionNsu}:payment_confirmed`;

  const existingEvent = db.paymentEvents.find((e) => e.idempotencyKey === idemKey);
  const payment = db.payments.find((p) => p.orderNsu === params.orderNsu);
  if (!payment) {
    throw new ApiError(
      404,
      'PAYMENT_ORDER_NSU_NOT_FOUND',
      `Nenhum pagamento registrado para o order_nsu "${params.orderNsu}".`
    );
  }

  const order = db.orders.find((o) => o.id === payment.orderId);
  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido vinculado ao pagamento não encontrado.');
  }

  // Idempotency guard: if event already processed or order already paid, do not duplicate!
  if (existingEvent || payment.status === 'paid' || order.financialStatus === 'paid') {
    if (!existingEvent) {
      db.paymentEvents.push({
        id: `pe-${crypto.randomUUID()}`,
        paymentId: payment.id,
        orderId: order.id,
        idempotencyKey: idemKey,
        eventType: 'duplicate_webhook_ignored',
        orderNsu: params.orderNsu,
        transactionNsu: params.transactionNsu,
        rawPayload: params.rawPayload,
        processingStatus: 'ignored_already_paid',
        processedAt: new Date().toISOString(),
      });
      saveDbState();
    }
    return {
      alreadyProcessed: true,
      order,
      payment,
    };
  }

  // Strict server-side amount verification
  if (params.paidAmountCents < payment.amountCents) {
    db.paymentEvents.push({
      id: `pe-${crypto.randomUUID()}`,
      paymentId: payment.id,
      orderId: order.id,
      idempotencyKey: `${idemKey}:mismatch`,
      eventType: 'amount_mismatch_rejected',
      orderNsu: params.orderNsu,
      transactionNsu: params.transactionNsu,
      rawPayload: params.rawPayload,
      processingStatus: 'rejected_divergent_amount',
      errorMessage: `Valor divergente: esperado ${payment.amountCents}, recebido ${params.paidAmountCents}`,
      processedAt: new Date().toISOString(),
    });
    saveDbState();
    throw new ApiError(
      400,
      'PAYMENT_AMOUNT_MISMATCH',
      `Valor pago (${params.paidAmountCents} centavos) diverge do valor do pedido (${payment.amountCents} centavos).`
    );
  }

  // Commit stock reservation -> deduct stockQuantity and release reservedQuantity
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (product && product.trackInventory && product.productType !== 'made_to_order') {
      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (variant) {
          const prev = variant.stockQuantity;
          variant.stockQuantity = Math.max(0, variant.stockQuantity - item.quantity);
          variant.reservedQuantity = Math.max(0, variant.reservedQuantity - item.quantity);
          db.inventoryMovements.push({
            id: `imov-${crypto.randomUUID()}`,
            productId: product.id,
            variantId: variant.id,
            orderId: order.id,
            movementType: 'sale_commit',
            quantity: item.quantity,
            previousStock: prev,
            newStock: variant.stockQuantity,
            notes: `Baixa definitiva de estoque — Pedido pago ${order.orderNumber}`,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        const prev = product.stockQuantity;
        product.stockQuantity = Math.max(0, product.stockQuantity - item.quantity);
        product.reservedQuantity = Math.max(0, product.reservedQuantity - item.quantity);
        db.inventoryMovements.push({
          id: `imov-${crypto.randomUUID()}`,
          productId: product.id,
          variantId: null,
          orderId: order.id,
          movementType: 'sale_commit',
          quantity: item.quantity,
          previousStock: prev,
          newStock: product.stockQuantity,
          notes: `Baixa definitiva de estoque — Pedido pago ${order.orderNumber}`,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  const requiresArt = order.items.some((i) => i.requiresArtApproval);
  const nextOpStatus: OrderOperationalStatus = requiresArt
    ? 'awaiting_art_approval'
    : 'in_production';

  const nowIso = new Date().toISOString();
  payment.status = 'paid';
  payment.transactionNsu = params.transactionNsu;
  payment.invoiceSlug = params.invoiceSlug ?? payment.invoiceSlug;
  payment.paidAmountCents = params.paidAmountCents;
  payment.captureMethod = params.captureMethod || 'pix';
  payment.receiptUrl = params.receiptUrl ?? null;
  payment.paidAt = nowIso;
  payment.providerPayload = params.rawPayload;
  payment.updatedAt = nowIso;

  const prevFin = order.financialStatus;
  const prevOp = order.operationalStatus;
  order.financialStatus = 'paid';
  order.operationalStatus = nextOpStatus;
  order.paidAt = nowIso;
  order.stockReservationExpiresAt = null;
  order.updatedAt = nowIso;

  order.statusHistory.push({
    id: `osh-${crypto.randomUUID()}`,
    orderId: order.id,
    previousFinancialStatus: prevFin,
    newFinancialStatus: 'paid',
    previousOperationalStatus: prevOp,
    newOperationalStatus: nextOpStatus,
    reason: `Pagamento confirmado com segurança via InfinitePay (${payment.captureMethod?.toUpperCase()}).`,
    metadata: {
      orderNsu: params.orderNsu,
      transactionNsu: params.transactionNsu,
      paidAmountCents: params.paidAmountCents,
    },
    createdAt: nowIso,
  });

  db.paymentEvents.push({
    id: `pe-${crypto.randomUUID()}`,
    paymentId: payment.id,
    orderId: order.id,
    idempotencyKey: idemKey,
    eventType: 'payment_confirmed',
    orderNsu: params.orderNsu,
    transactionNsu: params.transactionNsu,
    rawPayload: params.rawPayload,
    processingStatus: 'processed',
    processedAt: nowIso,
  });

  db.auditLogs.push({
    id: `aud-${crypto.randomUUID()}`,
    actorRole: 'infinitepay_webhook',
    action: 'PAYMENT_CONFIRMED',
    entityTable: 'orders',
    entityId: order.id,
    newData: {
      orderNumber: order.orderNumber,
      orderNsu: params.orderNsu,
      transactionNsu: params.transactionNsu,
      paidAmountCents: params.paidAmountCents,
      operationalStatus: nextOpStatus,
    },
    createdAt: nowIso,
  });

  saveDbState();
  return {
    alreadyProcessed: false,
    order,
    payment,
  };
}

/**
 * Allows customer or system to retry payment on a pending order without
 * duplicating the order or double-charging an already paid order.
 */
export async function retryOrderPaymentLink(orderNumber: string, appBaseUrl?: string): Promise<{
  order: Order;
  payment: PaymentRecord;
  checkoutUrl: string;
}> {
  const db = getDbState();
  const order = db.orders.find((o) => o.orderNumber === orderNumber);
  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
  }
  if (order.financialStatus === 'paid') {
    throw new ApiError(
      409,
      'ORDER_ALREADY_PAID',
      'Este pedido já consta como pago. Nenhuma nova cobrança foi gerada.'
    );
  }
  if (order.financialStatus === 'cancelled') {
    throw new ApiError(
      400,
      'ORDER_CANCELLED',
      'Este pedido foi cancelado e não permite nova tentativa de pagamento.'
    );
  }

  const payment = order.payments[0];
  if (!payment) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Registro financeiro não encontrado.');
  }

  const baseUrl = (
    appBaseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  const redirectUrl = `${baseUrl}/pedido/confirmacao?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.lookupToken)}`;
  const webhookUrl = `${baseUrl}/api/webhooks/infinitepay`;

  const linkResp = await infinitePayAdapter.createCheckoutLink({
    handle: db.storeSettings.infinitepayConfig.handle,
    orderNsu: payment.orderNsu,
    items: [
      {
        quantity: 1,
        price: order.totalCents,
        description: `Pedido ${order.orderNumber} - Anis Criações`,
      },
    ],
    redirectUrl,
    webhookUrl,
    customer: {
      name: order.customer.fullName,
      email: order.customer.email,
      phone: order.customer.phone,
    },
  });

  payment.checkoutUrl = linkResp.url;
  payment.updatedAt = new Date().toISOString();
  saveDbState();

  return {
    order,
    payment,
    checkoutUrl: linkResp.url,
  };
}

/**
 * Reconciles a pending order directly with POST https://api.checkout.infinitepay.io/payment_check
 * Crucial when the customer closes the browser before redirecting back to the store.
 */
export async function reconcilePendingPaymentWithProvider(params: {
  orderNsu: string;
  transactionNsu?: string;
  slug?: string;
}): Promise<{
  reconciled: boolean;
  paid: boolean;
  order: Order;
  payment: PaymentRecord;
}> {
  const db = getDbState();
  const payment = db.payments.find((p) => p.orderNsu === params.orderNsu);
  if (!payment) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Pagamento não encontrado para conciliação.');
  }
  const order = db.orders.find((o) => o.id === payment.orderId)!;

  if (payment.status === 'paid') {
    return { reconciled: true, paid: true, order, payment };
  }

  const checkResult = await infinitePayAdapter.checkPaymentStatus({
    handle: db.storeSettings.infinitepayConfig.handle,
    order_nsu: payment.orderNsu,
    transaction_nsu: params.transactionNsu || payment.transactionNsu || undefined,
    slug: params.slug || payment.invoiceSlug || undefined,
  });

  if (checkResult.success && checkResult.paid && checkResult.paid_amount >= payment.amountCents && checkResult.amount === payment.amountCents) {
    const confirmed = confirmOrderPaymentIdempotent({
      orderNsu: payment.orderNsu,
      transactionNsu: checkResult.transaction_nsu || `reconciled-${Date.now()}`,
      invoiceSlug: checkResult.slug,
      paidAmountCents: checkResult.paid_amount,
      captureMethod: checkResult.capture_method,
      receiptUrl: checkResult.receipt_url,
      rawPayload: checkResult.raw,
      idempotencyKey: `reconcile:${payment.orderNsu}:${checkResult.transaction_nsu || 'check'}`,
    });
    return {
      reconciled: true,
      paid: true,
      order: confirmed.order,
      payment: confirmed.payment,
    };
  }

  return {
    reconciled: true,
    paid: false,
    order,
    payment,
  };
}

// ==============================================================================
// 7. ORDER CANCELLATION, REFUND RECONCILIATION & STOCK EXPIRATION
// ==============================================================================
export function releaseExpiredReservationsInternal(): number {
  const db = getDbState();
  const now = Date.now();
  let count = 0;

  for (const order of db.orders) {
    if (
      order.financialStatus === 'pending' &&
      order.stockReservationExpiresAt &&
      new Date(order.stockReservationExpiresAt).getTime() < now
    ) {
      cancelOrRefundOrder({
        orderId: order.id,
        reason: 'Reserva de estoque expirada por falta de pagamento dentro do prazo.',
        actorRole: 'system_cron',
      });
      count += 1;
    }
  }
  return count;
}

/**
 * Cancels an order or records a reconciled refund performed on the payment provider,
 * returning reserved/committed stock appropriately.
 * Note: Does NOT assume a payment webhook authorizes automatic API refund;
 * records provider refund reconciliation with audit trail.
 */
export function cancelOrRefundOrder(params: {
  orderId: string;
  reason: string;
  refundAmountCents?: number;
  providerRefundReference?: string;
  actorId?: string;
  actorRole?: string;
}): Order {
  const db = getDbState();
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
  }

  if (order.operationalStatus === 'cancelled' && order.financialStatus === 'cancelled') {
    return order;
  }

  const nowIso = new Date().toISOString();
  const wasPaid = order.financialStatus === 'paid';

  // Return stock or release reservation
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (product && product.trackInventory && product.productType !== 'made_to_order') {
      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (variant) {
          if (wasPaid) {
            variant.stockQuantity += item.quantity;
          } else {
            variant.reservedQuantity = Math.max(0, variant.reservedQuantity - item.quantity);
          }
        }
      } else {
        if (wasPaid) {
          product.stockQuantity += item.quantity;
        } else {
          product.reservedQuantity = Math.max(0, product.reservedQuantity - item.quantity);
        }
      }

      db.inventoryMovements.push({
        id: `imov-${crypto.randomUUID()}`,
        productId: product.id,
        variantId: item.variantId ?? null,
        orderId: order.id,
        movementType: wasPaid ? 'return_restock' : 'reservation_release',
        quantity: item.quantity,
        previousStock: product.stockQuantity,
        newStock: product.stockQuantity,
        releasedAt: nowIso,
        notes: params.reason,
        createdAt: nowIso,
      });
    }
  }

  const prevFin = order.financialStatus;
  const prevOp = order.operationalStatus;

  const newFinStatus: OrderFinancialStatus = wasPaid
    ? params.refundAmountCents && params.refundAmountCents < order.totalCents
      ? 'partially_refunded'
      : 'refunded'
    : 'cancelled';

  order.financialStatus = newFinStatus;
  order.operationalStatus = 'cancelled';
  order.cancelledAt = nowIso;
  order.cancelReason = params.reason;
  order.stockReservationExpiresAt = null;
  order.updatedAt = nowIso;

  const payment = order.payments[0];
  if (payment) {
    payment.status = newFinStatus;
    if (wasPaid) {
      payment.refundedAt = nowIso;
      payment.refundAmountCents = params.refundAmountCents ?? order.totalCents;
      payment.refundReason = params.reason;
    } else {
      payment.cancelledAt = nowIso;
    }
    payment.updatedAt = nowIso;
  }

  order.statusHistory.push({
    id: `osh-${crypto.randomUUID()}`,
    orderId: order.id,
    previousFinancialStatus: prevFin,
    newFinancialStatus: newFinStatus,
    previousOperationalStatus: prevOp,
    newOperationalStatus: 'cancelled',
    changedBy: params.actorId ?? null,
    reason: params.reason,
    metadata: {
      providerRefundReference: params.providerRefundReference ?? null,
      refundAmountCents: params.refundAmountCents ?? null,
    },
    createdAt: nowIso,
  });

  db.auditLogs.push({
    id: `aud-${crypto.randomUUID()}`,
    actorId: params.actorId ?? null,
    actorRole: params.actorRole || 'admin',
    action: wasPaid ? 'ORDER_REFUND_RECONCILED' : 'ORDER_CANCELLED',
    entityTable: 'orders',
    entityId: order.id,
    newData: {
      orderNumber: order.orderNumber,
      financialStatus: newFinStatus,
      reason: params.reason,
    },
    createdAt: nowIso,
  });

  saveDbState();
  return order;
}

// ==============================================================================
// 8. DESIGN APPROVALS & PRODUCTION QUEUE WORKFLOW
// ==============================================================================
export function uploadDesignPreviewForOrder(params: {
  orderId: string;
  orderItemId: string;
  previewStoragePath: string;
  designerNotes?: string;
  actorId?: string;
}): DesignApproval {
  const db = getDbState();
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
  }

  const existingApprovals = order.designApprovals.filter(
    (a) => a.orderItemId === params.orderItemId
  );
  const latest = existingApprovals[existingApprovals.length - 1];
  const nowIso = new Date().toISOString();

  const signed = createSignedPrivateFileToken(
    'design-previews-private',
    params.previewStoragePath,
    3600
  );

  if (latest && latest.status === 'pending_preview') {
    latest.status = 'awaiting_customer';
    latest.previewStoragePath = params.previewStoragePath;
    latest.previewSignedUrl = signed.signedUrl;
    latest.designerNotes = params.designerNotes ?? latest.designerNotes;
    latest.updatedAt = nowIso;
    order.operationalStatus = 'awaiting_art_approval';
    saveDbState();
    return latest;
  }

  const nextVersion = latest ? latest.version + 1 : 1;
  const newApproval: DesignApproval = {
    id: `da-${crypto.randomUUID()}`,
    orderId: order.id,
    orderItemId: params.orderItemId,
    version: nextVersion,
    status: 'awaiting_customer',
    previewStorageBucket: 'design-previews-private',
    previewStoragePath: params.previewStoragePath,
    previewSignedUrl: signed.signedUrl,
    designerNotes: params.designerNotes ?? null,
    internalDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.designApprovals.push(newApproval);
  order.designApprovals.push(newApproval);
  order.operationalStatus = 'awaiting_art_approval';
  order.updatedAt = nowIso;
  saveDbState();
  return newApproval;
}

export function submitCustomerDesignDecision(params: {
  orderNumber: string;
  lookupToken: string;
  approvalId: string;
  decision: 'approved' | 'revision_requested';
  customerFeedback?: string;
}): { approval: DesignApproval; order: Order } {
  const db = getDbState();
  const order = db.orders.find(
    (o) => o.orderNumber === params.orderNumber && o.lookupToken === params.lookupToken
  );
  if (!order) {
    throw new ApiError(
      403,
      'UNAUTHORIZED_ORDER_ACCESS',
      'Credenciais de acesso ao pedido inválidas.'
    );
  }

  const approval = order.designApprovals.find((a) => a.id === params.approvalId);
  if (!approval) {
    throw new ApiError(404, 'APPROVAL_NOT_FOUND', 'Registro de aprovação de arte não encontrado.');
  }

  if (params.decision === 'revision_requested' && (!params.customerFeedback || params.customerFeedback.trim().length < 5)) {
    throw new ApiError(
      400,
      'FEEDBACK_REQUIRED_FOR_REVISION',
      'Descreva os ajustes desejados para solicitar revisão da arte.'
    );
  }

  const nowIso = new Date().toISOString();
  approval.status = params.decision;
  approval.customerFeedback = params.customerFeedback ?? null;
  approval.reviewedAt = nowIso;
  approval.updatedAt = nowIso;

  const prevOp = order.operationalStatus;
  if (params.decision === 'approved') {
    const latestByItem = new Map<string, DesignApproval>();
    for (const a of order.designApprovals) {
      const current = latestByItem.get(a.orderItemId);
      if (!current || a.version >= current.version) {
        latestByItem.set(a.orderItemId, a);
      }
    }
    const allLatestApproved = Array.from(latestByItem.values()).every(
      (a) => a.status === 'approved'
    );
    if (allLatestApproved && order.financialStatus === 'paid') {
      order.operationalStatus = 'in_production';
    }
  } else {
    order.operationalStatus = 'awaiting_art_approval';
  }

  order.statusHistory.push({
    id: `osh-${crypto.randomUUID()}`,
    orderId: order.id,
    previousFinancialStatus: order.financialStatus,
    newFinancialStatus: order.financialStatus,
    previousOperationalStatus: prevOp,
    newOperationalStatus: order.operationalStatus,
    reason:
      params.decision === 'approved'
        ? `Arte v${approval.version} aprovada pelo cliente. Pedido liberado para produção.`
        : `Revisão solicitada pelo cliente na arte v${approval.version}: "${params.customerFeedback}"`,
    createdAt: nowIso,
  });

  saveDbState();
  return { approval, order };
}

// ==============================================================================
// 9. LOGISTICS: MELHOR ENVIO LABEL GENERATION, LOCAL PICKUP & OWN DELIVERY
// ==============================================================================
export async function generateShipmentLabelForOrder(params: {
  orderId: string;
  executePurchaseNow?: boolean;
  actorId?: string;
}): Promise<ShipmentRecord> {
  const db = getDbState();
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
  }

  if (order.financialStatus !== 'paid') {
    throw new ApiError(
      400,
      'SHIPMENT_REQUIRES_PAID_ORDER',
      'Não é permitido gerar ou comprar etiqueta antes da confirmação do pagamento do pedido.'
    );
  }

  const shipment = order.shipment;
  if (!shipment) {
    throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'Registro de entrega não encontrado.');
  }

  const labelResult = await melhorEnvioAdapter.createAndProcessShipmentLabel({
    orderNumber: order.orderNumber,
    orderFinancialStatus: order.financialStatus,
    serviceId: shipment.serviceId || '1',
    recipient: {
      name: order.shippingAddressSnapshot.recipientName,
      phone: order.customer.phone,
      email: order.customer.email,
      document: order.customer.documentCpfCnpj,
      postalCode: order.shippingAddressSnapshot.postalCode,
      street: order.shippingAddressSnapshot.street,
      number: order.shippingAddressSnapshot.number,
      complement: order.shippingAddressSnapshot.complement,
      neighborhood: order.shippingAddressSnapshot.neighborhood,
      city: order.shippingAddressSnapshot.city,
      state: order.shippingAddressSnapshot.state,
    },
    packageData: {
      weightKg: Number((shipment.weightGrams / 1000).toFixed(2)),
      heightCm: shipment.heightCm,
      widthCm: shipment.widthCm,
      lengthCm: shipment.lengthCm,
      insuranceValueBRL: Number((shipment.declaredValueCents / 100).toFixed(2)),
    },
    items: order.items.map((i) => ({
      name: i.productNameSnapshot,
      quantity: i.quantity,
      unitValueBRL: Number((i.unitFinalPriceCents / 100).toFixed(2)),
    })),
    executePurchaseNow: params.executePurchaseNow,
  });

  const nowIso = new Date().toISOString();
  shipment.melhorEnvioOrderId = labelResult.melhorEnvioOrderId;
  shipment.protocol = labelResult.protocol;
  shipment.status = labelResult.status;
  shipment.labelUrl = labelResult.labelUrl ?? shipment.labelUrl;
  shipment.trackingCode = labelResult.trackingCode ?? shipment.trackingCode;
  shipment.trackingUrl = labelResult.trackingUrl ?? shipment.trackingUrl;
  shipment.updatedAt = nowIso;

  if (labelResult.status === 'label_generated') {
    order.operationalStatus = 'ready_for_shipping';
  }

  order.statusHistory.push({
    id: `osh-${crypto.randomUUID()}`,
    orderId: order.id,
    previousFinancialStatus: order.financialStatus,
    newFinancialStatus: order.financialStatus,
    previousOperationalStatus: order.operationalStatus,
    newOperationalStatus: order.operationalStatus,
    changedBy: params.actorId ?? null,
    reason:
      labelResult.status === 'label_generated'
        ? `Etiqueta Melhor Envio (${shipment. protocol}) comprada e gerada. Rastreio: ${shipment.trackingCode}`
        : `Etiqueta inserida no carrinho do Melhor Envio (${shipment.protocol}). Pronta para conferência/compra manual.`,
    createdAt: nowIso,
  });

  saveDbState();
  return shipment;
}

export function confirmLocalPickupHandover(params: {
  orderId: string;
  pickupCode: string;
  pickedUpByName: string;
  pickedUpByDocument: string;
  actorId?: string;
}): Order {
  const db = getDbState();
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
  }
  if (order.deliveryMethod !== 'local_pickup') {
    throw new ApiError(400, 'NOT_LOCAL_PICKUP', 'Este pedido não é da modalidade retirada local.');
  }
  if (order.financialStatus !== 'paid') {
    throw new ApiError(400, 'ORDER_NOT_PAID', 'O pedido precisa estar pago para confirmar a retirada.');
  }
  if (order.pickupCode && order.pickupCode.toUpperCase() !== params.pickupCode.trim().toUpperCase()) {
    throw new ApiError(400, 'INVALID_PICKUP_CODE', 'O código de retirada informado é inválido.');
  }

  const nowIso = new Date().toISOString();
  const prevOp = order.operationalStatus;
  order.operationalStatus = 'picked_up';
  order.updatedAt = nowIso;

  if (order.shipment) {
    order.shipment.status = 'picked_up';
    order.shipment.pickedUpAt = nowIso;
    order.shipment.pickedUpByName = params.pickedUpByName;
    order.shipment.pickedUpByDocument = params.pickedUpByDocument;
    order.shipment.deliveredAt = nowIso;
    order.shipment.updatedAt = nowIso;
  }

  order.statusHistory.push({
    id: `osh-${crypto.randomUUID()}`,
    orderId: order.id,
    previousFinancialStatus: order.financialStatus,
    newFinancialStatus: order.financialStatus,
    previousOperationalStatus: prevOp,
    newOperationalStatus: 'picked_up',
    changedBy: params.actorId ?? null,
    reason: `Retirada local confirmada para ${params.pickedUpByName} (Doc: ${params.pickedUpByDocument}).`,
    createdAt: nowIso,
  });

  saveDbState();
  return order;
}

// ==============================================================================
// 10. ADMIN PRODUCT CRUD, SOFT DELETE & CSV IMPORT
// ==============================================================================
export function upsertProductAdmin(
  input: Partial<Product> & { name: string; sku: string; priceCents: number; categoryId: string },
  actorId = 'admin'
): Product {
  const db = getDbState();
  const nowIso = new Date().toISOString();
  const existing = input.id ? db.products.find((p) => p.id === input.id) : undefined;

  if (existing) {
    const oldSnapshot = { name: existing.name, priceCents: existing.priceCents, stockQuantity: existing.stockQuantity };
    existing.categoryId = input.categoryId ?? existing.categoryId;
    existing.name = input.name;
    existing.slug = input.slug ? slugify(input.slug) : existing.slug;
    existing.sku = input.sku;
    existing.shortDescription = input.shortDescription ?? existing.shortDescription;
    existing.fullDescription = input.fullDescription ?? existing.fullDescription;
    existing.productType = input.productType ?? existing.productType;
    existing.priceCents = input.priceCents;
    existing.promotionalPriceCents =
      input.promotionalPriceCents !== undefined
        ? input.promotionalPriceCents
        : existing.promotionalPriceCents;
    existing.internalCostCents =
      input.internalCostCents !== undefined ? input.internalCostCents : existing.internalCostCents;
    existing.stockQuantity =
      typeof input.stockQuantity === 'number' ? input.stockQuantity : existing.stockQuantity;
    existing.trackInventory =
      typeof input.trackInventory === 'boolean' ? input.trackInventory : existing.trackInventory;
    existing.weightGrams = input.weightGrams ?? existing.weightGrams;
    existing.heightCm = input.heightCm ?? existing.heightCm;
    existing.widthCm = input.widthCm ?? existing.widthCm;
    existing.lengthCm = input.lengthCm ?? existing.lengthCm;
    existing.productionDays =
      typeof input.productionDays === 'number' ? input.productionDays : existing.productionDays;
    existing.requiresArtApproval =
      typeof input.requiresArtApproval === 'boolean'
        ? input.requiresArtApproval
        : existing.requiresArtApproval;
    existing.isVisible =
      typeof input.isVisible === 'boolean' ? input.isVisible : existing.isVisible;
    existing.isAvailable =
      typeof input.isAvailable === 'boolean' ? input.isAvailable : existing.isAvailable;
    existing.isFeatured =
      typeof input.isFeatured === 'boolean' ? input.isFeatured : existing.isFeatured;
    if (input.occasions) existing.occasions = input.occasions;
    if (input.kitItems) existing.kitItems = input.kitItems;
    if (input.images) existing.images = input.images;
    if (input.variants) existing.variants = input.variants;
    if (input.personalizationFields) existing.personalizationFields = input.personalizationFields;
    existing.seoTitle = input.seoTitle ?? existing.seoTitle;
    existing.seoDescription = input.seoDescription ?? existing.seoDescription;
    existing.updatedAt = nowIso;

    db.auditLogs.push({
      id: `aud-${crypto.randomUUID()}`,
      actorId,
      actorRole: 'admin',
      action: 'PRODUCT_UPDATED',
      entityTable: 'products',
      entityId: existing.id,
      oldData: oldSnapshot,
      newData: { name: existing.name, priceCents: existing.priceCents, stockQuantity: existing.stockQuantity },
      createdAt: nowIso,
    });

    saveDbState();
    return existing;
  }

  const newId = input.id || `prod-${crypto.randomUUID()}`;
  const newProduct: Product = {
    id: newId,
    categoryId: input.categoryId,
    name: input.name,
    slug: input.slug ? slugify(input.slug) : `${slugify(input.name)}-${newId.slice(-4)}`,
    sku: input.sku,
    shortDescription: input.shortDescription || input.name,
    fullDescription: input.fullDescription || input.shortDescription || input.name,
    productType: input.productType || 'regular_stock',
    priceCents: input.priceCents,
    promotionalPriceCents: input.promotionalPriceCents ?? null,
    internalCostCents: input.internalCostCents ?? null,
    stockQuantity: input.stockQuantity ?? 10,
    reservedQuantity: 0,
    trackInventory: input.trackInventory ?? true,
    weightGrams: input.weightGrams ?? 350,
    heightCm: input.heightCm ?? 10,
    widthCm: input.widthCm ?? 15,
    lengthCm: input.lengthCm ?? 20,
    productionDays: input.productionDays ?? 2,
    requiresArtApproval: input.requiresArtApproval ?? false,
    isVisible: input.isVisible ?? true,
    isAvailable: input.isAvailable ?? true,
    isFeatured: input.isFeatured ?? false,
    occasions: input.occasions ?? [],
    kitItems: input.kitItems ?? [],
    seoTitle: input.seoTitle ?? `${input.name} | Anis Criações`,
    seoDescription: input.seoDescription ?? input.shortDescription ?? input.name,
    images:
      input.images && input.images.length > 0
        ? input.images
        : [
            {
              id: `img-${crypto.randomUUID()}`,
              productId: newId,
              publicUrl:
                'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=85',
              altText: input.name,
              displayOrder: 1,
              isPrimary: true,
            },
          ],
    variants: input.variants ?? [],
    personalizationFields: (input.personalizationFields ?? []) as PersonalizationField[],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.products.push(newProduct);
  db.auditLogs.push({
    id: `aud-${crypto.randomUUID()}`,
    actorId,
    actorRole: 'admin',
    action: 'PRODUCT_CREATED',
    entityTable: 'products',
    entityId: newProduct.id,
    newData: { name: newProduct.name, sku: newProduct.sku, priceCents: newProduct.priceCents },
    createdAt: nowIso,
  });

  saveDbState();
  return newProduct;
}

export function softDeleteProductAdmin(productId: string, actorId = 'admin'): boolean {
  const db = getDbState();
  const product = db.products.find((p) => p.id === productId && !p.deletedAt);
  if (!product) {
    throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
  }
  const nowIso = new Date().toISOString();
  product.deletedAt = nowIso;
  product.isVisible = false;
  product.isAvailable = false;
  product.updatedAt = nowIso;

  db.auditLogs.push({
    id: `aud-${crypto.randomUUID()}`,
    actorId,
    actorRole: 'admin',
    action: 'PRODUCT_SOFT_DELETED',
    entityTable: 'products',
    entityId: product.id,
    oldData: { name: product.name, sku: product.sku },
    createdAt: nowIso,
  });

  saveDbState();
  return true;
}

export function importProductsFromCsvText(
  csvText: string,
  actorId = 'admin'
): { importedCount: number; errors: string[]; products: Product[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new ApiError(
      400,
      'EMPTY_CSV',
      'O arquivo CSV deve conter cabeçalho e ao menos uma linha de produto.'
    );
  }

  const header = (lines[0] || '').split(/[,;]/).map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('nome') !== -1 ? header.indexOf('nome') : header.indexOf('name');
  const skuIdx = header.indexOf('sku');
  const priceIdx =
    header.indexOf('preco_centavos') !== -1
      ? header.indexOf('preco_centavos')
      : header.indexOf('price_cents');
  const stockIdx =
    header.indexOf('estoque') !== -1 ? header.indexOf('estoque') : header.indexOf('stock');

  if (nameIdx === -1 || skuIdx === -1 || priceIdx === -1) {
    throw new ApiError(
      400,
      'INVALID_CSV_HEADERS',
      'Cabeçalhos obrigatórios no CSV: nome, sku, preco_centavos, estoque.'
    );
  }

  const db = getDbState();
  const defaultCategoryId = db.categories[0]?.id || 'cat-papelaria';
  const imported: Product[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = (lines[i] || '').split(/[,;]/).map((c) => c.trim());
    const name = cols[nameIdx] || '';
    const sku = cols[skuIdx] || '';
    const priceCents = Number(cols[priceIdx] || '0');
    const stock = stockIdx !== -1 ? Number(cols[stockIdx] || '0') : 10;

    if (!name || !sku || Number.isNaN(priceCents) || priceCents < 100) {
      errors.push(`Linha ${i + 1}: Dados inválidos (nome="${name}", sku="${sku}", preco="${priceCents}").`);
      continue;
    }

    const p = upsertProductAdmin(
      {
        categoryId: defaultCategoryId,
        name,
        sku,
        priceCents,
        stockQuantity: Math.max(0, stock),
        shortDescription: `${name} — Importado via lote validado.`,
        fullDescription: `${name} — Produto cadastrado via importação administrativa validada.`,
      },
      actorId
    );
    imported.push(p);
  }

  return {
    importedCount: imported.length,
    errors,
    products: imported,
  };
}
