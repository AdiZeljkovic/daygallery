import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // barrel-optimizacija: uvozi samo korištene ikone/motion module (manji bundle)
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion'],
  },
};

export default withNextIntl(nextConfig);
