import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AUTH_COOKIE, resolveUserFromToken } from '../services/authService.js';
import { resolveVenueAccess } from '../middleware/venueAccess.js';

export let io: Server;

/** Parsira cookie header bez dodatnih dependency-ja. */
function getCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function attachSockets(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.FRONTEND_ORIGIN, credentials: true },
  });

  // Handshake: JWT cookie ako postoji (admin); bez tokena = gost (samo order sobe)
  io.use(async (socket, next) => {
    const token = getCookie(socket.request.headers.cookie, AUTH_COOKIE);
    socket.data.user = token ? await resolveUserFromToken(token) : null;
    next();
  });

  io.on('connection', (socket) => {
    /**
     * Gostova status stranica — publicId je neizvodiv nanoid,
     * poznavanje ID-a je autorizacija sama po sebi.
     */
    socket.on('order:subscribe', (publicId: string) => {
      if (typeof publicId === 'string' && /^[\w-]{10,24}$/.test(publicId)) {
        socket.join(`order:${publicId}`);
      }
    });
    /**
     * Admin dashboard se pretplaćuje na narudžbe svog objekta.
     * Server provjerava ownership prije join-a — klijent ne može ući u tuđu sobu.
     */
    socket.on('venue:subscribe', async (venueId: number) => {
      const user = socket.data.user;
      if (!user) return; // gosti ne mogu u venue sobe
      if (!Number.isInteger(venueId) || venueId <= 0) return;

      // superadmin / vlasnik / osoblje objekta
      const access = await resolveVenueAccess(user, venueId);
      if (!access) return;
      socket.join(`venue:${venueId}`);
    });

    socket.on('venue:unsubscribe', (venueId: number) => {
      socket.leave(`venue:${venueId}`);
    });

    /** Admin galerija — live obavijest o novim gostovim slikama. */
    socket.on('event:subscribe', async (eventId: number) => {
      const user = socket.data.user;
      if (!user) return;
      if (!Number.isInteger(eventId) || eventId <= 0) return;

      if (user.role !== 'superadmin') {
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { ownerUserId: true },
        });
        if (!event || event.ownerUserId !== user.id) return;
      }
      socket.join(`event:${eventId}`);
    });

    socket.on('event:unsubscribe', (eventId: number) => {
      socket.leave(`event:${eventId}`);
    });
  });

  return io;
}
