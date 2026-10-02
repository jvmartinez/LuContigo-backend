import { Injectable } from '@nestjs/common';
import { diasEntre, rangoDias } from '../../common/tiempo';
import { validacion } from '../../common/errores/error-dominio';
import { PrismaService } from '../../prisma/prisma.service';
import type { EstadoCita } from '../../shared/enums';
import { bloquesEnRango, minutosDisponibles } from '../citas/agenda';

const MAX_DIAS = 366;
const tasa = (parte: number, total: number) =>
  total ? Math.round((parte / total) * 1000) / 10 : 0;

/** Panel de la clínica (RF-18). Solo agregados: nunca datos de pacientes. */
@Injectable()
export class IndicadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(desde: string, hasta: string, zona: string) {
    if (diasEntre(desde, hasta) >= MAX_DIAS) throw validacion('El rango máximo es de un año');
    const rango = rangoDias(desde, hasta, zona);
    const enRango = { inicio: { gte: rango.desde, lt: rango.hasta } };

    const [porEstado, medicos, citasActivas] = await Promise.all([
      this.prisma.db.cita.groupBy({ by: ['estado'], where: enRango, _count: { _all: true } }),
      this.prisma.db.personal.findMany({
        where: { usuario: { rol: 'MEDICO' } },
        include: {
          horarios: true,
          ausencias: { where: { desde: { lt: rango.hasta }, hasta: { gt: rango.desde } } },
        },
      }),
      this.prisma.db.cita.findMany({
        where: { ...enRango, estado: { notIn: ['CANCELADA', 'NO_ASISTIO'] } },
        select: { medicoId: true, inicio: true, fin: true },
      }),
    ]);

    const conteo = Object.fromEntries(porEstado.map((g) => [g.estado, g._count._all])) as Partial<
      Record<EstadoCita, number>
    >;
    const total = porEstado.reduce((s, g) => s + g._count._all, 0);
    const atendidas = conteo.ATENDIDA ?? 0;
    const noAsistio = conteo.NO_ASISTIO ?? 0;
    const canceladas = conteo.CANCELADA ?? 0;

    const ocupadosPorMedico = new Map<string, number>();
    for (const c of citasActivas) {
      const min = (c.fin.getTime() - c.inicio.getTime()) / 60_000;
      ocupadosPorMedico.set(c.medicoId, (ocupadosPorMedico.get(c.medicoId) ?? 0) + min);
    }

    return {
      desde,
      hasta,
      citas: total,
      porEstado: conteo,
      atendidas,
      cancelaciones: canceladas,
      noAsistio,
      tasaInasistencia: tasa(noAsistio, atendidas + noAsistio),
      tasaCancelacion: tasa(canceladas, total),
      ocupacionPorMedico: medicos
        .map((m) => {
          const disponibles = minutosDisponibles(
            bloquesEnRango(desde, hasta, zona, m.horarios),
            m.ausencias.map((a) => ({ inicio: a.desde, fin: a.hasta })),
          );
          const ocupados = Math.round(ocupadosPorMedico.get(m.id) ?? 0);
          return {
            medicoId: m.id,
            nombre: m.nombre,
            minutosDisponibles: disponibles,
            minutosAgendados: ocupados,
            ocupacion: tasa(ocupados, disponibles),
          };
        })
        .sort((a, b) => b.ocupacion - a.ocupacion),
    };
  }
}
