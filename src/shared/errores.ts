/** Códigos de error de la API (BACKEND.md §8.7) y su estado HTTP. */
export const CODIGOS_ERROR = {
  NO_AUTENTICADO: 401,
  SIN_PERMISO: 403,
  NO_ENCONTRADO: 404,
  VALIDACION: 422,
  HORARIO_OCUPADO: 409,
  TRANSICION_INVALIDA: 409,
  MEDICO_AUSENTE: 409,
  FUERA_DE_HORARIO: 409,
  SIN_ENFERMERA_ASIGNADA: 409,
  CONSULTA_CERRADA: 409,
  DUPLICADO: 409,
  TOKEN_INVALIDO: 410,
  LIMITE_EXCEDIDO: 429,
  ERROR_INTERNO: 500,
} as const;

export type CodigoError = keyof typeof CODIGOS_ERROR;

export interface RespuestaError {
  error: {
    codigo: CodigoError;
    mensaje: string;
    detalles?: Record<string, unknown>;
  };
}
