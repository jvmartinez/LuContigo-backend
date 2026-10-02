import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Usuario } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Configuracion } from '../../config/config.service';
import { ErrorDominio } from '../../common/errores/error-dominio';
import type { PayloadAcceso, UsuarioSesion } from '../../common/sesion';
import { PrismaService } from '../../prisma/prisma.service';
import { CredencialesService, sha256 } from './credenciales.service';

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Segundos de vida del access token. */
  expiraEn: number;
}

const credencialesInvalidas = () =>
  new ErrorDominio('NO_AUTENTICADO', 'Email o contraseña incorrectos.');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: Configuracion,
    private readonly credenciales: CredencialesService,
  ) {}

  async login(email: string, password: string): Promise<Tokens> {
    const usuario = await this.prisma.sinClinica.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.passwordHash) {
      await this.credenciales.verificarFicticio(password);
      throw credencialesInvalidas();
    }
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      throw new ErrorDominio(
        'LIMITE_EXCEDIDO',
        'Cuenta bloqueada temporalmente por intentos fallidos. Intenta en unos minutos.',
      );
    }

    const valida = await this.credenciales.verificar(usuario.passwordHash, password);
    if (!valida) {
      const intentos = usuario.intentosFallidos + 1;
      await this.prisma.sinClinica.usuario.update({
        where: { id: usuario.id },
        data:
          intentos >= MAX_INTENTOS
            ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) }
            : { intentosFallidos: intentos },
      });
      throw credencialesInvalidas();
    }
    if (!usuario.activo) throw new ErrorDominio('NO_AUTENTICADO', 'Tu cuenta está desactivada.');

    await this.prisma.sinClinica.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
    });
    return this.emitirTokens(usuario);
  }

  /** Rota el refresh token: revoca el usado y emite uno nuevo. */
  async refrescar(refreshToken: string | undefined): Promise<Tokens> {
    const registro = await this.validarRefresh(refreshToken);
    const revocado = await this.prisma.sinClinica.tokenRefresco.updateMany({
      where: { id: registro.id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    // Reutilización de un token ya rotado: posible robo, se revocan todas las sesiones.
    if (revocado.count === 0) {
      await this.revocarTodos(registro.usuarioId);
      throw new ErrorDominio('NO_AUTENTICADO', 'La sesión expiró. Inicia sesión de nuevo.');
    }
    const usuario = await this.prisma.sinClinica.usuario.findUniqueOrThrow({
      where: { id: registro.usuarioId },
    });
    if (!usuario.activo) throw new ErrorDominio('NO_AUTENTICADO', 'Tu cuenta está desactivada.');
    return this.emitirTokens(usuario);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.sinClinica.tokenRefresco.updateMany({
      where: { hash: sha256(refreshToken), revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  /** Siempre responde igual, exista o no el email. */
  async olvideContrasena(email: string): Promise<void> {
    const usuario = await this.prisma.sinClinica.usuario.findUnique({ where: { email } });
    if (usuario?.activo) await this.credenciales.enviarRestablecimiento(usuario);
  }

  async restablecerContrasena(token: string, password: string): Promise<void> {
    const registro = await this.prisma.sinClinica.tokenRestablecimiento.findUnique({
      where: { hash: sha256(token) },
    });
    if (!registro || registro.usadoEn || registro.expiraEn < new Date()) {
      throw new ErrorDominio('TOKEN_INVALIDO', 'El enlace no es válido o ya expiró.');
    }
    const passwordHash = await this.credenciales.hash(password);
    await this.prisma.sinClinica.$transaction([
      this.prisma.sinClinica.tokenRestablecimiento.update({
        where: { id: registro.id },
        data: { usadoEn: new Date() },
      }),
      this.prisma.sinClinica.usuario.update({
        where: { id: registro.usuarioId },
        data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
      }),
      this.prisma.sinClinica.tokenRefresco.updateMany({
        where: { usuarioId: registro.usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      }),
    ]);
  }

  async yo(sesion: UsuarioSesion) {
    const usuario = await this.prisma.db.usuario.findUniqueOrThrow({
      where: { id: sesion.usuarioId },
      include: {
        clinica: true,
        personal: { include: { especialidad: true, consultorio: true } },
        paciente: { select: { id: true, nombres: true, apellidos: true, canalPreferido: true } },
      },
    });
    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      clinica: {
        id: usuario.clinica.id,
        nombre: usuario.clinica.nombre,
        zonaHoraria: usuario.clinica.zonaHoraria,
        pais: usuario.clinica.pais,
      },
      personal: usuario.personal && {
        id: usuario.personal.id,
        nombre: usuario.personal.nombre,
        especialidad: usuario.personal.especialidad?.nombre ?? null,
        consultorio: usuario.personal.consultorio?.nombre ?? null,
      },
      paciente: usuario.paciente,
    };
  }

  private async validarRefresh(token: string | undefined) {
    if (!token) throw new ErrorDominio('NO_AUTENTICADO', 'Inicia sesión para continuar.');
    try {
      await this.jwt.verifyAsync(token, { secret: this.config.get('JWT_REFRESH_SECRET') });
    } catch {
      throw new ErrorDominio('NO_AUTENTICADO', 'La sesión expiró. Inicia sesión de nuevo.');
    }
    const registro = await this.prisma.sinClinica.tokenRefresco.findUnique({
      where: { hash: sha256(token) },
    });
    if (!registro || registro.expiraEn < new Date()) {
      throw new ErrorDominio('NO_AUTENTICADO', 'La sesión expiró. Inicia sesión de nuevo.');
    }
    return registro;
  }

  private async revocarTodos(usuarioId: string): Promise<void> {
    await this.prisma.sinClinica.tokenRefresco.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  private async emitirTokens(usuario: Usuario): Promise<Tokens> {
    const [clinica, personal, paciente] = await Promise.all([
      this.prisma.sinClinica.clinica.findUniqueOrThrow({ where: { id: usuario.clinicaId } }),
      this.prisma.sinClinica.personal.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      }),
      this.prisma.sinClinica.paciente.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      }),
    ]);

    const payload: PayloadAcceso = {
      sub: usuario.id,
      cli: usuario.clinicaId,
      rol: usuario.rol,
      tz: clinica.zonaHoraria,
      ...(personal && { per: personal.id }),
      ...(paciente && { pac: paciente.id }),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL'),
    });

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: usuario.id },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_TTL'),
        jwtid: jti,
      },
    );
    const { exp } = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.sinClinica.tokenRefresco.create({
      data: { usuarioId: usuario.id, hash: sha256(refreshToken), expiraEn: new Date(exp * 1000) },
    });

    const { exp: expAcceso, iat } = this.jwt.decode(accessToken) as { exp: number; iat: number };
    return { accessToken, refreshToken, expiraEn: expAcceso - iat };
  }
}
