import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Gift, Heart, MapPin, ShieldCheck, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sobre a Anis Criações | Nosso Ateliê',
  description:
    'Conheça a história da Anis Criações, nosso processo artesanal de encadernação em linho, gravação personalizada e curadoria de presentes afetivos.',
  alternates: { canonical: '/sobre' },
};

export default function AboutPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-12">
      <div className="space-y-4 border-b border-border pb-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Nossa Essência</span>
        </span>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">
          Feito à mão para guardar o que o tempo não pode apagar
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          A Anis Criações nasceu no coração de São Paulo com o propósito de resgatar o valor do presente pensado nos mínimos detalhes — unindo encadernação clássica em linho natural, cerâmica autoral, aromas botânicos e tecnologia de gravação de alta precisão.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <Heart className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="font-serif text-lg font-semibold">Artesania & Matéria-Prima</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Trabalhamos exclusivamente com linho puro, papéis livres de ácido (acid-free), cera vegetal de coco e madeira certificada de manejo responsável.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <Award className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="font-serif text-lg font-semibold">Conferência de Arte</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cada peça personalizada passa por revisão tipográfica e aprovação digital de prévia antes da gravação definitiva em hot stamping ou laser.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="font-serif text-lg font-semibold">Compromisso Comercial</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Prazos de produção transparentes, rastreamento ponta a ponta e atendimento próximo tanto para presentes individuais quanto para ações corporativas.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-muted/60 p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>Visite ou Retire no Nosso Ateliê</span>
          </div>
          <h3 className="font-serif text-2xl font-bold">
            Rua Oscar Freire, 1240 - Jardins, São Paulo/SP
          </h3>
          <p className="text-xs text-muted-foreground">
            Segunda a Sexta das 09h às 18h30 | Sábado das 09h às 14h
          </p>
        </div>
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-semibold text-primary-foreground shrink-0"
        >
          <Gift className="h-4 w-4" aria-hidden="true" />
          <span>Conhecer Produtos</span>
        </Link>
      </div>
    </div>
  );
}
