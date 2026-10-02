import { z } from 'zod';

/** Rangos aceptados (BACKEND.md §8.4). */
export const RANGOS_SIGNOS = {
  presionSistolica: [50, 260],
  presionDiastolica: [30, 160],
  frecuenciaCardiaca: [30, 220],
  temperatura: [34.0, 42.5],
  spo2: [50, 100],
  pesoKg: [0.5, 300],
  tallaCm: [30, 250],
} as const;

const entero = (campo: keyof typeof RANGOS_SIGNOS) =>
  z.number().int().min(RANGOS_SIGNOS[campo][0]).max(RANGOS_SIGNOS[campo][1]);
const decimal = (campo: keyof typeof RANGOS_SIGNOS) =>
  z.number().min(RANGOS_SIGNOS[campo][0]).max(RANGOS_SIGNOS[campo][1]);

export const SignosVitalesEntrada = z
  .object({
    presionSistolica: entero('presionSistolica').optional(),
    presionDiastolica: entero('presionDiastolica').optional(),
    frecuenciaCardiaca: entero('frecuenciaCardiaca').optional(),
    temperatura: decimal('temperatura').optional(),
    spo2: entero('spo2').optional(),
    pesoKg: decimal('pesoKg').optional(),
    tallaCm: decimal('tallaCm').optional(),
    nota: z.string().max(1000).optional(),
  })
  .refine((s) => (s.presionSistolica === undefined) === (s.presionDiastolica === undefined), {
    message: 'La presión se registra con sistólica y diastólica',
    path: ['presionDiastolica'],
  })
  .refine(
    (s) =>
      s.presionSistolica === undefined ||
      s.presionDiastolica === undefined ||
      s.presionSistolica > s.presionDiastolica,
    { message: 'La sistólica debe ser mayor que la diastólica', path: ['presionSistolica'] },
  );
export type SignosVitalesEntrada = z.infer<typeof SignosVitalesEntrada>;

export const ALERTAS = {
  PRESION_ALTA: 'PRESION_ALTA',
  TAQUICARDIA: 'TAQUICARDIA',
  FIEBRE: 'FIEBRE',
  SATURACION_BAJA: 'SATURACION_BAJA',
} as const;

/** Marcas de alerta según §8.4. `edadAnios` decide la alerta de frecuencia cardiaca. */
export function calcularAlertas(s: SignosVitalesEntrada, edadAnios: number): string[] {
  const alertas: string[] = [];
  if ((s.presionSistolica ?? 0) >= 140 || (s.presionDiastolica ?? 0) >= 90) {
    alertas.push(ALERTAS.PRESION_ALTA);
  }
  if (s.frecuenciaCardiaca !== undefined && edadAnios > 12 && s.frecuenciaCardiaca > 100) {
    alertas.push(ALERTAS.TAQUICARDIA);
  }
  if (s.temperatura !== undefined && s.temperatura >= 38.0) alertas.push(ALERTAS.FIEBRE);
  if (s.spo2 !== undefined && s.spo2 < 94) alertas.push(ALERTAS.SATURACION_BAJA);
  return alertas;
}

/** IMC con un decimal, o null si falta peso o talla. */
export function calcularImc(pesoKg?: number, tallaCm?: number): number | null {
  if (!pesoKg || !tallaCm) return null;
  const tallaM = tallaCm / 100;
  return Math.round((pesoKg / (tallaM * tallaM)) * 10) / 10;
}
