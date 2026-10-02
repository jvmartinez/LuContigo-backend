import { Injectable } from '@nestjs/common';
import { Configuracion } from '../../../config/config.service';

/**
 * WhatsApp Business Cloud API. Fuera de la ventana de 24 h Meta solo permite plantillas
 * aprobadas, así que el recordatorio va como plantilla (`WHATSAPP_TEMPLATE`) con los
 * parámetros en el orden de `parametros`.
 */
@Injectable()
export class WhatsappProveedor {
  constructor(private readonly config: Configuracion) {}

  get disponible(): boolean {
    return Boolean(this.config.get('WHATSAPP_TOKEN') && this.config.get('WHATSAPP_PHONE_ID'));
  }

  async enviarPlantilla(telefono: string, parametros: string[]): Promise<void> {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${this.config.get('WHATSAPP_PHONE_ID')}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get('WHATSAPP_TOKEN')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefono.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: this.config.get('WHATSAPP_TEMPLATE'),
            language: { code: 'es' },
            components: [
              { type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) },
            ],
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`WhatsApp respondió ${res.status}`);
  }
}
