import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { Publico } from '../../common/decorators';
import { ErrorDominio } from '../../common/errores/error-dominio';
import { ContextoClinica } from '../../common/tenancy/contexto-clinica';
import { Cuerpo, DocCuerpo } from '../../common/zod/zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmacionAccionEntrada } from '../../shared/citas';
import { ConfirmacionTokenService } from '../notificaciones/confirmacion-token.service';
import { CitasService } from './citas.service';

const enlaceUsado = () => new ErrorDominio('TOKEN_INVALIDO', 'Este enlace ya fue usado.');

/**
 * Enlace público del recordatorio (§9.4). El token firmado identifica la cita y la clínica;
 * es de un solo uso: al confirmar o cancelar se guarda su `jti`.
 */
@ApiTags('Confirmaciones')
@Controller('confirmaciones')
@Publico()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class ConfirmacionesController {
  constructor(
    private readonly tokens: ConfirmacionTokenService,
    private readonly prisma: PrismaService,
    private readonly citas: CitasService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Muestra la cita del enlace del recordatorio' })
  async ver(@Param('token') token: string) {
    const { citaId, clinicaId, jti } = this.tokens.verificar(token);
    if (await this.prisma.sinClinica.tokenConfirmacionUsado.findUnique({ where: { jti } }))
      throw enlaceUsado();

    return ContextoClinica.ejecutarEn(clinicaId, async () => {
      const cita = await this.prisma.db.cita.findUnique({
        where: { id: citaId },
        include: {
          clinica: true,
          paciente: { select: { nombres: true } },
          medico: { select: { nombre: true, especialidad: { select: { nombre: true } } } },
          consultorio: { select: { nombre: true } },
        },
      });
      if (!cita) throw new ErrorDominio('TOKEN_INVALIDO', 'La cita ya no existe.');
      return {
        cita: {
          id: cita.id,
          estado: cita.estado,
          inicio: cita.inicio.toISOString(),
          fin: cita.fin.toISOString(),
          paciente: cita.paciente.nombres,
          medico: cita.medico.nombre,
          especialidad: cita.medico.especialidad?.nombre ?? null,
          consultorio: cita.consultorio.nombre,
          clinica: {
            nombre: cita.clinica.nombre,
            direccion: cita.clinica.direccion,
            telefono: cita.clinica.telefono,
            zonaHoraria: cita.clinica.zonaHoraria,
          },
        },
        accionesDisponibles:
          cita.estado === 'PROGRAMADA'
            ? ['confirmar', 'cancelar']
            : cita.estado === 'CONFIRMADA'
              ? ['cancelar']
              : [],
      };
    });
  }

  @Post(':token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirma o cancela la cita desde el enlace (un solo uso)' })
  @DocCuerpo(ConfirmacionAccionEntrada, { accion: 'confirmar' })
  async actuar(
    @Param('token') token: string,
    @Cuerpo(ConfirmacionAccionEntrada) e: { accion: 'confirmar' | 'cancelar' },
  ) {
    const { citaId, clinicaId, jti } = this.tokens.verificar(token);

    return ContextoClinica.ejecutarEn(clinicaId, async () => {
      const cita = await this.prisma.db.cita.findUnique({
        where: { id: citaId },
        include: { clinica: { select: { zonaHoraria: true } } },
      });
      if (!cita) throw new ErrorDominio('TOKEN_INVALIDO', 'La cita ya no existe.');

      // Quien tiene el enlace actúa como el paciente dueño de la cita.
      const actor = {
        rol: 'PACIENTE' as const,
        usuarioId: null,
        pacienteId: cita.pacienteId,
        zonaHoraria: cita.clinica.zonaHoraria,
      };
      try {
        const { cita: actualizada } = await this.citas.transicionar(citaId, e.accion, actor, {
          data:
            e.accion === 'cancelar'
              ? { motivoCancelacion: 'Cancelada desde el recordatorio' }
              : undefined,
          enTx: async (tx) => {
            await tx.tokenConfirmacionUsado.create({ data: { jti, citaId } });
          },
        });
        return { estado: actualizada.estado, inicio: actualizada.inicio };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          throw enlaceUsado();
        throw err;
      }
    });
  }
}
