import React from 'react';
import type { Metadata } from 'next';
import { Truck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Prazos de Produção e Entrega',
  description:
    'Entenda como funcionam os prazos de produção artesanal, transporte via Melhor Envio, Entrega Própria e Retirada Local na Anis Criações.',
  alternates: { canonical: '/politicas/entrega' },
};

export default function DeliveryPolicyPage() {
  return (
    <div className="container py-12 max-w-3xl space-y-6">
      <div className="flex items-center gap-2.5 text-primary">
        <Truck className="h-6 w-6" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-widest">
          Logística & Prazos Transparentes
        </span>
      </div>
      <h1 className="font-serif text-3xl font-bold">
        Política de Prazos de Produção e Entrega
      </h1>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          1. Separação entre Prazo de Produção e Prazo de Transporte
        </h2>
        <p>
          Na Anis Criações, apresentamos de forma totalmente separada o <strong className="text-foreground">Prazo de Produção Artesanal</strong> de cada peça e o <strong className="text-foreground">Prazo Estimado de Transporte</strong>. O prazo total para recebimento é a soma de ambos os prazos, contados a partir da confirmação do pagamento (e da aprovação da arte, quando aplicável).
        </p>
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          2. Envios via Melhor Envio (Correios e Transportadoras)
        </h2>
        <p>
          As cotações são calculadas em tempo real pelo CEP de destino considerando peso e dimensões reais da embalagem. Assim que o pedido é despachado, o código de rastreamento fica disponível na página de consulta de pedidos.
        </p>
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          3. Retirada Local Gratuita no Ateliê
        </h2>
        <p>
          Oferecemos retirada sem custo no nosso ateliê nos Jardins (São Paulo/SP). Basta apresentar o código de retirada gerado no pedido e um documento oficial com foto.
        </p>
      </div>
    </div>
  );
}
