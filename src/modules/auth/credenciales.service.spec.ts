import { Configuracion } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Correo } from '../notificaciones/proveedores/email.proveedor';
import { CredencialesService, sha256 } from './credenciales.service';

describe('CredencialesService', () => {
  const crearToken = jest.fn();
  const enviar = jest.fn<Promise<void>, [Correo]>();
  const config = {
    get: jest.fn((clave: string) =>
      clave === 'APP_WEB_URL' ? 'https://app.medicita.test/' : undefined,
    ),
  } as unknown as Configuracion;
  const prisma = {
    sinClinica: { tokenRestablecimiento: { create: crearToken } },
  } as unknown as PrismaService;
  const servicio = new CredencialesService(prisma, { enviar } as never, config);

  beforeEach(() => {
    jest.clearAllMocks();
    crearToken.mockResolvedValue({});
    enviar.mockResolvedValue();
  });

  it('envía invitación con el enlace que consume la ruta web y guarda solo el hash', async () => {
    const antes = Date.now();
    await servicio.enviarInvitacion(
      { id: 'usr_personal', email: 'personal@example.test' },
      'Clínica Demo',
    );

    const correo = enviar.mock.calls[0][0];
    const token = correo.texto.match(/https:\/\/app\.medicita\.test\/restablecer\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeDefined();
    expect(correo).toMatchObject({
      para: 'personal@example.test',
      asunto: 'Tu acceso a MediCita · Clínica Demo',
    });
    expect(correo.texto).toContain('el enlace vence en 72 horas');
    expect(correo.texto).not.toContain('?token=');
    expect(crearToken).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 'usr_personal',
        hash: sha256(token!),
        expiraEn: expect.any(Date),
      }),
    });
    const expiraEn = crearToken.mock.calls[0][0].data.expiraEn as Date;
    expect(expiraEn.getTime()).toBeGreaterThanOrEqual(antes + 72 * 60 * 60 * 1000);
    expect(expiraEn.getTime()).toBeLessThanOrEqual(Date.now() + 72 * 60 * 60 * 1000);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('genera el enlace de restablecimiento con la misma ruta web', async () => {
    await servicio.enviarRestablecimiento({
      id: 'usr_personal',
      email: 'personal@example.test',
    });

    const correo = enviar.mock.calls[0][0];
    expect(correo.texto).toMatch(/https:\/\/app\.medicita\.test\/restablecer\/[A-Za-z0-9_-]+/);
    expect(correo.texto).toContain('El enlace vence en 1 hora');
    expect(crearToken).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
