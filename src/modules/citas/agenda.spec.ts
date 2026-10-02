import { bloquesEnRango, cabeEnHorario, calcularHuecos, minutosDisponibles } from './agenda';

const ZONA = 'America/Bogota'; // UTC−5, sin horario de verano
const HORARIO = [
  { diaSemana: 1, horaInicio: '08:00', horaFin: '10:00' },
  { diaSemana: 1, horaInicio: '14:00', horaFin: '15:00' },
];
// 2026-10-05 es lunes.
const d = (iso: string) => new Date(iso);

describe('agenda', () => {
  it('genera los bloques del día en la zona de la clínica', () => {
    const bloques = bloquesEnRango('2026-10-05', '2026-10-06', ZONA, HORARIO);
    expect(bloques).toEqual([
      { inicio: d('2026-10-05T13:00:00Z'), fin: d('2026-10-05T15:00:00Z') },
      { inicio: d('2026-10-05T19:00:00Z'), fin: d('2026-10-05T20:00:00Z') },
    ]);
  });

  it('huecos = horario − citas − ausencias, sin pasados', () => {
    const huecos = calcularHuecos({
      bloques: bloquesEnRango('2026-10-05', '2026-10-05', ZONA, HORARIO),
      duracionMin: 30,
      ocupados: [
        { inicio: d('2026-10-05T13:30:00Z'), fin: d('2026-10-05T14:00:00Z') }, // cita 08:30
        { inicio: d('2026-10-05T19:00:00Z'), fin: d('2026-10-05T23:00:00Z') }, // ausencia tarde
      ],
      ahora: d('2026-10-05T13:10:00Z'), // 08:10: el hueco de 08:00 ya pasó
    });
    expect(huecos.map((h) => h.inicio.toISOString())).toEqual([
      '2026-10-05T14:00:00.000Z',
      '2026-10-05T14:30:00.000Z',
    ]);
  });

  it('una cita cabe solo si queda completa dentro de un bloque', () => {
    const dentro = { inicio: d('2026-10-05T14:30:00Z'), fin: d('2026-10-05T15:00:00Z') };
    const cruza = { inicio: d('2026-10-05T14:45:00Z'), fin: d('2026-10-05T15:15:00Z') };
    const martes = { inicio: d('2026-10-06T14:00:00Z'), fin: d('2026-10-06T14:30:00Z') };
    expect(cabeEnHorario(dentro, ZONA, HORARIO)).toBe(true);
    expect(cabeEnHorario(cruza, ZONA, HORARIO)).toBe(false);
    expect(cabeEnHorario(martes, ZONA, HORARIO)).toBe(false);
  });

  it('minutos disponibles descuentan las ausencias', () => {
    const bloques = bloquesEnRango('2026-10-05', '2026-10-05', ZONA, HORARIO);
    expect(minutosDisponibles(bloques, [])).toBe(180);
    expect(
      minutosDisponibles(bloques, [
        { inicio: d('2026-10-05T14:00:00Z'), fin: d('2026-10-05T19:30:00Z') },
      ]),
    ).toBe(90);
  });
});
