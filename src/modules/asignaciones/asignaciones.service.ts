import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { noEncontrado, validacion } from '../../common/errores/error-dominio';
import type { UsuarioSesion } from '../../common/sesion';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { aFechaDb, deFechaDb, fechaLocal, hoyEn } from '../../common/tiempo';
import { PrismaService } from '../../prisma/prisma.service';
import type { Turno } from '../../shared/enums';

/** Turno al que pertenece un instante: antes de las 13:00 locales es MANANA. */
export function turnoDe(instante: Date, zona: string): Turno {
  return DateTime.fromJSDate(instante, { zone: zona }).hour < 13 ? 'MANANA' : 'TARDE';
}

@Injectable()
export class AsignacionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Médicos que tiene asignados una enfermera ese día (cualquier turno). */
  async medicosDeEnfermera(enfermeraId: string, fecha: string): Promise<string[]> {
    const filas = await this.prisma.db.asignacionTurno.findMany({
      where: { enfermeraId, fecha: aFechaDb(fecha) },
      select: { medicoId: true },
    });
    return [...new Set(filas.map((f) => f.medicoId))];
  }

  async estaAsignada(
    enfermeraId: string,
    medicoId: string,
    instante: Date,
    zona: string,
  ): Promise<boolean> {
    const n = await this.prisma.db.asignacionTurno.count({
      where: { enfermeraId, medicoId, fecha: aFechaDb(fechaLocal(instante, zona)) },
    });
    return n > 0;
  }

  /** Enfermera del médico en el turno del instante; si no hay, la de cualquier turno del día. */
  async enfermeraDeMedico(medicoId: string, instante: Date, zona: string): Promise<string | null> {
    const filas = await this.prisma.db.asignacionTurno.findMany({
      where: { medicoId, fecha: aFechaDb(fechaLocal(instante, zona)) },
    });
    const turno = turnoDe(instante, zona);
    return (filas.find((f) => f.turno === turno) ?? filas[0])?.enfermeraId ?? null;
  }

  async listar(sesion: UsuarioSesion, fecha?: string) {
    const dia = fecha ?? hoyEn(sesion.zonaHoraria);
    const filtroPropio =
      sesion.rol === 'MEDICO'
        ? { medicoId: sesion.personalId }
        : sesion.rol === 'ENFERMERA'
          ? { enfermeraId: sesion.personalId }
          : {};
    const filas = await this.prisma.db.asignacionTurno.findMany({
      where: { fecha: aFechaDb(dia), ...filtroPropio },
      include: {
        medico: { select: { id: true, nombre: true, especialidad: { select: { nombre: true } } } },
        enfermera: { select: { id: true, nombre: true } },
      },
      orderBy: [{ turno: 'asc' }, { medico: { nombre: 'asc' } }],
    });
    return filas.map((f) => ({
      id: f.id,
      fecha: deFechaDb(f.fecha),
      turno: f.turno,
      medico: {
        id: f.medico.id,
        nombre: f.medico.nombre,
        especialidad: f.medico.especialidad?.nombre ?? null,
      },
      enfermera: f.enfermera,
    }));
  }

  /** Crea o reemplaza la enfermera de un médico en un turno. */
  async asignar(e: { fecha: string; turno: Turno; medicoId: string; enfermeraId: string }) {
    const [medico, enfermera] = await Promise.all([
      this.prisma.db.personal.findUnique({ where: { id: e.medicoId }, include: { usuario: true } }),
      this.prisma.db.personal.findUnique({
        where: { id: e.enfermeraId },
        include: { usuario: true },
      }),
    ]);
    if (!medico) throw noEncontrado('El médico');
    if (!enfermera) throw noEncontrado('La enfermera');
    if (medico.usuario.rol !== 'MEDICO') throw validacion('medicoId no corresponde a un médico');
    if (enfermera.usuario.rol !== 'ENFERMERA')
      throw validacion('enfermeraId no corresponde a una enfermera');
    if (!medico.usuario.activo || !enfermera.usuario.activo)
      throw validacion('El personal está inactivo');

    const fecha = aFechaDb(e.fecha);
    const clinicaId = clinicaActual();
    const fila = await this.prisma.db.asignacionTurno.upsert({
      where: {
        clinicaId_fecha_turno_medicoId: { clinicaId, fecha, turno: e.turno, medicoId: e.medicoId },
      },
      create: {
        clinicaId,
        fecha,
        turno: e.turno,
        medicoId: e.medicoId,
        enfermeraId: e.enfermeraId,
      },
      update: { enfermeraId: e.enfermeraId },
    });
    return {
      id: fila.id,
      fecha: e.fecha,
      turno: fila.turno,
      medicoId: fila.medicoId,
      enfermeraId: fila.enfermeraId,
    };
  }
}
