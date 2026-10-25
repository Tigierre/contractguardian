import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { aspettoIstanza } from "@/lib/tema-di-casa";
// Roboto, il carattere del tema `acciaio`: dal pacchetto, servito dall'app stessa. Il browser
// scarica i file solo se una regola lo usa, cioè solo quando l'istanza sceglie quel tema.
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "../globals.css";

// Il tema dell'istanza si legge dalle env a RUNTIME (BRAND_THEME, BRAND_MODE, BRAND_ACCENT):
// pagine prerenderizzate alla build lo congelerebbero al valore della build.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Validate locale
  if (!hasLocale(routing.locales, locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for this locale
  const messages = await getMessages();

  // Tema e accento dell'istanza; env vuote = nessun attributo, l'aspetto di serie.
  const aspetto = aspettoIstanza();

  return (
    <html lang={locale} suppressHydrationWarning {...aspetto.attributi} style={aspetto.stile}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
              <Header />
              <LegalDisclaimer />
              <main>{children}</main>
              <footer className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
                <p>ContractGuardian &copy; {new Date().getFullYear()}</p>
              </footer>
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
