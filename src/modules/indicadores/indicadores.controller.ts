import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../../common/decorators';
import type { UsuarioSesion } from '../../common/sesion';
import { Consulta, DocConsulta } from '../../common/zod/zod';
import { IndicadoresConsulta } from '../../shared/clinica';
import { IndicadoresService } from './indicadores.service';

@ApiTags('Indicadores')
@ApiBearerAuth()
@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Citas, atendidas, inasistencia, cancelaciones y ocupación por médico' })
  @DocConsulta(IndicadoresConsulta)
  calcular(
    @UsuarioActual() u: UsuarioSesion,
    @Consulta(IndicadoresConsulta) q: { desde: string; hasta: string },
  ) {
    return this.indicadores.calcular(q.desde, q.hasta, u.zonaHoraria);
  }
}
