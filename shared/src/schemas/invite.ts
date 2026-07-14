import { z } from 'zod';

export const scheduleItemSchema = z.object({
  time: z.string().trim().min(1).max(10),
  title: z.string().trim().min(1).max(150),
  location: z.string().trim().max(200).optional().or(z.literal('')),
});

/** Wedding varijanta — samo prezentacijski sadržaj, renderuje se, nikad ne query-a. */
export const weddingDetailsSchema = z.object({
  heroEyebrow: z.string().max(120).optional(),
  countdownSub: z.string().max(200).optional(),
  rsvpSub: z.string().max(300).optional(),
  story: z
    .array(
      z.object({
        when: z.string().max(60),
        title: z.string().max(120),
        text: z.string().max(600),
      })
    )
    .max(10)
    .optional(),
  venueName: z.string().max(150).optional(),
  venueAddress: z.string().max(250).optional(),
  venueMaps: z.string().max(500).optional(),
});
export type WeddingDetails = z.infer<typeof weddingDetailsSchema>;

/** Opener/pečat prilagodba — vrijedi za sve pozivnice (standard i wedding). */
export const inviteDesignSchema = z.object({
  sealInitials: z.string().trim().max(8).optional().or(z.literal('')),
  sealFont: z.enum(['cinzel', 'cormorant', 'playfairSC']).optional(),
  theme: z.enum(['emeraldGold']).optional(),
  musicTrack: z.enum(['none', 'royal-1', 'royal-2', 'royal-3']).optional(),
});
export type InviteDesign = z.infer<typeof inviteDesignSchema>;

export const createInviteSchema = z.object({
  title: z.string().trim().min(1, 'Naslov je obavezan').max(150),
  hostNames: z.string().trim().min(1, 'Imena su obavezna').max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  time: z.string().trim().max(10).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
  eventId: z.number().int().positive().nullable().optional(),
  variant: z.enum(['standard', 'wedding']).default('standard'),
  weddingDetails: weddingDetailsSchema.nullable().optional(),
  design: inviteDesignSchema.nullable().optional(),
  schedule: z.array(scheduleItemSchema).max(20).default([]),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const updateInviteSchema = createInviteSchema.partial();
export type UpdateInviteInput = z.infer<typeof updateInviteSchema>;

export const createRsvpSchema = z.object({
  name: z.string().trim().min(1, 'Ime je obavezno').max(100),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  attending: z.boolean(),
  plusOnes: z.number().int().min(0).max(10).default(0),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});
export type CreateRsvpInput = z.infer<typeof createRsvpSchema>;

export const bulkTablesSchema = z.object({
  count: z.number().int().min(1).max(100),
  type: z.enum(['normal', 'vip']).default('normal'),
  startNumber: z.number().int().min(1).default(1),
});
export type BulkTablesInput = z.infer<typeof bulkTablesSchema>;

export const updateTableSchema = z.object({
  label: z.string().trim().min(1).max(20).optional(),
  type: z.enum(['normal', 'vip']).optional(),
  guests: z.string().max(2000).nullable().optional(),
});
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
