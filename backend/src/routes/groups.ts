import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  createGroupSchema,
  updateGroupSchema,
  createGroupMemberSchema,
  updateGroupMemberSchema,
} from '@platform/shared';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { hashPassword } from '../services/authService.js';

export const groupsRouter = Router();

// Grupe naloga vodi isključivo superadmin (tab Korisnici).
groupsRouter.use(requireAuth, requireRole('superadmin'));

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const idParam = (req: Request, name = 'id'): number => {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Neispravan ID');
  return id;
};

const memberDTO = (m: {
  id: number;
  role: string;
  permissions: unknown;
  user: { id: number; name: string; email: string; isActive: boolean };
}) => ({
  id: m.id,
  role: m.role,
  permissions: m.permissions ?? null,
  userId: m.user.id,
  name: m.user.name,
  email: m.user.email,
  isActive: m.user.isActive,
});

/** Lista grupa + članovi + objekti kojima je grupa dodijeljena. */
groupsRouter.get(
  '/',
  wrap(async (_req, res) => {
    const groups = await prisma.staffGroup.findMany({
      orderBy: { name: 'asc' },
      include: {
        members: {
          orderBy: { id: 'asc' },
          include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
        },
        venues: { select: { id: true, name: true } },
      },
    });
    res.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        venues: g.venues,
        members: g.members.map(memberDTO),
      }))
    );
  })
);

groupsRouter.post(
  '/',
  validate(createGroupSchema),
  wrap(async (req, res) => {
    const group = await prisma.staffGroup.create({ data: { name: req.body.name } });
    res.status(201).json(group);
  })
);

groupsRouter.patch(
  '/:id',
  validate(updateGroupSchema),
  wrap(async (req, res) => {
    const group = await prisma.staffGroup.update({
      where: { id: idParam(req) },
      data: req.body,
    });
    res.json(group);
  })
);

/** Brisanje grupe — objekti gube dodjelu (SetNull); staff nalozi bez drugih veza se brišu. */
groupsRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const id = idParam(req);
    const members = await prisma.staffGroupMember.findMany({
      where: { groupId: id },
      select: { userId: true },
    });
    await prisma.staffGroup.delete({ where: { id } }); // cascade briše članstva

    // počisti staff naloge koji su postojali samo radi ove grupe
    for (const { userId } of members) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, _count: { select: { groupMemberships: true } }, staffOf: { select: { id: true } } },
      });
      if (user?.role === 'staff' && user._count.groupMemberships === 0 && !user.staffOf) {
        await prisma.user.delete({ where: { id: userId } });
      }
    }
    res.json({ success: true });
  })
);

/** Dodavanje člana: kreira staff nalog + članstvo (ili veže postojeći staff nalog po emailu). */
groupsRouter.post(
  '/:id/members',
  validate(createGroupMemberSchema),
  wrap(async (req, res) => {
    const groupId = idParam(req);
    const { name, email, password, role } = req.body;

    const group = await prisma.staffGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new HttpError(404, 'Grupa nije pronađena');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'Email je već registrovan');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: 'staff',
        passwordHash: await hashPassword(password),
        groupMemberships: { create: { groupId, role } },
      },
      include: {
        groupMemberships: {
          where: { groupId },
          include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
        },
      },
    });

    res.status(201).json(memberDTO(user.groupMemberships[0]));
  })
);

/** Izmjena člana — rola i/ili per-modul permisije (null = vrati na default po roli). */
groupsRouter.patch(
  '/members/:memberId',
  validate(updateGroupMemberSchema),
  wrap(async (req, res) => {
    const memberId = idParam(req, 'memberId');
    const data: Record<string, unknown> = {};
    if (req.body.role !== undefined) data.role = req.body.role;
    if (req.body.permissions !== undefined)
      data.permissions = req.body.permissions === null ? null : req.body.permissions;

    const member = await prisma.staffGroupMember.update({
      where: { id: memberId },
      data,
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    });
    res.json(memberDTO(member));
  })
);

/** Uklanjanje člana — briše i nalog ako je staff bez drugih veza. */
groupsRouter.delete(
  '/members/:memberId',
  wrap(async (req, res) => {
    const memberId = idParam(req, 'memberId');
    const member = await prisma.staffGroupMember.findUnique({
      where: { id: memberId },
      select: { userId: true },
    });
    if (!member) throw new HttpError(404, 'Član nije pronađen');

    await prisma.staffGroupMember.delete({ where: { id: memberId } });

    const user = await prisma.user.findUnique({
      where: { id: member.userId },
      select: { role: true, _count: { select: { groupMemberships: true } }, staffOf: { select: { id: true } } },
    });
    if (user?.role === 'staff' && user._count.groupMemberships === 0 && !user.staffOf) {
      await prisma.user.delete({ where: { id: member.userId } });
    }
    res.json({ success: true });
  })
);
