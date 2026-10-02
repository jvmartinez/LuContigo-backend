import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, mergeMap } from 'rxjs';
import { AuditoriaService } from '../../modules/auditoria/auditoria.service';
import { CLAVE_AUDITAR, OpcionesAuditoria } from '../decorators';

/**
 * Registra en la bitácora cada lectura o escritura del expediente marcada con `@Auditar`
 * (RF-20). Se escribe antes de devolver la respuesta: si la auditoría falla, la petición
 * falla, para que ningún acceso quede sin registro.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opciones = this.reflector.get<OpcionesAuditoria | undefined>(
      CLAVE_AUDITAR,
      ctx.getHandler(),
    );
    if (!opciones) return next.handle();

    const req = ctx.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      mergeMap(async (respuesta: any) => {
        const idRuta: string | undefined = req.params?.id;
        const esPaciente = opciones.entidad === 'PACIENTE' || opciones.entidad === 'HISTORIAL';
        await this.auditoria.registrar({
          usuarioId: req.usuario?.usuarioId,
          accion: opciones.accion,
          entidad: opciones.entidad,
          entidadId: respuesta?.id ?? idRuta,
          pacienteId: respuesta?.pacienteId ?? (esPaciente ? (idRuta ?? respuesta?.id) : null),
          ip: req.ip,
        });
        return respuesta;
      }),
    );
  }
}
