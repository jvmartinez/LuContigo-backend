/**
 * Pruebas de integración con Postgres y Redis reales (Testcontainers). Cubren las pruebas
 * obligatorias de §11: doble reserva simultánea, visibilidad de la enfermera, citas ajenas
 * del paciente y cierre de consulta sin diagnóstico, además del flujo completo y la
 * auditoría. Requieren Docker.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import * as argon2 from 'argon2';
import { execSync } from 'node:child_process';
import { DateTime } from 'luxon';
import request from 'supertest';
import { crearClienteBase } from '../src/prisma/extensiones';

const ZONA = 'America/Bogota';
const PASSWORD = 'Prueba2026segura';

let pg: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;
let app: INestApplication;
let db: ReturnType<typeof crearClienteBase>;

const ids = {} as Record<string, string>;
const tokens = {} as Record<string, string>;

const api = () => request(app.getHttpServer());
const como = (quien: string) => ({ Authorization: `Bearer ${tokens[quien]}` });

async function crearClinica(sufijo: string) {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const clinica = await db.clinica.create({
    data: { nombre: `Clínica ${sufijo}`, zonaHoraria: ZONA, pais: 'CO' },
  });
  const clinicaId = clinica.id;
  const esp = await db.especialidad.create({
    data: { clinicaId, nombre: 'General', duracionCitaMin: 30 },
  });

  const personal = async (
    clave: string,
    rol: 'MEDICO' | 'ENFERMERA' | 'RECEPCION' | 'ADMIN',
    consultorioId?: string,
  ) => {
    const usuario = await db.usuario.create({
      data: { clinicaId, email: `${clave}.${sufijo}@test.app`.toLowerCase(), rol, passwordHash },
    });
    const p = await db.personal.create({
      data: {
        clinicaId,
        usuarioId: usuario.id,
        nombre: clave,
        especialidadId: rol === 'MEDICO' ? esp.id : undefined,
        consultorioId,
      },
    });
    ids[`${clave}${sufijo}`] = p.id;
    return p;
  };

  const c1 = await db.consultorio.create({ data: { clinicaId, nombre: 'C1' } });
  const c2 = await db.consultorio.create({ data: { clinicaId, nombre: 'C2' } });
  const medicoA = await personal('medicoA', 'MEDICO', c1.id);
  const medicoB = await personal('medicoB', 'MEDICO', c2.id);
  const enfA = await personal('enfA', 'ENFERMERA');
  const enfB = await personal('enfB', 'ENFERMERA');
  await personal('recepcion', 'RECEPCION');
  await personal('admin', 'ADMIN');

  // Atienden todos los días a toda hora, para que las pruebas no dependan del reloj.
  for (const m of [medicoA, medicoB]) {
    await db.horarioAtencion.createMany({
      data: [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({
        clinicaId,
        personalId: m.id,
        diaSemana,
        horaInicio: '00:00',
        horaFin: '23:59',
      })),
    });
  }

  // enfA ↔ medicoA, enfB ↔ medicoB, hoy y mañana, ambos turnos.
  const hoy = DateTime.now().setZone(ZONA);
  for (const dia of [hoy, hoy.plus({ days: 1 })]) {
    const fecha = new Date(`${dia.toISODate()}T00:00:00.000Z`);
    for (const turno of ['MANANA', 'TARDE'] as const) {
      await db.asignacionTurno.createMany({
        data: [
          { clinicaId, fecha, turno, medicoId: medicoA.id, enfermeraId: enfA.id },
          { clinicaId, fecha, turno, medicoId: medicoB.id, enfermeraId: enfB.id },
        ],
      });
    }
  }

  const paciente = async (clave: string, conPortal: boolean) => {
    const usuario = conPortal
      ? await db.usuario.create({
          data: {
            clinicaId,
            email: `${clave}.${sufijo}@test.app`.toLowerCase(),
            rol: 'PACIENTE',
            passwordHash,
          },
        })
      : null;
    const p = await db.paciente.create({
      data: {
        clinicaId,
        usuarioId: usuario?.id,
        nombres: clave,
        apellidos: 'Prueba',
        documento: `${sufijo}-${clave}`,
        fechaNacimiento: new Date('1990-01-01T00:00:00.000Z'),
        email: `${clave}@example.com`,
        consentimientoEn: new Date(),
      },
    });
    ids[`${clave}${sufijo}`] = p.id;
  };
  await paciente('pac1', true);
  await paciente('pac2', true);
  await paciente('pac3', false);
  return clinicaId;
}

async function login(clave: string, sufijo = 'X') {
  const res = await api()
    .post('/api/v1/auth/login')
    .set('X-Cliente', 'mobile')
    .send({ email: `${clave}.${sufijo}@test.app`.toLowerCase(), password: PASSWORD })
    .expect(200);
  tokens[clave + (sufijo === 'X' ? '' : sufijo)] = res.body.accessToken;
}

/** Inicio en el futuro, mañana a una hora fija local, para citas creadas por API. */
const manana = (hora: number, minuto = 0) =>
  DateTime.now()
    .setZone(ZONA)
    .plus({ days: 1 })
    .set({ hour: hora, minute: minuto, second: 0, millisecond: 0 })
    .toISO();

beforeAll(async () => {
  Logger.overrideLogger(['error']);
  [pg, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: pg.getConnectionUri(),
    REDIS_URL: redis.getConnectionUrl(),
    JWT_ACCESS_SECRET: 'secreto-de-prueba-acceso',
    JWT_REFRESH_SECRET: 'secreto-de-prueba-refresh',
    CONFIRMACION_TOKEN_SECRET: 'secreto-de-prueba-confirmacion',
    APP_WEB_URL: 'http://localhost:5173',
    EMAIL_PROVIDER: 'consola',
    SMS_PROVIDER: 'consola',
  });
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });

  db = crearClienteBase();
  await crearClinica('X');
  await crearClinica('Y');

  const { AppModule } = await import('../src/app.module');
  const { configurarApp } = await import('../src/configurar-app');
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app as NestExpressApplication);
  await app.init();

  for (const clave of ['recepcion', 'admin', 'medicoA', 'medicoB', 'enfA', 'enfB', 'pac1', 'pac2'])
    await login(clave);
  await login('recepcion', 'Y');
}, 240_000);

afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
  await Promise.all([pg?.stop(), redis?.stop()]);
});

describe('autenticación', () => {
  it('rechaza credenciales inválidas con el formato de error', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'admin.x@test.app', password: 'mala' })
      .expect(401);
    expect(res.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('GET /auth/yo devuelve rol y clínica', async () => {
    const res = await api().get('/api/v1/auth/yo').set(como('medicoA')).expect(200);
    expect(res.body.rol).toBe('MEDICO');
    expect(res.body.clinica.zonaHoraria).toBe(ZONA);
  });

  it('la web recibe el refresh token en cookie httpOnly y puede refrescar', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'admin.x@test.app', password: PASSWORD })
      .expect(200);
    expect(login.body.refreshToken).toBeUndefined();
    const cookie = login.headers['set-cookie'] as unknown as string[];
    expect(cookie[0]).toMatch(/mc_refresh=.*HttpOnly.*Secure.*SameSite=Strict/i);
    const refresh = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .send({})
      .expect(200);
    expect(refresh.body.accessToken).toBeDefined();
  });

  it('sin token responde 401', async () => {
    await api().get('/api/v1/citas').expect(401);
  });
});

describe('citas', () => {
  it('RF-05: dos reservas simultáneas del mismo horario, solo una gana', async () => {
    const cuerpo = (pacienteId: string) => ({
      pacienteId,
      medicoId: ids.medicoAX,
      inicio: manana(10),
    });
    const [a, b] = await Promise.all([
      api().post('/api/v1/citas').set(como('recepcion')).send(cuerpo(ids.pac1X)),
      api().post('/api/v1/citas').set(como('recepcion')).send(cuerpo(ids.pac2X)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const perdedora = a.status === 409 ? a : b;
    expect(perdedora.body.error.codigo).toBe('HORARIO_OCUPADO');
    const ganadora = a.status === 201 ? a : b;
    expect(ganadora.body.estado).toBe('PROGRAMADA');
    expect(ganadora.body.consultorio.nombre).toBe('C1');
    expect(ganadora.body.recordatorioProgramadoPara).toBeDefined();
  });

  it('un solape parcial también se rechaza, pero cancelar libera el horario', async () => {
    const primera = await api()
      .post('/api/v1/citas')
      .set(como('recepcion'))
      .send({ pacienteId: ids.pac1X, medicoId: ids.medicoBX, inicio: manana(11) })
      .expect(201);
    await api()
      .post('/api/v1/citas')
      .set(como('recepcion'))
      .send({ pacienteId: ids.pac2X, medicoId: ids.medicoBX, inicio: manana(11, 15) })
      .expect(409);
    await api()
      .post(`/api/v1/citas/${primera.body.id}/cancelar`)
      .set(como('recepcion'))
      .send({ motivo: 'Prueba' })
      .expect(200);
    await api()
      .post('/api/v1/citas')
      .set(como('recepcion'))
      .send({ pacienteId: ids.pac2X, medicoId: ids.medicoBX, inicio: manana(11, 15) })
      .expect(201);
  });

  it('el paciente agenda para sí mismo y no ve citas ajenas', async () => {
    const propia = await api()
      .post('/api/v1/citas')
      .set(como('pac1'))
      .send({ pacienteId: ids.pac2X, medicoId: ids.medicoAX, inicio: manana(15) })
      .expect(201);
    expect(propia.body.pacienteId).toBe(ids.pac1X); // ignora el pacienteId ajeno

    await api().get(`/api/v1/citas/${propia.body.id}`).set(como('pac1')).expect(200);
    const ajena = await api().get(`/api/v1/citas/${propia.body.id}`).set(como('pac2')).expect(404);
    expect(ajena.body.error.codigo).toBe('NO_ENCONTRADO');
    await api()
      .post(`/api/v1/citas/${propia.body.id}/cancelar`)
      .set(como('pac2'))
      .send({ motivo: 'x' })
      .expect(404);

    const mias = await api().get('/api/v1/pacientes/yo/citas').set(como('pac2')).expect(200);
    expect(mias.body.proximas.map((c: { id: string }) => c.id)).not.toContain(propia.body.id);
  });

  it('una transición inválida responde 409 TRANSICION_INVALIDA', async () => {
    const cita = await api()
      .post('/api/v1/citas')
      .set(como('recepcion'))
      .send({ pacienteId: ids.pac3X, medicoId: ids.medicoAX, inicio: manana(16) })
      .expect(201);
    const res = await api()
      .post(`/api/v1/citas/${cita.body.id}/iniciar`)
      .set(como('medicoA'))
      .expect(409);
    expect(res.body.error.codigo).toBe('TRANSICION_INVALIDA');
  });

  it('otra clínica no ve las citas', async () => {
    const cita = await api()
      .post('/api/v1/citas')
      .set(como('recepcion'))
      .send({ pacienteId: ids.pac3X, medicoId: ids.medicoBX, inicio: manana(17) })
      .expect(201);
    await api().get(`/api/v1/citas/${cita.body.id}`).set(como('recepcionY')).expect(404);
  });
});

describe('flujo de atención, enfermería y consulta', () => {
  let citaId: string;

  beforeAll(async () => {
    // Cita de hoy creada directamente (por API no se puede agendar en el pasado inmediato).
    const inicio = DateTime.now().plus({ minutes: 2 }).toJSDate();
    const clinica = await db.clinica.findFirstOrThrow({ where: { nombre: 'Clínica X' } });
    const medico = await db.personal.findUniqueOrThrow({ where: { id: ids.medicoAX } });
    const cita = await db.cita.create({
      data: {
        clinicaId: clinica.id,
        pacienteId: ids.pac2X,
        medicoId: medico.id,
        consultorioId: medico.consultorioId as string,
        inicio,
        fin: new Date(inicio.getTime() + 5 * 60_000),
        canalOrigen: 'RECEPCION',
      },
    });
    citaId = cita.id;
  });

  it('recepción registra la llegada', async () => {
    const res = await api()
      .post(`/api/v1/citas/${citaId}/llegada`)
      .set(como('recepcion'))
      .expect(200);
    expect(res.body.estado).toBe('EN_ESPERA');
  });

  it('la enfermera no ve pacientes de médicos no asignados', async () => {
    const cola = await api().get('/api/v1/enfermeria/cola').set(como('enfB')).expect(200);
    expect(cola.body.citas.map((c: { id: string }) => c.id)).not.toContain(citaId);
    await api().get(`/api/v1/pacientes/${ids.pac2X}/historial`).set(como('enfB')).expect(403);
    await api().get(`/api/v1/citas?medicoId=${ids.medicoAX}`).set(como('enfB')).expect(403);
    await api()
      .post(`/api/v1/citas/${citaId}/signos-vitales`)
      .set(como('enfB'))
      .send({ temperatura: 37 })
      .expect(403);
  });

  it('la enfermera asignada ve la cola y registra signos con alertas', async () => {
    const cola = await api().get('/api/v1/enfermeria/cola').set(como('enfA')).expect(200);
    expect(cola.body.citas.map((c: { id: string }) => c.id)).toContain(citaId);

    await api()
      .post(`/api/v1/citas/${citaId}/signos-vitales`)
      .set(como('enfA'))
      .send({ presionSistolica: 300, presionDiastolica: 90 })
      .expect(422);

    const res = await api()
      .post(`/api/v1/citas/${citaId}/signos-vitales`)
      .set(como('enfA'))
      .send({
        presionSistolica: 150,
        presionDiastolica: 95,
        temperatura: 38.4,
        pesoKg: 70,
        tallaCm: 170,
      })
      .expect(201);
    expect(res.body.alertas).toEqual(expect.arrayContaining(['PRESION_ALTA', 'FIEBRE']));
    expect(res.body.imc).toBe(24.2);

    await api().get(`/api/v1/pacientes/${ids.pac2X}/historial`).set(como('enfA')).expect(200);
  });

  it('solo el médico de la cita la inicia', async () => {
    await api().post(`/api/v1/citas/${citaId}/iniciar`).set(como('medicoB')).expect(403);
    const res = await api()
      .post(`/api/v1/citas/${citaId}/iniciar`)
      .set(como('medicoA'))
      .expect(200);
    expect(res.body.estado).toBe('EN_CONSULTA');
  });

  it('una consulta no se cierra sin diagnóstico', async () => {
    await api()
      .put(`/api/v1/citas/${citaId}/consulta`)
      .set(como('medicoA'))
      .send({ motivo: 'Cefalea', tratamiento: 'Acetaminofén' })
      .expect(200);
    const res = await api()
      .post(`/api/v1/citas/${citaId}/consulta/cerrar`)
      .set(como('medicoA'))
      .send({})
      .expect(422);
    expect(res.body.error.codigo).toBe('VALIDACION');
    expect(res.body.error.detalles.campos.map((c: { campo: string }) => c.campo)).toEqual([
      'diagnostico',
    ]);
  });

  it('delega una tarea a la enfermera asignada y ella la completa', async () => {
    const tarea = await api()
      .post(`/api/v1/citas/${citaId}/tareas`)
      .set(como('medicoA'))
      .send({ tipo: 'Tomar glucometría' })
      .expect(201);
    expect(tarea.body.enfermera.id).toBe(ids.enfAX);

    const tareas = await api()
      .get('/api/v1/enfermeria/tareas?estado=PENDIENTE')
      .set(como('enfA'))
      .expect(200);
    expect(tareas.body.map((t: { id: string }) => t.id)).toContain(tarea.body.id);
    await api().post(`/api/v1/tareas/${tarea.body.id}/completar`).set(como('enfB')).expect(404);
    await api().post(`/api/v1/tareas/${tarea.body.id}/completar`).set(como('enfA')).expect(200);
  });

  it('cierra con diagnóstico y tratamiento; la nota ya no se edita', async () => {
    const res = await api()
      .post(`/api/v1/citas/${citaId}/consulta/cerrar`)
      .set(como('medicoA'))
      .send({ diagnostico: 'Cefalea tensional', cie10: 'G44.2', indicaciones: 'Hidratación' })
      .expect(200);
    expect(res.body.cerradaEn).toBeDefined();

    const cita = await api().get(`/api/v1/citas/${citaId}`).set(como('recepcion')).expect(200);
    expect(cita.body.estado).toBe('ATENDIDA');
    expect(cita.body.historialEstados.map((h: { a: string }) => h.a)).toEqual([
      'EN_ESPERA',
      'LISTA',
      'EN_CONSULTA',
      'ATENDIDA',
    ]);

    const edicion = await api()
      .put(`/api/v1/citas/${citaId}/consulta`)
      .set(como('medicoA'))
      .send({ motivo: 'x' });
    expect(edicion.status).toBe(409);

    const indicaciones = await api()
      .get('/api/v1/pacientes/yo/indicaciones')
      .set(como('pac2'))
      .expect(200);
    expect(indicaciones.body[0].indicaciones).toBe('Hidratación');
  });

  it('RF-20: la auditoría registra los accesos y no admite cambios', async () => {
    const paciente = await db.paciente.findUniqueOrThrow({
      where: { id: ids.pac2X },
      select: { documento: true },
    });
    const res = await api()
      .get(`/api/v1/auditoria?documento=${encodeURIComponent(paciente.documento)}`)
      .set(como('admin'))
      .expect(200);
    const entidades = res.body.items.map((a: { entidad: string }) => a.entidad);
    expect(entidades).toEqual(
      expect.arrayContaining(['SIGNOS_VITALES', 'CONSULTA', 'HISTORIAL', 'TAREA']),
    );

    const sinCoincidencias = await api()
      .get('/api/v1/auditoria?documento=documento-inexistente')
      .set(como('admin'))
      .expect(200);
    expect(sinCoincidencias.body).toMatchObject({ items: [], total: 0 });

    await api()
      .get(`/api/v1/auditoria?pacienteId=${ids.pac2X}`)
      .set(como('admin'))
      .expect(400);

    await expect(db.$executeRawUnsafe(`UPDATE auditoria SET accion = 'X'`)).rejects.toThrow(
      /solo admite inserciones/,
    );
    await expect(db.$executeRawUnsafe(`DELETE FROM auditoria`)).rejects.toThrow(
      /solo admite inserciones/,
    );
  });
});

describe('roles', () => {
  it('un médico no puede crear personal ni ver indicadores', async () => {
    await api()
      .get('/api/v1/indicadores?desde=2026-01-01&hasta=2026-01-31')
      .set(como('medicoA'))
      .expect(403);
    await api().post('/api/v1/personal').set(como('medicoA')).send({}).expect(403);
  });

  it('admin ve indicadores agregados', async () => {
    const hoy = DateTime.now().setZone(ZONA);
    const res = await api()
      .get(
        `/api/v1/indicadores?desde=${hoy.toISODate()}&hasta=${hoy.plus({ days: 1 }).toISODate()}`,
      )
      .set(como('admin'))
      .expect(200);
    expect(res.body.citas).toBeGreaterThan(0);
    expect(res.body.ocupacionPorMedico).toHaveLength(2);
  });
});
