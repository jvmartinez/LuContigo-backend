import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import { ContextoClinica } from '../../common/tenancy/contexto-clinica';
import { PrismaService } from '../../prisma/prisma.service';
import { CitasService } from './citas.service';

export const COLA_MANTENIMIENTO = 'mantenimiento';
const HORA_CIERRE = 23;

/**
 * §9.7: a las 23:00 de cada clínica, las citas PROGRAMADA o CONFIRMADA ya vencidas pasan a
 * NO_ASISTIO. El job corre cada hora y actúa sobre las clínicas donde son las 23 h, así
 * respeta la zona horaria de cada una.
 */
@Processor(COLA_MANTENIMIENTO)
export class NoAsistenciaProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(NoAsistenciaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly citas: CitasService,
    @InjectQueue(COLA_MANTENIMIENTO) private readonly cola: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.cola.upsertJobScheduler(
      'no-asistencia',
      { pattern: '0 * * * *' },
      { name: 'no-asistencia' },
    );
  }

  async process(): Promise<void> {
    const clinicas = await this.prisma.sinClinica.clinica.findMany({
      select: { id: true, zonaHoraria: true },
    });
    for (const clinica of clinicas) {
      if (DateTime.now().setZone(clinica.zonaHoraria).hour !== HORA_CIERRE) continue;
      const marcadas = await ContextoClinica.ejecutarEn(clinica.id, () =>
        this.marcarVencidas(clinica.zonaHoraria),
      );
      if (marcadas) this.logger.log(`Clínica ${clinica.id}: ${marcadas} citas marcadas NO_ASISTIO`);
    }
  }

  async marcarVencidas(zonaHoraria: string): Promise<number> {
    const vencidas = await this.prisma.db.cita.findMany({
      where: { estado: { in: ['PROGRAMADA', 'CONFIRMADA'] }, fin: { lt: new Date() } },
      select: { id: true },
    });
    let marcadas = 0;
    for (const { id } of vencidas) {
      try {
        await this.citas.transicionar(id, 'noAsistio', {
          rol: 'SISTEMA',
          usuarioId: null,
          zonaHoraria,
        });
        marcadas++;
      } catch (e) {
        // Otra persona la movió de estado entre la consulta y la transición: se ignora.
        this.logger.warn(`Cita ${id} no se marcó: ${(e as Error).message}`);
      }
    }
    return marcadas;
  }
}
