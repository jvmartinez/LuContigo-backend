import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { ContextoClinica } from '../../common/tenancy/contexto-clinica';
import { PrismaService } from '../../prisma/prisma.service';
import type { CanalRecordatorio } from '../../shared/enums';
import { elegirCanales } from './canal';
import { ConfirmacionTokenService } from './confirmacion-token.service';
import { piezasRecordatorio, textoRecordatorio } from './plantillas';
import { EmailProveedor } from './proveedores/email.proveedor';
import { PushProveedor } from './proveedores/push.proveedor';
import { SmsProveedor } from './proveedores/sms.proveedor';
import { WhatsappProveedor } from './proveedores/whatsapp.proveedor';
import { COLA_RECORDATORIOS, JobRecordatorio } from './recordatorios.service';

/**
 * Envía el recordatorio de una cita (§9). Los logs solo llevan ids, nunca datos de
 * contacto ni del motivo de la cita.
 */
@Processor(COLA_RECORDATORIOS)
export class RecordatoriosProcessor extends WorkerHost {
  private readonly logger = new Logger(RecordatoriosProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: ConfirmacionTokenService,
    private readonly email: EmailProveedor,
    private readonly sms: SmsProveedor,
    private readonly whatsapp: WhatsappProveedor,
    private readonly push: PushProveedor,
  ) {
    super();
  }

  process(job: Job<JobRecordatorio>): Promise<void> {
    return ContextoClinica.ejecutarEn(job.data.clinicaId, () => this.enviar(job.data.citaId));
  }

  private async enviar(citaId: string): Promise<void> {
    const cita = await this.prisma.db.cita.findUnique({
      where: { id: citaId },
      include: {
        clinica: true,
        paciente: {
          include: { usuario: { include: { _count: { select: { dispositivos: true } } } } },
        },
        medico: { include: { especialidad: true } },
      },
    });
    if (!cita) return;

    // §9.3: solo si la cita sigue vigente.
    if (cita.estado !== 'PROGRAMADA' && cita.estado !== 'CONFIRMADA') {
      await this.marcar(citaId, { estado: 'OMITIDO' });
      return;
    }

    const { paciente } = cita;
    const canales = elegirCanales(
      {
        canalPreferido: paciente.canalPreferido,
        tieneApp: (paciente.usuario?._count.dispositivos ?? 0) > 0,
        telefono: paciente.telefono,
        email: paciente.email ?? null,
      },
      {
        push: this.push.disponible,
        whatsapp: this.whatsapp.disponible,
        sms: this.sms.disponible,
        email: true,
      },
    );
    if (!canales.length) {
      await this.marcar(citaId, {
        estado: 'FALLIDO',
        error: 'El paciente no tiene un canal de contacto',
      });
      throw new UnrecoverableError('Sin canal de contacto');
    }

    const datos = {
      citaId,
      nombre: paciente.nombres.split(' ')[0],
      medico: cita.medico.nombre,
      especialidad: cita.medico.especialidad?.nombre ?? 'Consulta',
      clinica: cita.clinica.nombre,
      inicio: cita.inicio,
      zonaHoraria: cita.clinica.zonaHoraria,
      enlace: this.tokens.enlace(this.tokens.firmar(cita)),
    };

    const errores: string[] = [];
    for (const canal of canales) {
      try {
        await this.enviarPor(canal, datos, paciente);
        await this.marcar(citaId, { estado: 'ENVIADO', canal, enviadoEn: new Date(), error: null });
        this.logger.log(`Recordatorio ${citaId} enviado por ${canal}`);
        return;
      } catch (e) {
        errores.push(`${canal}: ${(e as Error).message}`);
      }
    }
    await this.marcar(citaId, { error: errores.join(' | ').slice(0, 500) });
    throw new Error(`No se pudo enviar el recordatorio ${citaId}`);
  }

  private async enviarPor(
    canal: CanalRecordatorio,
    datos: Parameters<typeof textoRecordatorio>[0] & { citaId: string },
    paciente: { telefono: string | null; email: string | null; usuarioId: string | null },
  ): Promise<void> {
    const texto = textoRecordatorio(datos);
    switch (canal) {
      case 'PUSH': {
        const entregados = await this.push.enviarAUsuario(paciente.usuarioId as string, {
          titulo: 'Recordatorio de cita',
          cuerpo: texto.split('\n')[0],
          datos: { tipo: 'RECORDATORIO_CITA', citaId: datos.citaId, enlace: datos.enlace },
        });
        if (!entregados) throw new Error('ningún dispositivo lo recibió');
        return;
      }
      case 'WHATSAPP':
        return this.whatsapp.enviarPlantilla(
          paciente.telefono as string,
          Object.values(piezasRecordatorio(datos)),
        );
      case 'SMS':
        return this.sms.enviar(paciente.telefono as string, texto);
      case 'EMAIL':
        return this.email.enviar({
          para: paciente.email as string,
          asunto: 'Recordatorio de tu cita',
          texto,
        });
    }
  }

  private marcar(
    citaId: string,
    data: {
      estado?: 'ENVIADO' | 'FALLIDO' | 'OMITIDO';
      canal?: CanalRecordatorio;
      enviadoEn?: Date;
      error?: string | null;
    },
  ) {
    return this.prisma.db.recordatorio.update({ where: { citaId }, data });
  }

  /** §9.6: agotados los reintentos, queda FALLIDO para que recepción llame. */
  @OnWorkerEvent('failed')
  async alFallar(job: Job<JobRecordatorio> | undefined): Promise<void> {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    await ContextoClinica.ejecutarEn(job.data.clinicaId, () =>
      this.prisma.db.recordatorio.updateMany({
        where: { citaId: job.data.citaId, estado: 'PROGRAMADO' },
        data: { estado: 'FALLIDO' },
      }),
    );
    this.logger.warn(`Recordatorio ${job.data.citaId} FALLIDO tras ${job.attemptsMade} intentos`);
  }
}
