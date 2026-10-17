import React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Layers,
  Package,
  PenTool,
  Sparkles,
} from 'lucide-react';
import type { Product } from '@/types/database';
import { formatBusinessDays, formatCentsToBRL } from '@/lib/utils';
import {
  getEffectiveProductBasePriceCents,
  isProductAvailableForPurchase,
} from '@/lib/store/ecommerce-service';

const PRODUCT_TYPE_BADGE: Record<
  Product['productType'],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  regular_stock: { label: 'Pronta Entrega', icon: CheckCircle2 },
  personalized: { label: 'Personalizável', icon: PenTool },
  made_to_order: { label: 'Sob Encomenda', icon: Sparkles },
  with_variants: { label: 'Opções e Cores', icon: Layers },
  gift_kit: { label: 'Kit Presenteável', icon: Package },
  temporarily_unavailable: { label: 'Indisponível', icon: AlertCircle },
};

export function ProductCard({ product }: { product: Product }) {
  const primaryImage =
    product.images.find((i) => i.isPrimary) || product.images[0];
  const effectivePriceCents = getEffectiveProductBasePriceCents(product);
  const hasPromo =
    product.promotionalPriceCents !== null &&
    product.promotionalPriceCents > 0 &&
    product.promotionalPriceCents < product.priceCents;

  const availability = isProductAvailableForPurchase(
    product,
    product.variants[0]?.id,
    1
  );
  const badgeInfo = PRODUCT_TYPE_BADGE[product.productType];
  const BadgeIcon = badgeInfo.icon;

  return (
    <article
      data-testid={`product-card-${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[1.4rem] border border-border/75 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/25 focus-within:ring-2 focus-within:ring-primary"
    >
      <Link
        href={`/produto/${product.slug}`}
        className="relative aspect-[4/5] sm:aspect-[4/3] w-full overflow-hidden bg-muted block"
      >
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImage.publicUrl}
            alt={primaryImage.altText || product.name}
            loading="lazy"
            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.07]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
            Sem imagem
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
              availability.available
                ? 'bg-background/95 text-foreground'
                : 'bg-destructive text-destructive-foreground'
            }`}
          >
            <BadgeIcon className="h-3.5 w-3.5 text-primary" />
            <span>{badgeInfo.label}</span>
          </span>

          {hasPromo && availability.available && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-sm">
              Oferta
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div className="space-y-2">
          {product.category && (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {product.category.name}
            </span>
          )}

          <h3 className="font-serif text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            <Link href={`/produto/${product.slug}`} className="focus:outline-none">
              {product.name}
            </Link>
          </h3>

          <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {product.shortDescription}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-border/70 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              {hasPromo && (
                <span className="block text-xs text-muted-foreground line-through">
                  {formatCentsToBRL(product.priceCents)}
                </span>
              )}
              <span className="text-lg font-bold text-foreground">
                {formatCentsToBRL(effectivePriceCents)}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-secondary shrink-0" aria-hidden="true" />
              <span>{formatBusinessDays(product.productionDays)}</span>
            </div>
          </div>

          <Link
            href={`/produto/${product.slug}`}
            className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-all group-hover:shadow-md ${
              availability.available
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {availability.available
              ? product.personalizationFields.length > 0
                ? 'Personalizar e Comprar'
                : 'Ver Detalhes'
              : 'Ver Produto (Indisponível)'}
            <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
