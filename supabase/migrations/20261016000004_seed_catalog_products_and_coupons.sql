-- ==============================================================================
-- MIGRATION 004: CATALOG PRODUCTS, VARIANTS, PERSONALIZATION FIELDS & COUPONS
-- ==============================================================================

-- 1. Insert the 6 products covering all mandatory product types
INSERT INTO public.products (
  id, category_id, name, slug, sku, short_description, full_description,
  product_type, price_cents, promotional_price_cents, internal_cost_cents,
  stock_quantity, reserved_quantity, track_inventory, weight_grams,
  height_cm, width_cm, length_cm, production_days, requires_art_approval,
  is_visible, is_available, is_featured, occasions, kit_items, seo_title, seo_description
) VALUES
  (
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000103',
    'Vela Botânica Anis & Figo em Cerâmica Artesanal',
    'vela-botanica-anis-e-figo-ceramica',
    'ANIS-VEL-001',
    'Vela aromática 100% cera vegetal de coco com notas de figo fresco, anis estrelado e sândalo em pote de cerâmica reutilizável.',
    'Produzida artesanalmente em pequenos lotes, a Vela Botânica Anis & Figo combina cera vegetal livre de parafina, pavio de algodão trançado e fragrância autoral sofisticada. O recipiente em cerâmica esmaltada à mão pode ser reutilizado como cachepô ou porta-objetos.',
    'regular_stock',
    11900, 9800, 3900,
    25, 0, TRUE, 480,
    11.00, 11.00, 11.00, 0, FALSE,
    TRUE, TRUE, TRUE,
    ARRAY['Aniversário', 'Casa Nova', 'Agradecimento'],
    '[]'::jsonb,
    'Vela Botânica Anis & Figo em Cerâmica Artesanal | Anis Criações',
    'Vela aromática vegetal em cerâmica artesanal com notas de figo e anis. Pronta entrega.'
  ),
  (
    '00000000-0000-0000-0000-000000001002',
    '00000000-0000-0000-0000-000000000101',
    'Álbum de Memórias em Linho Puro com Hot Stamping',
    'album-memorias-linho-puro-hot-stamping',
    'ANIS-ALB-002',
    'Álbum encadernado à mão em linho belga com gravação de título, data e cor da folha metálica configuráveis.',
    'Nosso clássico Álbum de Memórias é confeccionado em capa dura revestida em linho puro 100% natural, com costura exposta interna de alta durabilidade e 80 páginas em papel acid-free 240g.',
    'personalized',
    24900, 21900, 8500,
    15, 0, TRUE, 850,
    6.00, 25.00, 31.00, 4, TRUE,
    TRUE, TRUE, TRUE,
    ARRAY['Casamento', 'Maternidade', 'Viagem', 'Bodas'],
    '[]'::jsonb,
    'Álbum de Fotos Personalizado em Linho com Hot Stamping | Anis Criações',
    'Álbum de memórias artesanal revestido em linho com gravação personalizada e aprovação de prévia.'
  ),
  (
    '00000000-0000-0000-0000-000000001003',
    '00000000-0000-0000-0000-000000000104',
    'Luminária Acrílico Cristal Retrato Ilustrado & Mensagem',
    'luminaria-acrilico-cristal-retrato-ilustrado',
    'ANIS-LUM-003',
    'Produzida sob encomenda a partir da sua foto favorita, gravada a laser em acrílico cristal 5mm com base em madeira nobre e LED quente.',
    'Cada Luminária Acrílico Cristal é desenhada individualmente por nossos ilustradores a partir da fotografia enviada por você, com aprovação de prévia antes da gravação definitiva.',
    'made_to_order',
    18900, NULL, 6200,
    0, 0, FALSE, 550,
    24.00, 18.00, 8.00, 6, TRUE,
    TRUE, TRUE, TRUE,
    ARRAY['Dia dos Namorados', 'Aniversário', 'Casamento', 'Homenagem'],
    '[]'::jsonb,
    'Luminária Personalizada com Foto em Acrílico e Madeira | Anis Criações',
    'Luminária produzida sob encomenda com ilustração da sua foto gravada a laser e aprovação de prévia.'
  ),
  (
    '00000000-0000-0000-0000-000000001004',
    '00000000-0000-0000-0000-000000000104',
    'Porta-Joias de Viagem Clássico com Monograma',
    'porta-joias-viagem-classico-monograma',
    'ANIS-PJ-004',
    'Porta-joias estruturado com interior aveludado, divisórias modulares e iniciais aplicadas. Disponível em diversas cores e tamanhos.',
    'Ideal para madrinhas, viagens e presentes de aniversário, o Porta-Joias Clássico Anis possui revestimento externo de toque macio e forro em veludo alemão.',
    'with_variants',
    13900, 11900, 4400,
    28, 0, TRUE, 320,
    7.00, 14.00, 14.00, 2, FALSE,
    TRUE, TRUE, TRUE,
    ARRAY['Madrinhas', 'Aniversário', 'Dia das Mães'],
    '[]'::jsonb,
    'Porta-Joias Personalizado com Iniciais para Presente | Anis Criações',
    'Porta-joias de viagem com divisórias em veludo e personalização de iniciais.'
  ),
  (
    '00000000-0000-0000-0000-000000001005',
    '00000000-0000-0000-0000-000000000102',
    'Box Presenteável Ritual de Afeto & Bem-Estar (5 Itens)',
    'box-presenteavel-ritual-afeto-bem-estar',
    'ANIS-KIT-005',
    'Caixa rígida em linho com fecho magnético contendo 5 itens autorais coordenados para um presente inesquecível.',
    'A Box Ritual de Afeto reúne 5 produtos selecionados do nosso ateliê acomodados em berço de palha natural perfumada e fita de gorgurão com laço duplo.',
    'gift_kit',
    32900, 28900, 11500,
    10, 0, TRUE, 1450,
    14.00, 28.00, 32.00, 3, FALSE,
    TRUE, TRUE, TRUE,
    ARRAY['Aniversário', 'Maternidade', 'Corporativo', 'Casamento'],
    '[
      {"name": "Caixa Rígida Revestida em Linho com Nome Gravado", "quantity": 1, "description": "Dimensões 30x26x12cm com fecho magnético"},
      {"name": "Vela Botânica Anis & Figo 180g em Cerâmica", "quantity": 1, "description": "Cera 100% vegetal de coco"},
      {"name": "Caderno Pontilhado Costura Copta com Iniciais", "quantity": 1, "description": "Capa em papel italiano 300g"},
      {"name": "Home Spray Chá Branco & Bambu 120ml", "quantity": 1, "description": "Frasco âmbar com válvula dourada"},
      {"name": "Cartão em Papel Algodão 350g com Lacre de Cera", "quantity": 1, "description": "Com sua mensagem impressa"}
    ]'::jsonb,
    'Box Presenteável Personalizada Ritual de Afeto | Anis Criações',
    'Kit presenteável de luxo com caixa rígida personalizada, vela botânica, caderno, home spray e cartão.'
  ),
  (
    '00000000-0000-0000-0000-000000001006',
    '00000000-0000-0000-0000-000000000103',
    'Caixa Musical Artesanal em Madeira Nogueira Esculpida',
    'caixa-musical-artesanal-madeira-nogueira',
    'ANIS-MUS-006',
    'Mecanismo mecânico suíço de 18 notas em caixa de nogueira maciça com gravação interna na tampa.',
    'Peça de colecionador esculpida em madeira nogueira certificada com acabamento em cera de carnaúba natural. Temporariamente indisponível.',
    'temporarily_unavailable',
    29900, NULL, 13000,
    0, 0, TRUE, 420,
    8.00, 12.00, 16.00, 5, FALSE,
    TRUE, FALSE, FALSE,
    ARRAY['Maternidade', 'Colecionador'],
    '[]'::jsonb,
    'Caixa Musical Artesanal em Madeira Nogueira | Anis Criações',
    'Caixa musical personalizada em madeira nogueira maciça.'
  )
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert product images
INSERT INTO public.product_images (id, product_id, public_url, alt_text, display_order, is_primary)
VALUES
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000001001', 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85', 'Vela Botânica Anis e Figo em pote de cerâmica artesanal', 1, TRUE),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000001002', 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=85', 'Álbum de Memórias revestido em linho natural com gravação dourada', 1, TRUE),
  ('00000000-0000-0000-0000-000000002003', '00000000-0000-0000-0000-000000001003', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=900&q=85', 'Luminária em acrílico gravado a laser com base de madeira', 1, TRUE),
  ('00000000-0000-0000-0000-000000002004', '00000000-0000-0000-0000-000000001004', 'https://images.unsplash.com/photo-1584302179602-e4c3d3fd629d?auto=format&fit=crop&w=900&q=85', 'Porta-joias personalizado aberto com divisórias em veludo', 1, TRUE),
  ('00000000-0000-0000-0000-000000002005', '00000000-0000-0000-0000-000000001005', 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=85', 'Box Presenteável Ritual de Afeto aberta com 5 itens', 1, TRUE),
  ('00000000-0000-0000-0000-000000002006', '00000000-0000-0000-0000-000000001006', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=900&q=85', 'Caixa Musical Artesanal em Madeira Nogueira', 1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert product variants for Porta-Joias
INSERT INTO public.product_variants (
  id, product_id, sku, name, attributes, price_override_cents, promotional_price_override_cents, stock_quantity, reserved_quantity, weight_grams, is_available
) VALUES
  ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000001004', 'ANIS-PJ-004-OW-P', 'Off-White Pérola — Compacto (10x10cm)', '{"Cor": "Off-White Pérola", "Tamanho": "Compacto (10x10cm)"}'::jsonb, 11900, 9900, 12, 0, 240, TRUE),
  ('00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-000000001004', 'ANIS-PJ-004-RS-M', 'Rosé Quartz — Médio (14x14cm)', '{"Cor": "Rosé Quartz", "Tamanho": "Médio (14x14cm)"}'::jsonb, 14900, 12900, 10, 0, 340, TRUE),
  ('00000000-0000-0000-0000-000000003003', '00000000-0000-0000-0000-000000001004', 'ANIS-PJ-004-SV-G', 'Verde Sálvia — Grande Duplo (18x14cm)', '{"Cor": "Verde Sálvia", "Tamanho": "Grande Duplo (18x14cm)"}'::jsonb, 17900, 15900, 6, 0, 460, TRUE)
ON CONFLICT (sku) DO NOTHING;

-- 4. Insert personalization fields
INSERT INTO public.personalization_fields (
  id, product_id, field_key, label, description, field_type, is_required, max_length, price_addition_cents, options, display_order, is_active
) VALUES
  ('00000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-000000001002', 'titulo_capa', 'Título da Capa (até 28 caracteres)', 'Ex: Nossa História - Ana & Lucas', 'short_text', TRUE, 28, 0, '[]'::jsonb, 1, TRUE),
  ('00000000-0000-0000-0000-000000004002', '00000000-0000-0000-0000-000000001002', 'data_especial', 'Data Comemorativa (Opcional)', 'Gravada na parte inferior da capa', 'date', FALSE, 20, 0, '[]'::jsonb, 2, TRUE),
  ('00000000-0000-0000-0000-000000004003', '00000000-0000-0000-0000-000000001002', 'cor_linho', 'Cor do Revestimento em Linho', NULL, 'color_select', TRUE, NULL, 0, '[{"id":"opt-linho-areia","label":"Areia Natural","value":"areia_natural","colorHex":"#DFD6C7","priceAdditionCents":0},{"id":"opt-linho-salvia","label":"Verde Sálvia","value":"verde_salvia","colorHex":"#7A8B71","priceAdditionCents":0},{"id":"opt-linho-terracota","label":"Terracota Suave","value":"terracota_suave","colorHex":"#B66655","priceAdditionCents":1500}]'::jsonb, 3, TRUE),
  ('00000000-0000-0000-0000-000000004004', '00000000-0000-0000-0000-000000001002', 'acabamento_gravacao', 'Acabamento da Gravação', NULL, 'option_select', TRUE, NULL, 0, '[{"id":"opt-hs-ouro","label":"Hot Stamping Ouro Clássico","value":"ouro","priceAdditionCents":0},{"id":"opt-hs-prata","label":"Hot Stamping Prata","value":"prata","priceAdditionCents":0},{"id":"opt-hs-bordado","label":"Bordado Computadorizado em Relevo (+ R$ 35,00)","value":"bordado_relevo","priceAdditionCents":3500}]'::jsonb, 4, TRUE),
  ('00000000-0000-0000-0000-000000004005', '00000000-0000-0000-0000-000000001003', 'foto_referencia', 'Foto para Ilustração Linear', 'Envie uma foto nítida em JPG, PNG ou WEBP', 'image_upload', TRUE, NULL, 0, '[]'::jsonb, 1, TRUE),
  ('00000000-0000-0000-0000-000000004006', '00000000-0000-0000-0000-000000001003', 'frase_gravada', 'Frase ou Nome na Base de Madeira', 'Até 45 caracteres', 'short_text', TRUE, 45, 0, '[]'::jsonb, 2, TRUE),
  ('00000000-0000-0000-0000-000000004007', '00000000-0000-0000-0000-000000001004', 'iniciais_monograma', 'Iniciais ou Nome Curto (até 10 caracteres)', 'Ex: M.C. ou Mariana', 'short_text', TRUE, 10, 0, '[]'::jsonb, 1, TRUE),
  ('00000000-0000-0000-0000-000000004008', '00000000-0000-0000-0000-000000001005', 'nome_tampa_caixa', 'Nome para Gravação na Tampa da Caixa', NULL, 'short_text', TRUE, 24, 0, '[]'::jsonb, 1, TRUE),
  ('00000000-0000-0000-0000-000000004009', '00000000-0000-0000-0000-000000001005', 'mensagem_cartao', 'Mensagem para o Cartão com Lacre de Cera', NULL, 'long_text', TRUE, 400, 0, '[]'::jsonb, 2, TRUE)
ON CONFLICT (product_id, field_key) DO NOTHING;

-- 5. Insert coupons
INSERT INTO public.coupons (
  id, code, description, discount_type, discount_value, min_order_cents, max_discount_cents, usage_limit, usage_count, is_active
) VALUES
  ('00000000-0000-0000-0000-000000005001', 'BEMVINDO10', '10% de desconto na primeira compra (pedidos acima de R$ 80,00)', 'percentage', 10, 8000, 5000, 500, 0, TRUE),
  ('00000000-0000-0000-0000-000000005002', 'AFETO25', 'R$ 25,00 de desconto para compras a partir de R$ 200,00', 'fixed_cents', 2500, 20000, 2500, 100, 0, TRUE)
ON CONFLICT (code) DO NOTHING;
