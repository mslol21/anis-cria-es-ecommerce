import React from 'react';
import type { Metadata } from 'next';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { getDbState } from '@/lib/store/ecommerce-service';

export const metadata: Metadata = {
  title: 'Contato & Atendimento WhatsApp',
  description:
    'Entre em contato com o Ateliê Anis Criações pelo WhatsApp, e-mail ou visite nosso ponto de retirada nos Jardins em São Paulo.',
  alternates: { canonical: '/contato' },
};

export default function ContactPage() {
  const { storeSettings } = getDbState();

  return (
    <div className="container py-12 max-w-4xl space-y-10">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold">
          Fale Conosco & Atendimento WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground">
          Estamos à disposição para tirar dúvidas sobre personalizações, prazos de produção, pedidos corporativos e acompanhamento de entregas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-serif text-xl font-bold">WhatsApp Direto do Ateliê</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Atendimento humano e rápido para auxiliar na escolha de cores, envio de logotipos ou dúvidas sobre seu pedido em andamento.
          </p>
          <a
            href={`https://wa.me/${storeSettings.supportWhatsapp}?text=Ol%C3%A1!%20Gostaria%20de%20atendimento%20sobre%20os%20produtos%20da%20Anis%20Cria%C3%A7%C3%B5es.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-xs font-bold text-secondary-foreground hover:bg-secondary/90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Iniciar Conversa no WhatsApp</span>
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-serif text-xl font-bold">Canais Oficiais & Endereço</h2>
          <ul className="space-y-3 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span>E-mail: {storeSettings.supportEmail}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <span>Telefone: (11) 99876-5432</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{storeSettings.addressLine}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span>Seg a Sex: 09h às 18h30 | Sábado: 09h às 14h</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
