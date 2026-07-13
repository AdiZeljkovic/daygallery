import { z } from 'zod';

/** Tema/branding objekta — sprema se kao JSON u venues.theme */
export const venueThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#D4AF37'),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0f0f0f'),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#fdfbf7'),
  mode: z.enum(['dark', 'light']).default('dark'),
});
export type VenueTheme = z.infer<typeof venueThemeSchema>;

export const createVenueSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(120),
  ownerUserId: z.number().int().positive().optional(), // superadmin dodjeljuje vlasnika
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  currency: z.string().trim().max(10).default('BAM'),
  defaultLang: z.enum(['bs', 'en']).default('bs'),
  theme: venueThemeSchema.partial().optional(),
  googleReviewUrl: z.string().url().max(500).optional().or(z.literal('')),
  reviewGateEnabled: z.boolean().default(false),
});
export type CreateVenueInput = z.infer<typeof createVenueSchema>;

export const updateVenueSchema = createVenueSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
