import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Configuracion } from '../../config/config.service';
import { ErrorDominio } from '../../common/errores/error-dominio';

export interface PayloadConfirmacion {
  citaId: string;
  clinicaId: string;
  jti: string;
}

/**
 * Enlace firmado del recordatorio (§9.4): JWT con `citaId` que expira a la hora de la
 * cita. El uso único se garantiza guardando el `jti` al consumirlo.
 */
@Injectable()
export class ConfirmacionTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: Configuracion,
  ) {}

  firmar(cita: { id: string; clinicaId: string; inicio: Date }): string {
    const segundos = Math.floor((cita.inicio.getTime() - Date.now()) / 1000);
    return this.jwt.sign(
      { citaId: cita.id, clinicaId: cita.clinicaId },
      {
        secret: this.config.get('CONFIRMACION_TOKEN_SECRET'),
        expiresIn: Math.max(segundos, 60),
        jwtid: randomUUID(),
      },
    );
  }

  enlace(token: string): string {
    return `${this.config.get('APP_WEB_URL')}/c/${token}`;
  }

  verificar(token: string): PayloadConfirmacion {
    try {
      return this.jwt.verify<PayloadConfirmacion>(token, {
        secret: this.config.get('CONFIRMACION_TOKEN_SECRET'),
      });
    } catch {
      throw new ErrorDominio('TOKEN_INVALIDO', 'El enlace no es válido o ya expiró.');
    }
  }
}
