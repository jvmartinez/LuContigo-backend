import { AsyncLocalStorage } from 'node:async_hooks';

export interface ContextoPeticion {
  clinicaId?: string;
  usuarioId?: string;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

/**
 * Contexto de clínica por petición (o por job). La extensión de Prisma lo lee para
 * añadir `clinica_id` a cada consulta de negocio.
 */
export const ContextoClinica = {
  /** Abre un contexto vacío; `ClinicaGuard` lo completa tras autenticar. */
  iniciar<T>(fn: () => T): T {
    return almacen.run({}, fn);
  },

  /** Ejecuta `fn` dentro de una clínica concreta (jobs, enlaces públicos, seed). */
  ejecutarEn<T>(clinicaId: string, fn: () => T, usuarioId?: string): T {
    return almacen.run({ clinicaId, usuarioId }, fn);
  },

  establecer(clinicaId: string, usuarioId?: string): void {
    const actual = almacen.getStore();
    if (!actual) throw new Error('No hay contexto de petición abierto');
    actual.clinicaId = clinicaId;
    actual.usuarioId = usuarioId;
  },

  clinicaId(): string | undefined {
    return almacen.getStore()?.clinicaId;
  },
};

/** Clínica del contexto actual, para los `create` (la extensión también la verifica). */
export function clinicaActual(): string {
  const clinicaId = ContextoClinica.clinicaId();
  if (!clinicaId) throw new Error('No hay clínica en el contexto');
  return clinicaId;
}
