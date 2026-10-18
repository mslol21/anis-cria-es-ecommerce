import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Gift,
  HeartHandshake,
  MapPin,
  MessageCircle,
  PenTool,
  Sparkles,
  Truck,
} from 'lucide-react';
import {
  getDbState,
  listCategories,
  listProducts,
} from '@/lib/store/ecommerce-service';
import { dbCategories, dbProducts } from '@/lib/store/supabase-catalog';
import { ProductCard } from '@/components/catalog/product-card';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { storeSettings } = getDbState();
  const categories = await dbCategories(false);
  const allProducts = await dbProducts({});
  const featuredProducts = allProducts.filter((p) => p.isFeatured).slice(0, 6);
  const activeBanner =
    storeSettings.bannersConfig.find((b) => b.isActive) ||
    storeSettings.bannersConfig[0];

  return (
    <div className="space-y-14 sm:space-y-20 pb-12">
      {/* Anisvest is the primary storefront offer; Anis Criações remains the umbrella brand. */}
      <section className="relative overflow-hidden bg-[#161a1d] text-white">
        <div className="container grid items-center gap-9 py-16 sm:py-20 lg:grid-cols-[1.2fr_.8fr] lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-amber-300/40 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[.15em] text-amber-200">Anisvest • Linha corporativa da Anis Criações</span>
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">Sua marca em destaque com personalizados para empresas.</h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300">Sacolas TNT, ecobags, brindes, calendários e materiais promocionais para negócios, eventos e campanhas. Consulte modelos e condições por quantidade.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/anisvest" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-200">Conhecer a Anisvest <ArrowRight className="h-4 w-4" /></Link>
              <a href="https://wa.me/c/5511914378109" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">Catálogo no WhatsApp <MessageCircle className="h-4 w-4" /></a>
            </div>
            <p className="text-xs text-slate-400">Produtos sob consulta • Arte e prazos combinados antes da produção</p>
          </div>
          <div className="flex min-h-[290px] flex-col justify-center rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-[#383739] via-[#24282b] to-[#111519] p-8 text-center shadow-xl">
            <span className="text-xs font-semibold uppercase tracking-[.25em] text-amber-300">Anisvest</span>
            <Gift className="mx-auto my-7 h-24 w-24 text-amber-200" strokeWidth={1} aria-hidden="true" />
            <p className="font-serif text-3xl font-semibold text-white">Personalizados para empresas</p>
            <p className="mt-3 text-sm text-slate-300">Seu logotipo • Seu evento • Sua identidade</p>
          </div>
        </div>
      </section>
      <section className="container flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Anis Criações</p><h2 className="mt-1 font-serif text-2xl font-semibold">Presentes e personalizados para momentos especiais</h2><p className="mt-2 text-sm text-muted-foreground">A linha de presentes continua disponível no nosso catálogo completo.</p></div>
        <Link href="/catalogo" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/30 px-5 py-3 text-sm font-semibold text-primary hover:bg-muted">Explorar presentes <ArrowRight className="h-4 w-4" /></Link>
      </section>

      {/* Categories Grid */}
      <section className="container space-y-6" aria-labelledby="categories-heading">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Curadoria por Departamento
            </span>
            <h2 id="categories-heading" className="font-serif text-2xl sm:text-3xl font-bold mt-1">
              Explore Nossas Coleções
            </h2>
          </div>
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <span>Ver todo o catálogo</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categoria/${cat.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/40 flex flex-col justify-between min-h-[185px]"
            >
              <div className="space-y-2">
                <h3 className="font-serif text-base sm:text-xl font-semibold group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {cat.description}
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>Descobrir produtos</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="container space-y-8" aria-labelledby="featured-heading">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Destaques do Ateliê
            </span>
            <h2 id="featured-heading" className="font-serif text-2xl sm:text-3xl font-bold mt-1">
              Presentes Mais Escolhidos
            </h2>
          </div>
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <span>Filtrar por ocasião ou preço</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* How Personalization Works */}
      <section className="bg-muted/60 border-y border-border py-16">
        <div className="container space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Processo Transparente
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">
              Como Funciona a Sua Encomenda Personalizada
            </h2>
            <p className="text-sm text-muted-foreground">
              Cuidamos de cada detalhe desde a escolha da gravação até a entrega segura no seu endereço.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl bg-card border border-border p-6 space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PenTool className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-serif text-lg font-semibold">
                1. Configure sua Personalização
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Na página do produto, escolha cores, digite nomes, datas, mensagens ou envie sua foto/brasão. O sistema valida tudo em tempo real.
              </p>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HeartHandshake className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-serif text-lg font-semibold">
                2. Aprovação de Arte & Produção
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nos itens com aprovação de arte, nossos designers enviam a prévia digital para você aprovar ou pedir ajustes diretamente na consulta do pedido.
              </p>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-serif text-lg font-semibold">
                3. Entrega Rastreada ou Retirada
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apresentamos separadamente o prazo de produção artesanal e o prazo de transporte via Melhor Envio, Entrega Própria em SP ou Retirada Local gratuita.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate / WhatsApp Banner */}
      <section className="container">
        <div className="rounded-3xl bg-primary text-primary-foreground p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">
              Precisa de ajuda para montar um presente ou pedido corporativo?
            </h2>
            <p className="text-sm text-primary-foreground/90 leading-relaxed">
              Nossa equipe de atendimento no ateliê auxilia na escolha das cores de linho, gravação de logotipo e mensagens personalizadas.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href={`https://wa.me/${storeSettings.supportWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-bold text-primary hover:bg-background/90 transition-colors"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>Falar no WhatsApp</span>
            </a>
            <Link
              href="/contato"
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/40 px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
            >
              <span>Ver Canais de Contato</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
