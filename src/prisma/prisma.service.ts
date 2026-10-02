import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClienteBase, ClienteClinica, crearClienteBase, crearClienteClinica } from './extensiones';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /**
   * Cliente sin filtro de clínica. Solo para lo que ocurre antes de conocer la clínica
   * (login, restablecer contraseña, tokens de dispositivo) o para recorrer clínicas en jobs.
   */
  readonly sinClinica: ClienteBase = crearClienteBase();

  /** Cliente de negocio: añade `clinicaId` del contexto a cada consulta. */
  readonly db: ClienteClinica = crearClienteClinica(this.sinClinica);

  async onModuleInit(): Promise<void> {
    await this.sinClinica.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.sinClinica.$disconnect();
  }
}
