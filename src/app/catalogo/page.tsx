import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Filter, PackageOpen, RotateCcw, Search } from 'lucide-react';
import {
  listCategories,
  listProducts,
  type CatalogFilterOptions,
} from '@/lib/store/ecommerce-service';
import { ProductCard } from '@/components/catalog/product-card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Catálogo de Presentes e Personalizados',
  description:
    'Explore nosso catálogo completo de presentes criativos, álbuns personalizados, velas botânicas e kits presenteáveis.',
  alternates: {
    canonical: '/catalogo',
  },
};

const OCCASIONS = [
  'Aniversário',
  'Casamento',
  'Maternidade',
  'Casa Nova',
  'Madrinhas',
  'Corporativo',
  'Dia dos Namorados',
];

export default function CatalogPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    category?: string;
    occasion?: string;
    minPrice?: string;
    maxPrice?: string;
    available?: string;
    sort?: string;
  };
}) {
  const categories = listCategories(false);
  const filters: CatalogFilterOptions = {
    search: searchParams.q || undefined,
    categorySlug: searchParams.category || undefined,
    occasion: searchParams.occasion || undefined,
    onlyAvailable: searchParams.available === 'true',
    minPriceCents: searchParams.minPrice ? Number(searchParams.minPrice) * 100 : undefined,
    maxPriceCents: searchParams.maxPrice ? Number(searchParams.maxPrice) * 100 : undefined,
    sortBy: (searchParams.sort as CatalogFilterOptions['sortBy']) || 'featured',
  };

  const products = listProducts(filters);

  return (
    <div className="container py-7 sm:py-12 space-y-7 sm:space-y-9">
      <div className="border-b border-border pb-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-2">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-primary">
                Início
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground font-medium">Catálogo</li>
          </ol>
        </nav>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight">
          Catálogo de Presentes & Personalizados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Utilize os filtros abaixo para encontrar o presente ideal por categoria, ocasião, faixa de preço ou disponibilidade.
        </p>
      </div>

      {/* Filters & Sorting Form */}
      <form
        method="GET"
        action="/catalogo"
        className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4"
        aria-label="Filtros do catálogo"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <label htmlFor="filter-q" className="block text-xs font-semibold mb-1.5">
              Busca por termo ou SKU
            </label>
            <div className="relative">
              <input
                id="filter-q"
                name="q"
                type="search"
                defaultValue={searchParams.q || ''}
                placeholder="Ex: álbum, vela, kit, porta-joias..."
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="filter-category" className="block text-xs font-semibold mb-1.5">
              Categoria
            </label>
            <select
              id="filter-category"
              name="category"
              defaultValue={searchParams.category || ''}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-occasion" className="block text-xs font-semibold mb-1.5">
              Ocasião
            </label>
            <select
              id="filter-occasion"
              name="occasion"
              defaultValue={searchParams.occasion || ''}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas as ocasiões</option>
              {OCCASIONS.map((occ) => (
                <option key={occ} value={occ}>
                  {occ}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-maxPrice" className="block text-xs font-semibold mb-1.5">
              Preço Máximo (R$)
            </label>
            <input
              id="filter-maxPrice"
              name="maxPrice"
              type="number"
              min="0"
              step="10"
              defaultValue={searchParams.maxPrice || ''}
              placeholder="Ex: 250"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="filter-sort" className="block text-xs font-semibold mb-1.5">
              Ordenar por
            </label>
            <select
              id="filter-sort"
              name="sort"
              defaultValue={searchParams.sort || 'featured'}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="featured">Destaques</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
              <option value="newest">Mais Recentes</option>
              <option value="name_asc">Ordem Alfabética (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/60">
          <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              name="available"
              value="true"
              defaultChecked={searchParams.available === 'true'}
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
            />
            <span>Mostrar somente produtos disponíveis para compra imediata</span>
          </label>

          <div className="flex items-center gap-3">
            <Link
              href="/catalogo"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpar Filtros</span>
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Aplicar Filtros</span>
            </button>
          </div>
        </div>
      </form>

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          Exibindo <strong className="text-foreground">{products.length}</strong>{' '}
          {products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
        </p>
      </div>

      {/* Product Grid or Empty State */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-4">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PackageOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-semibold">
              Nenhum produto encontrado com esses filtros
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Experimente limpar os filtros ou buscar por outros termos como &ldquo;álbum&rdquo;, &ldquo;vela&rdquo; ou &ldquo;kit&rdquo;.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ver Todo o Catálogo</span>
          </Link>
        </div>
      )}
    </div>
  );
}
