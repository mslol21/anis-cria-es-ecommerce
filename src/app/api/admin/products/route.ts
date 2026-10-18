import { NextResponse } from 'next/server';
import {
  importProductsFromCsvText,
  listCategories,
  listProducts,
  softDeleteProductAdmin,
  upsertProductAdmin,
} from '@/lib/store/ecommerce-service';
import { dbCategories, dbProducts, dbSaveProduct, dbSoftDeleteProduct } from '@/lib/store/supabase-catalog';
import { ApiError, handleApiError } from '@/lib/security/rate-limiter';
import { requireAdminSession } from '@/lib/supabase/server';
import { productUpsertSchema } from '@/lib/validators/schemas';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);
    const products = await dbProducts({ includeHiddenForAdmin: true });
    const categories = await dbCategories(true);
    return NextResponse.json({ products, categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession(request, ['super_admin', 'admin']);
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === 'csv_import' && typeof body.csvText === 'string') {
      throw new ApiError(409, 'CSV_IMPORT_REQUIRES_REVIEW', 'Importação CSV indisponível até a validação do novo banco. Edite os produtos já cadastrados no painel.');
    }

    const parsed = productUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Dados do produto inválidos.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const product = await dbSaveProduct(
      {
        ...parsed.data,
        images: Array.isArray(body.images) ? body.images : undefined,
        variants: Array.isArray(body.variants) ? body.variants : undefined,
        personalizationFields: Array.isArray(body.personalizationFields)
          ? body.personalizationFields
          : undefined,
      }
    );

    return NextResponse.json({ product }, { status: body.id ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdminSession(request, ['super_admin', 'admin']);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      throw new ApiError(400, 'MISSING_PRODUCT_ID', 'Informe o ID do produto para exclusão lógica.');
    }
    await dbSoftDeleteProduct(id);
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
