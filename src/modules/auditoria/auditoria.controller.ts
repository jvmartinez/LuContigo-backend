import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Consulta, DocConsulta } from '../../common/zod/zod';
import { AuditoriaConsulta } from '../../shared/clinica';
import { Paginacion } from '../../shared/comun';
import { AuditoriaService } from './auditoria.service';

const FiltroAuditoria = AuditoriaConsulta.merge(Paginacion);

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Bitácora de accesos al expediente (RF-20)' })
  @DocConsulta(FiltroAuditoria)
  listar(@Consulta(FiltroAuditoria) q: ReturnType<typeof FiltroAuditoria.parse>) {
    const { page, pageSize, ...filtro } = q;
    return this.auditoria.listar(filtro, { page, pageSize });
  }
}
