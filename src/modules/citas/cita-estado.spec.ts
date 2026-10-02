import { ErrorDominio } from '../../common/errores/error-dominio';
import { EstadoCita } from '../../shared/enums';
import { AccionCita, Actor, resolverTransicion, TRANSICIONES } from './cita-estado';

const ESTADOS = EstadoCita.options;
const ACTORES: Actor[] = ['PACIENTE', 'RECEPCION', 'ENFERMERA', 'MEDICO', 'ADMIN', 'SISTEMA'];

function codigoDe(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as ErrorDominio).codigo;
  }
}

describe('máquina de estados de la cita (§6)', () => {
  // Tabla de §6 tal cual; si alguien cambia TRANSICIONES sin actualizar el documento, falla.
  const esperado: Record<AccionCita, { desde: EstadoCita[]; hacia: EstadoCita; actores: Actor[] }> =
    {
      confirmar: { desde: ['PROGRAMADA'], hacia: 'CONFIRMADA', actores: ['PACIENTE', 'RECEPCION'] },
      llegada: { desde: ['PROGRAMADA', 'CONFIRMADA'], hacia: 'EN_ESPERA', actores: ['RECEPCION'] },
      registrarSignos: { desde: ['EN_ESPERA'], hacia: 'LISTA', actores: ['ENFERMERA'] },
      iniciar: { desde: ['EN_ESPERA', 'LISTA'], hacia: 'EN_CONSULTA', actores: ['MEDICO'] },
      cerrar: { desde: ['EN_CONSULTA'], hacia: 'ATENDIDA', actores: ['MEDICO'] },
      cancelar: {
        desde: ['PROGRAMADA', 'CONFIRMADA'],
        hacia: 'CANCELADA',
        actores: ['PACIENTE', 'RECEPCION'],
      },
      noAsistio: {
        desde: ['PROGRAMADA', 'CONFIRMADA'],
        hacia: 'NO_ASISTIO',
        actores: ['RECEPCION', 'SISTEMA'],
      },
      reprogramar: {
        desde: ['PROGRAMADA', 'CONFIRMADA'],
        hacia: 'PROGRAMADA',
        actores: ['RECEPCION', 'PACIENTE'],
      },
    };

  it('la tabla coincide con el documento', () => {
    for (const accion of Object.keys(esperado) as AccionCita[]) {
      expect([...TRANSICIONES[accion].desde].sort()).toEqual([...esperado[accion].desde].sort());
      expect(TRANSICIONES[accion].hacia).toBe(esperado[accion].hacia);
      expect([...TRANSICIONES[accion].actores].sort()).toEqual(
        [...esperado[accion].actores].sort(),
      );
    }
  });

  for (const [accion, regla] of Object.entries(esperado) as [
    AccionCita,
    (typeof esperado)[AccionCita],
  ][]) {
    describe(accion, () => {
      const actor = regla.actores[0];

      for (const estado of ESTADOS) {
        if (regla.desde.includes(estado)) {
          it(`válida desde ${estado} → ${regla.hacia}`, () => {
            expect(resolverTransicion(estado, accion, actor)).toBe(regla.hacia);
          });
        } else {
          it(`inválida desde ${estado} → TRANSICION_INVALIDA`, () => {
            expect(codigoDe(() => resolverTransicion(estado, accion, actor))).toBe(
              'TRANSICION_INVALIDA',
            );
          });
        }
      }

      for (const otro of ACTORES.filter((a) => !regla.actores.includes(a))) {
        it(`${otro} no puede → SIN_PERMISO`, () => {
          expect(codigoDe(() => resolverTransicion(regla.desde[0], accion, otro))).toBe(
            'SIN_PERMISO',
          );
        });
      }
    });
  }

  it('los estados finales no admiten ninguna acción', () => {
    for (const estado of ['ATENDIDA', 'CANCELADA', 'NO_ASISTIO'] as const) {
      for (const [accion, regla] of Object.entries(TRANSICIONES) as [
        AccionCita,
        (typeof TRANSICIONES)[AccionCita],
      ][]) {
        expect(codigoDe(() => resolverTransicion(estado, accion, regla.actores[0]))).toBe(
          'TRANSICION_INVALIDA',
        );
      }
    }
  });
});
