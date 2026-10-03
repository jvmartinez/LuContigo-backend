import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Consulta, DocConsulta } from '../../common/zod/zod';
import { AuditoriaConsulta } from '../../shared/clinica';
import { Paginacion } from '../../shared/comun';
import { AuditoriaService } from './auditoria.service';

const FiltroAuditoria = AuditoriaConsulta.merge(Paginacion).strict();

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Bitácora de accesos al expediente (RF-20)' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['items', 'page', 'pageSize', 'total'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'usuarioId', 'accion', 'entidad', 'entidadId', 'pacienteId', 'documento', 'ip', 'fecha'],
            properties: {
              id: { type: 'string' },
              usuarioId: { type: 'string', nullable: true },
              accion: { type: 'string' },
              entidad: { type: 'string' },
              entidadId: { type: 'string', nullable: true },
              pacienteId: { type: 'string', nullable: true },
              documento: {
                type: 'string',
                nullable: true,
                description: 'Número de documento del paciente; null si no hay paciente asociado.',
              },
              ip: { type: 'string', nullable: true },
              fecha: { type: 'string', format: 'date-time' },
            },
          },
        },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        total: { type: 'integer' },
      },
    },
  })
  @DocConsulta(FiltroAuditoria)
  listar(@Consulta(FiltroAuditoria) q: ReturnType<typeof FiltroAuditoria.parse>) {
    const { page, pageSize, ...filtro } = q;
    return this.auditoria.listar(filtro, { page, pageSize });
  }
}
