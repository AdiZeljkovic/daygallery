import { z } from 'zod';
import { STAFF_ROLES, PANEL_MODULES } from '../types.js';

/** Grupa naloga za lokal (superadmin, tab Korisnici). */
export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(120),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema.partial();

/** Novi član grupe — kreira staff nalog + članstvo. */
export const createGroupMemberSchema = z.object({
  name: z.string().trim().min(1, 'Ime je obavezno').max(100),
  email: z.string().trim().toLowerCase().email('Neispravan email'),
  password: z.string().min(8, 'Lozinka mora imati najmanje 8 znakova'),
  role: z.enum(STAFF_ROLES),
});
export type CreateGroupMemberInput = z.infer<typeof createGroupMemberSchema>;

/** Izmjena člana: rola i/ili per-modul permisije (null = default po roli). */
export const updateGroupMemberSchema = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  permissions: z
    .object(Object.fromEntries(PANEL_MODULES.map((m) => [m, z.boolean()])) as Record<
      (typeof PANEL_MODULES)[number],
      z.ZodBoolean
    >)
    .nullable()
    .optional(),
});
export type UpdateGroupMemberInput = z.infer<typeof updateGroupMemberSchema>;
