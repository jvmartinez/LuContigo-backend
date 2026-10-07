import { z } from 'zod';
import { CanalRecordatorio, Plataforma } from './enums';
import { FechaIso } from './comun';

const Telefono = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Usa formato internacional, p. ej. +573001234567');

export const BuscarPacientesConsulta = z.object({
  q: z.string().trim().max(100).optional(),
});

const DatosPaciente = z.object({
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  documento: z.string().trim().min(3).max(30),
  fechaNacimiento: FechaIso,
  telefono: Telefono.optional(),
  email: z.string().email().toLowerCase().optional(),
  alergias: z.string().max(2000).optional(),
  antecedentes: z.string().max(5000).optional(),
  seguro: z.string().max(200).optional(),
  canalPreferido: CanalRecordatorio.optional(),
});

export const CrearPacienteEntrada = DatosPaciente.extend({
  /** Consentimiento de tratamiento de datos (§10). */
  consentimientoDatos: z.literal(true, {
    errorMap: () => ({ message: 'Se requiere el consentimiento del paciente' }),
  }),
  /** Crea un usuario de portal e invita por email. Requiere email. */
  crearAccesoPortal: z.boolean().default(false),
}).refine((p) => !p.crearAccesoPortal || p.email, {
  message: 'El acceso al portal requiere email',
  path: ['email'],
});
export type CrearPacienteEntrada = z.infer<typeof CrearPacienteEntrada>;

export const ActualizarPacienteEntrada = DatosPaciente.partial();
export type ActualizarPacienteEntrada = z.infer<typeof ActualizarPacienteEntrada>;

export const ActualizarMisDatosEntrada = z.object({
  telefono: Telefono.nullable().optional(),
  email: z.string().email().toLowerCase().nullable().optional(),
  canalPreferido: CanalRecordatorio.nullable().optional(),
});

export const RegistrarDispositivoEntrada = z.object({
  token: z.string().min(10).max(4096),
  plataforma: Plataforma,
});

export const PacienteSalida = z.object({
  id: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  documento: z.string(),
  fechaNacimiento: FechaIso,
  telefono: z.string().nullable(),
  email: z.string().nullable(),
  alergias: z.string().nullable(),
  antecedentes: z.string().nullable(),
  seguro: z.string().nullable(),
  canalPreferido: CanalRecordatorio.nullable(),
  tieneAccesoPortal: z.boolean(),
  consentimientoEn: z.string().datetime(),
});

export const MisIndicacionesSalida = z.array(
  z.object({
    citaId: z.string(),
    fecha: z.string().datetime(),
    medico: z.string(),
    especialidad: z.string().nullable(),
    indicaciones: z.string().nullable(),
  }),
);
