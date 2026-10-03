import { Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../../common/decorators';
import { noEncontrado } from '../../common/errores/error-dominio';
import type { UsuarioSesion } from '../../common/sesion';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { Cuerpo, DocCuerpo } from '../../common/zod/zod';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActualizarConsultorioEntrada,
  ActualizarEspecialidadEntrada,
  CrearConsultorioEntrada,
  CrearEspecialidadEntrada,
} from '../../shared/clinica';

@ApiTags('Clínica')
@ApiBearerAuth()
@Controller()
export class ClinicasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('clinica')
  @ApiOperation({ summary: 'Datos de mi clínica' })
  async clinica(@UsuarioActual() u: UsuarioSesion) {
    const c = await this.prisma.sinClinica.clinica.findUniqueOrThrow({
      where: { id: u.clinicaId },
    });
    return {
      id: c.id,
      nombre: c.nombre,
      direccion: c.direccion,
      telefono: c.telefono,
      zonaHoraria: c.zonaHoraria,
      pais: c.pais,
    };
  }

  // ─── Especialidades ─────────────────────────────────────────────────────────

  @Get('especialidades')
  @ApiOperation({ summary: 'Especialidades y duración por defecto de la cita' })
  especialidades() {
    return this.prisma.db.especialidad.findMany({ orderBy: { nombre: 'asc' } });
  }

  @Post('especialidades')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crea una especialidad para la clínica' })
  @DocCuerpo(CrearEspecialidadEntrada, { nombre: 'Cardiología', duracionCitaMin: 40 })
  crearEspecialidad(
    @Cuerpo(CrearEspecialidadEntrada) e: { nombre: string; duracionCitaMin: number },
  ) {
    return this.prisma.db.especialidad.create({ data: { clinicaId: clinicaActual(), ...e } });
  }

  @Patch('especialidades/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualiza una especialidad' })
  @DocCuerpo(ActualizarEspecialidadEntrada)
  async actualizarEspecialidad(
    @Param('id') id: string,
    @Cuerpo(ActualizarEspecialidadEntrada) e: { nombre?: string; duracionCitaMin?: number },
  ) {
    if (!(await this.prisma.db.especialidad.findUnique({ where: { id } })))
      throw noEncontrado('La especialidad');
    return this.prisma.db.especialidad.update({ where: { id }, data: e });
  }

  // ─── Consultorios ───────────────────────────────────────────────────────────

  @Get('consultorios')
  @Roles('ADMIN', 'RECEPCION')
  @ApiOperation({ summary: 'Lista los consultorios y sus especialidades' })
  consultorios() {
    return this.prisma.db.consultorio.findMany({
      orderBy: { nombre: 'asc' },
      include: { especialidad: { select: { id: true, nombre: true } } },
    });
  }

  @Post('consultorios')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crea un consultorio' })
  @DocCuerpo(CrearConsultorioEntrada, { nombre: 'Consultorio 4', especialidadId: 'esp_01H…' })
  crearConsultorio(
    @Cuerpo(CrearConsultorioEntrada) e: { nombre: string; especialidadId?: string },
  ) {
    return this.prisma.db.consultorio.create({ data: { clinicaId: clinicaActual(), ...e } });
  }

  @Patch('consultorios/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualiza un consultorio' })
  @DocCuerpo(ActualizarConsultorioEntrada, { activo: false })
  async actualizarConsultorio(
    @Param('id') id: string,
    @Cuerpo(ActualizarConsultorioEntrada)
    e: { nombre?: string; especialidadId?: string | null; activo?: boolean },
  ) {
    if (!(await this.prisma.db.consultorio.findUnique({ where: { id } })))
      throw noEncontrado('El consultorio');
    return this.prisma.db.consultorio.update({ where: { id }, data: e });
  }
}
