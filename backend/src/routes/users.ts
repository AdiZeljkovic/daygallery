import { Router } from 'express';
import { createUserSchema, updateUserSchema } from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../services/authService.js';

export const usersRouter = Router();

// Samo superadmin upravlja korisnicima
usersRouter.use(requireAuth, requireRole('superadmin'));

const publicUser = { id: true, email: true, name: true, role: true, isActive: true, createdAt: true } as const;

usersRouter.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { ...publicUser, venues: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/', validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email je već registrovan' });

    const user = await prisma.user.create({
      data: { email, name, role, passwordHash: await hashPassword(password) },
      select: publicUser,
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/:id', validate(updateUserSchema), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { password, ...rest } = req.body;

    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await hashPassword(password);
      // nova lozinka poništava sve postojeće sesije tog korisnika
      data.tokenVersion = { increment: 1 };
    }
    // deaktivacija također ubija sesije
    if (rest.isActive === false) data.tokenVersion = { increment: 1 };

    const user = await prisma.user.update({ where: { id }, data, select: publicUser });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Ne možete obrisati vlastiti nalog' });
    }

    // Objekti i galerije imaju FK na vlasnika — bez ove provjere baza baca 500.
    const [venues, events] = await Promise.all([
      prisma.venue.count({ where: { ownerUserId: id } }),
      prisma.event.count({ where: { ownerUserId: id } }),
    ]);
    if (venues > 0 || events > 0) {
      const parts = [
        venues > 0 ? `${venues} objek${venues === 1 ? 'at' : 'ta'}` : null,
        events > 0 ? `${events} galerij${events === 1 ? 'u' : 'e'}` : null,
      ].filter(Boolean);
      return res.status(409).json({
        error: `Korisnik posjeduje ${parts.join(' i ')}. Prvo prebacite vlasništvo ili obrišite te resurse.`,
      });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
