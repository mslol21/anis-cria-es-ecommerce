import { NextResponse } from 'next/server';
import {
  listCategories,
  listProducts,
  type CatalogFilterOptions,
} from '@/lib/store/ecommerce-service';
import { dbCategories, dbProducts } from '@/lib/store/supabase-catalog';
import { handleApiError } from '@/lib/security/rate-limiter';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: CatalogFilterOptions = {
      search: searchParams.get('q') || undefined,
      categorySlug: searchParams.get('category') || undefined,
      occasion: searchParams.get('occasion') || undefined,
      onlyAvailable: searchParams.get('available') === 'true',
      minPriceCents: searchParams.get('minPrice')
        ? Number(searchParams.get('minPrice'))
        : undefined,
      maxPriceCents: searchParams.get('maxPrice')
        ? Number(searchParams.get('maxPrice'))
        : undefined,
      sortBy:
        (searchParams.get('sort') as CatalogFilterOptions['sortBy']) || 'featured',
    };

    const products = await dbProducts(filters);
    const categories = await dbCategories(false);

    return NextResponse.json({
      products,
      categories,
      total: products.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
