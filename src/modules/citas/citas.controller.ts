import { Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Consulta, Cuerpo, DocConsulta, DocCuerpo } from '../../common/zod/zod';
import {
  AgendaConsulta,
  CancelarCitaEntrada,
  CrearCitaEntrada,
  DisponibilidadConsulta,
  ReprogramarCitaEntrada,
} from '../../shared/citas';
import type { EstadoCita } from '../../shared/enums';
import { CitasService } from './citas.service';

@ApiTags('Citas')
@ApiBearerAuth()
@Controller()
export class CitasController {
  constructor(private readonly citas: CitasService) {}

  @Get('disponibilidad')
  @ApiOperation({ summary: 'Huecos libres: horario − citas activas − ausencias' })
  @DocConsulta(DisponibilidadConsulta)
  disponibilidad(
    @UsuarioActual() u: UsuarioSesion,
    @Consulta(DisponibilidadConsulta) q: { medicoId: string; desde: string; hasta: string },
  ) {
    return this.citas.disponibilidad(q.medicoId, q.desde, q.hasta, u.zonaHoraria);
  }

  @Get('citas')
  @Roles('RECEPCION', 'MEDICO', 'ENFERMERA', 'ADMIN')
  @ApiOperation({ summary: 'Agenda filtrada por día, médico y estado' })
  @DocConsulta(AgendaConsulta)
  agenda(
    @UsuarioActual() u: UsuarioSesion,
    @Consulta(AgendaConsulta) q: { fecha?: string; medicoId?: string; estado?: EstadoCita },
  ) {
    return this.citas.agenda(u, q);
  }

  @Get('citas/:id')
  @ApiOperation({ summary: 'Detalle de la cita con su historial de estados' })
  obtener(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.citas.obtener(id, u);
  }

  @Post('citas')
  @Roles('RECEPCION', 'PACIENTE')
  @ApiOperation({ summary: 'Crea una cita (valida horario, ausencias y doble reserva)' })
  @DocCuerpo(CrearCitaEntrada, {
    pacienteId: 'pac_01H…',
    medicoId: 'per_01H…',
    inicio: '2026-10-05T09:30:00-05:00',
    motivo: 'Control de presión arterial',
  })
  crear(@UsuarioActual() u: UsuarioSesion, @Cuerpo(CrearCitaEntrada) e: CrearCitaEntrada) {
    return this.citas.crear(e, u);
  }

  @Patch('citas/:id/reprogramar')
  @Roles('RECEPCION', 'PACIENTE')
  @ApiOperation({ summary: 'Mueve la cita a otro horario (vuelve a PROGRAMADA)' })
  @DocCuerpo(ReprogramarCitaEntrada, { inicio: '2026-10-06T10:00:00-05:00' })
  reprogramar(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id') id: string,
    @Cuerpo(ReprogramarCitaEntrada) e: { inicio: string },
  ) {
    return this.citas.reprogramar(id, e.inicio, u);
  }

  @Post('citas/:id/confirmar')
  @HttpCode(200)
  @Roles('RECEPCION', 'PACIENTE')
  @ApiOperation({ summary: 'PROGRAMADA → CONFIRMADA' })
  async confirmar(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return (await this.citas.transicionar(id, 'confirmar', u)).cita;
  }

  @Post('citas/:id/llegada')
  @HttpCode(200)
  @Roles('RECEPCION')
  @ApiOperation({ summary: 'El paciente llegó: → EN_ESPERA' })
  async llegada(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return (await this.citas.transicionar(id, 'llegada', u)).cita;
  }

  @Post('citas/:id/cancelar')
  @HttpCode(200)
  @Roles('RECEPCION', 'PACIENTE')
  @ApiOperation({ summary: '→ CANCELADA (libera el horario y anula el recordatorio)' })
  @DocCuerpo(CancelarCitaEntrada, { motivo: 'El paciente tiene un viaje' })
  async cancelar(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id') id: string,
    @Cuerpo(CancelarCitaEntrada) e: { motivo: string },
  ) {
    return (
      await this.citas.transicionar(id, 'cancelar', u, { data: { motivoCancelacion: e.motivo } })
    ).cita;
  }

  @Post('citas/:id/no-asistio')
  @HttpCode(200)
  @Roles('RECEPCION')
  @ApiOperation({ summary: '→ NO_ASISTIO (solo si ya pasó la hora)' })
  async noAsistio(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return (await this.citas.transicionar(id, 'noAsistio', u)).cita;
  }

  @Post('citas/:id/iniciar')
  @HttpCode(200)
  @Roles('MEDICO')
  @ApiOperation({ summary: 'El médico de la cita inicia la consulta: → EN_CONSULTA' })
  async iniciar(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return (await this.citas.transicionar(id, 'iniciar', u)).cita;
  }

  @Get('pacientes/yo/citas')
  @Roles('PACIENTE')
  @ApiOperation({ summary: 'Citas propias: próximas y pasadas' })
  misCitas(@UsuarioActual() u: UsuarioSesion) {
    return this.citas.misCitas(u);
  }
}
