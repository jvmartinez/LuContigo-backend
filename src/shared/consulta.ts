import { z } from 'zod';
import { EstadoTarea } from './enums';

const texto = (max: number) => z.string().trim().max(max);

export const GuardarConsultaEntrada = z.object({
  motivo: texto(1000).optional(),
  examenFisico: texto(5000).optional(),
  diagnostico: texto(2000).optional(),
  cie10: z
    .string()
    .trim()
    .regex(/^[A-Z]\d{2}(\.\d{1,4})?$/i, 'Código CIE-10 inválido')
    .optional(),
  tratamiento: texto(5000).optional(),
  indicaciones: texto(5000).optional(),
});
export type GuardarConsultaEntrada = z.infer<typeof GuardarConsultaEntrada>;

export const CrearTareaEntrada = z.object({
  tipo: z.string().trim().min(1).max(100),
  detalle: z.string().trim().max(2000).optional(),
  /** Si se omite, se usa la enfermera asignada al médico ese día. */
  enfermeraId: z.string().optional(),
});

export const TareasConsulta = z.object({ estado: EstadoTarea.optional() });
