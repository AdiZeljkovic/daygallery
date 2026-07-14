import { z } from 'zod';

/** Recenzije-kampanja — pametni Google review link (samostalni modul). */
export const createReviewCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(150),
  googleReviewUrl: z.string().url().max(500).optional().or(z.literal('')),
  gateEnabled: z.boolean().default(true),
});
export type CreateReviewCampaignInput = z.infer<typeof createReviewCampaignSchema>;

export const updateReviewCampaignSchema = createReviewCampaignSchema.partial();
export type UpdateReviewCampaignInput = z.infer<typeof updateReviewCampaignSchema>;
