import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { clinicaActual } from '../../common/tenancy/contexto-clinica';
import { PrismaService } from '../../prisma/prisma.service';

export const COLA_RECORDATORIOS = 'recordatorios';
const VEINTICUATRO_HORAS = 24 * 60 * 60 * 1000;

export interface JobRecordatorio {
  citaId: string;
  clinicaId: string;
}

const idJob = (citaId: string) => `recordatorio-${citaId}`;

/** Programación de recordatorios (§9.1–9.2). */
@Injectable()
export class RecordatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(COLA_RECORDATORIOS) private readonly cola: Queue<JobRecordatorio>,
  ) {}

  /**
   * Programa (o reprograma) el recordatorio para `inicio − 24 h`; si la cita es en menos
   * de 24 h se envía ya. Devuelve la hora programada.
   */
  async programar(cita: { id: string; inicio: Date }): Promise<Date> {
    const clinicaId = clinicaActual();
    const programadoPara = new Date(
      Math.max(Date.now(), cita.inicio.getTime() - VEINTICUATRO_HORAS),
    );

    await this.prisma.db.recordatorio.upsert({
      where: { citaId: cita.id },
      create: { clinicaId, citaId: cita.id, programadoPara },
      update: { programadoPara, estado: 'PROGRAMADO', enviadoEn: null, error: null, canal: null },
    });

    await this.quitarJob(cita.id);
    await this.cola.add(
      'enviar',
      { citaId: cita.id, clinicaId },
      {
        jobId: idJob(cita.id),
        delay: Math.max(0, programadoPara.getTime() - Date.now()),
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
    return programadoPara;
  }

  /** Al cancelar: elimina el job pendiente y marca el recordatorio como cancelado. */
  async cancelar(citaId: string): Promise<void> {
    await this.quitarJob(citaId);
    await this.prisma.db.recordatorio.updateMany({
      where: { citaId, estado: 'PROGRAMADO' },
      data: { estado: 'CANCELADO' },
    });
  }

  private async quitarJob(citaId: string): Promise<void> {
    const job = await this.cola.getJob(idJob(citaId));
    if (job && !(await job.isActive())) await job.remove();
  }
}
