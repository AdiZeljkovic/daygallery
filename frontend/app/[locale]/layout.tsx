import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import {
  Inter,
  Playfair_Display,
  Cinzel,
  Cormorant_Garamond,
  Playfair_Display_SC,
  Great_Vibes,
} from 'next/font/google';
import { routing } from '@/i18n/routing';
import { Providers } from '@/components/Providers';
import '../globals.css';

// Globalni fontovi — koriste se svugdje, preload (default)
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin', 'latin-ext'], variable: '--font-playfair' });

// Ugravirani/kaligrafski set — SAMO pozivnice (i/[slug], r/[slug]).
// preload:false → ne blokira landing/meni/admin gdje se ne koristi.
const cinzel = Cinzel({ subsets: ['latin', 'latin-ext'], variable: '--font-cinzel', preload: false });
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  preload: false,
});
const playfairSC = Playfair_Display_SC({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700', '900'],
  variable: '--font-playfair-sc',
  preload: false,
});
// Kaligrafski script (imena para na royal pozivnici)
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--font-script', preload: false });

export const metadata: Metadata = {
  title: 'Special Day',
  description: 'Premium digitalna rješenja za evente i ugostiteljstvo',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${playfair.variable} ${cinzel.variable} ${cormorant.variable} ${playfairSC.variable} ${greatVibes.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
