import { Injectable, Logger } from '@nestjs/common';
import { Configuracion } from '../../../config/config.service';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
}

/**
 * Envío de email. `resend` usa su API REST; `consola` solo deja constancia en el log
 * (sin destinatario ni contenido) para desarrollo. Amazon SES queda como alternativa.
 */
@Injectable()
export class EmailProveedor {
  private readonly logger = new Logger(EmailProveedor.name);

  constructor(private readonly config: Configuracion) {}

  async enviar(correo: Correo): Promise<void> {
    if (this.config.get('EMAIL_PROVIDER') === 'consola') {
      this.logger.log(`[email simulado] asunto="${correo.asunto}"`);
      if (this.config.get('NODE_ENV') === 'development') this.logger.debug(correo.texto);
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get('EMAIL_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get('EMAIL_FROM'),
        to: [correo.para],
        subject: correo.asunto,
        text: correo.texto,
      }),
    });
    if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
  }
}
