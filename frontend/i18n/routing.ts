import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['bs', 'en'],
  defaultLocale: 'bs',
  // bs bez prefiksa (čisti URL-ovi), /en/... za engleski
  localePrefix: 'as-needed',
});
