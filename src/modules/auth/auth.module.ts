import { Global, Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CredencialesService } from './credenciales.service';

@Global()
@Module({
  imports: [NotificacionesModule],
  controllers: [AuthController],
  providers: [AuthService, CredencialesService],
  exports: [CredencialesService],
})
export class AuthModule {}
