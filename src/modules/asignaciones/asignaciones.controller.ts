import { Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Consulta, Cuerpo, DocConsulta, DocCuerpo } from '../../common/zod/zod';
import type { Turno } from '../../shared/enums';
import { AsignacionesConsulta, AsignarTurnoEntrada } from '../../shared/personal';
import { AsignacionesService } from './asignaciones.service';

@ApiTags('Asignaciones')
@ApiBearerAuth()
@Controller('asignaciones')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get()
  @Roles('ADMIN', 'RECEPCION', 'MEDICO', 'ENFERMERA')
  @ApiOperation({
    summary: 'Asignación enfermera–médico del día (médico y enfermera ven solo la propia)',
  })
  @DocConsulta(AsignacionesConsulta)
  listar(@UsuarioActual() u: UsuarioSesion, @Consulta(AsignacionesConsulta) q: { fecha?: string }) {
    return this.asignaciones.listar(u, q.fecha);
  }

  @Put()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Asigna la enfermera de un médico en un turno' })
  @DocCuerpo(AsignarTurnoEntrada, {
    fecha: '2026-10-05',
    turno: 'MANANA',
    medicoId: 'per_01H…',
    enfermeraId: 'per_01H…',
  })
  asignar(
    @Cuerpo(AsignarTurnoEntrada)
    e: {
      fecha: string;
      turno: Turno;
      medicoId: string;
      enfermeraId: string;
    },
  ) {
    return this.asignaciones.asignar(e);
  }
}
