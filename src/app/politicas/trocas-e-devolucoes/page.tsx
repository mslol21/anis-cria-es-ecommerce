import React from 'react';
import type { Metadata } from 'next';
import { RotateCcw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Trocas, Devoluções e Personalizados',
  description:
    'Regras de trocas, devoluções e garantias para produtos de pronta entrega e itens personalizados conforme o Código de Defesa do Consumidor.',
  alternates: { canonical: '/politicas/trocas-e-devolucoes' },
};

export default function ReturnsPolicyPage() {
  return (
    <div className="container py-12 max-w-3xl space-y-6">
      <div className="flex items-center gap-2.5 text-primary">
        <RotateCcw className="h-6 w-6" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-widest">
          Garantia de Qualidade & CDC
        </span>
      </div>
      <h1 className="font-serif text-3xl font-bold">
        Política de Trocas e Devoluções
      </h1>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          1. Produtos sem Personalização (Pronta Entrega)
        </h2>
        <p>
          Conforme o Art. 49 do Código de Defesa do Consumidor, o cliente dispõe de até 7 (sete) dias corridos após o recebimento para exercer o direito de arrependimento em itens não personalizados, desde que sem indícios de uso e na embalagem original.
        </p>
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          2. Produtos Personalizados e Sob Encomenda
        </h2>
        <p>
          Por serem confeccionados exclusivamente com nomes, datas, gravações ou fotografias do cliente — não podendo ser comercializados a terceiros —, produtos personalizados são passíveis de troca ou reembolso integral em caso de defeito de fabricação, avaria no transporte ou divergência em relação à arte aprovada pelo cliente.
        </p>
      </div>
    </div>
  );
}
