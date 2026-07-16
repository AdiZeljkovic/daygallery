import type { Request, Response, NextFunction } from 'express';
import type { StaffRole } from '@prisma/client';
import { DEFAULT_MODULE_PERMS, type PanelModule } from '@platform/shared';
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
 *  - superadmin → uvijek; vlasnik (client owner = Šef) → uvijek;
 *  - osoblje (VenueStaff) → ako je član tog objekta (opciono ograničeno na role);
 *  - član GRUPE dodijeljene objektu → po per-modul permisijama (default po roli).
 *
 * `modules` (any-of): za rute vezane uz modul panela — član grupe prolazi ako mu
 * je BILO KOJI od navedenih modula dozvoljen (eksplicitno ili default po roli).
 * Bez `modules`, član grupe prolazi po `staffRoles` (ili uvijek ako ni to nije zadano).
 * Vraća null ako nema pristupa.
 */
export async function resolveVenueAccess(
  user: { id: number; role: string },
  venueId: number,
  staffRoles?: StaffRole[],
  modules?: PanelModule[]
): Promise<Request['venueAccess'] | null> {
  if (user.role === 'superadmin') return { venueId, via: 'superadmin' };

  // 1 upit umjesto 3: vlasnik + osoblje(filtrirano na usera) + član grupe(filtrirano)
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      ownerUserId: true,
      staff: { where: { userId: user.id }, select: { role: true } },
      group: {
        select: { members: { where: { userId: user.id }, select: { role: true, permissions: true } } },
      },
    },
  });
  if (!venue) return null;
  if (venue.ownerUserId === user.id) return { venueId, via: 'owner' };

  // klasično osoblje objekta (VenueStaff)
  const staff = venue.staff[0];
  if (staff) {
    if (staffRoles && !staffRoles.includes(staff.role)) {
      // rola ne zadovoljava — ali modul-pristup po defaultu role može (buduće šeme)
      if (!modules?.some((m) => DEFAULT_MODULE_PERMS[staff.role][m])) return null;
    }
    return { venueId, via: staff.role };
  }

  // član grupe dodijeljene objektu
  const member = venue.group?.members[0];
  if (member) {
    const perms = {
      ...DEFAULT_MODULE_PERMS[member.role],
      ...((member.permissions as Partial<Record<PanelModule, boolean>> | null) ?? {}),
    };
    if (modules && modules.length > 0) {
      if (!modules.some((m) => perms[m])) return null;
    } else if (staffRoles && !staffRoles.includes(member.role)) {
      return null;
    }
    return { venueId, via: member.role };
  }

  return null;
}

/**
 * Middleware: pristup objektu iz req.params[idParam].
 * Bez `staffRoles` → svako osoblje/član grupe objekta prolazi.
 * Sa `staffRoles` → osoblje samo navedenih rola (superadmin/vlasnik uvijek).
 * Sa `modules` → član grupe prolazi po per-modul permisijama.
 * Koristi se NAKON requireAuth.
 */
export function requireVenueAccess(
  staffRoles?: StaffRole[],
  idParam = 'id',
  modules?: PanelModule[]
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const venueId = Number(req.params[idParam]);
    if (!Number.isInteger(venueId) || venueId <= 0) {
      return res.status(400).json({ error: 'Neispravan ID' });
    }

    const access = await resolveVenueAccess(req.user!, venueId, staffRoles, modules);
    if (!access) return res.status(403).json({ error: 'Nemate pristup ovom objektu' });

    req.venueAccess = access;
    next();
  };
}

/** Samo šef (vlasnik ili manager) — za upravljanje menijem/inventarom/osobljem/taskovima. */
export const requireVenueManager = (idParam = 'id') =>
  requireVenueAccess(['manager'], idParam);
