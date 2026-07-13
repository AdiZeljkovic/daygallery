import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Neispravan email'),
  password: z.string().min(1, 'Lozinka je obavezna'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Neispravan email'),
  password: z.string().min(8, 'Lozinka mora imati najmanje 8 znakova'),
  name: z.string().trim().min(1, 'Ime je obavezno').max(100),
  role: z.enum(['superadmin', 'client']).default('client'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
