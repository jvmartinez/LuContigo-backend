import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from './configuracion';
import { Configuracion } from './config.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validarEntorno })],
  providers: [Configuracion],
  exports: [Configuracion],
})
export class ConfiguracionModule {}
