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
        'API REST multi-clínica de MediCita. Las rutas protegidas requieren autenticación JWT iniciada ' +
          'en `/auth/login`. La web recibe el refresh token en una cookie httpOnly; para la app móvil, ' +
          'envía `X-Cliente: mobile` y los tokens se devuelven en el cuerpo de la respuesta. ' +
          'Los errores usan `{ error: { codigo, mensaje, detalles } }`. ' +
          'Las fechas y horas se envían en ISO 8601 con zona horaria; las fechas de calendario usan ' +
          '`YYYY-MM-DD`. Las listas paginadas usan `page` (desde 1) y `pageSize` (por defecto 20, máximo 100).',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento, { jsonDocumentUrl: 'api/docs/openapi.json' });
}
