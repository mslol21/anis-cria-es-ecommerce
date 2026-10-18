-- ANISVEST: corporate product category, safe to run repeatedly.
-- Does not insert placeholder products or alter existing orders.
INSERT INTO public.categories (
  id, name, slug, description, display_order, is_active, seo_title, seo_description
) VALUES (
  '00000000-0000-0000-0000-000000000105',
  'Anisvest — Empresas',
  'anisvest-corporativo',
  'Sacolas TNT, ecobags, calendários, brindes e materiais promocionais personalizados para empresas.',
  0, true,
  'Anisvest | Personalizados para Empresas',
  'Sacolas personalizadas, ecobags, calendários e brindes corporativos.'
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;
