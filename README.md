# Anis Criações — E-Commerce Profissional de Presentes & Personalizados

Loja virtual completa, segura, acessível (WCAG) e pronta para operação comercial para presentes criativos, álbuns artesanais em linho, luminárias gravadas a laser e kits presenteáveis personalizados.

---

## 1. Stack Tecnológica Implementada

- **Framework & Linguagem:** Next.js 14 (App Router) + TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Interface & Design System:** React 18 + Tailwind CSS + Primitivos shadcn/ui (Radix UI) + Ícones **Lucide** (`lucide-react`) — sem uso de emojis como ícones de interface
- **Formulários & Validação:** React Hook Form + Zod (validação estrita no cliente e no servidor)
- **Banco de Dados, Autenticação & Storage:** Supabase PostgreSQL (22 tabelas normalizadas com RLS), Supabase Auth e Supabase Storage (buckets público e privados com URLs assinadas temporárias)
- **Pagamentos:** API Oficial Brasileira de Checkout da **InfinitePay** (`https://api.checkout.infinitepay.io/links` e `https://api.checkout.infinitepay.io/payment_check`)
- **Logística:** API Oficial do **Melhor Envio** (`/api/v2/me/shipment/calculate`, `/api/v2/me/cart`, `/api/v2/me/shipment/checkout`, `/api/v2/me/shipment/generate`, `/api/v2/me/shipment/print`, `/api/v2/me/shipment/tracking`) + módulos independentes de **Retirada Local** e **Entrega Própria**
- **Testes Automatizados:** Vitest (Unitários e Integração cobrindo os 22 cenários obrigatórios) + Playwright (End-to-End Desktop e Mobile)

---

## 2. Arquitetura e Estrutura de Pastas

```text
anis_criacoes/
├── supabase/
│   └── migrations/
│       ├── 20261016000001_initial_schema.sql              # 22 tabelas relacionais, enums, índices e constraints
│       ├── 20261016000002_functions_triggers_and_rls.sql  # Funções transacionais, reserva de estoque, webhook idempotente, LGPD e RLS
│       └── 20261016000003_initial_catalog_setup.sql       # Configuração comercial base e categorias iniciais
├── src/
│   ├── app/
│   │   ├── page.tsx                                       # Vitrine inicial administrável
│   │   ├── catalogo/page.tsx                              # Catálogo com busca, filtros e ordenação
│   │   ├── categoria/[slug]/page.tsx                      # Página de departamento com BreadcrumbList JSON-LD
│   │   ├── produto/[slug]/page.tsx                        # Página de produto com Product JSON-LD, galeria, variações e personalização
│   │   ├── carrinho/page.tsx                              # Sacola persistente com cupom e cotação de frete
│   │   ├── checkout/page.tsx                              # Checkout sem exigir cadastro + integração InfinitePay
│   │   ├── pedido/confirmacao/page.tsx                    # Confirmação de pedido e conciliação segura
│   │   ├── pedidos/consulta/page.tsx                      # Consulta de pedidos, rastreio e aprovação/revisão de arte
│   │   ├── sobre/page.tsx                                 # Institucional sobre o ateliê
│   │   ├── contato/page.tsx                               # Canais de atendimento e WhatsApp
│   │   ├── politicas/                                     # Políticas de Privacidade (LGPD), Entrega e Trocas/Devoluções
│   │   ├── admin/page.tsx                                 # Painel Administrativo protegido (Módulos A a H + impressão)
│   │   ├── sitemap.ts                                     # Sitemap dinâmico XML
│   │   ├── robots.ts                                      # Regras de indexação
│   │   └── api/                                           # Route Handlers REST protegidos com Rate Limiting e Zod
│   ├── components/
│   │   ├── layout/                                        # SiteHeader e SiteFooter acessíveis
│   │   ├── catalog/                                       # ProductCard e ProductDetailClient
│   │   └── admin/                                         # AdminPortalClient (8 módulos + ficha de produção)
│   ├── context/
│   │   └── cart-context.tsx                               # Estado persistente da sacola
│   ├── lib/
│   │   ├── integrations/
│   │   │   ├── infinitepay.ts                             # Adapter oficial InfinitePay Checkout Brasil
│   │   │   └── melhor-envio.ts                            # Adapter oficial Melhor Envio
│   │   ├── security/
│   │   │   ├── file-validator.ts                          # Validação binária (magic bytes) e URLs assinadas privadas
│   │   │   └── rate-limiter.ts                            # Rate limiting e padronização de erros HTTP
│   │   ├── store/
│   │   │   ├── initial-data.ts                            # Catálogo base cobrindo os 6 tipos de produtos
│   │   │   └── ecommerce-service.ts                       # Regras de negócio, estoque, personalização e conciliação
│   │   ├── supabase/                                      # Clientes Browser, Server e Service Role (exclusivo servidor)
│   │   └── validators/schemas.ts                          # Schemas Zod compartilhados
│   └── types/
│       └── database.ts                                    # Tipagem estrita das 22 tabelas e entidades
├── tests/
│   ├── unit/security-and-uploads.test.ts                  # Testes unitários de segurança, uploads e URLs assinadas
│   ├── integration/ecommerce-scenarios.test.ts            # Testes de integração dos 22 cenários obrigatórios
│   └── e2e/storefront-and-admin.spec.ts                   # Testes E2E Playwright (Desktop & Mobile)
└── docs/
    └── CHECKLIST_IMPLANTACAO_E_CONTAS.md                  # Roteiro de configuração das contas externas e deploy Vercel
```

---

## 3. Variáveis de Ambiente (`.env.local`)

Copie o arquivo `.env.example` para `.env.local` e preencha com as credenciais das contas oficiais:

| Variável | Escopo | Descrição |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Público | URL canônica da loja (ex.: `https://aniscriacoes.com.br`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Público | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público | Chave pública anônima (sujeita às políticas RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Servidor** | Chave privilegiada usada **exclusivamente no servidor** |
| `INFINITEPAY_API_BASE_URL` | **Servidor** | `https://api.checkout.infinitepay.io` |
| `INFINITEPAY_HANDLE` | **Servidor** | Sua InfiniteTag cadastrada na InfinitePay (sem `$`) |
| `MELHOR_ENVIO_API_BASE_URL` | **Servidor** | `https://sandbox.melhorenvio.com.br` ou `https://melhorenvio.com.br` |
| `MELHOR_ENVIO_ACCESS_TOKEN` | **Servidor** | Bearer Token OAuth2/Pessoal da conta Melhor Envio |
| `MELHOR_ENVIO_USER_AGENT` | **Servidor** | Identificação exigida pela API Melhor Envio (`NomeApp/1.0 (email)`) |
| `MELHOR_ENVIO_ORIGIN_POSTAL_CODE` | **Servidor** | CEP de origem dos envios (ex.: `01310100`) |
| `MELHOR_ENVIO_AUTO_PURCHASE_ENABLED` | **Servidor** | `false` por padrão (insere no carrinho para compra manual; `true` compra com saldo da carteira) |

---

## 4. Comandos de Execução, Build e Testes

```bash
# 1. Instalar dependências
npm install

# 2. Executar verificação estrita de tipos TypeScript
npm run typecheck

# 3. Executar suíte de testes unitários e de integração (Vitest)
npm test

# 4. Executar servidor de desenvolvimento
npm run dev

# 5. Gerar build otimizado de produção (compatível com Vercel)
npm run build

# 6. Executar testes End-to-End com Playwright
npm run test:e2e
```
