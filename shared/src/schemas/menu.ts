import { z } from 'zod';
import { CATEGORY_KINDS } from '../types.js';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(120),
  kind: z.enum(CATEGORY_KINDS).default('food'),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
  translations: z
    .array(z.object({ lang: z.string().length(2), name: z.string().trim().min(1).max(120) }))
    .optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const createItemSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(150),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  price: z.coerce.number().min(0, 'Cijena ne može biti negativna').max(99999),
  discountPercent: z.coerce.number().int().min(1).max(99).nullable().optional(),
  isFeatured: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = createItemSchema.partial().extend({
  // inventar: null = ne prati se stanje
  stockQty: z.coerce.number().int().min(0).max(999999).nullable().optional(),
  lowStockAt: z.coerce.number().int().min(0).max(999999).nullable().optional(),
  translations: z
    .array(
      z.object({
        lang: z.string().length(2),
        name: z.string().trim().min(1).max(150),
        description: z.string().trim().max(500).optional().or(z.literal('')),
      })
    )
    .optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
