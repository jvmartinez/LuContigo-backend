import { Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar, Roles, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Cuerpo, DocCuerpo } from '../../common/zod/zod';
import { CrearTareaEntrada, GuardarConsultaEntrada } from '../../shared/consulta';
import { ConsultasService } from './consultas.service';

const EJEMPLO_NOTA = {
  motivo: 'Control de presión arterial',
  examenFisico: 'TA 145/92, ruidos cardiacos rítmicos, sin edemas',
  diagnostico: 'Hipertensión arterial esencial',
  cie10: 'I10',
  tratamiento: 'Losartán 50 mg cada 24 h',
  indicaciones: 'Dieta baja en sal, caminar 30 minutos diarios, control en 1 mes',
};

@ApiTags('Consulta')
@ApiBearerAuth()
@Controller('citas/:id')
export class ConsultasController {
  constructor(private readonly consultas: ConsultasService) {}

  @Get('consulta')
  @Roles('MEDICO', 'ENFERMERA')
  @Auditar({ accion: 'LEER', entidad: 'CONSULTA' })
  @ApiOperation({ summary: 'Nota de consulta (la enfermera solo ve notas cerradas)' })
  obtener(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.consultas.obtener(id, u);
  }

  @Put('consulta')
  @Roles('MEDICO')
  @Auditar({ accion: 'ACTUALIZAR', entidad: 'CONSULTA' })
  @ApiOperation({ summary: 'Guarda el borrador de la nota' })
  @DocCuerpo(GuardarConsultaEntrada, EJEMPLO_NOTA)
  guardar(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id') id: string,
    @Cuerpo(GuardarConsultaEntrada) e: GuardarConsultaEntrada,
  ) {
    return this.consultas.guardarBorrador(id, e, u);
  }

  @Post('consulta/cerrar')
  @HttpCode(200)
  @Roles('MEDICO')
  @Auditar({ accion: 'CERRAR', entidad: 'CONSULTA' })
  @ApiOperation({
    summary: 'Cierra la nota (exige diagnóstico y tratamiento); la cita pasa a ATENDIDA',
  })
  @DocCuerpo(GuardarConsultaEntrada, EJEMPLO_NOTA)
  cerrar(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id') id: string,
    @Cuerpo(GuardarConsultaEntrada) e: GuardarConsultaEntrada,
  ) {
    return this.consultas.cerrar(id, e, u);
  }

  @Post('tareas')
  @Roles('MEDICO')
  @Auditar({ accion: 'CREAR', entidad: 'TAREA' })
  @ApiOperation({ summary: 'Delega una tarea a la enfermera asignada' })
  @DocCuerpo(CrearTareaEntrada, { tipo: 'Aplicar medicamento', detalle: 'Dipirona 1 g IM' })
  crearTarea(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id') id: string,
    @Cuerpo(CrearTareaEntrada) e: { tipo: string; detalle?: string; enfermeraId?: string },
  ) {
    return this.consultas.crearTarea(id, e, u);
  }
}
