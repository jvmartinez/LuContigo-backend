import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { CitasController } from './citas.controller';
import { CitasService } from './citas.service';
import { ConfirmacionesController } from './confirmaciones.controller';
import { COLA_MANTENIMIENTO, NoAsistenciaProcessor } from './no-asistencia.processor';

@Module({
  imports: [
    AsignacionesModule,
    NotificacionesModule,
    BullModule.registerQueue({ name: COLA_MANTENIMIENTO }),
  ],
  controllers: [CitasController, ConfirmacionesController],
  providers: [CitasService, NoAsistenciaProcessor],
  exports: [CitasService],
})
export class CitasModule {}
