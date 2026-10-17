import React from 'react';
import Link from 'next/link';
import {
  Clock,
  Gift,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Truck,
} from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground mt-20 no-print">
      {/* Trust Strip */}
      <div className="border-b border-border bg-muted/50 py-8">
        <div className="container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-semibold">Produção Autoral & Afetiva</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acabamento artesanal com conferência individual e prévia de arte quando aplicável.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-semibold">Envio Seguro & Retirada Local</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Integração Melhor Envio com rastreio, mensageiro próprio em SP e retirada grátis no ateliê.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-semibold">Checkout Oficial InfinitePay</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pagamento criptografado via PIX ou Cartão em ambiente certificado sem armazenar dados de cartão.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-semibold">Privacidade & LGPD</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seus arquivos de personalização ficam protegidos em bucket privado com acesso restrito.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="container py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="font-serif text-xl font-bold">Anis Criações</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Criamos presentes personalizados, álbuns revestidos em linho puro, velas botânicas e kits corporativos pensados para transformar ocasiões especiais em memórias palpáveis.
          </p>
          <p className="text-xs text-muted-foreground pt-1">
            Anis Criações Presentes e Personalizados LTDA — CNPJ: 48.123.456/0001-89
          </p>
        </div>

        <div>
          <h4 className="font-serif text-base font-semibold mb-4">Departamentos</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/catalogo" className="hover:text-primary transition-colors">
                Todos os Produtos
              </Link>
            </li>
            <li>
              <Link
                href="/categoria/papelaria-fina-e-albuns"
                className="hover:text-primary transition-colors"
              >
                Papelaria Fina & Álbuns
              </Link>
            </li>
            <li>
              <Link
                href="/categoria/kits-presenteaveis"
                className="hover:text-primary transition-colors"
              >
                Kits Presenteáveis
              </Link>
            </li>
            <li>
              <Link
                href="/categoria/casa-aromas-e-decor"
                className="hover:text-primary transition-colors"
              >
                Casa, Aromas & Decor
              </Link>
            </li>
            <li>
              <Link
                href="/categoria/acrilicos-e-gravacao-laser"
                className="hover:text-primary transition-colors"
              >
                Acrílicos & Gravação Laser
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-serif text-base font-semibold mb-4">Cliente & Políticas</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/pedidos/consulta" className="hover:text-primary transition-colors">
                Consultar Pedido / Aprovar Arte
              </Link>
            </li>
            <li>
              <Link href="/sobre" className="hover:text-primary transition-colors">
                Sobre a Empresa
              </Link>
            </li>
            <li>
              <Link href="/contato" className="hover:text-primary transition-colors">
                Fale Conosco & WhatsApp
              </Link>
            </li>
            <li>
              <Link href="/politicas/privacidade" className="hover:text-primary transition-colors">
                Política de Privacidade (LGPD)
              </Link>
            </li>
            <li>
              <Link href="/politicas/entrega" className="hover:text-primary transition-colors">
                Política de Prazos e Entrega
              </Link>
            </li>
            <li>
              <Link
                href="/politicas/trocas-e-devolucoes"
                className="hover:text-primary transition-colors"
              >
                Política de Trocas e Devoluções
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-serif text-base font-semibold mb-4">Atendimento & Ateliê</h4>
          <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <span>Rua Oscar Freire, 1240 - Jardins, São Paulo/SP - CEP 01426-001</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span>Seg a Sex: 09h às 18h30 | Sáb: 09h às 14h</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span>(11) 99876-5432</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span>atendimento@aniscriacoes.com.br</span>
          </div>
          <div className="pt-2">
            <a
              href="https://wa.me/5511998765432?text=Ol%C3%A1!%20Gostaria%20de%20ajuda%20com%20um%20presente%20personalizado%20na%20Anis%20Cria%C3%A7%C3%B5es."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/90 transition-colors"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>Atendimento via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Anis Criações. Todos os direitos reservados.</p>
          <p>Compra sem necessidade de cadastro obrigatório • Ambiente seguro</p>
        </div>
      </div>
    </footer>
  );
}
