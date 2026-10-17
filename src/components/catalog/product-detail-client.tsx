'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  Gift,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Upload,
} from 'lucide-react';
import type {
  CustomerPersonalizationInput,
  PickupLocation,
  Product,
  ShippingQuote,
} from '@/types/database';
import {
  formatBusinessDays,
  formatCentsToBRL,
  formatPostalCode,
} from '@/lib/utils';
import { useCart } from '@/context/cart-context';

export function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null
  );
  const [quantity, setQuantity] = useState(1);

  // Personalization state keyed by field.id
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<
      string,
      {
        storageBucket: string;
        storagePath: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        signedPreviewUrl?: string;
      }
    >
  >({});
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Inline Shipping Calculator state
  const [cepInput, setCepInput] = useState('');
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [shippingResult, setShippingResult] = useState<{
    melhorEnvioQuotes: ShippingQuote[];
    localPickupLocations: PickupLocation[];
    ownDeliveryOptions: ShippingQuote[];
  } | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => product.variants.find((v) => v.id === selectedVariantId) ?? null,
    [product.variants, selectedVariantId]
  );

  const unitBasePriceCents = useMemo(() => {
    if (selectedVariant) {
      if (
        selectedVariant.promotionalPriceOverrideCents !== null &&
        selectedVariant.promotionalPriceOverrideCents > 0
      ) {
        return selectedVariant.promotionalPriceOverrideCents;
      }
      if (
        selectedVariant.priceOverrideCents !== null &&
        selectedVariant.priceOverrideCents > 0
      ) {
        return selectedVariant.priceOverrideCents;
      }
    }
    if (
      product.promotionalPriceCents !== null &&
      product.promotionalPriceCents > 0
    ) {
      return product.promotionalPriceCents;
    }
    return product.priceCents;
  }, [product, selectedVariant]);

  const unitPersonalizationPriceCents = useMemo(() => {
    let addition = 0;
    for (const field of product.personalizationFields) {
      if (!field.isActive) continue;
      if (
        field.fieldType === 'short_text' ||
        field.fieldType === 'long_text' ||
        field.fieldType === 'date' ||
        field.fieldType === 'additional_notes'
      ) {
        if ((textValues[field.id] || '').trim() !== '') {
          addition += field.priceAdditionCents;
        }
      } else if (
        field.fieldType === 'option_select' ||
        field.fieldType === 'color_select'
      ) {
        const val = selectedOptions[field.id];
        if (val) {
          const opt = field.options.find((o) => o.value === val || o.id === val);
          addition += field.priceAdditionCents + (opt?.priceAdditionCents || 0);
        }
      } else if (
        field.fieldType === 'image_upload' ||
        field.fieldType === 'art_upload'
      ) {
        if (uploadedFiles[field.id]) {
          addition += field.priceAdditionCents;
        }
      }
    }
    return addition;
  }, [product.personalizationFields, textValues, selectedOptions, uploadedFiles]);

  const availableStock = useMemo(() => {
    if (
      !product.isAvailable ||
      product.productType === 'temporarily_unavailable'
    ) {
      return 0;
    }
    if (selectedVariant) {
      return Math.max(
        0,
        selectedVariant.stockQuantity - selectedVariant.reservedQuantity
      );
    }
    if (!product.trackInventory || product.productType === 'made_to_order') {
      return 999;
    }
    return Math.max(0, product.stockQuantity - product.reservedQuantity);
  }, [product, selectedVariant]);

  const isPurchaseable =
    product.isAvailable &&
    product.productType !== 'temporarily_unavailable' &&
    availableStock >= quantity;

  const handleFileUpload = async (fieldId: string, file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    setUploadingFieldId(fieldId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'custom-uploads-private');
      formData.append('folder', `product-${product.slug}`);

      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha no envio do arquivo.');
      }

      setUploadedFiles((prev) => ({
        ...prev,
        [fieldId]: {
          storageBucket: data.storageBucket,
          storagePath: data.storagePath,
          originalName: data.originalName,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          signedPreviewUrl: data.signedPreviewUrl,
        },
      }));
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setUploadingFieldId(null);
    }
  };

  const handleAddToCart = (redirectToCart: boolean) => {
    setFormError(null);

    if (!isPurchaseable) {
      setFormError('Este produto ou variação não possui estoque suficiente.');
      return;
    }

    const personalizationsToSave: Array<
      CustomerPersonalizationInput & {
        fieldLabel: string;
        displayValue: string;
        priceAdditionCents: number;
      }
    > = [];

    for (const field of product.personalizationFields.filter((f) => f.isActive)) {
      if (
        field.fieldType === 'short_text' ||
        field.fieldType === 'long_text' ||
        field.fieldType === 'date' ||
        field.fieldType === 'additional_notes'
      ) {
        const val = (textValues[field.id] || '').trim();
        if (field.isRequired && !val) {
          setFormError(`Preencha o campo obrigatório: "${field.label}".`);
          return;
        }
        if (field.maxLength && val.length > field.maxLength) {
          setFormError(
            `O campo "${field.label}" permite no máximo ${field.maxLength} caracteres.`
          );
          return;
        }
        if (val) {
          personalizationsToSave.push({
            fieldId: field.id,
            fieldKey: field.fieldKey,
            textValue: val,
            fieldLabel: field.label,
            displayValue: val,
            priceAdditionCents: field.priceAdditionCents,
          });
        }
      } else if (
        field.fieldType === 'option_select' ||
        field.fieldType === 'color_select'
      ) {
        const optVal = selectedOptions[field.id] || '';
        if (field.isRequired && !optVal) {
          setFormError(`Selecione uma opção para: "${field.label}".`);
          return;
        }
        if (optVal) {
          const opt = field.options.find((o) => o.value === optVal || o.id === optVal);
          personalizationsToSave.push({
            fieldId: field.id,
            fieldKey: field.fieldKey,
            selectedOptionValue: optVal,
            fieldLabel: field.label,
            displayValue: opt?.label || optVal,
            priceAdditionCents:
              field.priceAdditionCents + (opt?.priceAdditionCents || 0),
          });
        }
      } else if (
        field.fieldType === 'image_upload' ||
        field.fieldType === 'art_upload'
      ) {
        const fileObj = uploadedFiles[field.id];
        if (field.isRequired && !fileObj) {
          setFormError(`Envie o arquivo obrigatório para: "${field.label}".`);
          return;
        }
        if (fileObj) {
          personalizationsToSave.push({
            fieldId: field.id,
            fieldKey: field.fieldKey,
            uploadedFile: fileObj,
            fieldLabel: field.label,
            displayValue: `Arquivo: ${fileObj.originalName}`,
            priceAdditionCents: field.priceAdditionCents,
          });
        }
      }
    }

    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productImage:
        product.images[0]?.publicUrl ||
        'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
      sku: selectedVariant?.sku || product.sku,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      quantity,
      unitBasePriceCents,
      unitPersonalizationPriceCents,
      productionDays: product.productionDays,
      requiresArtApproval: product.requiresArtApproval,
      personalizations: personalizationsToSave,
    });

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 3000);
    if (redirectToCart) {
      router.push('/carrinho');
    }
  };

  const handleCalculateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    setShippingError(null);
    setLoadingShipping(true);
    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationPostalCode: cepInput,
          items: [
            {
              productId: product.id,
              variantId: selectedVariantId,
              quantity,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Erro ao calcular frete.');
      }
      setShippingResult(data);
    } catch (err) {
      setShippingError((err as Error).message);
    } finally {
      setLoadingShipping(false);
    }
  };

  const currentImage =
    product.images[selectedImageIdx] || product.images[0] || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* Left Column: Image Gallery */}
      <div className="lg:col-span-6 space-y-4">
        <div className="aspect-[4/3] sm:aspect-square overflow-hidden rounded-3xl border border-border bg-muted shadow-sm">
          {currentImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentImage.publicUrl}
              alt={currentImage.altText || product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              Imagem indisponível
            </div>
          )}
        </div>

        {product.images.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {product.images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedImageIdx(idx)}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  idx === selectedImageIdx
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border opacity-75 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.publicUrl}
                  alt={img.altText}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Kit Presenteável Items Breakdown */}
        {product.productType === 'gift_kit' && product.kitItems.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Gift className="h-4 w-4" aria-hidden="true" />
              <span>O que compõe este Kit Presenteável ({product.kitItems.length} itens):</span>
            </div>
            <ul className="space-y-3 divide-y divide-border/60 text-sm">
              {product.kitItems.map((ki, idx) => (
                <li key={idx} className="pt-2.5 first:pt-0 flex items-start justify-between gap-4">
                  <div>
                    <span className="font-semibold text-foreground">
                      {ki.quantity}x {ki.name}
                    </span>
                    {ki.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{ki.description}</p>
                    )}
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-1" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right Column: Details, Variants, Personalization, Actions */}
      <div className="lg:col-span-6 space-y-6">
        <div className="space-y-2 border-b border-border pb-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>SKU: {selectedVariant?.sku || product.sku}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-secondary font-medium">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Prazo de produção: {formatBusinessDays(product.productionDays)}
            </span>
          </div>

          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-foreground">
            {product.name}
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.shortDescription}
          </p>

          {/* Price Display */}
          <div className="pt-3 flex items-baseline gap-3">
            <span
              data-testid="product-unit-price"
              className="text-3xl font-bold text-foreground"
            >
              {formatCentsToBRL(unitBasePriceCents + unitPersonalizationPriceCents)}
            </span>
            {product.promotionalPriceCents &&
              product.promotionalPriceCents < product.priceCents && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCentsToBRL(product.priceCents)}
                </span>
              )}
            {unitPersonalizationPriceCents > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Inclui +{formatCentsToBRL(unitPersonalizationPriceCents)} de personalização
              </span>
            )}
          </div>
        </div>

        {/* Artwork Approval Highlight */}
        {product.requiresArtApproval && (
          <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-secondary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              <strong className="block text-foreground font-semibold">
                Inclui Prévia Digital para Aprovação de Arte
              </strong>
              Após a confirmação do pedido, nossa equipe enviará a prévia da sua arte personalizada para você aprovar antes da gravação definitiva.
            </div>
          </div>
        )}

        {/* Variants Selector */}
        {product.variants.length > 0 && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Escolha a Opção / Variação:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {product.variants.map((variant) => {
                const vStock = Math.max(
                  0,
                  variant.stockQuantity - variant.reservedQuantity
                );
                const selected = variant.id === selectedVariantId;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={!variant.isAvailable || vStock <= 0}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      selected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-card hover:bg-muted/60'
                    } ${!variant.isAvailable || vStock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-xs font-semibold text-foreground">
                      {variant.name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatCentsToBRL(
                        variant.promotionalPriceOverrideCents ||
                          variant.priceOverrideCents ||
                          product.priceCents
                      )}{' '}
                      • {vStock > 0 ? `${vStock} em estoque` : 'Esgotado'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Configurable Personalization Fields */}
        {product.personalizationFields.filter((f) => f.isActive).length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5 shadow-sm">
            <div className="border-b border-border pb-3">
              <h2 className="font-serif text-lg font-semibold">
                Personalize seu Produto
              </h2>
              <p className="text-xs text-muted-foreground">
                Preencha os detalhes com atenção. Sua personalização ficará vinculada permanentemente ao seu pedido.
              </p>
            </div>

            {product.personalizationFields
              .filter((f) => f.isActive)
              .map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`field-${field.id}`}
                      className="text-xs font-semibold text-foreground"
                    >
                      {field.label}{' '}
                      {field.isRequired ? (
                        <span className="text-destructive">*</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">(Opcional)</span>
                      )}
                    </label>
                    {field.priceAdditionCents > 0 && (
                      <span className="text-xs font-semibold text-primary">
                        + {formatCentsToBRL(field.priceAdditionCents)}
                      </span>
                    )}
                  </div>

                  {field.description && (
                    <p className="text-[11px] text-muted-foreground">{field.description}</p>
                  )}

                  {field.fieldType === 'short_text' && (
                    <input
                      id={`field-${field.id}`}
                      data-testid={`personalization-${field.fieldKey}`}
                      type="text"
                      maxLength={field.maxLength || undefined}
                      value={textValues[field.id] || ''}
                      onChange={(e) =>
                        setTextValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      placeholder={`Digite ${field.label.toLowerCase()}`}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  )}

                  {(field.fieldType === 'long_text' ||
                    field.fieldType === 'additional_notes') && (
                    <textarea
                      id={`field-${field.id}`}
                      data-testid={`personalization-${field.fieldKey}`}
                      rows={3}
                      maxLength={field.maxLength || undefined}
                      value={textValues[field.id] || ''}
                      onChange={(e) =>
                        setTextValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      placeholder="Escreva sua mensagem ou instruções..."
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    />
                  )}

                  {field.fieldType === 'date' && (
                    <input
                      id={`field-${field.id}`}
                      data-testid={`personalization-${field.fieldKey}`}
                      type="date"
                      value={textValues[field.id] || ''}
                      onChange={(e) =>
                        setTextValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm"
                    />
                  )}

                  {field.fieldType === 'option_select' && (
                    <select
                      id={`field-${field.id}`}
                      data-testid={`personalization-${field.fieldKey}`}
                      value={selectedOptions[field.id] || ''}
                      onChange={(e) =>
                        setSelectedOptions((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                    >
                      <option value="">Selecione uma opção...</option>
                      {field.options.map((opt) => (
                        <option key={opt.id} value={opt.value}>
                          {opt.label}
                          {opt.priceAdditionCents > 0
                            ? ` (+ ${formatCentsToBRL(opt.priceAdditionCents)})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.fieldType === 'color_select' && (
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {field.options.map((opt) => {
                        const isSelected = selectedOptions[field.id] === opt.value;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            data-testid={`color-option-${opt.value}`}
                            onClick={() =>
                              setSelectedOptions((prev) => ({
                                ...prev,
                                [field.id]: opt.value,
                              }))
                            }
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                                : 'border-border bg-background hover:bg-muted'
                            }`}
                          >
                            {opt.colorHex && (
                              <span
                                className="h-4 w-4 rounded-full border border-black/20"
                                style={{ backgroundColor: opt.colorHex }}
                              />
                            )}
                            <span>{opt.label}</span>
                            {opt.priceAdditionCents > 0 && (
                              <span className="text-primary font-semibold">
                                (+{formatCentsToBRL(opt.priceAdditionCents)})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(field.fieldType === 'image_upload' ||
                    field.fieldType === 'art_upload') && (
                    <div className="space-y-2">
                      <label
                        htmlFor={`field-${field.id}`}
                        className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-border bg-background px-4 py-3 text-xs hover:border-primary transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {uploadingFieldId === field.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : uploadedFiles[field.id] ? (
                            <FileCheck className="h-4 w-4 text-secondary" />
                          ) : (
                            <Upload className="h-4 w-4 text-primary" />
                          )}
                          <span>
                            {uploadedFiles[field.id]
                              ? `Arquivo anexado: ${uploadedFiles[field.id]?.originalName}`
                              : 'Clique para selecionar arquivo (PNG, JPG, WEBP ou PDF)'}
                          </span>
                        </div>
                        <span className="font-semibold text-primary">Procurar</span>
                      </label>
                      <input
                        id={`field-${field.id}`}
                        data-testid={`personalization-${field.fieldKey}`}
                        type="file"
                        accept={field.allowedMimeTypes.join(',')}
                        onChange={(e) => handleFileUpload(field.id, e.target.files?.[0])}
                        className="sr-only"
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Validation Error Alert */}
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {/* Added to Cart Alert */}
        {addedFeedback && (
          <div
            role="status"
            className="rounded-xl border border-secondary/40 bg-secondary/10 p-3.5 text-xs font-medium text-foreground flex items-center gap-2"
          >
            <Check className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
            <span>Produto adicionado à sacola com sucesso!</span>
          </div>
        )}

        {/* Quantity & Purchase Buttons */}
        {isPurchaseable ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-xl border border-border bg-card">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3.5 py-2.5 text-sm font-bold hover:bg-muted"
                >
                  -
                </button>
                <span
                  data-testid="product-quantity-value"
                  className="px-4 py-2.5 text-sm font-semibold"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() =>
                    setQuantity((q) => Math.min(availableStock, q + 1))
                  }
                  className="px-3.5 py-2.5 text-sm font-bold hover:bg-muted"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                data-testid="add-to-cart-btn"
                onClick={() => handleAddToCart(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                <span>Adicionar à Sacola e Finalizar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleAddToCart(false)}
              className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Adicionar à Sacola e Continuar Comprando
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-2">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span>Produto Temporariamente Indisponível</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Este item aguarda reposição de matéria-prima no nosso ateliê. Entre em contato pelo WhatsApp caso deseje encomendar um item similar.
            </p>
          </div>
        )}

        {/* Inline Shipping & Lead Time Calculator */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Simular Frete, Entrega Própria ou Retirada Local</span>
          </div>

          <form onSubmit={handleCalculateShipping} className="flex gap-2">
            <label htmlFor="product-cep-input" className="sr-only">
              Digite seu CEP
            </label>
            <input
              id="product-cep-input"
              type="text"
              value={formatPostalCode(cepInput)}
              onChange={(e) => setCepInput(e.target.value)}
              placeholder="00000-000"
              className="flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loadingShipping}
              className="rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/90"
            >
              {loadingShipping ? 'Calculando...' : 'Calcular'}
            </button>
          </form>

          {shippingError && (
            <p className="text-xs text-destructive">{shippingError}</p>
          )}

          {shippingResult && (
            <div className="space-y-2.5 pt-2 border-t border-border/60 text-xs">
              <div className="rounded-lg bg-muted/70 p-2.5 text-muted-foreground">
                <strong className="text-foreground">Prazo de Produção do Produto:</strong>{' '}
                {formatBusinessDays(product.productionDays)} (contado separadamente do prazo de transporte abaixo).
              </div>

              {shippingResult.localPickupLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="font-semibold block">{loc.name}</span>
                      <span className="text-muted-foreground">
                        Pronto para retirada após produção ({loc.minPrepDays} dia útil mín.)
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-secondary">Grátis</span>
                </div>
              ))}

              {shippingResult.ownDeliveryOptions.map((own) => (
                <div
                  key={own.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2.5"
                >
                  <div>
                    <span className="font-semibold block">{own.serviceName}</span>
                    <span className="text-muted-foreground">
                      Transporte: +{own.deliveryDays} dia(s) útil(eis) após produção
                    </span>
                  </div>
                  <span className="font-bold">{formatCentsToBRL(own.priceCents)}</span>
                </div>
              ))}

              {shippingResult.melhorEnvioQuotes.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2.5"
                >
                  <div>
                    <span className="font-semibold block">
                      {q.companyName} — {q.serviceName}
                    </span>
                    <span className="text-muted-foreground">
                      Transporte estimado: +{q.deliveryDays} dias úteis após produção
                    </span>
                  </div>
                  <span className="font-bold">{formatCentsToBRL(q.priceCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full Description & Packaging Specs */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-serif text-lg font-semibold">Descrição Completa & Acabamento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.fullDescription}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span>
                Dimensões: {product.lengthCm}x{product.widthCm}x{product.heightCm} cm
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Peso aprox.: {product.weightGrams}g</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
