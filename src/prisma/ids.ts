import { randomBytes } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID (26 caracteres, ordenable por tiempo). */
export function ulid(ahora = Date.now()): string {
  let tiempo = '';
  let t = ahora;
  for (let i = 0; i < 10; i++) {
    tiempo = CROCKFORD[t % 32] + tiempo;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(16);
  let aleatorio = '';
  for (let i = 0; i < 16; i++) aleatorio += CROCKFORD[bytes[i] % 32];
  return tiempo + aleatorio;
}

/** Prefijo de id por modelo de Prisma ("pac_01H…", "cit_01H…"). */
export const PREFIJOS: Record<string, string> = {
  Clinica: 'cli',
  Usuario: 'usu',
  TokenRefresco: 'trf',
  TokenRestablecimiento: 'trs',
  Especialidad: 'esp',
  Consultorio: 'con',
  Personal: 'per',
  HorarioAtencion: 'hor',
  Ausencia: 'aus',
  AsignacionTurno: 'asg',
  Paciente: 'pac',
  Cita: 'cit',
  CitaHistorialEstado: 'che',
  SignosVitales: 'sig',
  Consulta: 'cns',
  TareaDelegada: 'tar',
  Recordatorio: 'rec',
  DispositivoPush: 'dsp',
  Auditoria: 'aud',
};

export function nuevoId(prefijo: string): string {
  return `${prefijo}_${ulid()}`;
}
