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
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#f7efe8] border-b border-[#e8dcd4]">
        <div className="container py-12 sm:py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-7 space-y-6 lg:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{activeBanner?.badgeText || 'Ateliê de Presentes Personalizados'}</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl xl:text-6xl font-semibold tracking-tight text-[#342720] leading-[1.09] max-w-[16ch]">
              {activeBanner?.title ||
                'Presentes com alma, criados para eternizar histórias'}
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              {activeBanner?.subtitle ||
                'Encadernação artesanal em linho, gravação personalizada em ouro, kits presenteáveis e peças exclusivas produzidas sob medida.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href={activeBanner?.ctaHref || '/catalogo'}
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
              >
                <span>{activeBanner?.ctaLabel || 'Explorar Catálogo'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>

              <Link
                href="/categoria/kits-presenteaveis"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-muted transition-all"
              >
                <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Ver Kits Presenteáveis</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border/70 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Compra rápida sem exigir cadastro</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Aprovação de arte online</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Retirada grátis no Ateliê em SP</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:pl-4">
            <div className="relative aspect-[5/4] sm:aspect-square overflow-hidden rounded-[2.5rem] rounded-tl-[6rem] border-[8px] border-white/70 shadow-[0_28px_75px_-30px_rgba(86,53,44,.42)] bg-[#eadbd2]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  activeBanner?.imageUrl ||
                  'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=85'
                }
                alt={activeBanner?.title || 'Presentes personalizados Anis Criações'}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Anisvest: primary corporate line */}
      <section className="container" aria-labelledby="anisvest-heading">
        <div className="overflow-hidden rounded-[2rem] bg-[#191c20] text-white">
          <div className="grid items-center gap-8 p-7 sm:p-12 lg:grid-cols-[1.3fr_.7fr]">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-amber-200/40 px-4 py-2 text-xs font-bold uppercase tracking-[.2em] text-amber-200">Linha corporativa • Anisvest</span>
              <h2 id="anisvest-heading" className="font-serif text-3xl font-semibold leading-tight sm:text-5xl">Sua marca merece ser lembrada.</h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Sacolas personalizadas, ecobags, calendários e brindes para empresas, eventos e campanhas. Consulte condições por quantidade.</p>
              <Link href="/anisvest" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-6 py-3 font-semibold text-slate-950 hover:bg-amber-200">Conhecer a Anisvest <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="flex min-h-[170px] items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="text-center"><Gift className="mx-auto h-16 w-16 text-amber-200" strokeWidth={1.1} /><p className="mt-5 font-serif text-3xl font-bold tracking-wide text-amber-100">Anisvest</p><p className="mt-1 text-sm text-slate-300">Personalizados para empresas</p></div>
            </div>
          </div>
        </div>
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
