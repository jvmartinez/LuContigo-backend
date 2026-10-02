import { Module } from '@nestjs/common';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { CitasModule } from '../citas/citas.module';
import { ConsultasController } from './consultas.controller';
import { ConsultasService } from './consultas.service';

@Module({
  imports: [AsignacionesModule, CitasModule],
  controllers: [ConsultasController],
  providers: [ConsultasService],
})
export class ConsultasModule {}
