import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireVenueAccess, resolveVenueAccess } from '../middleware/venueAccess.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hashPassword } from '../services/authService.js';

export const staffRouter = Router();
staffRouter.use(requireAuth);

const createStaffSchema = z.object({
  name: z.string().trim().min(1, 'Ime je obavezno').max(100),
  email: z.string().trim().toLowerCase().email('Neispravan email'),
  password: z.string().min(8, 'Lozinka mora imati najmanje 8 znakova'),
  role: z.enum(['manager', 'waiter', 'kitchen']),
});

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Lista osoblja objekta — smiju vidjeti svi članovi (za dodjelu taskova i sl.). */
staffRouter.get(
  '/venues/:id/staff',
  requireVenueAccess(),
  wrap(async (req, res) => {
    const staff = await prisma.venueStaff.findMany({
      where: { venueId: Number(req.params.id) },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      orderBy: { id: 'asc' },
    });
    res.json(
      staff.map((s) => ({
        id: s.id,
        role: s.role,
        userId: s.user.id,
        name: s.user.name,
        email: s.user.email,
        isActive: s.user.isActive,
      }))
    );
  })
);

/** Šef (vlasnik/manager) dodaje radnika: kreira User(staff) + članstvo. */
staffRouter.post(
  '/venues/:id/staff',
  requireVenueAccess(['manager'], 'id', ['staff']),
  validate(createStaffSchema),
  wrap(async (req, res) => {
    const venueId = Number(req.params.id);
    const { name, email, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'Email je već registrovan');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: 'staff',
        passwordHash: await hashPassword(password),
        staffOf: { create: { venueId, role } },
      },
      include: { staffOf: true },
    });

    res.status(201).json({
      id: user.staffOf!.id,
      role: user.staffOf!.role,
      userId: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
    });
  })
);

/** Promjena lozinke radnika (odjavljuje ga svugdje). */
staffRouter.patch(
  '/staff/:staffId/password',
  validate(z.object({ password: z.string().min(8, 'Lozinka mora imati najmanje 8 znakova') })),
  wrap(async (req, res) => {
    const staff = await prisma.venueStaff.findUnique({ where: { id: Number(req.params.staffId) } });
    if (!staff) throw new HttpError(404, 'Radnik nije pronađen');

    const access = await resolveVenueAccess(req.user!, staff.venueId, ['manager'], ['staff']);
    if (!access) throw new HttpError(403, 'Nemate pristup');

    await prisma.user.update({
      where: { id: staff.userId },
      data: { passwordHash: await hashPassword(req.body.password), tokenVersion: { increment: 1 } },
    });
    res.json({ success: true });
  })
);

// ================================================================
// Grupa lokala — šef (vlasnik/manager) dodaje i uklanja naloge u
// grupi dodijeljenoj NJEGOVOM objektu (grupe kreira superadmin).
// ================================================================

/** Grupa objekta + članovi (za tab Osoblje). */
staffRouter.get(
  '/venues/:id/group',
  requireVenueAccess(['manager'], 'id', ['staff']),
  wrap(async (req, res) => {
    const venue = await prisma.venue.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        group: {
          include: {
            members: {
              orderBy: { id: 'asc' },
              include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
            },
          },
        },
      },
    });
    if (!venue?.group) return res.json(null);
    res.json({
      id: venue.group.id,
      name: venue.group.name,
      members: venue.group.members.map((m) => ({
        id: m.id,
        role: m.role,
        permissions: m.permissions ?? null,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        isActive: m.user.isActive,
      })),
    });
  })
);

/** Šef dodaje nalog u grupu svog objekta. */
staffRouter.post(
  '/venues/:id/group/members',
  requireVenueAccess(['manager'], 'id', ['staff']),
  validate(createStaffSchema),
  wrap(async (req, res) => {
    const venue = await prisma.venue.findUnique({
      where: { id: Number(req.params.id) },
      select: { groupId: true },
    });
    if (!venue?.groupId) throw new HttpError(400, 'Objekat nema dodijeljenu grupu naloga');

    const { name, email, password, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'Email je već registrovan');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: 'staff',
        passwordHash: await hashPassword(password),
        groupMemberships: { create: { groupId: venue.groupId, role } },
      },
      include: { groupMemberships: { where: { groupId: venue.groupId } } },
    });
    const m = user.groupMemberships[0];
    res.status(201).json({
      id: m.id,
      role: m.role,
      permissions: m.permissions ?? null,
      userId: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
    });
  })
);

/** Šef uklanja člana iz grupe svog objekta (nalog bez drugih veza se briše). */
staffRouter.delete(
  '/venues/:id/group/members/:memberId',
  requireVenueAccess(['manager'], 'id', ['staff']),
  wrap(async (req, res) => {
    const venue = await prisma.venue.findUnique({
      where: { id: Number(req.params.id) },
      select: { groupId: true },
    });
    if (!venue?.groupId) throw new HttpError(400, 'Objekat nema dodijeljenu grupu naloga');

    const memberId = Number(req.params.memberId);
    const member = await prisma.staffGroupMember.findUnique({
      where: { id: memberId },
      select: { userId: true, groupId: true },
    });
    // član mora pripadati grupi OVOG objekta — šef ne smije dirati tuđe grupe
    if (!member || member.groupId !== venue.groupId) {
      throw new HttpError(404, 'Član nije pronađen');
    }

    await prisma.staffGroupMember.delete({ where: { id: memberId } });

    const user = await prisma.user.findUnique({
      where: { id: member.userId },
      select: {
        role: true,
        _count: { select: { groupMemberships: true } },
        staffOf: { select: { id: true } },
      },
    });
    if (user?.role === 'staff' && user._count.groupMemberships === 0 && !user.staffOf) {
      await prisma.user.delete({ where: { id: member.userId } });
    }
    res.json({ success: true });
  })
);

/** Brisanje radnika — briše i njegov nalog. */
staffRouter.delete(
  '/staff/:staffId',
  wrap(async (req, res) => {
    const staff = await prisma.venueStaff.findUnique({ where: { id: Number(req.params.staffId) } });
    if (!staff) throw new HttpError(404, 'Radnik nije pronađen');

    const access = await resolveVenueAccess(req.user!, staff.venueId, ['manager'], ['staff']);
    if (!access) throw new HttpError(403, 'Nemate pristup');

    await prisma.user.delete({ where: { id: staff.userId } }); // cascade briše i VenueStaff
    res.json({ success: true });
  })
);
