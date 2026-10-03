import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Configuracion } from '../../config/config.service';
import { Publico, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Cuerpo, DocCuerpo } from '../../common/zod/zod';
import {
  LoginEntrada,
  OlvideContrasenaEntrada,
  RefreshEntrada,
  RestablecerContrasenaEntrada,
} from '../../shared/auth';
import { AuthService, Tokens } from './auth.service';

export const COOKIE_REFRESH = 'mc_refresh';
const LIMITE_AUTH = { default: { limit: 10, ttl: 60_000 } };

/**
 * La web recibe el refresh token en cookie httpOnly; la app móvil lo recibe en el cuerpo
 * y lo guarda en almacenamiento seguro. La app se identifica con `X-Cliente: mobile`.
 */
const esMovil = (req: Request) => req.header('x-cliente')?.toLowerCase() === 'mobile';

@ApiTags('Autenticación')
@Controller('auth')
@Throttle(LIMITE_AUTH)
@ApiHeader({
  name: 'X-Cliente',
  required: false,
  description: '"mobile" para recibir el refresh token en el cuerpo',
})
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: Configuracion,
  ) {}

  @Post('login')
  @Publico()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicia sesión con email y contraseña',
    description:
      'Devuelve el access token y su vencimiento. En web, el refresh token se guarda en una cookie httpOnly; ' +
      'con `X-Cliente: mobile`, ambos tokens se devuelven en el cuerpo.',
  })
  @DocCuerpo(LoginEntrada, { email: 'recepcion@demo.medicita.app', password: 'Demo2026medicita' })
  async login(
    @Cuerpo(LoginEntrada) e: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responder(await this.auth.login(e.email, e.password), req, res);
  }

  @Post('refresh')
  @Publico()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renueva los tokens de acceso',
    description:
      'Rota el refresh token. La web lo envía mediante cookie; la app móvil debe enviarlo en `refreshToken`.',
  })
  @DocCuerpo(RefreshEntrada)
  async refresh(
    @Cuerpo(RefreshEntrada) e: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.refrescar(e.refreshToken ?? req.cookies?.[COOKIE_REFRESH]);
    return this.responder(tokens, req, res);
  }

  @Post('logout')
  @Publico()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cierra sesión y revoca el refresh token',
    description: 'La web usa la cookie de refresh; la app móvil envía `refreshToken` en el cuerpo.',
  })
  @DocCuerpo(RefreshEntrada)
  async logout(
    @Cuerpo(RefreshEntrada) e: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(e.refreshToken ?? req.cookies?.[COOKIE_REFRESH]);
    res.clearCookie(COOKIE_REFRESH, this.opcionesCookie());
  }

  @Post('olvide-contrasena')
  @Publico()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Envía enlace de restablecimiento (responde igual si el email no existe)',
  })
  @DocCuerpo(OlvideContrasenaEntrada)
  olvide(@Cuerpo(OlvideContrasenaEntrada) e: { email: string }): Promise<void> {
    return this.auth.olvideContrasena(e.email);
  }

  @Post('restablecer-contrasena')
  @Publico()
  @HttpCode(204)
  @ApiOperation({ summary: 'Cambia la contraseña con el token del enlace' })
  @DocCuerpo(RestablecerContrasenaEntrada)
  restablecer(
    @Cuerpo(RestablecerContrasenaEntrada) e: { token: string; password: string },
  ): Promise<void> {
    return this.auth.restablecerContrasena(e.token, e.password);
  }

  @Get('yo')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario actual, rol y clínica' })
  yo(@UsuarioActual() u: UsuarioSesion) {
    return this.auth.yo(u);
  }

  private responder(tokens: Tokens, req: Request, res: Response) {
    if (esMovil(req)) return tokens;
    res.cookie(COOKIE_REFRESH, tokens.refreshToken, this.opcionesCookie());
    return { accessToken: tokens.accessToken, expiraEn: tokens.expiraEn };
  }

  private opcionesCookie(): CookieOptions {
    return { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth' };
  }
}
