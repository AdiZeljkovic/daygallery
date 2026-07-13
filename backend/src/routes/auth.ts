import { Router } from 'express';
import { loginSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import {
  AUTH_COOKIE,
  cookieOptions,
  signToken,
  verifyPassword,
} from '../services/authService.js';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Ista poruka za nepostojeći email i pogrešnu lozinku — bez user enumeration
    const invalid = () => res.status(401).json({ error: 'Pogrešan email ili lozinka' });
    if (!user || !user.isActive) return invalid();
    if (!(await verifyPassword(password, user.passwordHash))) return invalid();

    const token = signToken({ sub: user.id, role: user.role, tv: user.tokenVersion });
    res.cookie(AUTH_COOKIE, token, cookieOptions);
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ success: true });
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { id, email, name, role } = req.user!;

    // staff kontekst (konobar/kuhinja/manager) + resursi vlasnika za role-based UI
    const [staff, venues, events] = await Promise.all([
      role === 'staff'
        ? prisma.venueStaff.findUnique({
            where: { userId: id },
            include: { venue: { select: { id: true, name: true } } },
          })
        : null,
      role === 'client'
        ? prisma.venue.findMany({
            where: { ownerUserId: id },
            select: { id: true, name: true, slug: true },
          })
        : [],
      role === 'client'
        ? prisma.event.findMany({
            where: { ownerUserId: id },
            select: { id: true, name: true, slug: true },
          })
        : [],
    ]);

    res.json({
      id,
      email,
      name,
      role,
      staff: staff
        ? { venueId: staff.venueId, role: staff.role, venueName: staff.venue.name }
        : null,
      venues,
      events,
    });
  } catch (err) {
    next(err);
  }
});
