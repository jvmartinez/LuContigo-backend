import { Injectable } from '@nestjs/common';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { PrismaService } from '../../prisma/prisma.service';
import type { Pagina, Paginacion } from '../../shared/comun';

export interface EntradaAuditoria {
  usuarioId?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  pacienteId?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inserta en la bitácora. La tabla no admite UPDATE ni DELETE (trigger en BD). */
  async registrar(entrada: EntradaAuditoria): Promise<void> {
    await this.prisma.db.auditoria.create({
      data: {
        clinicaId: clinicaActual(),
        usuarioId: entrada.usuarioId ?? null,
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId ?? null,
        pacienteId: entrada.pacienteId ?? null,
        ip: entrada.ip ?? null,
      },
    });
  }

  async listar(
    filtro: { pacienteId?: string; usuarioId?: string; desde?: string },
    { page, pageSize }: Paginacion,
  ): Promise<Pagina<unknown>> {
    const where = {
      pacienteId: filtro.pacienteId,
      usuarioId: filtro.usuarioId,
      ...(filtro.desde && { fecha: { gte: new Date(filtro.desde) } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.auditoria.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.db.auditoria.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }
}
