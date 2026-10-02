import { Module } from '@nestjs/common';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { CitasModule } from '../citas/citas.module';
import { EnfermeriaController } from './enfermeria.controller';
import { EnfermeriaService } from './enfermeria.service';

@Module({
  imports: [AsignacionesModule, CitasModule],
  controllers: [EnfermeriaController],
  providers: [EnfermeriaService],
})
export class EnfermeriaModule {}
