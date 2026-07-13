import type { Request, Response, NextFunction } from 'express';
import type { User } from '@prisma/client';
import { AUTH_COOKIE, resolveUserFromToken } from '../services/authService.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Zahtijeva validan JWT cookie; postavlja req.user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: 'Niste prijavljeni' });

  const user = await resolveUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Sesija je istekla, prijavite se ponovo' });

  req.user = user;
  next();
}

/** Zahtijeva određenu rolu (koristi se NAKON requireAuth). */
export function requireRole(role: 'superadmin') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Nemate ovlaštenje za ovu akciju' });
    }
    next();
  };
}
