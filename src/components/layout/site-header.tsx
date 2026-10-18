'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Gift,
  Menu,
  PackageSearch,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';

export function SiteHeader() {
  const { totalItemsCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const navClass = (href: string) => `rounded-full px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${pathname === href ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted hover:text-primary'}`;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/catalogo?q=${encodeURIComponent(q)}`);
      setMobileMenuOpen(false);
    } else {
      router.push('/catalogo');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#ecded7] bg-[#fffcf8]/95 backdrop-blur supports-[backdrop-filter]:bg-[#fffcf8]/90 no-print">
      {/* Top Announcement Bar */}
      <div className="bg-[#a86a60] text-white text-[11px] sm:text-xs py-2 px-4">
        <div className="container flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Presentes autorais personalizados à mão | Retirada grátis no Ateliê em SP ou envio para todo o Brasil
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/pedidos/consulta"
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-foreground rounded"
            >
              <PackageSearch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Acompanhar Pedido / Aprovar Arte</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container py-3 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="inline-flex lg:hidden items-center justify-center rounded-md p-2 text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Fechar menu principal' : 'Abrir menu principal'}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>

          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/25">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="block font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Anis Criações
              </span>
              <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
                Ateliê de Presentes & Afeto
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Navegação Principal"
            className="hidden lg:flex items-center gap-1 text-sm font-medium"
          >
            <Link href="/anisvest" className={navClass("/anisvest")}><span className="font-bold">Anisvest</span><span className="ml-1 text-[10px] text-primary">Empresas</span></Link>
            <Link
              href="/catalogo"
              className={navClass("/catalogo")}
            >
              Catálogo Completo
            </Link>
            <Link
              href="/categoria/papelaria-fina-e-albuns"
              className={navClass("/categoria/papelaria-fina-e-albuns")}
            >
              Álbuns & Papelaria
            </Link>
            <Link
              href="/categoria/kits-presenteaveis"
              className={navClass("/categoria/kits-presenteaveis")}
            >
              Kits Presenteáveis
            </Link>
            <Link
              href="/categoria/casa-aromas-e-decor"
              className={navClass("/categoria/casa-aromas-e-decor")}
            >
              Velas & Casa
            </Link>
            <Link
              href="/categoria/acrilicos-e-gravacao-laser"
              className={navClass("/categoria/acrilicos-e-gravacao-laser")}
            >
              Acrílicos & Laser
            </Link>
            <Link
              href="/sobre"
              className={navClass("/sobre")}
            >
              O Ateliê
            </Link>
          </nav>

          {/* Search & Cart Actions */}
          <div className="flex items-center gap-3">
            <form
              onSubmit={handleSearchSubmit}
              role="search"
              className="hidden md:flex items-center relative"
            >
              <label htmlFor="header-search-input" className="sr-only">
                Buscar presentes ou personalizados
              </label>
              <input
                id="header-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar álbum, vela, kit..."
                className="w-56 xl:w-64 rounded-full border border-input bg-card pl-4 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                aria-label="Executar busca"
                className="absolute right-2.5 text-muted-foreground hover:text-primary p-1"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <Link
              href="/pedidos/consulta"
              className="inline-flex md:hidden items-center justify-center rounded-full p-2.5 border border-border bg-card text-foreground hover:bg-muted"
              aria-label="Consultar pedido"
            >
              <Truck className="h-5 w-5" aria-hidden="true" />
            </Link>

            <Link
              href="/carrinho"
              aria-label={`Carrinho de compras com ${totalItemsCount} itens`}
              className="relative inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sacola</span>
              <span
                data-testid="cart-count-badge"
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-background px-1.5 text-xs font-bold text-primary"
              >
                {totalItemsCount}
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <form onSubmit={handleSearchSubmit} role="search" className="mt-3 md:hidden">
          <div className="relative flex items-center">
            <label htmlFor="mobile-search-input" className="sr-only">
              Buscar presentes ou personalizados
            </label>
            <input
              id="mobile-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="O que você deseja presentear hoje?"
              className="w-full rounded-full border border-input bg-card pl-4 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              aria-label="Buscar produtos"
              className="absolute right-3 text-muted-foreground hover:text-primary p-1"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <nav
            aria-label="Menu Mobile"
            className="mt-3 lg:hidden max-h-[65vh] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-xl space-y-1"
          >
            <Link href="/anisvest" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg bg-primary/10 px-3 py-3 text-base font-bold text-primary">Anisvest — Para empresas</Link>
            <Link
              href="/catalogo"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-muted"
            >
              Catálogo Completo
            </Link>
            <Link
              href="/categoria/papelaria-fina-e-albuns"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-muted"
            >
              Papelaria Fina & Álbuns
            </Link>
            <Link
              href="/categoria/kits-presenteaveis"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-muted"
            >
              Kits Presenteáveis
            </Link>
            <Link
              href="/categoria/casa-aromas-e-decor"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-muted"
            >
              Casa, Aromas & Decor
            </Link>
            <Link
              href="/categoria/acrilicos-e-gravacao-laser"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-base font-medium hover:bg-muted"
            >
              Acrílicos & Gravação Laser
            </Link>
            <div className="border-t border-border pt-2 mt-2 space-y-1">
              <Link
                href="/pedidos/consulta"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
              >
                <PackageSearch className="h-4 w-4" aria-hidden="true" />
                <span>Consultar Pedido e Aprovar Arte</span>
              </Link>
              <Link
                href="/sobre"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Sobre a Anis Criações
              </Link>
              <Link
                href="/contato"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Atendimento & WhatsApp
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
