import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Entorno } from './configuracion';

/** Acceso tipado a la configuración ya validada. */
@Injectable()
export class Configuracion {
  constructor(private readonly config: ConfigService<Entorno, true>) {}

  get<K extends keyof Entorno>(clave: K): Entorno[K] {
    return this.config.get(clave, { infer: true });
  }

  get esProduccion(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
