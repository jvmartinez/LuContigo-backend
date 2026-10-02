import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Consulta, Cuerpo, DocConsulta, DocCuerpo } from '../../common/zod/zod';
import type { Rol } from '../../shared/enums';
import {
  ActualizarPersonalEntrada,
  CrearAusenciaEntrada,
  CrearPersonalEntrada,
  HorariosEntrada,
  ListarPersonalConsulta,
} from '../../shared/personal';
import { PersonalService } from './personal.service';

@ApiTags('Personal')
@ApiBearerAuth()
@Controller()
export class PersonalController {
  constructor(private readonly personal: PersonalService) {}

  @Get('medicos')
  @ApiOperation({ summary: 'Médicos activos con su especialidad (para agendar)' })
  medicos() {
    return this.personal.medicos();
  }

  @Get('personal')
  @Roles('ADMIN', 'RECEPCION')
  @ApiOperation({ summary: 'Lista el personal de la clínica' })
  @DocConsulta(ListarPersonalConsulta)
  listar(@Consulta(ListarPersonalConsulta) q: { rol?: Rol }) {
    return this.personal.listar(q.rol);
  }

  @Post('personal')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crea personal y su usuario; invita por email' })
  @DocCuerpo(CrearPersonalEntrada, {
    nombre: 'Dra. Laura Méndez',
    email: 'laura.mendez@clinica.com',
    rol: 'MEDICO',
    especialidadId: 'esp_01H…',
    licencia: 'RM-12345',
    consultorioId: 'con_01H…',
  })
  crear(@Cuerpo(CrearPersonalEntrada) e: ReturnType<typeof CrearPersonalEntrada.parse>) {
    return this.personal.crear(e);
  }

  @Patch('personal/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Edita, activa o desactiva (desactivar cierra sus sesiones)' })
  @DocCuerpo(ActualizarPersonalEntrada)
  actualizar(
    @Param('id') id: string,
    @Cuerpo(ActualizarPersonalEntrada) e: ReturnType<typeof ActualizarPersonalEntrada.parse>,
  ) {
    return this.personal.actualizar(id, e);
  }

  @Get('personal/:id/horarios')
  @Roles('ADMIN', 'RECEPCION', 'MEDICO', 'ENFERMERA')
  @ApiOperation({ summary: 'Plantilla semanal (médico y enfermera ven solo la propia)' })
  horarios(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.personal.horarios(id, u);
  }

  @Put('personal/:id/horarios')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reemplaza la plantilla semanal' })
  @DocCuerpo(HorariosEntrada, {
    bloques: [
      { diaSemana: 1, horaInicio: '08:00', horaFin: '12:00' },
      { diaSemana: 1, horaInicio: '14:00', horaFin: '18:00' },
    ],
  })
  reemplazarHorarios(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id') id: string,
    @Cuerpo(HorariosEntrada) e: ReturnType<typeof HorariosEntrada.parse>,
  ) {
    return this.personal.reemplazarHorarios(id, e, u);
  }

  @Get('personal/:id/ausencias')
  @Roles('ADMIN', 'RECEPCION', 'MEDICO', 'ENFERMERA')
  @ApiOperation({ summary: 'Ausencias vigentes y futuras' })
  ausencias(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.personal.ausencias(id, u);
  }

  @Post('personal/:id/ausencias')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Registra una ausencia y devuelve las citas afectadas' })
  @DocCuerpo(CrearAusenciaEntrada, {
    desde: '2026-10-12T00:00:00-05:00',
    hasta: '2026-10-16T23:59:59-05:00',
    motivo: 'Congreso médico',
  })
  crearAusencia(
    @Param('id') id: string,
    @Cuerpo(CrearAusenciaEntrada) e: { desde: string; hasta: string; motivo?: string },
  ) {
    return this.personal.crearAusencia(id, e);
  }

  @Delete('personal/:id/ausencias/:ausenciaId')
  @Roles('ADMIN')
  @HttpCode(204)
  @ApiOperation({ summary: 'Elimina una ausencia' })
  eliminarAusencia(
    @Param('id') id: string,
    @Param('ausenciaId') ausenciaId: string,
  ): Promise<void> {
    return this.personal.eliminarAusencia(id, ausenciaId);
  }
}
