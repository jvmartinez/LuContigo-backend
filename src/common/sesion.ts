import type { Rol } from '../shared/enums';

/** Lo que `JwtAuthGuard` deja en `req.usuario` tras validar el access token. */
export interface UsuarioSesion {
  usuarioId: string;
  clinicaId: string;
  rol: Rol;
  /** Zona horaria de la clínica (IANA). */
  zonaHoraria: string;
  personalId?: string;
  pacienteId?: string;
}

/** Payload del access token (claves cortas). */
export interface PayloadAcceso {
  sub: string;
  cli: string;
  rol: Rol;
  tz: string;
  per?: string;
  pac?: string;
}

declare module 'express' {
  interface Request {
    usuario?: UsuarioSesion;
  }
}
