import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Cuerpo, DocCuerpo, DocErrores, DocRespuesta } from '../../common/zod/zod';
import { PrismaService } from '../../prisma/prisma.service';
import { RegistrarDispositivoEntrada } from '../../shared/pacientes';

@ApiTags('Dispositivos')
@ApiBearerAuth()
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  @ApiOperation({ summary: 'Registra el token push (FCM) de la app móvil' })
  @DocCuerpo(RegistrarDispositivoEntrada, { token: 'fcm-token…', plataforma: 'ANDROID' })
  @DocRespuesta(204, 'Dispositivo registrado o reasignado al usuario actual')
  @DocErrores('NO_AUTENTICADO', 'VALIDACION')
  async registrar(
    @UsuarioActual() u: UsuarioSesion,
    @Cuerpo(RegistrarDispositivoEntrada) d: { token: string; plataforma: 'ANDROID' | 'IOS' },
  ): Promise<void> {
    // Un token pertenece a un solo usuario: si cambió de cuenta en el mismo equipo, se reasigna.
    await this.prisma.sinClinica.dispositivoPush.upsert({
      where: { token: d.token },
      create: { usuarioId: u.usuarioId, token: d.token, plataforma: d.plataforma },
      update: { usuarioId: u.usuarioId, plataforma: d.plataforma },
    });
  }

  @Delete(':token')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Elimina un token push del usuario actual',
    description:
      'Alternativa a enviar `dispositivoToken` en `POST /auth/logout`. Solo borra tokens propios; ' +
      'responde 204 aunque el token no exista.',
  })
  @DocRespuesta(204, 'Dispositivo eliminado')
  @DocErrores('NO_AUTENTICADO')
  async eliminar(@UsuarioActual() u: UsuarioSesion, @Param('token') token: string): Promise<void> {
    await this.prisma.sinClinica.dispositivoPush.deleteMany({
      where: { token, usuarioId: u.usuarioId },
    });
  }
}
