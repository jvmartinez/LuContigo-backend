import { Module } from '@nestjs/common';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';

@Module({
  imports: [AsignacionesModule],
  controllers: [PacientesController],
  providers: [PacientesService],
  exports: [PacientesService],
})
export class PacientesModule {}
