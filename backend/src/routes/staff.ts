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
