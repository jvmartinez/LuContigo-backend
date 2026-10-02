import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfiguracionModule } from './config/config.module';
import { Configuracion } from './config/config.service';
import { FiltroErrores } from './common/filters/filtro-errores';
import { ClinicaGuard } from './common/guards/clinica.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LimiteGuard } from './common/guards/limite.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditoriaInterceptor } from './common/interceptors/auditoria.interceptor';
import { ContextoClinica } from './common/tenancy/contexto-clinica';
import { PrismaModule } from './prisma/prisma.module';
import { AsignacionesModule } from './modules/asignaciones/asignaciones.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { CitasModule } from './modules/citas/citas.module';
import { ClinicasModule } from './modules/clinicas/clinicas.module';
import { ConsultasModule } from './modules/consultas/consultas.module';
import { EnfermeriaModule } from './modules/enfermeria/enfermeria.module';
import { IndicadoresModule } from './modules/indicadores/indicadores.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { PacientesModule } from './modules/pacientes/pacientes.module';
import { PersonalModule } from './modules/personal/personal.module';

/** Opciones de ioredis a partir de `REDIS_URL` (redis:// o rediss://). */
function conexionRedis(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: decodeURIComponent(u.password) || undefined,
    db: Number(u.pathname.slice(1) || 0),
    ...(u.protocol === 'rediss:' && { tls: {} }),
  };
}

@Module({
  imports: [
    ConfiguracionModule,
    PrismaModule,
    JwtModule.register({ global: true }),
    // §10: 100 peticiones por minuto por usuario (auth y confirmaciones bajan a 10).
    // En memoria: con varias réplicas conviene un storage en Redis.
    ThrottlerModule.forRootAsync({
      inject: [Configuracion],
      useFactory: (config: Configuracion) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        skipIf: () => config.get('NODE_ENV') === 'test',
      }),
    }),
    BullModule.forRootAsync({
      inject: [Configuracion],
      useFactory: (config: Configuracion) => ({
        connection: conexionRedis(config.get('REDIS_URL')),
        prefix: 'medicita',
      }),
    }),
    AuditoriaModule,
    AuthModule,
    NotificacionesModule,
    ClinicasModule,
    PersonalModule,
    AsignacionesModule,
    PacientesModule,
    CitasModule,
    EnfermeriaModule,
    ConsultasModule,
    IndicadoresModule,
  ],
  providers: [
    // El orden importa: autenticar → fijar clínica → rol → límite por usuario.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ClinicaGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: LimiteGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
    { provide: APP_FILTER, useClass: FiltroErrores },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Abre el contexto de clínica de cada petición; ClinicaGuard lo completa.
    consumer
      .apply((_req: unknown, _res: unknown, next: () => void) => ContextoClinica.iniciar(next))
      .forRoutes('*');
  }
}
