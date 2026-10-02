import type { SignosVitales } from '@prisma/client';
import { calcularImc } from '../../shared/signos-vitales';

const num = (d: { toNumber(): number } | null) => (d === null ? null : d.toNumber());

export function serializarSignos(s: SignosVitales) {
  const pesoKg = num(s.pesoKg);
  const tallaCm = num(s.tallaCm);
  return {
    id: s.id,
    citaId: s.citaId,
    enfermeraId: s.enfermeraId,
    presionSistolica: s.presionSistolica,
    presionDiastolica: s.presionDiastolica,
    frecuenciaCardiaca: s.frecuenciaCardiaca,
    temperatura: num(s.temperatura),
    spo2: s.spo2,
    pesoKg,
    tallaCm,
    imc: calcularImc(pesoKg ?? undefined, tallaCm ?? undefined),
    nota: s.nota,
    alertas: s.alertas,
    tomadoEn: s.tomadoEn.toISOString(),
  };
}
