import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from '../../shared/enums';
import type { UsuarioSesion } from '../sesion';

export const CLAVE_PUBLICO = 'medicita:publico';
export const CLAVE_ROLES = 'medicita:roles';
export const CLAVE_AUDITAR = 'medicita:auditar';

/** Endpoint sin autenticación (login, enlaces de confirmación). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Roles con acceso al endpoint. Sin `@Roles`, cualquier usuario autenticado. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

/** Usuario autenticado de la petición. */
export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.usuario as UsuarioSesion;
  },
);

export type EntidadAuditada = 'PACIENTE' | 'HISTORIAL' | 'CONSULTA' | 'SIGNOS_VITALES' | 'TAREA';

export interface OpcionesAuditoria {
  accion: 'LEER' | 'CREAR' | 'ACTUALIZAR' | 'CERRAR';
  entidad: EntidadAuditada;
}

/**
 * Registra el acceso en la bitácora (RF-20). El interceptor toma `entidadId` de
 * `:id` y `pacienteId` de la respuesta (o de `:id` si la entidad es el paciente).
 */
export const Auditar = (opciones: OpcionesAuditoria) => SetMetadata(CLAVE_AUDITAR, opciones);
