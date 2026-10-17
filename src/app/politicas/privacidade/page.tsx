import React from 'react';
import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade e Proteção de Dados (LGPD)',
  description:
    'Política de Privacidade e conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) da Anis Criações.',
  alternates: { canonical: '/politicas/privacidade' },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container py-12 max-w-3xl space-y-6">
      <div className="flex items-center gap-2.5 text-primary">
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-widest">
          Conformidade LGPD — Lei nº 13.709/2018
        </span>
      </div>
      <h1 className="font-serif text-3xl font-bold">Política de Privacidade</h1>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          A <strong className="text-foreground">Anis Criações Presentes e Personalizados LTDA</strong> coleta apenas os dados estritamente necessários para execução do contrato de compra e venda, personalização do produto, emissão fiscal e entrega logística.
        </p>
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          1. Dados Coletados e Finalidade
        </h2>
        <p>
          Solicitamos nome completo, CPF/CNPJ, e-mail, telefone e endereço de entrega exclusivamente para processar o pedido, emitir etiquetas logísticas via Melhor Envio e gerar o link de pagamento oficial via InfinitePay.
        </p>
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          2. Segurança de Fotografias e Arquivos de Personalização
        </h2>
        <p>
          Fotografias, brasões e artes enviadas pelos clientes para gravação personalizada são armazenados em bucket privado criptografado, sem acesso público na internet, acessíveis apenas pela equipe de produção mediante URLs assinadas com tempo de expiração restrito.
        </p>
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          3. Pagamentos Seguros
        </h2>
        <p>
          Não capturamos nem armazenamos números de cartão de crédito em nossos servidores. Toda transação financeira ocorre diretamente no ambiente certificado da InfinitePay.
        </p>
        <h2 className="font-serif text-lg font-semibold text-foreground pt-2">
          4. Direitos do Titular (Anonimização e Exclusão)
        </h2>
        <p>
          O titular pode solicitar a qualquer momento a confirmação de tratamento, correção ou anonimização de seus dados pessoais pelo e-mail <strong>atendimento@aniscriacoes.com.br</strong>, respeitadas as obrigações legais e fiscais de guarda.
        </p>
      </div>
    </div>
  );
}
