import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import type { Role } from '@platform/shared';

const BCRYPT_COST = 12;
const TOKEN_TTL = '7d';
export const AUTH_COOKIE = 'sd_token';

export interface JwtPayload {
  sub: number; // user id
  role: Role;
  tv: number; // tokenVersion — kill-switch
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_TTL });

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Validira token + učitava korisnika, provjerava tokenVersion i isActive.
 * Vraća null ako je bilo šta nevalidno — pozivaoc odgovara sa 401.
 */
export async function resolveUserFromToken(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) return null;

  return user;
}

export const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};
