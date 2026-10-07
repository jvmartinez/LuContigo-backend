import { z } from 'zod';

const vacioComoIndefinido = (v: unknown) => (v === '' ? undefined : v);
const opcional = z.preprocess(vacioComoIndefinido, z.string().optional());

const EsquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(6),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(6),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CONFIRMACION_TOKEN_SECRET: z.string().min(6),
  APP_WEB_URL: z.string().url(),
  EMAIL_PROVIDER: z.enum(['resend', 'consola']).default('consola'),
  EMAIL_API_KEY: opcional,
  EMAIL_FROM: z.string().default('MediCita <no-reply@medicita.app>'),
  SMS_PROVIDER: z.enum(['twilio', 'consola']).default('consola'),
  TWILIO_ACCOUNT_SID: opcional,
  TWILIO_AUTH_TOKEN: opcional,
  TWILIO_FROM: opcional,
  WHATSAPP_TOKEN: opcional,
  WHATSAPP_PHONE_ID: opcional,
  WHATSAPP_TEMPLATE: z.string().default('recordatorio_cita'),
  FIREBASE_PROJECT_ID: opcional,
  FIREBASE_SERVICE_ACCOUNT_JSON: opcional,
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

export type Entorno = z.infer<typeof EsquemaEntorno>;

/** Valida las variables de entorno al arrancar. Falla rápido si falta algo. */
export function validarEntorno(crudo: Record<string, unknown>): Entorno {
  const resultado = EsquemaEntorno.safeParse(crudo);
  if (!resultado.success) {
    const faltantes = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuración inválida:\n  ${faltantes.join('\n  ')}`);
  }
  const entorno = resultado.data;
  if (entorno.EMAIL_PROVIDER === 'resend' && !entorno.EMAIL_API_KEY) {
    throw new Error('EMAIL_API_KEY es obligatorio cuando EMAIL_PROVIDER=resend');
  }
  if (entorno.NODE_ENV === 'production') {
    for (const clave of [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'CONFIRMACION_TOKEN_SECRET',
    ] as const) {
      if (entorno[clave] === 'cambiar' || entorno[clave].length < 32) {
        throw new Error(`${clave} debe tener al menos 32 caracteres en producción`);
      }
    }
    if (entorno.EMAIL_PROVIDER === 'consola' || entorno.SMS_PROVIDER === 'consola') {
      throw new Error('Los proveedores "consola" solo se permiten fuera de producción');
    }
  }
  return entorno;
}
