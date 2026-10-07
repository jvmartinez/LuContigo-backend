import { z } from 'zod';
import { CanalRecordatorio, Rol } from './enums';

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

/** Mobile puede enviar su token push para dejar de recibir notificaciones tras cerrar sesión. */
export const LogoutEntrada = RefreshEntrada.extend({
  dispositivoToken: z.string().min(10).max(4096).optional(),
});
export type LogoutEntrada = z.infer<typeof LogoutEntrada>;

export const TokensSalida = z.object({
  accessToken: z.string(),
  /** Solo con `X-Cliente: mobile`; la web lo recibe en la cookie `mc_refresh`. */
  refreshToken: z.string().optional(),
  /** Segundos de vida del access token. */
  expiraEn: z.number().int(),
});

export const UsuarioActualSalida = z.object({
  id: z.string(),
  email: z.string(),
  rol: Rol,
  clinica: z.object({
    id: z.string(),
    nombre: z.string(),
    zonaHoraria: z.string(),
    pais: z.string(),
  }),
  personal: z
    .object({
      id: z.string(),
      nombre: z.string(),
      especialidad: z.string().nullable(),
      consultorio: z.string().nullable(),
    })
    .nullable(),
  paciente: z
    .object({
      id: z.string(),
      nombres: z.string(),
      apellidos: z.string(),
      canalPreferido: CanalRecordatorio.nullable(),
    })
    .nullable(),
});

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
