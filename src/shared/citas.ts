import { z } from 'zod';
import { CanalOrigen, EstadoCita } from './enums';
import { FechaHoraIso, FechaIso, Id } from './comun';

export const DisponibilidadConsulta = z
  .object({
    medicoId: Id,
    desde: FechaIso,
    hasta: FechaIso,
  })
  .refine((v) => v.desde <= v.hasta, {
    message: 'desde debe ser anterior a hasta',
    path: ['hasta'],
  });

export const AgendaConsulta = z.object({
  fecha: FechaIso.optional(),
  medicoId: Id.optional(),
  estado: EstadoCita.optional(),
});

export const CrearCitaEntrada = z.object({
  /** Obligatorio para recepción; el paciente solo agenda para sí mismo. */
  pacienteId: Id.optional(),
  medicoId: Id,
  inicio: FechaHoraIso,
  motivo: z.string().trim().max(500).optional(),
  canalOrigen: CanalOrigen.optional(),
});
export type CrearCitaEntrada = z.infer<typeof CrearCitaEntrada>;

export const ReprogramarCitaEntrada = z.object({ inicio: FechaHoraIso });

export const CancelarCitaEntrada = z.object({
  motivo: z.string().trim().min(1).max(500),
});

export const ConfirmacionAccionEntrada = z.object({
  accion: z.enum(['confirmar', 'cancelar']),
});
