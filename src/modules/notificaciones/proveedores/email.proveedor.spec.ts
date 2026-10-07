import { Logger } from '@nestjs/common';
import { Configuracion } from '../../../config/config.service';
import { Correo, EmailProveedor } from './email.proveedor';

describe('EmailProveedor', () => {
  const valores: Record<string, string> = {
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: 'test-api-key',
    EMAIL_FROM: 'MediCita <develper.jvmartinez@gmail.com>',
    NODE_ENV: 'test',
  };
  const config = {
    get: jest.fn((clave: string) => valores[clave]),
  } as unknown as Configuracion;
  const proveedor = new EmailProveedor(config);
  const correo: Correo = {
    para: 'personal@example.test',
    asunto: 'Invitación de prueba',
    texto: 'Crea tu contraseña en https://app.medicita.test/restablecer/token-prueba',
  };
  let fetch: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 202 } as Response);
  });

  afterEach(() => {
    fetch.mockRestore();
  });

  it('prepara la solicitud con remitente y destinatario configurados', async () => {
    await proveedor.enviar(correo);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: valores.EMAIL_FROM,
          to: [correo.para],
          subject: correo.asunto,
          text: correo.texto,
        }),
      }),
    );
  });

  it('propaga un rechazo del proveedor', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(proveedor.enviar(correo)).rejects.toThrow('Resend respondió 401');
  });

  it('simula en consola sin registrar el contenido sensible ni hacer una solicitud', async () => {
    valores.EMAIL_PROVIDER = 'consola';
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    try {
      await proveedor.enviar(correo);

      expect(log).toHaveBeenCalledWith('[email simulado] asunto="Invitación de prueba"');
      expect(debug).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      debug.mockRestore();
      valores.EMAIL_PROVIDER = 'resend';
    }
  });
});
