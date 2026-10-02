import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Rol } from '../../shared/enums';
import { CLAVE_ROLES } from '../decorators';
import { sinPermiso } from '../errores/error-dominio';

/** Control grueso por rol (`@Roles`). Las reglas finas viven en cada servicio. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const { usuario } = ctx.switchToHttp().getRequest<Request>();
    if (!usuario || !roles.includes(usuario.rol)) throw sinPermiso();
    return true;
  }
}
