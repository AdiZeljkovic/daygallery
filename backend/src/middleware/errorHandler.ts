import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

/** Baciva greška s HTTP statusom — koristi se u servisima: throw new HttpError(403, '...') */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Neispravni podaci',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  // express.json / multer prekoračenje veličine
  const code = (err as { type?: string; code?: string }).type ?? (err as { code?: string }).code;
  if (code === 'entity.too.large' || code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Podaci su preveliki' });
  }
  if (code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Previše fajlova u jednom zahtjevu (max 10)' });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Greška na serveru',
    ...(env.isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
