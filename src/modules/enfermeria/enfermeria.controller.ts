import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar, Roles, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Consulta, Cuerpo, DocConsulta, DocCuerpo } from '../../common/zod/zod';
import { FechaIso } from '../../shared/comun';
import { TareasConsulta } from '../../shared/consulta';
import type { EstadoTarea } from '../../shared/enums';
import { SignosVitalesEntrada } from '../../shared/signos-vitales';
import { z } from 'zod';
import { EnfermeriaService } from './enfermeria.service';

const ColaConsulta = z.object({ fecha: FechaIso.optional() });

@ApiTags('Enfermería')
@ApiBearerAuth()
@Controller()
@Roles('ENFERMERA')
export class EnfermeriaController {
  constructor(private readonly enfermeria: EnfermeriaService) {}

  @Get('enfermeria/cola')
  @ApiOperation({ summary: 'Citas EN_ESPERA y LISTA de mis médicos asignados' })
  @DocConsulta(ColaConsulta)
  cola(@UsuarioActual() u: UsuarioSesion, @Consulta(ColaConsulta) q: { fecha?: string }) {
    return this.enfermeria.cola(u, q.fecha);
  }

  @Post('citas/:id/signos-vitales')
  @Auditar({ accion: 'CREAR', entidad: 'SIGNOS_VITALES' })
  @ApiOperation({
    summary: 'Registra signos vitales y pasa la cita a LISTA. Devuelve alertas e IMC.',
  })
  @DocCuerpo(SignosVitalesEntrada, {
    presionSistolica: 145,
    presionDiastolica: 92,
    frecuenciaCardiaca: 88,
    temperatura: 36.8,
    spo2: 97,
    pesoKg: 72.5,
    tallaCm: 168,
    nota: 'Refiere cefalea leve',
  })
  registrarSignos(
    @UsuarioActual() u: UsuarioSesion,
    @Param('id') id: string,
    @Cuerpo(SignosVitalesEntrada) e: SignosVitalesEntrada,
  ) {
    return this.enfermeria.registrarSignos(id, e, u);
  }

  @Get('enfermeria/tareas')
  @ApiOperation({ summary: 'Mis tareas delegadas' })
  @DocConsulta(TareasConsulta)
  tareas(@UsuarioActual() u: UsuarioSesion, @Consulta(TareasConsulta) q: { estado?: EstadoTarea }) {
    return this.enfermeria.tareas(u, q.estado);
  }

  @Post('tareas/:id/completar')
  @HttpCode(200)
  @Auditar({ accion: 'ACTUALIZAR', entidad: 'TAREA' })
  @ApiOperation({ summary: 'Marca una tarea como HECHA' })
  completar(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.enfermeria.completarTarea(id, u);
  }
}
