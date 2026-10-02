import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfirmacionTokenService } from './confirmacion-token.service';
import { DispositivosController } from './dispositivos.controller';
import { EmailProveedor } from './proveedores/email.proveedor';
import { PushProveedor } from './proveedores/push.proveedor';
import { SmsProveedor } from './proveedores/sms.proveedor';
import { WhatsappProveedor } from './proveedores/whatsapp.proveedor';
import { RecordatoriosProcessor } from './recordatorios.processor';
import { COLA_RECORDATORIOS, RecordatoriosService } from './recordatorios.service';

@Module({
  imports: [BullModule.registerQueue({ name: COLA_RECORDATORIOS })],
  controllers: [DispositivosController],
  providers: [
    EmailProveedor,
    SmsProveedor,
    WhatsappProveedor,
    PushProveedor,
    ConfirmacionTokenService,
    RecordatoriosService,
    RecordatoriosProcessor,
  ],
  exports: [EmailProveedor, PushProveedor, ConfirmacionTokenService, RecordatoriosService],
})
export class NotificacionesModule {}
