import { Injectable } from '@nestjs/common';
import type { Personal, Usuario } from '@prisma/client';
import { noEncontrado, sinPermiso, validacion } from '../../common/errores/error-dominio';
import type { UsuarioSesion } from '../../common/sesion';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { PrismaService } from '../../prisma/prisma.service';
import { ESTADOS_INACTIVOS, type Rol } from '../../shared/enums';
import type {
  ActualizarPersonalEntrada,
  CrearPersonalEntrada,
  HorariosEntrada,
} from '../../shared/personal';
import { CredencialesService } from '../auth/credenciales.service';
import { serializarCita } from '../citas/citas.service';

type PersonalCompleto = Personal & {
  usuario: Usuario;
  especialidad: { id: string; nombre: string } | null;
  consultorio: { id: string; nombre: string } | null;
};

const INCLUDE = {
  usuario: true,
  especialidad: { select: { id: true, nombre: true } },
  consultorio: { select: { id: true, nombre: true } },
} as const;

function serializar(p: PersonalCompleto) {
  return {
    id: p.id,
    nombre: p.nombre,
    email: p.usuario.email,
    rol: p.usuario.rol,
    activo: p.usuario.activo,
    licencia: p.licencia,
    especialidad: p.especialidad,
    consultorio: p.consultorio,
  };
}

@Injectable()
export class PersonalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credenciales: CredencialesService,
  ) {}

  async listar(rol?: Rol) {
    const personal = await this.prisma.db.personal.findMany({
      where: rol ? { usuario: { rol } } : {},
      include: INCLUDE,
      orderBy: { nombre: 'asc' },
    });
    return personal.map(serializar);
  }

  /** Médicos activos, para que recepción y pacientes elijan con quién agendar. */
  async medicos() {
    const medicos = await this.prisma.db.personal.findMany({
      where: { usuario: { rol: 'MEDICO', activo: true } },
      include: { especialidad: { select: { id: true, nombre: true, duracionCitaMin: true } } },
      orderBy: { nombre: 'asc' },
    });
    return medicos.map((m) => ({ id: m.id, nombre: m.nombre, especialidad: m.especialidad }));
  }

  /** Crea el usuario y su ficha de personal, e invita por email a definir la contraseña. */
  async crear(e: CrearPersonalEntrada) {
    await this.validarReferencias(e);
    const clinicaId = clinicaActual();
    const personal = await this.prisma.db.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({ data: { clinicaId, email: e.email, rol: e.rol } });
      return tx.personal.create({
        data: {
          clinicaId,
          usuarioId: usuario.id,
          nombre: e.nombre,
          especialidadId: e.especialidadId,
          licencia: e.licencia,
          consultorioId: e.consultorioId,
        },
        include: INCLUDE,
      });
    });
    const clinica = await this.prisma.sinClinica.clinica.findUniqueOrThrow({
      where: { id: clinicaId },
    });
    await this.credenciales.enviarInvitacion(personal.usuario, clinica.nombre);
    return serializar(personal);
  }

  async actualizar(id: string, e: ActualizarPersonalEntrada) {
    const actual = await this.buscar(id);
    await this.validarReferencias(e);
    const { activo, ...datos } = e;
    const personal = await this.prisma.db.$transaction(async (tx) => {
      if (activo !== undefined && activo !== actual.usuario.activo) {
        await tx.usuario.update({ where: { id: actual.usuarioId }, data: { activo } });
        if (!activo) {
          await tx.tokenRefresco.updateMany({
            where: { usuarioId: actual.usuarioId, revocadoEn: null },
            data: { revocadoEn: new Date() },
          });
        }
      }
      return tx.personal.update({ where: { id }, data: datos, include: INCLUDE });
    });
    return serializar(personal);
  }

  async horarios(id: string, sesion: UsuarioSesion) {
    this.exigirPropioOGestion(id, sesion);
    await this.buscar(id);
    const bloques = await this.prisma.db.horarioAtencion.findMany({
      where: { personalId: id },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      select: { diaSemana: true, horaInicio: true, horaFin: true },
    });
    return { personalId: id, bloques };
  }

  /** Reemplaza la plantilla semanal completa. */
  async reemplazarHorarios(id: string, e: HorariosEntrada, sesion: UsuarioSesion) {
    await this.buscar(id);
    const clinicaId = clinicaActual();
    await this.prisma.db.$transaction([
      this.prisma.db.horarioAtencion.deleteMany({ where: { personalId: id } }),
      this.prisma.db.horarioAtencion.createMany({
        data: e.bloques.map((b) => ({ clinicaId, personalId: id, ...b })),
      }),
    ]);
    return this.horarios(id, sesion);
  }

  async ausencias(id: string, sesion: UsuarioSesion) {
    this.exigirPropioOGestion(id, sesion);
    await this.buscar(id);
    const ausencias = await this.prisma.db.ausencia.findMany({
      where: { personalId: id, hasta: { gte: new Date() } },
      orderBy: { desde: 'asc' },
    });
    return ausencias.map((a) => ({
      id: a.id,
      desde: a.desde.toISOString(),
      hasta: a.hasta.toISOString(),
      motivo: a.motivo,
    }));
  }

  /** Registra la ausencia y devuelve las citas activas que caen dentro, para reprogramarlas. */
  async crearAusencia(id: string, e: { desde: string; hasta: string; motivo?: string }) {
    await this.buscar(id);
    const desde = new Date(e.desde);
    const hasta = new Date(e.hasta);
    const ausencia = await this.prisma.db.ausencia.create({
      data: { clinicaId: clinicaActual(), personalId: id, desde, hasta, motivo: e.motivo },
    });
    const afectadas = await this.prisma.db.cita.findMany({
      where: {
        medicoId: id,
        estado: { notIn: ESTADOS_INACTIVOS },
        inicio: { lt: hasta },
        fin: { gt: desde },
      },
      include: {
        paciente: { select: { id: true, nombres: true, apellidos: true, documento: true } },
        medico: {
          select: { id: true, nombre: true, especialidad: { select: { id: true, nombre: true } } },
        },
        consultorio: { select: { id: true, nombre: true } },
        recordatorio: { select: { programadoPara: true, estado: true, canal: true } },
      },
      orderBy: { inicio: 'asc' },
    });
    return {
      ausencia: { id: ausencia.id, desde: e.desde, hasta: e.hasta, motivo: ausencia.motivo },
      citasAfectadas: afectadas.map(serializarCita),
    };
  }

  async eliminarAusencia(id: string, ausenciaId: string): Promise<void> {
    const r = await this.prisma.db.ausencia.deleteMany({
      where: { id: ausenciaId, personalId: id },
    });
    if (r.count === 0) throw noEncontrado('La ausencia');
  }

  private async buscar(id: string) {
    const personal = await this.prisma.db.personal.findUnique({
      where: { id },
      include: { usuario: true },
    });
    if (!personal) throw noEncontrado('El miembro del personal');
    return personal;
  }

  private exigirPropioOGestion(id: string, sesion: UsuarioSesion): void {
    if (sesion.rol !== 'ADMIN' && sesion.rol !== 'RECEPCION' && sesion.personalId !== id)
      throw sinPermiso();
  }

  private async validarReferencias(e: {
    especialidadId?: string | null;
    consultorioId?: string | null;
  }) {
    if (
      e.especialidadId &&
      !(await this.prisma.db.especialidad.findUnique({ where: { id: e.especialidadId } }))
    ) {
      throw validacion('La especialidad no existe', { campo: 'especialidadId' });
    }
    if (
      e.consultorioId &&
      !(await this.prisma.db.consultorio.findUnique({ where: { id: e.consultorioId } }))
    ) {
      throw validacion('El consultorio no existe', { campo: 'consultorioId' });
    }
  }
}
