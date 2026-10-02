import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ContextoClinica } from '../tenancy/contexto-clinica';

/**
 * Fija la clínica del usuario en el contexto de la petición. A partir de aquí la
 * extensión de Prisma filtra todas las consultas de negocio por esa clínica.
 */
@Injectable()
export class ClinicaGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.usuario) ContextoClinica.establecer(req.usuario.clinicaId, req.usuario.usuarioId);
    return true;
  }
}
