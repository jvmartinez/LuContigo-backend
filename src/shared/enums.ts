import { z } from 'zod';

export const Rol = z.enum(['PACIENTE', 'RECEPCION', 'ENFERMERA', 'MEDICO', 'ADMIN']);
export type Rol = z.infer<typeof Rol>;

export const EstadoCita = z.enum([
  'PROGRAMADA',
  'CONFIRMADA',
  'EN_ESPERA',
  'LISTA',
  'EN_CONSULTA',
  'ATENDIDA',
  'CANCELADA',
  'NO_ASISTIO',
]);
export type EstadoCita = z.infer<typeof EstadoCita>;

/** Estados que liberan el horario del médico y del consultorio. */
export const ESTADOS_INACTIVOS: EstadoCita[] = ['CANCELADA', 'NO_ASISTIO'];

export const CanalOrigen = z.enum(['RECEPCION', 'TELEFONO', 'PORTAL_WEB', 'APP_MOVIL']);
export type CanalOrigen = z.infer<typeof CanalOrigen>;

export const Turno = z.enum(['MANANA', 'TARDE']);
export type Turno = z.infer<typeof Turno>;

export const EstadoTarea = z.enum(['PENDIENTE', 'HECHA', 'CANCELADA']);
export type EstadoTarea = z.infer<typeof EstadoTarea>;

export const CanalRecordatorio = z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']);
export type CanalRecordatorio = z.infer<typeof CanalRecordatorio>;

export const Plataforma = z.enum(['ANDROID', 'IOS']);
export type Plataforma = z.infer<typeof Plataforma>;
