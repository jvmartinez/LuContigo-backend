import { CODIGOS_ERROR, CodigoError } from '../../shared/errores';

/** Error de negocio con código estable de la API (§8.7). */
export class ErrorDominio extends Error {
  readonly status: number;

  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalles?: Record<string, unknown>,
  ) {
    super(mensaje);
    this.status = CODIGOS_ERROR[codigo];
  }
}

export const noEncontrado = (recurso: string) =>
  new ErrorDominio('NO_ENCONTRADO', `${recurso} no existe o no tienes acceso.`);

export const sinPermiso = (mensaje = 'No tienes permiso para esta acción.') =>
  new ErrorDominio('SIN_PERMISO', mensaje);

export const validacion = (mensaje: string, detalles?: Record<string, unknown>) =>
  new ErrorDominio('VALIDACION', mensaje, detalles);

/** Postgres 23P01: violación de restricción de exclusión (doble reserva). */
export function esViolacionDeSolape(error: unknown): boolean {
  const texto = error instanceof Error ? error.message : String(error);
  return /23P01|exclusion constraint|_sin_solape/.test(texto);
}
