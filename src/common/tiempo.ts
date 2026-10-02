import { DateTime, Interval } from 'luxon';

/** Fecha local "YYYY-MM-DD" de hoy en la zona de la clínica. */
export function hoyEn(zona: string, ahora = new Date()): string {
  return DateTime.fromJSDate(ahora, { zone: zona }).toISODate() as string;
}

/** Fecha local "YYYY-MM-DD" de un instante en la zona de la clínica. */
export function fechaLocal(instante: Date, zona: string): string {
  return DateTime.fromJSDate(instante, { zone: zona }).toISODate() as string;
}

/** Instantes UTC que delimitan un día local: [inicio, fin). */
export function rangoDia(fecha: string, zona: string): { desde: Date; hasta: Date } {
  const inicio = DateTime.fromISO(fecha, { zone: zona }).startOf('day');
  return { desde: inicio.toJSDate(), hasta: inicio.plus({ days: 1 }).toJSDate() };
}

/** Instantes UTC que cubren desde el primer día hasta el último día local, ambos inclusive. */
export function rangoDias(
  desde: string,
  hasta: string,
  zona: string,
): { desde: Date; hasta: Date } {
  return { desde: rangoDia(desde, zona).desde, hasta: rangoDia(hasta, zona).hasta };
}

/** Columna `@db.Date`: medianoche UTC del día indicado. */
export function aFechaDb(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function deFechaDb(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return DateTime.fromISO(hasta).diff(DateTime.fromISO(desde), 'days').days;
}

export function edadEnAnios(fechaNacimiento: Date, ahora = new Date()): number {
  return Math.floor(
    Interval.fromDateTimes(DateTime.fromJSDate(fechaNacimiento), DateTime.fromJSDate(ahora)).length(
      'years',
    ),
  );
}

export function seSolapan(a: { inicio: Date; fin: Date }, b: { inicio: Date; fin: Date }): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}
