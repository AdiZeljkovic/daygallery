import { NextIntlClientProvider } from 'next-intl';
import bsMessages from '@/messages/bs.json';

// Admin panel je interni alat — uvijek na bosanskom, bez obzira na URL locale (/en/…).
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="bs" messages={bsMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
