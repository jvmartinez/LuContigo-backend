import { ArgumentsHost, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorDominio } from '../errores/error-dominio';
import { FiltroErrores } from './filtro-errores';

function ejecutar(error: unknown) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'GET', path: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  new FiltroErrores().catch(error, host);
  return { status: res.status.mock.calls[0][0], cuerpo: res.json.mock.calls[0][0] };
}

describe('formato de error (§8.7)', () => {
  beforeAll(() => Logger.overrideLogger(false));
  it('ErrorDominio conserva código, mensaje y detalles', () => {
    const r = ejecutar(new ErrorDominio('MEDICO_AUSENTE', 'No está', { medicoId: 'per_1' }));
    expect(r).toEqual({
      status: 409,
      cuerpo: {
        error: { codigo: 'MEDICO_AUSENTE', mensaje: 'No está', detalles: { medicoId: 'per_1' } },
      },
    });
  });

  it('la violación de exclusión de Postgres (23P01) es HORARIO_OCUPADO', () => {
    const r = ejecutar(
      new Error(
        'PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint \\"cita_medico_sin_solape\\"" }',
      ),
    );
    expect(r.status).toBe(409);
    expect(r.cuerpo.error.codigo).toBe('HORARIO_OCUPADO');
  });

  it.each([
    [new ForbiddenException(), 403, 'SIN_PERMISO'],
    [new NotFoundException(), 404, 'NO_ENCONTRADO'],
    [new ThrottlerException(), 429, 'LIMITE_EXCEDIDO'],
    [new Error('boom'), 500, 'ERROR_INTERNO'],
  ])('%s → %i %s', (error, status, codigo) => {
    const r = ejecutar(error);
    expect(r.status).toBe(status);
    expect(r.cuerpo.error.codigo).toBe(codigo);
  });
});
