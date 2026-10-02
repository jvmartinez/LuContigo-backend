import { Injectable } from '@nestjs/common';
import { ErrorDominio, noEncontrado } from '../../common/errores/error-dominio';
import type { UsuarioSesion } from '../../common/sesion';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { edadEnAnios, hoyEn, rangoDia } from '../../common/tiempo';
import { PrismaService } from '../../prisma/prisma.service';
import type { EstadoTarea } from '../../shared/enums';
import { calcularAlertas, SignosVitalesEntrada } from '../../shared/signos-vitales';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { CitasService } from '../citas/citas.service';
import { serializarSignos } from './signos';

@Injectable()
export class EnfermeriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asignaciones: AsignacionesService,
    private readonly citas: CitasService,
  ) {}

  /** Cola del día (RF-10): citas EN_ESPERA y LISTA de los médicos asignados a la enfermera. */
  async cola(sesion: UsuarioSesion, fecha?: string) {
    const dia = fecha ?? hoyEn(sesion.zonaHoraria);
    const medicos = await this.asignaciones.medicosDeEnfermera(sesion.personalId as string, dia);
    const { desde, hasta } = rangoDia(dia, sesion.zonaHoraria);
    const citas = await this.prisma.db.cita.findMany({
      where: {
        medicoId: { in: medicos },
        estado: { in: ['EN_ESPERA', 'LISTA'] },
        inicio: { gte: desde, lt: hasta },
      },
      include: {
        paciente: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            fechaNacimiento: true,
            alergias: true,
          },
        },
        medico: { select: { id: true, nombre: true } },
        consultorio: { select: { id: true, nombre: true } },
        signos: { select: { alertas: true, tomadoEn: true } },
        historial: {
          where: { a: 'EN_ESPERA' },
          select: { fecha: true },
          orderBy: { fecha: 'desc' },
          take: 1,
        },
      },
      orderBy: { inicio: 'asc' },
    });
    return {
      fecha: dia,
      citas: citas.map((c) => ({
        id: c.id,
        pacienteId: c.pacienteId,
        estado: c.estado,
        inicio: c.inicio.toISOString(),
        llegadaEn: c.historial[0]?.fecha.toISOString() ?? null,
        paciente: {
          id: c.paciente.id,
          nombres: c.paciente.nombres,
          apellidos: c.paciente.apellidos,
          edad: edadEnAnios(c.paciente.fechaNacimiento),
          alergias: c.paciente.alergias,
        },
        medico: c.medico,
        consultorio: c.consultorio,
        alertas: c.signos?.alertas ?? [],
      })),
    };
  }

  /** Registra signos vitales (RF-09) y pasa la cita a LISTA en la misma transacción. */
  async registrarSignos(citaId: string, e: SignosVitalesEntrada, sesion: UsuarioSesion) {
    const cita = await this.citas.cargarModelo(citaId, sesion);
    const paciente = await this.prisma.db.paciente.findUniqueOrThrow({
      where: { id: cita.pacienteId },
      select: { fechaNacimiento: true },
    });
    const alertas = calcularAlertas(e, edadEnAnios(paciente.fechaNacimiento));

    const { resultado } = await this.citas.transicionar(citaId, 'registrarSignos', sesion, {
      enTx: (tx) =>
        tx.signosVitales.create({
          data: {
            clinicaId: clinicaActual(),
            citaId,
            enfermeraId: sesion.personalId as string,
            presionSistolica: e.presionSistolica,
            presionDiastolica: e.presionDiastolica,
            frecuenciaCardiaca: e.frecuenciaCardiaca,
            temperatura: e.temperatura,
            spo2: e.spo2,
            pesoKg: e.pesoKg,
            tallaCm: e.tallaCm,
            nota: e.nota,
            alertas,
          },
        }),
    });
    return { ...serializarSignos(resultado!), pacienteId: cita.pacienteId };
  }

  async tareas(sesion: UsuarioSesion, estado?: EstadoTarea) {
    const tareas = await this.prisma.db.tareaDelegada.findMany({
      where: { enfermeraId: sesion.personalId, ...(estado && { estado }) },
      orderBy: [{ estado: 'asc' }, { creadaEn: 'asc' }],
      include: {
        consulta: {
          select: {
            citaId: true,
            medico: { select: { id: true, nombre: true } },
            cita: {
              select: { paciente: { select: { id: true, nombres: true, apellidos: true } } },
            },
          },
        },
      },
    });
    return tareas.map((t) => ({
      id: t.id,
      tipo: t.tipo,
      detalle: t.detalle,
      estado: t.estado,
      creadaEn: t.creadaEn.toISOString(),
      completadaEn: t.completadaEn?.toISOString() ?? null,
      citaId: t.consulta.citaId,
      medico: t.consulta.medico,
      paciente: t.consulta.cita.paciente,
    }));
  }

  async completarTarea(id: string, sesion: UsuarioSesion) {
    const tarea = await this.prisma.db.tareaDelegada.findFirst({
      where: { id, enfermeraId: sesion.personalId },
      include: { consulta: { select: { cita: { select: { pacienteId: true } } } } },
    });
    if (!tarea) throw noEncontrado('La tarea');
    const r = await this.prisma.db.tareaDelegada.updateMany({
      where: { id, estado: 'PENDIENTE' },
      data: { estado: 'HECHA', completadaEn: new Date() },
    });
    if (r.count === 0) {
      throw new ErrorDominio('TRANSICION_INVALIDA', `La tarea ya está ${tarea.estado}.`);
    }
    return { id, estado: 'HECHA' as const, pacienteId: tarea.consulta.cita.pacienteId };
  }
}
