import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';

/**
 * Error tracking — aktivan SAMO ako je SENTRY_DSN postavljen u .env.
 * Bez DSN-a sve funkcije su no-op (nula overheada, nula mrežnih poziva).
 */
const enabled = !!env.SENTRY_DSN;

export function initSentry() {
  if (!enabled) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // ne šalji tijela zahtjeva (mogu sadržavati lozinke/lične podatke)
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  console.log('✅ Sentry error tracking aktivan');
}

/** Prijavi neočekivanu grešku (poziva se iz errorHandler-a). */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export const sentryEnabled = enabled;
