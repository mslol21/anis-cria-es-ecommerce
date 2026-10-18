import 'server-only';
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { ApiError } from '@/lib/security/rate-limiter';
import type { Category, Product } from '@/types/database';
import type { CatalogFilterOptions } from '@/lib/store/ecommerce-service';
import { slugify } from '@/lib/utils';

const client = () => {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new ApiError(503, 'CATALOG_NOT_CONFIGURED', 'Catálogo Supabase não configurado.');
  return createServiceRoleClient();
};
const fail = (message: string): never => { throw new ApiError(503, 'CATALOG_DATABASE_ERROR', message); };
const category = (r: any): Category => ({
  id:r.id, parentId:r.parent_id, name:r.name, slug:r.slug, description:r.description || '',
  imageUrl:r.image_url, displayOrder:r.display_order || 0, isActive:r.is_active,
  seoTitle:r.seo_title, seoDescription:r.seo_description, deletedAt:r.deleted_at,
});
const product = (r: any, categories: Category[]): Product => ({
  id:r.id, categoryId:r.category_id, category:categories.find(c=>c.id===r.category_id),
  name:r.name, slug:r.slug, sku:r.sku, shortDescription:r.short_description,
  fullDescription:r.full_description, productType:r.product_type,
  priceCents:r.price_cents, promotionalPriceCents:r.promotional_price_cents,
  internalCostCents:r.internal_cost_cents, stockQuantity:r.stock_quantity,
  reservedQuantity:r.reserved_quantity, trackInventory:r.track_inventory,
  weightGrams:r.weight_grams, heightCm:Number(r.height_cm), widthCm:Number(r.width_cm),
  lengthCm:Number(r.length_cm), productionDays:r.production_days, requiresArtApproval:r.requires_art_approval,
  isVisible:r.is_visible, isAvailable:r.is_available, isFeatured:r.is_featured,
  occasions:r.occasions || [], kitItems:r.kit_items || [], seoTitle:r.seo_title,
  seoDescription:r.seo_description, images:[], variants:[], personalizationFields:[],
  createdAt:r.created_at, updatedAt:r.updated_at, deletedAt:r.deleted_at,
});

export async function dbCategories(includeInactive = false): Promise<Category[]> {
  const { data,error } = await client().from('categories').select('*').is('deleted_at',null).order('display_order');
  if(error) return fail('Falha na leitura de categorias.');
  return (data||[]).map(category).filter(c=>includeInactive||c.isActive);
}
export async function dbProducts(filters: CatalogFilterOptions = {}): Promise<Product[]> {
  const categories=await dbCategories(true);
  let q=client().from('products').select('*').is('deleted_at',null);
  if(!filters.includeHiddenForAdmin) q=q.eq('is_visible',true);
  if(filters.search) q=q.or('name.ilike.%'+filters.search.replace(/[,()%]/g,'')+'%,sku.ilike.%'+filters.search.replace(/[,()%]/g,'')+'%');
  if(filters.onlyAvailable) q=q.eq('is_available',true);
  const {data,error}=await q.limit(1000);
  if(error) return fail('Falha na leitura de produtos.');
  let products=(data||[]).map(r=>product(r,categories));
  if(filters.categorySlug) products=products.filter(p=>p.category?.slug===filters.categorySlug);
  if(filters.occasion) products=products.filter(p=>p.occasions.some(x=>x.toLowerCase()===filters.occasion?.toLowerCase()));
  if(filters.minPriceCents!==undefined) products=products.filter(p=>p.priceCents>=filters.minPriceCents!);
  if(filters.maxPriceCents!==undefined) products=products.filter(p=>p.priceCents<=filters.maxPriceCents!);
  products.sort((a,b)=>{
    switch(filters.sortBy){
      case 'price_asc': return a.priceCents-b.priceCents;
      case 'price_desc': return b.priceCents-a.priceCents;
      case 'newest': return new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();
      case 'name_asc': return a.name.localeCompare(b.name,'pt-BR');
      default: return Number(b.isFeatured)-Number(a.isFeatured)||a.name.localeCompare(b.name,'pt-BR');
    }
  });
  // Attach real images; no fabricated placeholders for unpublished inventory.
  const ids=products.map(p=>p.id);
  if(ids.length){
    const {data:images,error:imageError}=await client().from('product_images').select('*').in('product_id',ids);
    if(imageError) return fail('Falha na leitura das imagens dos produtos.');
    for(const img of images||[]){
      const p=products.find(x=>x.id===img.product_id);
      p?.images.push({id:img.id,productId:img.product_id,variantId:img.variant_id,
        storagePath:img.storage_path,publicUrl:img.public_url||'',altText:img.alt_text||'',
        displayOrder:img.display_order||0,isPrimary:img.is_primary});
    }
    products.forEach(p=>p.images.sort((a,b)=>a.displayOrder-b.displayOrder));
  }
  return products;
}
export async function dbProductBySlug(slug:string):Promise<Product|null>{
  return (await dbProducts({search:undefined})).find(p=>p.slug===slug)||null;
}
export async function dbSaveProduct(input:Partial<Product>&{name:string;sku:string;priceCents:number;categoryId:string}):Promise<Product>{
  const db=client();
  const isUpdate=Boolean(input.id);
  const row:any={
    category_id:input.categoryId,name:input.name,sku:input.sku,price_cents:input.priceCents,
    short_description:input.shortDescription||input.name,
    full_description:input.fullDescription||input.shortDescription||input.name,
    product_type:input.productType||'regular_stock',
    ...(input.stockQuantity!==undefined?{stock_quantity:input.stockQuantity}:{}),
    ...(input.productionDays!==undefined?{production_days:input.productionDays}:{}),
    ...(input.weightGrams!==undefined?{weight_grams:input.weightGrams}:{}),
    ...(input.heightCm!==undefined?{height_cm:input.heightCm}:{}),
    ...(input.widthCm!==undefined?{width_cm:input.widthCm}:{}),
    ...(input.lengthCm!==undefined?{length_cm:input.lengthCm}:{}),
    ...(input.requiresArtApproval!==undefined?{requires_art_approval:input.requiresArtApproval}:{}),
    ...(input.isFeatured!==undefined?{is_featured:input.isFeatured}:{})
  };
  // Never make an unreviewed product publicly purchasable on creation.
  if(!isUpdate){row.is_visible=false;row.is_available=false;row.slug=slugify(input.name)+'-'+crypto.randomUUID().slice(0,8);}
  if(isUpdate && input.isVisible!==undefined)row.is_visible=input.isVisible;
  if(isUpdate && input.isAvailable!==undefined)row.is_available=input.isAvailable;
  const result=isUpdate?await db.from('products').update(row).eq('id',input.id!).select('*').single()
    :await db.from('products').insert(row).select('*').single();
  if(result.error||!result.data) return fail('Falha ao salvar o produto no Supabase.');
  return product(result.data,await dbCategories(true));
}
export async function dbSoftDeleteProduct(id:string):Promise<void>{
 const {error}=await client().from('products').update({deleted_at:new Date().toISOString(),is_visible:false,is_available:false}).eq('id',id);
 if(error) return fail('Não foi possível remover o produto.');
}
