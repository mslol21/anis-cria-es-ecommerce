export type StaffRoleType = 'super_admin' | 'admin' | 'production' | 'support';

export type ProductType =
  | 'regular_stock'
  | 'personalized'
  | 'made_to_order'
  | 'with_variants'
  | 'gift_kit'
  | 'temporarily_unavailable';

export type PersonalizationFieldType =
  | 'short_text'
  | 'long_text'
  | 'date'
  | 'option_select'
  | 'color_select'
  | 'image_upload'
  | 'art_upload'
  | 'additional_notes';

export type DeliveryMethod = 'melhor_envio' | 'local_pickup' | 'own_delivery';

export type OrderFinancialStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export type OrderOperationalStatus =
  | 'awaiting_payment'
  | 'awaiting_art_approval'
  | 'in_production'
  | 'ready_for_shipping'
  | 'ready_for_pickup'
  | 'out_for_own_delivery'
  | 'shipped'
  | 'delivered'
  | 'picked_up'
  | 'cancelled';

export type ApprovalStatus =
  | 'pending_preview'
  | 'awaiting_customer'
  | 'approved'
  | 'revision_requested';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export type ShipmentStatus =
  | 'pending'
  | 'cart_inserted'
  | 'label_purchased'
  | 'label_generated'
  | 'posted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'delivered'
  | 'picked_up'
  | 'cancelled'
  | 'manual_required';

export type CouponDiscountType = 'percentage' | 'fixed_cents';

export type InventoryMovementType =
  | 'initial'
  | 'manual_adjustment'
  | 'reservation'
  | 'reservation_release'
  | 'sale_commit'
  | 'return_restock';

export interface PersonalizationOptionChoice {
  id: string;
  label: string;
  value: string;
  colorHex?: string;
  priceAdditionCents: number;
}

export interface PersonalizationField {
  id: string;
  productId: string;
  fieldKey: string;
  label: string;
  description?: string;
  fieldType: PersonalizationFieldType;
  isRequired: boolean;
  maxLength?: number | null;
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
  priceAdditionCents: number;
  options: PersonalizationOptionChoice[];
  displayOrder: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  priceOverrideCents: number | null;
  promotionalPriceOverrideCents: number | null;
  stockQuantity: number;
  reservedQuantity: number;
  weightGrams: number | null;
  isAvailable: boolean;
  deletedAt?: string | null;
}

export interface ProductImage {
  id: string;
  productId: string;
  variantId?: string | null;
  storagePath?: string | null;
  publicUrl: string;
  altText: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface KitItemEntry {
  name: string;
  quantity: number;
  description?: string;
}

export interface Category {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  deletedAt?: string | null;
}

export interface Product {
  id: string;
  categoryId: string;
  category?: Category;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  fullDescription: string;
  productType: ProductType;
  priceCents: number;
  promotionalPriceCents: number | null;
  internalCostCents?: number | null;
  stockQuantity: number;
  reservedQuantity: number;
  trackInventory: boolean;
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  productionDays: number;
  requiresArtApproval: boolean;
  isVisible: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  occasions: string[];
  kitItems: KitItemEntry[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  personalizationFields: PersonalizationField[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CustomerPersonalizationInput {
  fieldId: string;
  fieldKey: string;
  textValue?: string;
  selectedOptionValue?: string;
  uploadedFile?: {
    storageBucket: string;
    storagePath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    signedPreviewUrl?: string;
  };
}

export interface OrderItemCustomizationSnapshot {
  id: string;
  orderItemId: string;
  fieldId: string | null;
  fieldKeySnapshot: string;
  fieldLabelSnapshot: string;
  fieldTypeSnapshot: PersonalizationFieldType;
  textValue?: string | null;
  selectedOptionSnapshot?: PersonalizationOptionChoice | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  fileOriginalName?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
  priceAdditionCentsSnapshot: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  productNameSnapshot: string;
  variantNameSnapshot?: string | null;
  skuSnapshot: string;
  quantity: number;
  unitBasePriceCents: number;
  unitPersonalizationPriceCents: number;
  unitFinalPriceCents: number;
  totalPriceCents: number;
  productionDaysSnapshot: number;
  requiresArtApproval: boolean;
  kitItemsSnapshot: KitItemEntry[];
  customizations: OrderItemCustomizationSnapshot[];
}

export interface ShippingAddressSnapshot {
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  previousFinancialStatus?: OrderFinancialStatus | null;
  newFinancialStatus?: OrderFinancialStatus | null;
  previousOperationalStatus?: OrderOperationalStatus | null;
  newOperationalStatus?: OrderOperationalStatus | null;
  changedBy?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DesignApproval {
  id: string;
  orderId: string;
  orderItemId: string;
  version: number;
  status: ApprovalStatus;
  previewStorageBucket: string;
  previewStoragePath?: string | null;
  previewSignedUrl?: string | null;
  designerNotes?: string | null;
  customerFeedback?: string | null;
  internalDeadline?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: 'infinitepay';
  orderNsu: string;
  transactionNsu?: string | null;
  invoiceSlug?: string | null;
  checkoutUrl?: string | null;
  amountCents: number;
  paidAmountCents?: number | null;
  installments?: number;
  captureMethod?: string | null;
  status: PaymentStatus;
  receiptUrl?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  refundedAt?: string | null;
  refundAmountCents?: number | null;
  refundReason?: string | null;
  providerPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEventRecord {
  id: string;
  paymentId?: string | null;
  orderId?: string | null;
  idempotencyKey: string;
  eventType: string;
  orderNsu: string;
  transactionNsu?: string | null;
  rawPayload: Record<string, unknown>;
  processingStatus: string;
  errorMessage?: string | null;
  processedAt: string;
}

export interface ShippingQuote {
  id: string;
  customerPostalCode: string;
  cartHash: string;
  deliveryMethod: DeliveryMethod;
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
  expiresAt: string;
  createdAt: string;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  shippingQuoteId?: string | null;
  deliveryMethod: DeliveryMethod;
  provider: string;
  melhorEnvioOrderId?: string | null;
  protocol?: string | null;
  serviceId?: string | null;
  serviceName: string;
  companyName?: string | null;
  shippingCostCents: number;
  declaredValueCents: number;
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  status: ShipmentStatus;
  pickupCode?: string | null;
  pickedUpAt?: string | null;
  pickedUpByName?: string | null;
  pickedUpByDocument?: string | null;
  ownDeliveryDriver?: string | null;
  ownDeliveryRegion?: string | null;
  ownDeliveryProofPath?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRecord {
  id: string;
  profileId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  documentCpfCnpj: string;
  lgpdAcceptedAt: string;
  anonymizedAt?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  lookupToken: string;
  customerId: string;
  customer: CustomerRecord;
  profileId?: string | null;
  shippingAddressSnapshot: ShippingAddressSnapshot;
  deliveryMethod: DeliveryMethod;
  pickupLocationId?: string | null;
  shippingQuoteId?: string | null;
  financialStatus: OrderFinancialStatus;
  operationalStatus: OrderOperationalStatus;
  subtotalCents: number;
  personalizationTotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  couponId?: string | null;
  couponCodeSnapshot?: string | null;
  productionDays: number;
  estimatedShippingDays: number;
  stockReservationExpiresAt?: string | null;
  pickupCode?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
  designApprovals: DesignApproval[];
  payments: PaymentRecord[];
  shipment?: ShipmentRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderCents: number;
  maxDiscountCents?: number | null;
  usageLimit?: number | null;
  usageCount: number;
  startsAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  deletedAt?: string | null;
}

export interface PickupLocation {
  id: string;
  name: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  operatingHours: string;
  availableDays: string[];
  minPrepDays: number;
  instructions: string;
  feeCents: number;
  isActive: boolean;
}

export interface OwnDeliveryRegion {
  id: string;
  name: string;
  cepPrefixStart: string;
  cepPrefixEnd: string;
  feeCents: number;
  estimatedDays: number;
  driverName: string;
  isActive: boolean;
}

export interface StoreBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  badgeText?: string;
  isActive: boolean;
}

export interface StoreSettings {
  id: string;
  storeName: string;
  legalName: string;
  cnpj: string;
  supportEmail: string;
  supportWhatsapp: string;
  originPostalCode: string;
  addressLine: string;
  themeConfig: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    fontHeading: string;
    fontBody: string;
    logoUrl: string;
  };
  infinitepayConfig: {
    handle: string;
    enabled: boolean;
  };
  melhorEnvioConfig: {
    sandbox: boolean;
    autoPurchaseEnabled: boolean;
    defaultInsurance: boolean;
    freeShippingThresholdCents?: number | null;
  };
  ownDeliveryConfig: {
    enabled: boolean;
    regions: OwnDeliveryRegion[];
  };
  bannersConfig: StoreBanner[];
  seoConfig: {
    defaultTitle: string;
    defaultDescription: string;
  };
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  variantId?: string | null;
  orderId?: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  expiresAt?: string | null;
  releasedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId?: string | null;
  actorRole: string;
  action: string;
  entityTable: string;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}
