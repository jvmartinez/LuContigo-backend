import { DateTime } from 'luxon';
import { seSolapan } from '../../common/tiempo';

/** Cálculos de agenda puros (sin base de datos) para disponibilidad e indicadores. */

export interface Intervalo {
  inicio: Date;
  fin: Date;
}

export interface BloqueHorario {
  /** ISO: 1 = lunes … 7 = domingo */
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

function enHora(dia: DateTime, hhmm: string): DateTime {
  const [hour, minute] = hhmm.split(':').map(Number);
  return dia.set({ hour, minute, second: 0, millisecond: 0 });
}

/** Bloques de atención concretos entre dos fechas locales (ambas inclusive). */
export function bloquesEnRango(
  desde: string,
  hasta: string,
  zona: string,
  horarios: BloqueHorario[],
): Intervalo[] {
  const bloques: Intervalo[] = [];
  const ultimo = DateTime.fromISO(hasta, { zone: zona }).startOf('day');
  for (
    let dia = DateTime.fromISO(desde, { zone: zona }).startOf('day');
    dia <= ultimo;
    dia = dia.plus({ days: 1 })
  ) {
    for (const h of horarios.filter((b) => b.diaSemana === dia.weekday)) {
      bloques.push({
        inicio: enHora(dia, h.horaInicio).toJSDate(),
        fin: enHora(dia, h.horaFin).toJSDate(),
      });
    }
  }
  return bloques.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/**
 * Huecos libres (§8.2): horario − citas activas − ausencias. Cada bloque se parte en
 * turnos de `duracionMin` y se descartan los pasados y los que chocan con algo ocupado.
 */
export function calcularHuecos(p: {
  bloques: Intervalo[];
  duracionMin: number;
  ocupados: Intervalo[];
  ahora?: Date;
}): Intervalo[] {
  const ahora = p.ahora ?? new Date();
  const paso = p.duracionMin * 60_000;
  const huecos: Intervalo[] = [];
  for (const bloque of p.bloques) {
    for (let t = bloque.inicio.getTime(); t + paso <= bloque.fin.getTime(); t += paso) {
      const hueco = { inicio: new Date(t), fin: new Date(t + paso) };
      if (hueco.inicio < ahora) continue;
      if (p.ocupados.some((o) => seSolapan(hueco, o))) continue;
      huecos.push(hueco);
    }
  }
  return huecos;
}

/** ¿La cita cae completa dentro de un bloque del horario del médico? */
export function cabeEnHorario(cita: Intervalo, zona: string, horarios: BloqueHorario[]): boolean {
  const fecha = DateTime.fromJSDate(cita.inicio, { zone: zona }).toISODate() as string;
  return bloquesEnRango(fecha, fecha, zona, horarios).some(
    (b) => b.inicio <= cita.inicio && cita.fin <= b.fin,
  );
}

/** Minutos de los bloques que no quedan cubiertos por ausencias. */
export function minutosDisponibles(bloques: Intervalo[], ausencias: Intervalo[]): number {
  let total = 0;
  for (const b of bloques) {
    let libres = b.fin.getTime() - b.inicio.getTime();
    // Las ausencias de un mismo médico no se solapan en la práctica; si lo hicieran, se acota a 0.
    for (const a of ausencias) {
      const ini = Math.max(b.inicio.getTime(), a.inicio.getTime());
      const fin = Math.min(b.fin.getTime(), a.fin.getTime());
      if (fin > ini) libres -= fin - ini;
    }
    total += Math.max(0, libres);
  }
  return Math.round(total / 60_000);
}
