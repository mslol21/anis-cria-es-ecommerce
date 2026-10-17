import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/cart-context';
import { SiteChrome } from '@/components/layout/site-chrome';
import { getDbState } from '@/lib/store/ecommerce-service';

export function generateMetadata(): Metadata {
  const { storeSettings } = getDbState();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: storeSettings.seoConfig.defaultTitle,
      template: `%s | ${storeSettings.storeName}`,
    },
    description: storeSettings.seoConfig.defaultDescription,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      url: baseUrl,
      siteName: storeSettings.storeName,
      title: storeSettings.seoConfig.defaultTitle,
      description: storeSettings.seoConfig.defaultDescription,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { storeSettings } = getDbState();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: storeSettings.storeName,
    legalName: storeSettings.legalName,
    url: baseUrl,
    email: storeSettings.supportEmail,
    telephone: `+${storeSettings.supportWhatsapp}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: storeSettings.addressLine,
      postalCode: storeSettings.originPostalCode,
      addressCountry: 'BR',
    },
  };

  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <CartProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Pular para o conteúdo principal
          </a>
          <SiteChrome>{children}</SiteChrome>
        </CartProvider>
      </body>
    </html>
  );
}
