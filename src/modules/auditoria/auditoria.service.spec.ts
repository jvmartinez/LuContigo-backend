import type { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from './auditoria.service';

jest.mock('@nestjs/common', () => ({ Injectable: () => (target: unknown) => target }));
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('AuditoriaService.listar', () => {
  const db = {
    auditoria: { findMany: jest.fn(), count: jest.fn() },
    paciente: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const servicio = new AuditoriaService({ db } as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('incluye documentos con una consulta por pagina y conserva registros sin paciente', async () => {
    db.auditoria.findMany.mockResolvedValue([
      { id: 'aud_1', pacienteId: 'pac_1' },
      { id: 'aud_2', pacienteId: 'pac_1' },
      { id: 'aud_3', pacienteId: null },
      { id: 'aud_4', pacienteId: 'pac_eliminado' },
    ]);
    db.auditoria.count.mockResolvedValue(4);
    db.paciente.findMany.mockResolvedValue([{ id: 'pac_1', documento: '0012345678' }]);

    const resultado = await servicio.listar({}, { page: 1, pageSize: 50 });

    expect(resultado).toEqual({
      items: [
        { id: 'aud_1', pacienteId: 'pac_1', documento: '0012345678' },
        { id: 'aud_2', pacienteId: 'pac_1', documento: '0012345678' },
        { id: 'aud_3', pacienteId: null, documento: null },
        { id: 'aud_4', pacienteId: 'pac_eliminado', documento: null },
      ],
      page: 1,
      pageSize: 50,
      total: 4,
    });
    expect(db.paciente.findMany).toHaveBeenCalledTimes(1);
    expect(db.paciente.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['pac_1', 'pac_eliminado'] } },
      select: { id: true, documento: true },
    });
  });

  it('no consulta documentos si no hay registros de pacientes', async () => {
    db.auditoria.findMany.mockResolvedValue([{ id: 'aud_1', pacienteId: null }]);
    db.auditoria.count.mockResolvedValue(1);
    const resultado = await servicio.listar({}, { page: 1, pageSize: 50 });
    expect(resultado.items).toEqual([{ id: 'aud_1', pacienteId: null, documento: null }]);
    expect(db.paciente.findMany).not.toHaveBeenCalled();
  });

  it('devuelve una pagina vacia si el documento no existe', async () => {
    db.paciente.findFirst.mockResolvedValue(null);
    await expect(
      servicio.listar({ documento: 'inexistente' }, { page: 1, pageSize: 50 }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 50, total: 0 });
    expect(db.auditoria.findMany).not.toHaveBeenCalled();
    expect(db.paciente.findMany).not.toHaveBeenCalled();
  });
});