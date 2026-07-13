import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

type OwnedResource = 'venue' | 'event';

/**
 * Provjerava da resurs iz req.params[idParam] pripada prijavljenom korisniku.
 * Superadmin zaobilazi provjeru. Koristi se NAKON requireAuth.
 * Sprječava IDOR — sama prijava nije dovoljna za pristup tuđem resursu.
 */
export function requireOwnership(resource: OwnedResource, idParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    if (user.role === 'superadmin') return next();

    const id = Number(req.params[idParam]);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Neispravan ID' });
    }

    const row =
      resource === 'venue'
        ? await prisma.venue.findUnique({ where: { id }, select: { ownerUserId: true } })
        : await prisma.event.findUnique({ where: { id }, select: { ownerUserId: true } });

    if (!row) return res.status(404).json({ error: 'Nije pronađeno' });
    if (row.ownerUserId !== user.id) {
      return res.status(403).json({ error: 'Nemate pristup ovom resursu' });
    }
    next();
  };
}
