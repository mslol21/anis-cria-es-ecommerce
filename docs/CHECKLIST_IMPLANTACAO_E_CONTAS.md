# Roteiro de Configuração de Contas Externas e Checklist de Implantação (Vercel)

Este documento detalha o passo a passo para conectar as contas comerciais reais (Supabase, InfinitePay e Melhor Envio) e realizar o deploy seguro na Vercel.

---

## 1. Configuração do Supabase (PostgreSQL, Auth e Storage)

1. Crie um novo projeto em [https://supabase.com/dashboard](https://supabase.com/dashboard) na região **South America (São Paulo - `sa-east-1`)**.
2. Execute as migrações versionadas presentes em `supabase/migrations/` na ordem cronológica:
   - `supabase/migrations/20261016000001_initial_schema.sql` (cria as 22 tabelas relacionais, tipos enum, constraints e índices).
   - `supabase/migrations/20261016000002_functions_triggers_and_rls.sql` (cria funções transacionais de reserva concorrente de estoque com `FOR UPDATE`, confirmação idempotente de pagamento, anonimização LGPD, políticas RLS em todas as 22 tabelas e buckets de Storage).
   - `supabase/migrations/20261016000003_initial_catalog_setup.sql` (configuração inicial da loja, ponto de retirada e categorias).
3. Verifique em **Storage -> Buckets** a criação dos 3 buckets:
   - `catalog-public` (Público — imagens de vitrine dos produtos).
   - `custom-uploads-private` (**Privado** — fotos e artes enviadas pelos clientes no pedido).
   - `design-previews-private` (**Privado** — prévias de arte enviadas pelos designers para aprovação).
4. Para atribuir permissão administrativa a um usuário autenticado, execute no SQL Editor (usando `service_role`):
   ```sql
   INSERT INTO public.staff_roles (user_id, role, is_active)
   VALUES ('UUID_DO_USUARIO_AUTH', 'super_admin', TRUE);
   ```

---

## 2. Configuração da InfinitePay (Checkout Oficial Brasileiro)

Documentação de referência: [https://www.infinitepay.io/checkout-documentacao](https://www.infinitepay.io/checkout-documentacao)

1. Acesse sua conta comercial InfinitePay Brasil e localize sua **InfiniteTag (`handle`)**.
2. Configure no ambiente de produção:
   - `INFINITEPAY_API_BASE_URL=https://api.checkout.infinitepay.io`
   - `INFINITEPAY_HANDLE=sua_infinitetag_sem_cifrao`
3. O sistema envia automaticamente em cada chamada `POST https://api.checkout.infinitepay.io/links`:
   - `handle`: sua InfiniteTag
   - `order_nsu`: número comercial único do pedido (`ANIS-YYYY-XXXXXX`)
   - `items`: lista de itens com `price` inteiro em **centavos** e `quantity`
   - `redirect_url`: `https://SEU_DOMINIO/pedido/confirmacao?order=...&token=...`
   - `webhook_url`: `https://SEU_DOMINIO/api/webhooks/infinitepay`
4. **Reconciliação e Segurança:**
   - O sistema nunca confia exclusivamente no `redirect_url`.
   - O endpoint `/api/webhooks/infinitepay` valida o valor pago (`paid_amount >= amount_cents`) e utiliza chave de idempotência para impedir confirmação ou baixa de estoque duplicada.
   - Caso o cliente feche o navegador antes do redirecionamento, o endpoint `/api/payments/check` consulta diretamente `POST https://api.checkout.infinitepay.io/payment_check`.

---

## 3. Configuração do Melhor Envio (Cotação, Carrinho, Etiquetas e Rastreio)

1. Crie sua conta em [https://melhorenvio.com.br](https://melhorenvio.com.br) (ou [https://sandbox.melhorenvio.com.br](https://sandbox.melhorenvio.com.br) para homologação).
2. Em **Gerenciar -> Tokens**, gere um token de acesso com as permissões:
   - `shipping-calculate`
   - `cart-read` / `cart-write`
   - `shipping-checkout`
   - `shipping-generate`
   - `shipping-print`
   - `shipping-tracking`
3. Configure no ambiente:
   - `MELHOR_ENVIO_API_BASE_URL=https://melhorenvio.com.br`
   - `MELHOR_ENVIO_ACCESS_TOKEN=seu_token_jwt`
   - `MELHOR_ENVIO_USER_AGENT="AnisCriacoesEcommerce/1.0 (atendimento@aniscriacoes.com.br)"`
   - `MELHOR_ENVIO_ORIGIN_POSTAL_CODE=01426001`
   - `MELHOR_ENVIO_AUTO_PURCHASE_ENABLED=false` (mantenha `false` caso deseje revisar as etiquetas no carrinho do Melhor Envio e pagar manualmente com saldo da carteira; mude para `true` apenas quando mantiver saldo pré-pago suficiente na carteira do Melhor Envio).

---

## 4. Checklist de Implantação em Produção (Vercel)

- [x] **TypeScript Strict & Build Limpo:** `npm run typecheck` e `npm run build` executam sem erros.
- [x] **Variáveis de Ambiente Configuradas na Vercel:** Todas as chaves de `.env.example` cadastradas em *Project Settings -> Environment Variables*.
- [x] **Isolamento da `SUPABASE_SERVICE_ROLE_KEY`:** Sem prefixo `NEXT_PUBLIC_`, inacessível no bundle do navegador.
- [x] **Migrações SQL Aplicadas:** 22 tabelas criadas com RLS ativo e políticas de menor privilégio.
- [x] **Buckets Privados Validados:** Uploads de clientes validados por assinatura binária real (magic bytes) e servidos apenas via URLs assinadas com expiração.
- [x] **Fluxo InfinitePay Verificado:** Criação de link em centavos, webhook idempotente e conciliação via `/payment_check`.
- [x] **Fluxo Logístico Verificado:** Cotação por CEP com peso/dimensões reais, bloqueio de geração de etiqueta antes do pagamento, Retirada Local e Entrega Própria funcionando.
- [x] **SEO & Acessibilidade:** `sitemap.xml`, `robots.txt`, JSON-LD (`Organization`, `Product`, `BreadcrumbList`), contraste acessível e ícones Lucide sem emojis.
