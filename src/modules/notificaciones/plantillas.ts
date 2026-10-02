import { DateTime } from 'luxon';

export interface DatosRecordatorio {
  nombre: string;
  medico: string;
  especialidad: string;
  clinica: string;
  inicio: Date;
  zonaHoraria: string;
  enlace: string;
  ahora?: Date;
}

/** Piezas del recordatorio, en el orden de los parámetros de la plantilla de WhatsApp. */
export function piezasRecordatorio(d: DatosRecordatorio) {
  const cita = DateTime.fromJSDate(d.inicio, { zone: d.zonaHoraria }).setLocale('es');
  const hoy = DateTime.fromJSDate(d.ahora ?? new Date(), { zone: d.zonaHoraria }).startOf('day');
  const dias = Math.round(cita.startOf('day').diff(hoy, 'days').days);
  const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : 'el';
  return {
    nombre: d.nombre,
    medico: d.medico,
    especialidad: d.especialidad,
    cuando,
    fecha: cita.toFormat("cccc d 'de' LLLL"),
    hora: cita.toFormat('h:mm a'),
    clinica: d.clinica,
    enlace: d.enlace,
  };
}

/** Plantilla §9: "Hola {nombre}, te recordamos tu cita con {medico} ({especialidad}) mañana…" */
export function textoRecordatorio(d: DatosRecordatorio): string {
  const p = piezasRecordatorio(d);
  return (
    `Hola ${p.nombre}, te recordamos tu cita con ${p.medico} (${p.especialidad}) ` +
    `${p.cuando} ${p.fecha} a las ${p.hora} en ${p.clinica}.\n` +
    `Confirma o cancela aquí: ${p.enlace}`
  );
}
