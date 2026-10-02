import { z } from 'zod';

/** Fecha-hora ISO 8601 con zona ("2026-10-05T09:30:00-05:00" o "…Z"). */
export const FechaHoraIso = z.string().datetime({ offset: true });

/** Fecha de calendario "YYYY-MM-DD". */
export const FechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD');

/** Hora "HH:mm" (24 h). */
export const HoraIso = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato esperado HH:mm');

export const Id = z.string().min(1).max(40);

export const Paginacion = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Paginacion = z.infer<typeof Paginacion>;

export interface Pagina<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
