import { Injectable, Logger } from '@nestjs/common';
import { Configuracion } from '../../../config/config.service';

/** SMS vía Twilio (API REST). `consola` simula el envío en desarrollo. */
@Injectable()
export class SmsProveedor {
  private readonly logger = new Logger(SmsProveedor.name);

  constructor(private readonly config: Configuracion) {}

  get disponible(): boolean {
    return (
      this.config.get('SMS_PROVIDER') === 'consola' ||
      Boolean(this.config.get('TWILIO_ACCOUNT_SID') && this.config.get('TWILIO_AUTH_TOKEN'))
    );
  }

  async enviar(telefono: string, texto: string): Promise<void> {
    if (this.config.get('SMS_PROVIDER') === 'consola') {
      this.logger.log('[sms simulado]');
      if (this.config.get('NODE_ENV') === 'development') this.logger.debug(texto);
      return;
    }
    const sid = this.config.get('TWILIO_ACCOUNT_SID') as string;
    const token = this.config.get('TWILIO_AUTH_TOKEN') as string;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: telefono,
        From: this.config.get('TWILIO_FROM') ?? '',
        Body: texto,
      }),
    });
    if (!res.ok) throw new Error(`Twilio respondió ${res.status}`);
  }
}
