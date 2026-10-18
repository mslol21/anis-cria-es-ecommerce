import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { listCategories, listProducts } from '@/lib/store/ecommerce-service';
import { dbCategories, dbProducts } from '@/lib/store/supabase-catalog';
import { ProductCard } from '@/components/catalog/product-card';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const categories = await dbCategories(false);
  const category = categories.find((c) => c.slug === params.slug);
  if (!category) {
    return { title: 'Categoria não encontrada' };
  }
  return {
    title: category.seoTitle || category.name,
    description: category.seoDescription || category.description,
    alternates: {
      canonical: `/categoria/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const categories = await dbCategories(false);
  const category = categories.find((c) => c.slug === params.slug);

  if (!category) {
    notFound();
  }

  const products = await dbProducts({ categorySlug: category.slug });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Início',
        item: `${baseUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Catálogo',
        item: `${baseUrl}/catalogo`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: category.name,
        item: `${baseUrl}/categoria/${category.slug}`,
      },
    ],
  };

  return (
    <div className="container py-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="border-b border-border pb-6 space-y-2">
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Voltar para o Catálogo Completo</span>
        </Link>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold">{category.name}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          {category.description}
        </p>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum produto ativo nesta categoria no momento.
          </p>
        </div>
      )}
    </div>
  );
}
