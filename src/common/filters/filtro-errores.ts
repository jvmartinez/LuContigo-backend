import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { CodigoError, RespuestaError } from '../../shared/errores';
import { ErrorDominio, esViolacionDeSolape } from '../errores/error-dominio';

const CODIGO_POR_STATUS: Record<number, CodigoError> = {
  400: 'VALIDACION',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'NO_ENCONTRADO',
  409: 'DUPLICADO',
  422: 'VALIDACION',
  429: 'LIMITE_EXCEDIDO',
};

const MENSAJES: Partial<Record<CodigoError, string>> = {
  NO_AUTENTICADO: 'Inicia sesión para continuar.',
  SIN_PERMISO: 'No tienes permiso para esta acción.',
  NO_ENCONTRADO: 'El recurso no existe.',
  LIMITE_EXCEDIDO: 'Demasiadas peticiones. Intenta de nuevo en un minuto.',
  ERROR_INTERNO: 'Ocurrió un error inesperado.',
};

/**
 * Formato único de errores (§8.7). Nunca registra cuerpos de petición ni datos clínicos:
 * solo método, ruta, código y, para errores 500, la traza.
 */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const { status, cuerpo } = this.traducir(excepcion);

    if (status >= 500) {
      const traza = excepcion instanceof Error ? excepcion.stack : String(excepcion);
      this.logger.error(`${req.method} ${req.route?.path ?? req.path} → ${status}`, traza);
    }
    res.status(status).json(cuerpo);
  }

  private traducir(e: unknown): { status: number; cuerpo: RespuestaError } {
    const respuesta = (
      codigo: CodigoError,
      status: number,
      mensaje?: string,
      detalles?: Record<string, unknown>,
    ) => ({
      status,
      cuerpo: {
        error: {
          codigo,
          mensaje: mensaje ?? MENSAJES[codigo] ?? 'Error.',
          ...(detalles && { detalles }),
        },
      },
    });

    if (e instanceof ErrorDominio) return respuesta(e.codigo, e.status, e.message, e.detalles);

    if (e instanceof ThrottlerException) return respuesta('LIMITE_EXCEDIDO', 429);

    if (e instanceof HttpException) {
      const status = e.getStatus();
      const codigo = CODIGO_POR_STATUS[status] ?? (status >= 500 ? 'ERROR_INTERNO' : 'VALIDACION');
      const mensaje = status === 404 ? 'La ruta no existe.' : MENSAJES[codigo];
      return respuesta(codigo, status, mensaje);
    }

    if (esViolacionDeSolape(e)) {
      return respuesta('HORARIO_OCUPADO', 409, 'Ese horario ya tiene una cita. Elige otro.');
    }

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return respuesta('NO_ENCONTRADO', 404);
      if (e.code === 'P2002') {
        return respuesta('DUPLICADO', 409, 'Ya existe un registro con esos datos.', {
          campos: (e.meta?.target as string[] | undefined) ?? [],
        });
      }
      if (e.code === 'P2003')
        return respuesta('VALIDACION', 422, 'Hace referencia a un registro inexistente.');
    }

    return respuesta('ERROR_INTERNO', 500);
  }
}
