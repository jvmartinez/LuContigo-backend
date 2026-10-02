import { Injectable } from '@nestjs/common';
import type { Cita, Consulta } from '@prisma/client';
import { ErrorDominio, noEncontrado, validacion } from '../../common/errores/error-dominio';
import type { UsuarioSesion } from '../../common/sesion';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { PrismaService } from '../../prisma/prisma.service';
import type { GuardarConsultaEntrada } from '../../shared/consulta';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { CitasService } from '../citas/citas.service';

function serializarConsulta(c: Consulta, pacienteId: string) {
  return {
    id: c.id,
    citaId: c.citaId,
    pacienteId,
    medicoId: c.medicoId,
    motivo: c.motivo,
    examenFisico: c.examenFisico,
    diagnostico: c.diagnostico,
    cie10: c.cie10,
    tratamiento: c.tratamiento,
    indicaciones: c.indicaciones,
    cerradaEn: c.cerradaEn?.toISOString() ?? null,
    actualizadaEn: c.actualizadaEn.toISOString(),
  };
}

const vacio = (s?: string | null) => !s || !s.trim();

@Injectable()
export class ConsultasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly citas: CitasService,
    private readonly asignaciones: AsignacionesService,
  ) {}

  async obtener(citaId: string, sesion: UsuarioSesion) {
    const cita = await this.citas.cargarModelo(citaId, sesion);
    const consulta = await this.prisma.db.consulta.findUnique({ where: { citaId } });
    // El borrador solo lo ve su autor; la enfermera ve la nota cerrada.
    if (!consulta || (!consulta.cerradaEn && consulta.medicoId !== sesion.personalId)) {
      throw noEncontrado('La nota de consulta');
    }
    return serializarConsulta(consulta, cita.pacienteId);
  }

  /** Guarda el borrador de la nota (RF-08). Solo el médico de la cita y con la cita EN_CONSULTA. */
  async guardarBorrador(citaId: string, e: GuardarConsultaEntrada, sesion: UsuarioSesion) {
    const cita = await this.citaEnConsulta(citaId, sesion);
    const existente = await this.prisma.db.consulta.findUnique({ where: { citaId } });
    this.exigirAbierta(existente);
    const consulta = await this.prisma.db.consulta.upsert({
      where: { citaId },
      create: { clinicaId: clinicaActual(), citaId, medicoId: cita.medicoId, ...e },
      update: e,
    });
    return serializarConsulta(consulta, cita.pacienteId);
  }

  /** Cierra la nota: exige diagnóstico y tratamiento; la cita pasa a ATENDIDA. */
  async cerrar(citaId: string, e: GuardarConsultaEntrada, sesion: UsuarioSesion) {
    const cita = await this.citaEnConsulta(citaId, sesion);
    const existente = await this.prisma.db.consulta.findUnique({ where: { citaId } });
    this.exigirAbierta(existente);

    const final = { ...pick(existente), ...e };
    const faltantes = [
      ...(vacio(final.diagnostico) ? ['diagnostico'] : []),
      ...(vacio(final.tratamiento) ? ['tratamiento'] : []),
    ];
    if (faltantes.length) {
      throw validacion('Para cerrar la consulta se requieren diagnóstico y tratamiento.', {
        campos: faltantes.map((campo) => ({ campo, mensaje: 'Obligatorio al cerrar' })),
      });
    }

    const { resultado } = await this.citas.transicionar(citaId, 'cerrar', sesion, {
      enTx: (tx) =>
        tx.consulta.upsert({
          where: { citaId },
          create: {
            clinicaId: clinicaActual(),
            citaId,
            medicoId: cita.medicoId,
            ...final,
            cerradaEn: new Date(),
          },
          update: { ...e, cerradaEn: new Date() },
        }),
    });
    return serializarConsulta(resultado!, cita.pacienteId);
  }

  /** Delega una tarea (RF-11) a la enfermera indicada o a la asignada al médico ese día. */
  async crearTarea(
    citaId: string,
    e: { tipo: string; detalle?: string; enfermeraId?: string },
    sesion: UsuarioSesion,
  ) {
    const cita = await this.citas.cargarModelo(citaId, sesion);
    if (cita.estado !== 'EN_CONSULTA' && cita.estado !== 'ATENDIDA') {
      throw new ErrorDominio(
        'TRANSICION_INVALIDA',
        'Solo se delegan tareas durante o después de la consulta.',
      );
    }
    const consulta =
      (await this.prisma.db.consulta.findUnique({ where: { citaId } })) ??
      (await this.prisma.db.consulta.create({
        data: { clinicaId: clinicaActual(), citaId, medicoId: cita.medicoId },
      }));

    const enfermeraId =
      e.enfermeraId ??
      (await this.asignaciones.enfermeraDeMedico(cita.medicoId, cita.inicio, sesion.zonaHoraria));
    if (!enfermeraId) {
      throw new ErrorDominio(
        'SIN_ENFERMERA_ASIGNADA',
        'No hay enfermera asignada a tu turno. Indica una.',
      );
    }
    const enfermera = await this.prisma.db.personal.findUnique({
      where: { id: enfermeraId },
      include: { usuario: true },
    });
    if (!enfermera || enfermera.usuario.rol !== 'ENFERMERA' || !enfermera.usuario.activo) {
      throw validacion('enfermeraId no corresponde a una enfermera activa', {
        campo: 'enfermeraId',
      });
    }

    const tarea = await this.prisma.db.tareaDelegada.create({
      data: {
        clinicaId: clinicaActual(),
        consultaId: consulta.id,
        enfermeraId,
        tipo: e.tipo,
        detalle: e.detalle,
      },
    });
    return {
      id: tarea.id,
      citaId,
      pacienteId: cita.pacienteId,
      tipo: tarea.tipo,
      detalle: tarea.detalle,
      estado: tarea.estado,
      enfermera: { id: enfermera.id, nombre: enfermera.nombre },
      creadaEn: tarea.creadaEn.toISOString(),
    };
  }

  private async citaEnConsulta(citaId: string, sesion: UsuarioSesion): Promise<Cita> {
    const cita = await this.citas.cargarModelo(citaId, sesion);
    if (cita.estado !== 'EN_CONSULTA') {
      throw new ErrorDominio(
        'TRANSICION_INVALIDA',
        `La cita está en ${cita.estado}; inicia la consulta primero.`,
      );
    }
    return cita;
  }

  private exigirAbierta(consulta: Consulta | null): void {
    if (consulta?.cerradaEn) {
      throw new ErrorDominio('CONSULTA_CERRADA', 'La nota ya está cerrada y no se puede editar.');
    }
  }
}

function pick(c: Consulta | null): GuardarConsultaEntrada {
  if (!c) return {};
  const campos = [
    'motivo',
    'examenFisico',
    'diagnostico',
    'cie10',
    'tratamiento',
    'indicaciones',
  ] as const;
  return Object.fromEntries(
    campos.filter((k) => c[k] !== null).map((k) => [k, c[k]]),
  ) as GuardarConsultaEntrada;
}
