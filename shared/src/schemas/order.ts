import { z } from 'zod';
import { ORDER_STATUSES } from '../types.js';

export const createOrderSchema = z.object({
  tableNumber: z
    .string()
    .trim()
    .min(1, 'Broj stola je obavezan')
    .max(20, 'Broj stola je predug'),
  note: z.string().trim().max(500).optional(),
  // Kolo sreće — osvojeni artikal (server provjeri da je istaknut)
  wheelItemId: z.number().int().positive().nullable().optional(),
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1, 'Narudžba mora imati bar jedan artikal')
    .max(50, 'Previše artikala u narudžbi'),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
