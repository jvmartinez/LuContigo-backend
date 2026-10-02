import { Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar, Roles, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Consulta, Cuerpo, DocConsulta, DocCuerpo } from '../../common/zod/zod';
import { Paginacion } from '../../shared/comun';
import type { CanalRecordatorio } from '../../shared/enums';
import {
  ActualizarMisDatosEntrada,
  ActualizarPacienteEntrada,
  BuscarPacientesConsulta,
  CrearPacienteEntrada,
} from '../../shared/pacientes';
import { PacientesService } from './pacientes.service';

const FiltroPacientes = BuscarPacientesConsulta.merge(Paginacion);

@ApiTags('Pacientes')
@ApiBearerAuth()
@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientes: PacientesService) {}

  @Get()
  @Roles('RECEPCION', 'MEDICO', 'ENFERMERA')
  @ApiOperation({ summary: 'Busca por nombre, apellido o documento' })
  @DocConsulta(FiltroPacientes)
  buscar(@Consulta(FiltroPacientes) q: { q?: string; page: number; pageSize: number }) {
    return this.pacientes.buscar(q.q, q);
  }

  @Post()
  @Roles('RECEPCION')
  @Auditar({ accion: 'CREAR', entidad: 'PACIENTE' })
  @ApiOperation({ summary: 'Registra un paciente (exige consentimiento de datos)' })
  @DocCuerpo(CrearPacienteEntrada, {
    nombres: 'Ana María',
    apellidos: 'Rojas Díaz',
    documento: '1032456789',
    fechaNacimiento: '1985-04-12',
    telefono: '+573001234567',
    email: 'ana.rojas@example.com',
    alergias: 'Penicilina',
    consentimientoDatos: true,
    crearAccesoPortal: true,
  })
  crear(@Cuerpo(CrearPacienteEntrada) e: ReturnType<typeof CrearPacienteEntrada.parse>) {
    return this.pacientes.crear(e);
  }

  // Las rutas /yo van antes que /:id.
  @Get('yo/indicaciones')
  @Roles('PACIENTE')
  @ApiOperation({ summary: 'Indicaciones de mis consultas cerradas' })
  misIndicaciones(@UsuarioActual() u: UsuarioSesion) {
    return this.pacientes.misIndicaciones(u);
  }

  @Patch('yo')
  @Roles('PACIENTE')
  @ApiOperation({ summary: 'Actualiza mi teléfono, email y canal preferido de recordatorio' })
  @DocCuerpo(ActualizarMisDatosEntrada, { telefono: '+573001234567', canalPreferido: 'WHATSAPP' })
  actualizarMisDatos(
    @UsuarioActual() u: UsuarioSesion,
    @Cuerpo(ActualizarMisDatosEntrada)
    e: {
      telefono?: string | null;
      email?: string | null;
      canalPreferido?: CanalRecordatorio | null;
    },
  ) {
    return this.pacientes.actualizarMisDatos(u, e);
  }

  @Get(':id')
  @Roles('RECEPCION', 'MEDICO', 'ENFERMERA')
  @Auditar({ accion: 'LEER', entidad: 'PACIENTE' })
  @ApiOperation({ summary: 'Datos, alergias y antecedentes' })
  obtener(@Param('id') id: string) {
    return this.pacientes.obtener(id);
  }

  @Patch(':id')
  @Roles('RECEPCION')
  @Auditar({ accion: 'ACTUALIZAR', entidad: 'PACIENTE' })
  @ApiOperation({ summary: 'Actualiza datos demográficos' })
  @DocCuerpo(ActualizarPacienteEntrada)
  actualizar(
    @Param('id') id: string,
    @Cuerpo(ActualizarPacienteEntrada) e: ReturnType<typeof ActualizarPacienteEntrada.parse>,
  ) {
    return this.pacientes.actualizar(id, e);
  }

  @Get(':id/historial')
  @Roles('MEDICO', 'ENFERMERA')
  @Auditar({ accion: 'LEER', entidad: 'HISTORIAL' })
  @ApiOperation({ summary: 'Línea de tiempo: consultas, signos y tareas' })
  historial(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.pacientes.historial(id, u);
  }
}
