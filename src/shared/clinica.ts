import { z } from 'zod';
import { FechaHoraIso, FechaIso, Id } from './comun';

export const CrearConsultorioEntrada = z.object({
  nombre: z.string().trim().min(1).max(100),
  especialidadId: Id.optional(),
});
export const ActualizarConsultorioEntrada = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  especialidadId: Id.nullable().optional(),
  activo: z.boolean().optional(),
});

export const CrearEspecialidadEntrada = z.object({
  nombre: z.string().trim().min(1).max(100),
  duracionCitaMin: z.number().int().min(5).max(240).default(30),
});
export const ActualizarEspecialidadEntrada = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  duracionCitaMin: z.number().int().min(5).max(240).optional(),
});

export const IndicadoresConsulta = z
  .object({ desde: FechaIso, hasta: FechaIso })
  .refine((v) => v.desde <= v.hasta, {
    message: 'desde debe ser anterior a hasta',
    path: ['hasta'],
  });

export const AuditoriaConsulta = z.object({
  pacienteId: Id.optional(),
  usuarioId: Id.optional(),
  desde: FechaHoraIso.optional(),
});
