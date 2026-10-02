import { Injectable, Logger } from '@nestjs/common';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Configuracion } from '../../../config/config.service';
import { PrismaService } from '../../../prisma/prisma.service';

const CODIGOS_TOKEN_INVALIDO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface MensajePush {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>;
}

/** Push con Firebase Cloud Messaging (Android directo, iOS vía APNs). */
@Injectable()
export class PushProveedor {
  private readonly logger = new Logger(PushProveedor.name);
  private app?: App;

  constructor(
    private readonly config: Configuracion,
    private readonly prisma: PrismaService,
  ) {}

  get disponible(): boolean {
    return Boolean(this.config.get('FIREBASE_SERVICE_ACCOUNT_JSON'));
  }

  private firebase(): App {
    if (!this.app) {
      const credencial = JSON.parse(
        Buffer.from(this.config.get('FIREBASE_SERVICE_ACCOUNT_JSON') as string, 'base64').toString(
          'utf8',
        ),
      );
      this.app = initializeApp(
        { credential: cert(credencial), projectId: this.config.get('FIREBASE_PROJECT_ID') },
        'medicita',
      );
    }
    return this.app;
  }

  /**
   * Envía a todos los dispositivos del usuario. Borra los tokens que FCM reporta inválidos.
   * Devuelve cuántos dispositivos lo recibieron.
   */
  async enviarAUsuario(usuarioId: string, mensaje: MensajePush): Promise<number> {
    const dispositivos = await this.prisma.sinClinica.dispositivoPush.findMany({
      where: { usuarioId },
    });
    if (!dispositivos.length) return 0;

    const respuesta = await getMessaging(this.firebase()).sendEachForMulticast({
      tokens: dispositivos.map((d) => d.token),
      notification: { title: mensaje.titulo, body: mensaje.cuerpo },
      data: mensaje.datos,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    const invalidos = respuesta.responses
      .map((r, i) =>
        !r.success && CODIGOS_TOKEN_INVALIDO.has(r.error?.code ?? '')
          ? dispositivos[i].token
          : null,
      )
      .filter((t): t is string => t !== null);
    if (invalidos.length) {
      await this.prisma.sinClinica.dispositivoPush.deleteMany({
        where: { token: { in: invalidos } },
      });
      this.logger.log(`Se eliminaron ${invalidos.length} tokens push inválidos`);
    }
    return respuesta.successCount;
  }
}
