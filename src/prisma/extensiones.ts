import { Prisma, PrismaClient } from '@prisma/client';
import { ContextoClinica } from '../common/tenancy/contexto-clinica';
import { PREFIJOS, nuevoId } from './ids';

/** Modelos de negocio que llevan `clinicaId` y quedan aislados por clínica. */
export const MODELOS_CON_CLINICA = new Set<string>([
  'Usuario',
  'Especialidad',
  'Consultorio',
  'Personal',
  'HorarioAtencion',
  'Ausencia',
  'AsignacionTurno',
  'Paciente',
  'Cita',
  'CitaHistorialEstado',
  'SignosVitales',
  'Consulta',
  'TareaDelegada',
  'Recordatorio',
  'Auditoria',
]);

const OPERACIONES_CON_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

function conId(model: string, data: any): any {
  const prefijo = PREFIJOS[model];
  if (!prefijo || !data || data.id) return data;
  return { ...data, id: nuevoId(prefijo) };
}

/** Genera ids con prefijo en create/createMany/upsert cuando no se pasan. */
export const extensionIds = Prisma.defineExtension({
  name: 'ids-con-prefijo',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const a = args as any;
        if (operation === 'create') a.data = conId(model, a.data);
        if (operation === 'createMany') {
          a.data = Array.isArray(a.data)
            ? a.data.map((d: any) => conId(model, d))
            : conId(model, a.data);
        }
        if (operation === 'upsert') a.create = conId(model, a.create);
        return query(a);
      },
    },
  },
});

function conClinica(data: any, clinicaId: string): any {
  if (data.clinicaId && data.clinicaId !== clinicaId) {
    throw new Error('Intento de escribir en otra clínica');
  }
  return { ...data, clinicaId };
}

/**
 * Añade `clinicaId` del contexto a cada consulta de un modelo de negocio.
 * Ninguna consulta de negocio corre sin clínica: si falta el contexto, falla.
 */
export const extensionClinica = Prisma.defineExtension({
  name: 'aislamiento-por-clinica',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!MODELOS_CON_CLINICA.has(model)) return query(args);
        const clinicaId = ContextoClinica.clinicaId();
        if (!clinicaId) {
          throw new Error(`Consulta de negocio sin clínica: ${model}.${operation}`);
        }
        const a = (args ?? {}) as any;
        if (OPERACIONES_CON_WHERE.has(operation)) a.where = { ...a.where, clinicaId };
        if (operation === 'create') a.data = conClinica(a.data, clinicaId);
        if (operation === 'createMany') {
          a.data = Array.isArray(a.data)
            ? a.data.map((d: any) => conClinica(d, clinicaId))
            : conClinica(a.data, clinicaId);
        }
        if (operation === 'upsert') a.create = conClinica(a.create, clinicaId);
        return query(a);
      },
    },
  },
});

export function crearClienteBase(opciones?: Prisma.PrismaClientOptions) {
  return new PrismaClient(opciones).$extends(extensionIds);
}

export type ClienteBase = ReturnType<typeof crearClienteBase>;

export function crearClienteClinica(base: ClienteBase) {
  return base.$extends(extensionClinica);
}

export type ClienteClinica = ReturnType<typeof crearClienteClinica>;

/** Cliente dentro de `$transaction(async (tx) => …)`. */
export type Tx = Omit<
  ClienteClinica,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
