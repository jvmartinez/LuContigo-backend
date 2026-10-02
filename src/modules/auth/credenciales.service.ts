import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Configuracion } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailProveedor } from '../notificaciones/proveedores/email.proveedor';

const UNA_HORA = 60 * 60 * 1000;

export const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

/** Contraseñas (Argon2id) y enlaces de un solo uso para crear o restablecer contraseña. */
@Injectable()
export class CredencialesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProveedor,
    private readonly config: Configuracion,
  ) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verificar(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  private hashFicticio?: Promise<string>;

  /** Iguala el tiempo de respuesta cuando el email no existe (evita enumerar cuentas). */
  async verificarFicticio(password: string): Promise<void> {
    this.hashFicticio ??= this.hash(randomBytes(16).toString('hex'));
    await argon2.verify(await this.hashFicticio, password);
  }

  /** Crea un token de restablecimiento y devuelve el valor en claro (solo se guarda el hash). */
  async crearTokenRestablecimiento(usuarioId: string, validezMs: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.sinClinica.tokenRestablecimiento.create({
      data: { usuarioId, hash: sha256(token), expiraEn: new Date(Date.now() + validezMs) },
    });
    return token;
  }

  async enviarRestablecimiento(usuario: { id: string; email: string }): Promise<void> {
    const token = await this.crearTokenRestablecimiento(usuario.id, UNA_HORA);
    await this.email.enviar({
      para: usuario.email,
      asunto: 'Restablece tu contraseña de MediCita',
      texto:
        'Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 1 hora:\n' +
        `${this.config.get('APP_WEB_URL')}/restablecer-contrasena?token=${token}\n\n` +
        'Si no fuiste tú, ignora este mensaje.',
    });
  }

  /** Invitación para personal o pacientes con portal: define su contraseña (válida 72 h). */
  async enviarInvitacion(usuario: { id: string; email: string }, clinica: string): Promise<void> {
    const token = await this.crearTokenRestablecimiento(usuario.id, 72 * UNA_HORA);
    await this.email.enviar({
      para: usuario.email,
      asunto: `Tu acceso a MediCita · ${clinica}`,
      texto:
        `${clinica} te dio acceso a MediCita. Crea tu contraseña aquí (el enlace vence en 72 horas):\n` +
        `${this.config.get('APP_WEB_URL')}/restablecer-contrasena?token=${token}`,
    });
  }
}
