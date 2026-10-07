import { validarEntorno } from './configuracion';

const entornoMinimo = {
  DATABASE_URL: 'postgresql://localhost/medicita',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  CONFIRMACION_TOKEN_SECRET: 'test-confirmacion-secret',
  APP_WEB_URL: 'https://app.medicita.test',
};

describe('validarEntorno email', () => {
  it('requiere la clave de Resend cuando se configura el proveedor real', () => {
    expect(() =>
      validarEntorno({ ...entornoMinimo, EMAIL_PROVIDER: 'resend' }),
    ).toThrow('EMAIL_API_KEY es obligatorio cuando EMAIL_PROVIDER=resend');
  });

  it('permite el proveedor de consola para desarrollo sin clave externa', () => {
    expect(
      validarEntorno({ ...entornoMinimo, EMAIL_PROVIDER: 'consola' }).EMAIL_PROVIDER,
    ).toBe('consola');
  });
});
