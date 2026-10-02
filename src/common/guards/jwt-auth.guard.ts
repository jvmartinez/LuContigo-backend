import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Configuracion } from '../../config/config.service';
import { CLAVE_PUBLICO } from '../decorators';
import { ErrorDominio } from '../errores/error-dominio';
import type { PayloadAcceso } from '../sesion';

/** Valida el access token (Bearer) y deja la sesión en `req.usuario`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: Configuracion,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new ErrorDominio('NO_AUTENTICADO', 'Inicia sesión para continuar.');
    }

    let payload: PayloadAcceso;
    try {
      payload = await this.jwt.verifyAsync<PayloadAcceso>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new ErrorDominio('NO_AUTENTICADO', 'La sesión expiró. Inicia sesión de nuevo.');
    }

    req.usuario = {
      usuarioId: payload.sub,
      clinicaId: payload.cli,
      rol: payload.rol,
      zonaHoraria: payload.tz,
      personalId: payload.per,
      pacienteId: payload.pac,
    };
    return true;
  }
}
