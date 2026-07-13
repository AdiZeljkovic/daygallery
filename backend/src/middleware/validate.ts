import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/** Validira req.body zod šemom; na grešku vraća 400 s field errorima. */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Neispravni podaci',
        fields: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}
