import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Configuracion } from './config/config.service';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  configurarApp(app);

  const config = app.get(Configuracion);
  await app.listen(config.get('PORT'));
  const logger = new Logger('MediCita');
  logger.log(`API en http://localhost:${config.get('PORT')}/api/v1`);
  logger.log(`Docs en http://localhost:${config.get('PORT')}/api/docs`);
}

void bootstrap();
