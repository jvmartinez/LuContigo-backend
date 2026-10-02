import { Injectable } from '@nestjs/common';
import type { Paciente, Prisma } from '@prisma/client';
import { noEncontrado, sinPermiso } from '../../common/errores/error-dominio';
import type { UsuarioSesion } from '../../common/sesion';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { aFechaDb, deFechaDb, hoyEn, rangoDia } from '../../common/tiempo';
import { PrismaService } from '../../prisma/prisma.service';
import type { Pagina, Paginacion } from '../../shared/comun';
import type { CanalRecordatorio } from '../../shared/enums';
import type { ActualizarPacienteEntrada, CrearPacienteEntrada } from '../../shared/pacientes';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { CredencialesService } from '../auth/credenciales.service';
import { serializarSignos } from '../enfermeria/signos';

export function serializarPaciente(p: Paciente) {
  return {
    id: p.id,
    nombres: p.nombres,
    apellidos: p.apellidos,
    documento: p.documento,
    fechaNacimiento: deFechaDb(p.fechaNacimiento),
    telefono: p.telefono,
    email: p.email,
    alergias: p.alergias,
    antecedentes: p.antecedentes,
    seguro: p.seguro,
    canalPreferido: p.canalPreferido,
    tieneAccesoPortal: p.usuarioId !== null,
    consentimientoEn: p.consentimientoEn.toISOString(),
  };
}

@Injectable()
export class PacientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asignaciones: AsignacionesService,
    private readonly credenciales: CredencialesService,
  ) {}

  async buscar(q: string | undefined, { page, pageSize }: Paginacion): Promise<Pagina<unknown>> {
    const texto = q?.trim();
    const where: Prisma.PacienteWhereInput = texto
      ? {
          OR: [
            { documento: { startsWith: texto } },
            { nombres: { contains: texto, mode: 'insensitive' } },
            { apellidos: { contains: texto, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.db.paciente.findMany({
        where,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          documento: true,
          fechaNacimiento: true,
          telefono: true,
        },
      }),
      this.prisma.db.paciente.count({ where }),
    ]);
    return {
      items: items.map((p) => ({ ...p, fechaNacimiento: deFechaDb(p.fechaNacimiento) })),
      page,
      pageSize,
      total,
    };
  }

  async crear(e: CrearPacienteEntrada) {
    const clinicaId = clinicaActual();
    const { paciente, usuario } = await this.prisma.db.$transaction(async (tx) => {
      const usuario =
        e.crearAccesoPortal && e.email
          ? await tx.usuario.create({ data: { clinicaId, email: e.email, rol: 'PACIENTE' } })
          : null;
      const paciente = await tx.paciente.create({
        data: {
          clinicaId,
          usuarioId: usuario?.id,
          nombres: e.nombres,
          apellidos: e.apellidos,
          documento: e.documento,
          fechaNacimiento: aFechaDb(e.fechaNacimiento),
          telefono: e.telefono,
          email: e.email,
          alergias: e.alergias,
          antecedentes: e.antecedentes,
          seguro: e.seguro,
          canalPreferido: e.canalPreferido,
          consentimientoEn: new Date(),
        },
      });
      return { paciente, usuario };
    });

    if (usuario) {
      const clinica = await this.prisma.sinClinica.clinica.findUniqueOrThrow({
        where: { id: clinicaId },
      });
      await this.credenciales.enviarInvitacion(usuario, clinica.nombre);
    }
    return serializarPaciente(paciente);
  }

  async obtener(id: string) {
    const paciente = await this.prisma.db.paciente.findUnique({ where: { id } });
    if (!paciente) throw noEncontrado('El paciente');
    return { ...serializarPaciente(paciente), pacienteId: paciente.id };
  }

  async actualizar(id: string, e: ActualizarPacienteEntrada) {
    await this.obtener(id);
    const { fechaNacimiento, ...resto } = e;
    const paciente = await this.prisma.db.paciente.update({
      where: { id },
      data: { ...resto, ...(fechaNacimiento && { fechaNacimiento: aFechaDb(fechaNacimiento) }) },
    });
    return { ...serializarPaciente(paciente), pacienteId: paciente.id };
  }

  /**
   * Línea de tiempo del expediente (RF-07): consultas, signos y tareas.
   * - Médico: pacientes que tienen o tuvieron cita con él.
   * - Enfermera: pacientes con cita hoy con alguno de sus médicos asignados.
   */
  async historial(pacienteId: string, sesion: UsuarioSesion) {
    const paciente = await this.prisma.db.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) throw noEncontrado('El paciente');
    await this.exigirAccesoClinico(pacienteId, sesion);

    const citas = await this.prisma.db.cita.findMany({
      where: { pacienteId, estado: { in: ['EN_ESPERA', 'LISTA', 'EN_CONSULTA', 'ATENDIDA'] } },
      orderBy: { inicio: 'desc' },
      include: {
        medico: { select: { id: true, nombre: true, especialidad: { select: { nombre: true } } } },
        signos: true,
        consulta: {
          include: { tareas: { include: { enfermera: { select: { id: true, nombre: true } } } } },
        },
      },
    });

    return {
      pacienteId,
      paciente: serializarPaciente(paciente),
      eventos: citas.map((c) => {
        // Los borradores de nota solo los ve el médico que los escribe.
        const consultaVisible =
          c.consulta && (c.consulta.cerradaEn || c.consulta.medicoId === sesion.personalId)
            ? c.consulta
            : null;
        return {
          citaId: c.id,
          fecha: c.inicio.toISOString(),
          estado: c.estado,
          medico: {
            id: c.medico.id,
            nombre: c.medico.nombre,
            especialidad: c.medico.especialidad?.nombre ?? null,
          },
          signosVitales: c.signos && serializarSignos(c.signos),
          consulta: consultaVisible && {
            id: consultaVisible.id,
            motivo: consultaVisible.motivo,
            examenFisico: consultaVisible.examenFisico,
            diagnostico: consultaVisible.diagnostico,
            cie10: consultaVisible.cie10,
            tratamiento: consultaVisible.tratamiento,
            indicaciones: consultaVisible.indicaciones,
            cerradaEn: consultaVisible.cerradaEn?.toISOString() ?? null,
          },
          tareas: (consultaVisible?.tareas ?? []).map((t) => ({
            id: t.id,
            tipo: t.tipo,
            detalle: t.detalle,
            estado: t.estado,
            enfermera: t.enfermera,
            creadaEn: t.creadaEn.toISOString(),
            completadaEn: t.completadaEn?.toISOString() ?? null,
          })),
        };
      }),
    };
  }

  async exigirAccesoClinico(pacienteId: string, sesion: UsuarioSesion): Promise<void> {
    if (sesion.rol === 'MEDICO') {
      const n = await this.prisma.db.cita.count({
        where: { pacienteId, medicoId: sesion.personalId },
      });
      if (n === 0) throw sinPermiso('El paciente no tiene citas contigo.');
      return;
    }
    if (sesion.rol === 'ENFERMERA') {
      const hoy = hoyEn(sesion.zonaHoraria);
      const medicos = await this.asignaciones.medicosDeEnfermera(sesion.personalId as string, hoy);
      const { desde, hasta } = rangoDia(hoy, sesion.zonaHoraria);
      const n = await this.prisma.db.cita.count({
        where: { pacienteId, medicoId: { in: medicos }, inicio: { gte: desde, lt: hasta } },
      });
      if (n === 0) throw sinPermiso('El paciente no tiene cita hoy con tus médicos asignados.');
      return;
    }
    throw sinPermiso();
  }

  /** Indicaciones de las consultas cerradas del propio paciente. */
  async misIndicaciones(sesion: UsuarioSesion) {
    if (!sesion.pacienteId) throw sinPermiso();
    const consultas = await this.prisma.db.consulta.findMany({
      where: { cerradaEn: { not: null }, cita: { pacienteId: sesion.pacienteId } },
      orderBy: { cerradaEn: 'desc' },
      include: {
        cita: { select: { id: true, inicio: true } },
        medico: { select: { nombre: true, especialidad: { select: { nombre: true } } } },
      },
    });
    return consultas.map((c) => ({
      citaId: c.cita.id,
      fecha: c.cita.inicio.toISOString(),
      medico: c.medico.nombre,
      especialidad: c.medico.especialidad?.nombre ?? null,
      indicaciones: c.indicaciones,
    }));
  }

  async actualizarMisDatos(
    sesion: UsuarioSesion,
    e: {
      telefono?: string | null;
      email?: string | null;
      canalPreferido?: CanalRecordatorio | null;
    },
  ) {
    if (!sesion.pacienteId) throw sinPermiso();
    const paciente = await this.prisma.db.paciente.update({
      where: { id: sesion.pacienteId },
      data: e,
    });
    return serializarPaciente(paciente);
  }
}
