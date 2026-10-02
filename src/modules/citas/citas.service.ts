import { Injectable, Logger } from '@nestjs/common';
import type { Cita, Prisma } from '@prisma/client';
import {
  ErrorDominio,
  esViolacionDeSolape,
  noEncontrado,
  sinPermiso,
  validacion,
} from '../../common/errores/error-dominio';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { diasEntre, fechaLocal, hoyEn, rangoDia, rangoDias } from '../../common/tiempo';
import type { Tx } from '../../prisma/extensiones';
import { PrismaService } from '../../prisma/prisma.service';
import type { CrearCitaEntrada } from '../../shared/citas';
import { ESTADOS_INACTIVOS, type CanalOrigen, type EstadoCita } from '../../shared/enums';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { RecordatoriosService } from '../notificaciones/recordatorios.service';
import { bloquesEnRango, cabeEnHorario, calcularHuecos, Intervalo } from './agenda';
import { AccionCita, Actor, resolverTransicion } from './cita-estado';

const DURACION_POR_DEFECTO = 30;
const MAX_DIAS_DISPONIBILIDAD = 31;

/** Quién actúa sobre una cita: un usuario autenticado o el sistema (jobs, enlace de confirmación). */
export interface ActorCita {
  rol: Actor;
  usuarioId: string | null;
  zonaHoraria: string;
  personalId?: string;
  pacienteId?: string;
}

const INCLUDE_CITA = {
  paciente: { select: { id: true, nombres: true, apellidos: true, documento: true } },
  medico: {
    select: { id: true, nombre: true, especialidad: { select: { id: true, nombre: true } } },
  },
  consultorio: { select: { id: true, nombre: true } },
  recordatorio: { select: { programadoPara: true, estado: true, canal: true } },
} satisfies Prisma.CitaInclude;

type CitaCompleta = Prisma.CitaGetPayload<{ include: typeof INCLUDE_CITA }>;

export function serializarCita(c: CitaCompleta) {
  return {
    id: c.id,
    estado: c.estado,
    inicio: c.inicio.toISOString(),
    fin: c.fin.toISOString(),
    motivo: c.motivo,
    canalOrigen: c.canalOrigen,
    motivoCancelacion: c.motivoCancelacion,
    pacienteId: c.pacienteId,
    paciente: c.paciente,
    medico: {
      id: c.medico.id,
      nombre: c.medico.nombre,
      especialidad: c.medico.especialidad?.nombre ?? null,
    },
    consultorio: c.consultorio,
    recordatorio: c.recordatorio && {
      programadoPara: c.recordatorio.programadoPara.toISOString(),
      estado: c.recordatorio.estado,
      canal: c.recordatorio.canal,
    },
  };
}

const activa = { estado: { notIn: ESTADOS_INACTIVOS } } satisfies Prisma.CitaWhereInput;

@Injectable()
export class CitasService {
  private readonly logger = new Logger(CitasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asignaciones: AsignacionesService,
    private readonly recordatorios: RecordatoriosService,
  ) {}

  // ─── Disponibilidad y agenda ────────────────────────────────────────────────

  async disponibilidad(medicoId: string, desde: string, hasta: string, zona: string) {
    if (diasEntre(desde, hasta) >= MAX_DIAS_DISPONIBILIDAD) {
      throw validacion(`El rango máximo es de ${MAX_DIAS_DISPONIBILIDAD} días`);
    }
    const medico = await this.medicoParaAgendar(medicoId);
    const rango = rangoDias(desde, hasta, zona);
    const [citas, ausencias] = await Promise.all([
      this.prisma.db.cita.findMany({
        where: { medicoId, ...activa, inicio: { lt: rango.hasta }, fin: { gt: rango.desde } },
        select: { inicio: true, fin: true },
      }),
      this.prisma.db.ausencia.findMany({
        where: { personalId: medicoId, desde: { lt: rango.hasta }, hasta: { gt: rango.desde } },
        select: { desde: true, hasta: true },
      }),
    ]);
    const duracionMin = medico.especialidad?.duracionCitaMin ?? DURACION_POR_DEFECTO;
    const huecos = calcularHuecos({
      bloques: bloquesEnRango(desde, hasta, zona, medico.horarios),
      duracionMin,
      ocupados: [...citas, ...ausencias.map((a) => ({ inicio: a.desde, fin: a.hasta }))],
    });
    return {
      medicoId,
      duracionMin,
      huecos: huecos.map((h) => ({ inicio: h.inicio.toISOString(), fin: h.fin.toISOString() })),
    };
  }

  /** Agenda del día. El médico ve la suya; la enfermera, la de sus médicos asignados. */
  async agenda(
    actor: ActorCita,
    filtro: { fecha?: string; medicoId?: string; estado?: EstadoCita },
  ) {
    const fecha = filtro.fecha ?? hoyEn(actor.zonaHoraria);
    let medicoIds: string[] | undefined = filtro.medicoId ? [filtro.medicoId] : undefined;

    if (actor.rol === 'MEDICO') {
      if (filtro.medicoId && filtro.medicoId !== actor.personalId)
        throw sinPermiso('Solo puedes ver tu agenda.');
      medicoIds = [actor.personalId as string];
    }
    if (actor.rol === 'ENFERMERA') {
      const asignados = await this.asignaciones.medicosDeEnfermera(
        actor.personalId as string,
        fecha,
      );
      if (filtro.medicoId && !asignados.includes(filtro.medicoId)) {
        throw sinPermiso('Ese médico no está asignado a ti en esa fecha.');
      }
      medicoIds = filtro.medicoId ? [filtro.medicoId] : asignados;
    }

    const { desde, hasta } = rangoDia(fecha, actor.zonaHoraria);
    const citas = await this.prisma.db.cita.findMany({
      where: {
        inicio: { gte: desde, lt: hasta },
        ...(medicoIds && { medicoId: { in: medicoIds } }),
        ...(filtro.estado && { estado: filtro.estado }),
      },
      include: INCLUDE_CITA,
      orderBy: [{ inicio: 'asc' }],
    });
    return { fecha, citas: citas.map(serializarCita) };
  }

  async obtener(id: string, actor: ActorCita) {
    const cita = await this.cargar(id, actor);
    const historial = await this.prisma.db.citaHistorialEstado.findMany({
      where: { citaId: id },
      orderBy: { fecha: 'asc' },
      select: { de: true, a: true, usuarioId: true, fecha: true },
    });
    return { ...cita, historialEstados: historial };
  }

  async misCitas(actor: ActorCita) {
    if (!actor.pacienteId) throw sinPermiso();
    const ahora = new Date();
    const [proximas, pasadas] = await Promise.all([
      this.prisma.db.cita.findMany({
        where: { pacienteId: actor.pacienteId, inicio: { gte: ahora } },
        include: INCLUDE_CITA,
        orderBy: { inicio: 'asc' },
      }),
      this.prisma.db.cita.findMany({
        where: { pacienteId: actor.pacienteId, inicio: { lt: ahora } },
        include: INCLUDE_CITA,
        orderBy: { inicio: 'desc' },
        take: 50,
      }),
    ]);
    return { proximas: proximas.map(serializarCita), pasadas: pasadas.map(serializarCita) };
  }

  // ─── Crear y reprogramar ────────────────────────────────────────────────────

  async crear(e: CrearCitaEntrada, actor: ActorCita) {
    const pacienteId = actor.rol === 'PACIENTE' ? actor.pacienteId : e.pacienteId;
    if (!pacienteId) throw validacion('pacienteId es obligatorio', { campo: 'pacienteId' });
    if (
      !(await this.prisma.db.paciente.findUnique({
        where: { id: pacienteId },
        select: { id: true },
      }))
    ) {
      throw noEncontrado('El paciente');
    }

    const medico = await this.medicoParaAgendar(e.medicoId);
    const intervalo = this.intervalo(e.inicio, medico.especialidad?.duracionCitaMin);
    await this.validarHorario(medico, intervalo, actor.zonaHoraria);

    const cita = await this.conSolape({ medicoId: medico.id, inicio: intervalo.inicio }, () =>
      this.prisma.db.$transaction(async (tx) => {
        await this.bloquearAgenda(tx, medico.id, medico.consultorioId as string);
        const nueva = await tx.cita.create({
          data: {
            clinicaId: clinicaActual(),
            pacienteId,
            medicoId: medico.id,
            consultorioId: medico.consultorioId as string,
            inicio: intervalo.inicio,
            fin: intervalo.fin,
            motivo: e.motivo,
            canalOrigen: this.canalOrigen(actor.rol, e.canalOrigen),
          },
        });
        await this.registrarHistorial(tx, nueva.id, null, 'PROGRAMADA', actor.usuarioId);
        return nueva;
      }),
    );

    const recordatorioProgramadoPara = await this.programarRecordatorio(cita);
    return { ...(await this.cargar(cita.id, actor)), recordatorioProgramadoPara };
  }

  async reprogramar(id: string, inicio: string, actor: ActorCita) {
    const actual = await this.cargar(id, actor);
    resolverTransicion(actual.estado, 'reprogramar', actor.rol);

    const medico = await this.medicoParaAgendar(actual.medico.id);
    const intervalo = this.intervalo(inicio, medico.especialidad?.duracionCitaMin);
    await this.validarHorario(medico, intervalo, actor.zonaHoraria);

    const cita = await this.conSolape({ medicoId: medico.id, inicio: intervalo.inicio }, () =>
      this.prisma.db.$transaction(async (tx) => {
        await this.bloquearAgenda(tx, medico.id, medico.consultorioId as string);
        const r = await tx.cita.updateMany({
          where: { id, estado: actual.estado },
          data: {
            inicio: intervalo.inicio,
            fin: intervalo.fin,
            consultorioId: medico.consultorioId as string,
            estado: 'PROGRAMADA',
          },
        });
        if (r.count === 0) throw this.cambioConcurrente();
        await this.registrarHistorial(tx, id, actual.estado, 'PROGRAMADA', actor.usuarioId);
        return tx.cita.findUniqueOrThrow({ where: { id } });
      }),
    );

    const recordatorioProgramadoPara = await this.programarRecordatorio(cita);
    return { ...(await this.cargar(id, actor)), recordatorioProgramadoPara };
  }

  // ─── Transiciones ───────────────────────────────────────────────────────────

  /**
   * Aplica una transición de la máquina de estados: valida acceso, rol y estado; actualiza
   * de forma condicional (si otro usuario cambió la cita a la vez, falla con 409) y
   * escribe en el historial. `enTx` añade escrituras en la misma transacción.
   */
  async transicionar<T = void>(
    id: string,
    accion: AccionCita,
    actor: ActorCita,
    opciones: {
      data?: Prisma.CitaUpdateManyMutationInput;
      enTx?: (tx: Tx, cita: Cita) => Promise<T>;
    } = {},
  ): Promise<{ cita: ReturnType<typeof serializarCita>; resultado?: T }> {
    const cita = await this.cargarModelo(id, actor);
    if (accion === 'noAsistio' && cita.inicio > new Date()) {
      throw new ErrorDominio('TRANSICION_INVALIDA', 'Todavía no llega la hora de la cita.');
    }
    const hacia = resolverTransicion(cita.estado, accion, actor.rol);

    const resultado = await this.prisma.db.$transaction(async (tx) => {
      const r = await tx.cita.updateMany({
        where: { id, estado: cita.estado },
        data: { ...opciones.data, estado: hacia },
      });
      if (r.count === 0) throw this.cambioConcurrente();
      await this.registrarHistorial(tx, id, cita.estado, hacia, actor.usuarioId);
      return opciones.enTx ? opciones.enTx(tx as Tx, cita) : undefined;
    });

    if (hacia === 'CANCELADA' || hacia === 'NO_ASISTIO') {
      await this.recordatorios
        .cancelar(id)
        .catch((e) => this.logger.warn(`No se pudo cancelar el recordatorio ${id}: ${e.message}`));
    }
    const actualizada = await this.prisma.db.cita.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_CITA,
    });
    return { cita: serializarCita(actualizada), resultado };
  }

  // ─── Acceso ─────────────────────────────────────────────────────────────────

  /** Carga la cita comprobando que el actor puede verla (reglas finas de §7). */
  async cargarModelo(id: string, actor: ActorCita): Promise<Cita> {
    const cita = await this.prisma.db.cita.findUnique({ where: { id } });
    if (!cita) throw noEncontrado('La cita');
    await this.exigirAcceso(cita, actor);
    return cita;
  }

  async cargar(id: string, actor: ActorCita) {
    await this.cargarModelo(id, actor);
    const cita = await this.prisma.db.cita.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_CITA,
    });
    return serializarCita(cita);
  }

  private async exigirAcceso(cita: Cita, actor: ActorCita): Promise<void> {
    switch (actor.rol) {
      case 'PACIENTE':
        // Un paciente no sabe siquiera que existen citas ajenas.
        if (cita.pacienteId !== actor.pacienteId) throw noEncontrado('La cita');
        return;
      case 'MEDICO':
        if (cita.medicoId !== actor.personalId) throw sinPermiso('La cita es de otro médico.');
        return;
      case 'ENFERMERA':
        if (
          !(await this.asignaciones.estaAsignada(
            actor.personalId as string,
            cita.medicoId,
            cita.inicio,
            actor.zonaHoraria,
          ))
        ) {
          throw sinPermiso('No estás asignada al médico de esta cita.');
        }
        return;
      default:
        return;
    }
  }

  // ─── Apoyo ──────────────────────────────────────────────────────────────────

  private async medicoParaAgendar(medicoId: string) {
    const medico = await this.prisma.db.personal.findUnique({
      where: { id: medicoId },
      include: { usuario: true, especialidad: true, consultorio: true, horarios: true },
    });
    if (!medico || medico.usuario.rol !== 'MEDICO') throw noEncontrado('El médico');
    if (!medico.usuario.activo) throw validacion('El médico no está activo');
    return medico;
  }

  private intervalo(inicioIso: string, duracionMin?: number): Intervalo {
    const inicio = new Date(inicioIso);
    return {
      inicio,
      fin: new Date(inicio.getTime() + (duracionMin ?? DURACION_POR_DEFECTO) * 60_000),
    };
  }

  private async validarHorario(
    medico: Awaited<ReturnType<CitasService['medicoParaAgendar']>>,
    cita: Intervalo,
    zona: string,
  ): Promise<void> {
    if (cita.inicio <= new Date())
      throw validacion('La cita debe ser en el futuro', { campo: 'inicio' });
    if (!medico.consultorio || !medico.consultorio.activo) {
      throw validacion('El médico no tiene un consultorio activo asignado');
    }
    if (!cabeEnHorario(cita, zona, medico.horarios)) {
      throw new ErrorDominio('FUERA_DE_HORARIO', 'El médico no atiende en ese horario.', {
        medicoId: medico.id,
        inicio: cita.inicio.toISOString(),
        fecha: fechaLocal(cita.inicio, zona),
      });
    }
    const ausencia = await this.prisma.db.ausencia.findFirst({
      where: { personalId: medico.id, desde: { lt: cita.fin }, hasta: { gt: cita.inicio } },
    });
    if (ausencia) {
      throw new ErrorDominio('MEDICO_AUSENTE', 'El médico no está disponible en esa fecha.', {
        medicoId: medico.id,
        desde: ausencia.desde.toISOString(),
        hasta: ausencia.hasta.toISOString(),
      });
    }
  }

  /**
   * Serializa las reservas que compiten por la misma agenda. Sin esto, dos inserciones
   * simultáneas que chocan en ambas restricciones (médico y consultorio) se bloquean
   * mutuamente y Postgres aborta una con deadlock (40P01) en vez de 23P01. Los locks se
   * toman en orden fijo para que no haya interbloqueo y se liberan al terminar la transacción.
   */
  private async bloquearAgenda(tx: Tx, medicoId: string, consultorioId: string): Promise<void> {
    for (const clave of [`medico:${medicoId}`, `consultorio:${consultorioId}`].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))`;
    }
  }

  /** Traduce la restricción de exclusión de Postgres (23P01) a 409 HORARIO_OCUPADO. */
  private async conSolape<T>(
    detalles: { medicoId: string; inicio: Date },
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (esViolacionDeSolape(e)) {
        throw new ErrorDominio('HORARIO_OCUPADO', 'Ese horario ya tiene una cita. Elige otro.', {
          medicoId: detalles.medicoId,
          inicio: detalles.inicio.toISOString(),
        });
      }
      throw e;
    }
  }

  private canalOrigen(rol: Actor, pedido?: CanalOrigen): CanalOrigen {
    if (rol === 'PACIENTE') return pedido === 'APP_MOVIL' ? 'APP_MOVIL' : 'PORTAL_WEB';
    return pedido === 'TELEFONO' ? 'TELEFONO' : 'RECEPCION';
  }

  private registrarHistorial(
    tx: Tx,
    citaId: string,
    de: EstadoCita | null,
    a: EstadoCita,
    usuarioId: string | null,
  ) {
    return tx.citaHistorialEstado.create({
      data: { clinicaId: clinicaActual(), citaId, de, a, usuarioId },
    });
  }

  private async programarRecordatorio(cita: Cita): Promise<string | null> {
    try {
      return (await this.recordatorios.programar(cita)).toISOString();
    } catch (e) {
      this.logger.error(
        `No se pudo programar el recordatorio de ${cita.id}: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private cambioConcurrente() {
    return new ErrorDominio(
      'TRANSICION_INVALIDA',
      'La cita cambió mientras tanto. Actualiza e intenta de nuevo.',
    );
  }
}
