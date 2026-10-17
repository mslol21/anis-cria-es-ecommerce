-- ==============================================================================
-- MIGRATION 003: INITIAL COMMERCIAL CONFIGURATION & BASE CATALOG STRUCTURE
-- ==============================================================================

INSERT INTO public.store_settings (
  id,
  store_name,
  legal_name,
  cnpj,
  support_email,
  support_whatsapp,
  origin_postal_code,
  address_line
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Anis Criações',
  'Anis Criações Presentes e Personalizados LTDA',
  '48.123.456/0001-89',
  'atendimento@aniscriacoes.com.br',
  '5511998765432',
  '01310100',
  'Rua Oscar Freire, 1240 - Jardins, São Paulo/SP'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pickup_locations (
  id,
  name,
  postal_code,
  street,
  number,
  complement,
  neighborhood,
  city,
  state,
  operating_hours,
  available_days,
  min_prep_days,
  instructions,
  fee_cents,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Ateliê Anis Criações - Jardins',
  '01426001',
  'Rua Oscar Freire',
  '1240',
  'Loja 02 - Térreo',
  'Jardins',
  'São Paulo',
  'SP',
  'Segunda a Sexta das 09h às 18h30 | Sábado das 09h às 14h',
  ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'],
  1,
  'Apresente o código de retirada enviado na confirmação do pedido e um documento oficial com foto.',
  0,
  TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, name, slug, description, display_order, is_active, seo_title, seo_description)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'Papelaria Fina & Álbuns', 'papelaria-fina-e-albuns', 'Álbuns de memórias, planners bordados e cadernos personalizados em linho.', 1, TRUE, 'Papelaria Fina e Álbuns Personalizados | Anis Criações', 'Álbuns artesanais em linho e papelaria personalizada com gravação em hot stamping.'),
  ('00000000-0000-0000-0000-000000000102', 'Kits Presenteáveis', 'kits-presenteaveis', 'Caixas rígidas curadas com múltiplos itens afetivos para ocasiões especiais.', 2, TRUE, 'Kits Presenteáveis e Boxes Exclusivas | Anis Criações', 'Boxes presenteáveis completas para aniversários, casamentos, maternidade e corporativo.'),
  ('00000000-0000-0000-0000-000000000103', 'Casa, Aromas & Decor', 'casa-aromas-e-decor', 'Velas aromáticas vegetais, difusores em cerâmica e peças decorativas autorais.', 3, TRUE, 'Casa, Aromas e Decoração Afetiva | Anis Criações', 'Velas botânicas, cerâmicas artesanais e presentes para casa.'),
  ('00000000-0000-0000-0000-000000000104', 'Acrílicos & Gravação Laser', 'acrilicos-e-gravacao-laser', 'Quadros com foto, luminárias em acrílico cristal e porta-joias gravados.', 4, TRUE, 'Presentes em Acrílico e Gravação a Laser | Anis Criações', 'Luminárias personalizadas, porta-joias com iniciais e presentes sob encomenda.')
ON CONFLICT (slug) DO NOTHING;
