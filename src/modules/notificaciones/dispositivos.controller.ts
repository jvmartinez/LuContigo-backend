import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Cuerpo, DocCuerpo } from '../../common/zod/zod';
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
  @ApiOperation({ summary: 'Elimina el token push al cerrar sesión' })
  async eliminar(@UsuarioActual() u: UsuarioSesion, @Param('token') token: string): Promise<void> {
    await this.prisma.sinClinica.dispositivoPush.deleteMany({
      where: { token, usuarioId: u.usuarioId },
    });
  }
}
