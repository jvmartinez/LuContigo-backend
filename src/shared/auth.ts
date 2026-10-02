import { z } from 'zod';

export const LoginEntrada = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(200),
});
export type LoginEntrada = z.infer<typeof LoginEntrada>;

/** La web manda el refresh token en cookie; mobile en el cuerpo. */
export const RefreshEntrada = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshEntrada = z.infer<typeof RefreshEntrada>;

export const OlvideContrasenaEntrada = z.object({
  email: z.string().email().toLowerCase(),
});

export const Contrasena = z
  .string()
  .min(10, 'Mínimo 10 caracteres')
  .max(200)
  .regex(/[A-Za-z]/, 'Debe incluir letras')
  .regex(/\d/, 'Debe incluir números');

export const RestablecerContrasenaEntrada = z.object({
  token: z.string().min(20),
  password: Contrasena,
});
