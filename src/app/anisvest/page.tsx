import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BriefcaseBusiness, CalendarDays, Gift, Package, ShoppingBag, UploadCloud, CheckCircle2 } from 'lucide-react';
import { dbProducts } from '@/lib/store/supabase-catalog';
import { ProductCard } from '@/components/catalog/product-card';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Anisvest | Personalizados para Empresas',
  description: 'Sacolas personalizadas, ecobags, calendários, brindes e materiais promocionais para sua empresa. Solicite uma cotação por quantidade.',
  alternates: { canonical: '/anisvest' },
};

const collections = [
  { title: 'Sacolas personalizadas', desc: 'Sacolas TNT, modelos metalizados e embalagens com sua marca.', icon: ShoppingBag },
  { title: 'Ecobags e algodão', desc: 'Sacolas reutilizáveis para eventos, ações e presentes corporativos.', icon: Package },
  { title: 'Calendários personalizados', desc: 'Mini calendários e materiais promocionais para distribuir aos clientes.', icon: CalendarDays },
  { title: 'Brindes e campanhas', desc: 'Cartões raspadinha e materiais personalizados para divulgação.', icon: Gift },
];

export default async function AnisvestPage() {
  const products = await dbProducts({ categorySlug: 'anisvest-corporativo' });
  return (
    <div className="pb-20">
      <section className="relative overflow-hidden bg-[#15191b] text-white">
        <div className="container grid gap-10 py-16 md:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-white/10 px-4 py-2 text-xs font-semibold tracking-[.18em] uppercase text-amber-200"><BriefcaseBusiness className="h-4 w-4" /> Linha corporativa Anis Criações</span>
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">Anisvest. Sua marca presente em cada detalhe.</h1>
            <p className="max-w-xl text-base leading-8 text-slate-300">Personalizados para empresas, comércios, eventos e campanhas. Encontre sacolas, ecobags, calendários e materiais promocionais feitos para valorizar sua identidade.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="#colecoes" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-6 py-3 font-semibold text-slate-950 transition-colors hover:bg-amber-200">Ver linha corporativa <ArrowRight className="h-4 w-4" /></Link>
              <a href="https://wa.me/c/5511914378109" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-amber-300/50 px-6 py-3 font-semibold text-amber-100 hover:bg-white/10">Ver catálogo no WhatsApp <ArrowRight className="h-4 w-4" /></a>
              <Link href="/contato" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10">Solicitar orçamento</Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-[#343537] via-[#262829] to-[#131617] p-8 shadow-2xl md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[.24em] text-amber-300">Anisvest</p>
            <div className="my-10 flex items-center justify-center"><ShoppingBag className="h-32 w-32 text-amber-200/80" strokeWidth={.8} aria-hidden="true" /></div>
            <p className="text-center font-serif text-2xl text-white">Personalização para quem faz negócios.</p>
            <p className="mt-3 text-center text-sm text-slate-300">Seu logotipo. Seu evento. Sua identidade.</p>
          </div>
        </div>
      </section>

      <section id="colecoes" className="container space-y-8 py-16">
        <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Catálogo corporativo</p><h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Soluções para sua empresa</h2><p className="mt-3 text-muted-foreground">Consulte modelos, quantidade mínima, personalização e prazo de produção antes de fechar seu pedido.</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {collections.map(({ title, desc, icon: Icon }) => <div key={title} className="rounded-2xl border border-border bg-white p-6 shadow-sm"><div className="mb-5 inline-flex rounded-xl bg-amber-100 p-3 text-[#785d21]"><Icon className="h-6 w-6" /></div><h3 className="font-serif text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{desc}</p></div>)}
        </div>
      </section>

      <section className="border-y border-border bg-[#fbf7f2] py-16">
        <div className="container space-y-8">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Produtos da Anisvest</p><h2 className="mt-2 font-serif text-3xl font-semibold">Catálogo para empresas</h2></div>
          {products.length ? <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">{products.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center"><p className="font-semibold">Novos produtos corporativos em preparação</p><p className="mt-2 text-sm text-muted-foreground">Enquanto o catálogo é atualizado, solicite uma cotação com o tipo de produto e a quantidade desejada.</p><Link href="/contato" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">Falar sobre meu pedido <ArrowRight className="h-4 w-4" /></Link></div>}
        </div>
      </section>

      <section className="container grid gap-8 py-16 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Orçamento sob medida</p><h2 className="mt-2 font-serif text-3xl font-semibold">Sua marca, do seu jeito.</h2><p className="mt-4 leading-7 text-muted-foreground">Para pedidos corporativos, valores e prazos dependem do modelo, acabamento, quantidade e personalização. Envie sua necessidade para receber uma proposta.</p></div>
        <div className="rounded-2xl border border-border bg-white p-7">
          <div className="space-y-4 text-sm">
            <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-secondary" /> Escolha o tipo de produto e a quantidade</p>
            <p className="flex items-center gap-3"><UploadCloud className="h-5 w-5 text-secondary" /> Informe como deseja aplicar sua logomarca</p>
            <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-secondary" /> Confirme prazo, arte e condições antes da produção</p>
          </div>
          <Link href="/contato" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Pedir orçamento para minha empresa <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
