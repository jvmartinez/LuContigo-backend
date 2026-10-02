import { z } from 'zod';
import { Rol, Turno } from './enums';
import { FechaHoraIso, FechaIso, HoraIso, Id } from './comun';

export const RolPersonal = Rol.exclude(['PACIENTE']);

export const CrearPersonalEntrada = z.object({
  nombre: z.string().trim().min(1).max(150),
  email: z.string().email().toLowerCase(),
  rol: RolPersonal,
  especialidadId: Id.optional(),
  licencia: z.string().trim().max(50).optional(),
  consultorioId: Id.optional(),
});
export type CrearPersonalEntrada = z.infer<typeof CrearPersonalEntrada>;

export const ActualizarPersonalEntrada = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
  especialidadId: Id.nullable().optional(),
  licencia: z.string().trim().max(50).nullable().optional(),
  consultorioId: Id.nullable().optional(),
  activo: z.boolean().optional(),
});
export type ActualizarPersonalEntrada = z.infer<typeof ActualizarPersonalEntrada>;

export const ListarPersonalConsulta = z.object({ rol: RolPersonal.optional() });

const Bloque = z
  .object({ diaSemana: z.number().int().min(1).max(7), horaInicio: HoraIso, horaFin: HoraIso })
  .refine((b) => b.horaInicio < b.horaFin, { message: 'horaFin debe ser posterior a horaInicio' });

export const HorariosEntrada = z
  .object({ bloques: z.array(Bloque).max(50) })
  .refine(
    ({ bloques }) =>
      bloques.every((a, i) =>
        bloques.every(
          (b, j) =>
            i === j ||
            a.diaSemana !== b.diaSemana ||
            a.horaFin <= b.horaInicio ||
            b.horaFin <= a.horaInicio,
        ),
      ),
    { message: 'Hay bloques que se solapan el mismo día', path: ['bloques'] },
  );
export type HorariosEntrada = z.infer<typeof HorariosEntrada>;

export const CrearAusenciaEntrada = z
  .object({
    desde: FechaHoraIso,
    hasta: FechaHoraIso,
    motivo: z.string().trim().max(300).optional(),
  })
  .refine((a) => new Date(a.desde) < new Date(a.hasta), {
    message: 'hasta debe ser posterior a desde',
    path: ['hasta'],
  });

export const AsignacionesConsulta = z.object({ fecha: FechaIso.optional() });

export const AsignarTurnoEntrada = z.object({
  fecha: FechaIso,
  turno: Turno,
  medicoId: Id,
  enfermeraId: Id,
});
