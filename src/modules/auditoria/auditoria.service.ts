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
    filtro: { documento?: string; usuarioId?: string; desde?: string },
    { page, pageSize }: Paginacion,
  ): Promise<Pagina<unknown>> {
    const paciente = filtro.documento
      ? await this.prisma.db.paciente.findFirst({
          where: { documento: filtro.documento },
          select: { id: true },
        })
      : null;
    if (filtro.documento && !paciente) return { items: [], page, pageSize, total: 0 };

    const where = {
      pacienteId: paciente?.id,
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
    const pacienteIds = [...new Set(items.flatMap((item) => (item.pacienteId ? [item.pacienteId] : [])))];
    const pacientes = pacienteIds.length
      ? await this.prisma.db.paciente.findMany({
          where: { id: { in: pacienteIds } },
          select: { id: true, documento: true },
        })
      : [];
    const documentos = new Map(pacientes.map((paciente) => [paciente.id, paciente.documento]));
    return {
      items: items.map((item) => ({
        ...item,
        documento: item.pacienteId ? (documentos.get(item.pacienteId) ?? null) : null,
      })),
      page,
      pageSize,
      total,
    };
  }
}
