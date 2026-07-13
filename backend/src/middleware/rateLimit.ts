import rateLimit from 'express-rate-limit';

const json429 = { error: 'Previše zahtjeva, pokušajte kasnije' };

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429,
});

/** Brute-force zaštita prijave — ostaje strog. */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429,
});

/**
 * VAŽNO: gosti u kafiću dijele jedan javni IP (WiFi objekta), a na svadbi
 * desetine gostiju uploaduju istovremeno. Limiti moraju biti dovoljno visoki
 * da ne blokiraju legitiman promet u špici, a dovoljno niski da spriječe
 * automatizovani spam.
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40, // narudžbe cijelog objekta po minuti
  standardHeaders: true,
  legacyHeaders: false,
  message: json429,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 300, // uploadi svih gostiju jednog eventa po satu
  standardHeaders: true,
  legacyHeaders: false,
  message: json429,
});
