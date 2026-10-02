import type { CanalRecordatorio } from '../../shared/enums';

export interface DatosContacto {
  canalPreferido: CanalRecordatorio | null;
  tieneApp: boolean;
  telefono: string | null;
  email: string | null;
}

export interface CanalesDisponibles {
  push: boolean;
  whatsapp: boolean;
  sms: boolean;
  email: boolean;
}

/**
 * Orden de canales para un recordatorio (§9.5): primero el preferido del paciente si se
 * puede usar; después push si tiene la app, luego WhatsApp o SMS y, por último, email.
 */
export function elegirCanales(
  c: DatosContacto,
  disponibles: CanalesDisponibles,
): CanalRecordatorio[] {
  const usable: Record<CanalRecordatorio, boolean> = {
    PUSH: c.tieneApp && disponibles.push,
    WHATSAPP: Boolean(c.telefono) && disponibles.whatsapp,
    SMS: Boolean(c.telefono) && disponibles.sms,
    EMAIL: Boolean(c.email) && disponibles.email,
  };
  const orden: CanalRecordatorio[] = ['PUSH', 'WHATSAPP', 'SMS', 'EMAIL'];
  const preferido = c.canalPreferido && usable[c.canalPreferido] ? [c.canalPreferido] : [];
  return [...preferido, ...orden.filter((canal) => usable[canal] && canal !== c.canalPreferido)];
}
