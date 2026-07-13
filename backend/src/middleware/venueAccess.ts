import type { Request, Response, NextFunction } from 'express';
import type { StaffRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      venueAccess?: { venueId: number; via: 'superadmin' | 'owner' | StaffRole };
    }
  }
}

/**
 * Utvrđuje kako korisnik smije pristupiti objektu:
 * superadmin → uvijek; vlasnik (client owner = Šef) → uvijek;
 * osoblje → ako je član tog objekta (opciono ograničeno na role).
 * Vraća null ako nema pristupa.
 */
export async function resolveVenueAccess(
  user: { id: number; role: string },
  venueId: number,
  staffRoles?: StaffRole[]
): Promise<Request['venueAccess'] | null> {
  if (user.role === 'superadmin') return { venueId, via: 'superadmin' };

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { ownerUserId: true },
  });
  if (!venue) return null;
  if (venue.ownerUserId === user.id) return { venueId, via: 'owner' };

  const staff = await prisma.venueStaff.findUnique({ where: { userId: user.id } });
  if (!staff || staff.venueId !== venueId) return null;
  if (staffRoles && !staffRoles.includes(staff.role)) return null;
  return { venueId, via: staff.role };
}

/**
 * Middleware: pristup objektu iz req.params[idParam].
 * Bez `staffRoles` → svako osoblje objekta prolazi.
 * Sa `staffRoles` → osoblje samo navedenih rola (superadmin/vlasnik uvijek).
 * Koristi se NAKON requireAuth.
 */
export function requireVenueAccess(staffRoles?: StaffRole[], idParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const venueId = Number(req.params[idParam]);
    if (!Number.isInteger(venueId) || venueId <= 0) {
      return res.status(400).json({ error: 'Neispravan ID' });
    }

    const access = await resolveVenueAccess(req.user!, venueId, staffRoles);
    if (!access) return res.status(403).json({ error: 'Nemate pristup ovom objektu' });

    req.venueAccess = access;
    next();
  };
}

/** Samo šef (vlasnik ili manager) — za upravljanje menijem/inventarom/osobljem/taskovima. */
export const requireVenueManager = (idParam = 'id') =>
  requireVenueAccess(['manager'], idParam);
