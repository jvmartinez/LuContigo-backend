import { ErrorDominio } from '../../common/errores/error-dominio';
import type { EstadoCita, Rol } from '../../shared/enums';

/**
 * Máquina de estados de la cita (RF-03, BACKEND.md §6) como tabla pura.
 * Las reglas finas (dueño de la cita, médico de la cita, enfermera asignada, hora pasada)
 * se comprueban en `CitasService`; aquí solo estado de origen y rol.
 */

export type AccionCita =
  | 'confirmar'
  | 'llegada'
  | 'registrarSignos'
  | 'iniciar'
  | 'cerrar'
  | 'cancelar'
  | 'noAsistio'
  | 'reprogramar';

/** `SISTEMA`: jobs (no asistencia al final del día). */
export type Actor = Rol | 'SISTEMA';

export interface Transicion {
  desde: readonly EstadoCita[];
  hacia: EstadoCita;
  actores: readonly Actor[];
}

export const TRANSICIONES: Record<AccionCita, Transicion> = {
  confirmar: { desde: ['PROGRAMADA'], hacia: 'CONFIRMADA', actores: ['PACIENTE', 'RECEPCION'] },
  llegada: { desde: ['PROGRAMADA', 'CONFIRMADA'], hacia: 'EN_ESPERA', actores: ['RECEPCION'] },
  registrarSignos: { desde: ['EN_ESPERA'], hacia: 'LISTA', actores: ['ENFERMERA'] },
  iniciar: { desde: ['EN_ESPERA', 'LISTA'], hacia: 'EN_CONSULTA', actores: ['MEDICO'] },
  cerrar: { desde: ['EN_CONSULTA'], hacia: 'ATENDIDA', actores: ['MEDICO'] },
  cancelar: {
    desde: ['PROGRAMADA', 'CONFIRMADA'],
    hacia: 'CANCELADA',
    actores: ['PACIENTE', 'RECEPCION'],
  },
  noAsistio: {
    desde: ['PROGRAMADA', 'CONFIRMADA'],
    hacia: 'NO_ASISTIO',
    actores: ['RECEPCION', 'SISTEMA'],
  },
  reprogramar: {
    desde: ['PROGRAMADA', 'CONFIRMADA'],
    hacia: 'PROGRAMADA',
    actores: ['RECEPCION', 'PACIENTE'],
  },
};

/**
 * Devuelve el estado de destino o lanza:
 * - `SIN_PERMISO` si el actor no puede ejecutar la acción;
 * - `TRANSICION_INVALIDA` si la acción no aplica desde el estado actual.
 */
export function resolverTransicion(
  estado: EstadoCita,
  accion: AccionCita,
  actor: Actor,
): EstadoCita {
  const t = TRANSICIONES[accion];
  if (!t.actores.includes(actor)) {
    throw new ErrorDominio('SIN_PERMISO', 'Tu rol no puede realizar esta acción sobre la cita.');
  }
  if (!t.desde.includes(estado)) {
    throw new ErrorDominio(
      'TRANSICION_INVALIDA',
      `No se puede ${DESCRIPCION[accion]} una cita en estado ${estado}.`,
      {
        estado,
        accion,
      },
    );
  }
  return t.hacia;
}

const DESCRIPCION: Record<AccionCita, string> = {
  confirmar: 'confirmar',
  llegada: 'registrar la llegada de',
  registrarSignos: 'registrar signos vitales de',
  iniciar: 'iniciar',
  cerrar: 'cerrar',
  cancelar: 'cancelar',
  noAsistio: 'marcar como no asistida',
  reprogramar: 'reprogramar',
};
