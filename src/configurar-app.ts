import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Configuracion } from './config/config.service';

/** Configuración HTTP común a `main.ts` y a las pruebas de integración. */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get(Configuracion);

  app.setGlobalPrefix('api/v1');
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });
  app.enableShutdownHooks();

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('MediCita API')
      .setDescription(
        'API REST multi-clínica de MediCita. Errores con formato `{ error: { codigo, mensaje, detalles } }`. ' +
          'Fechas en ISO 8601 con zona; paginación con `page` y `pageSize` (máx. 100).',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento, { jsonDocumentUrl: 'api/docs/openapi.json' });
}
