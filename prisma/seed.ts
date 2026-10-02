/**
 * Seed de desarrollo: clínica demo con 3 médicos, 2 enfermeras, recepción, admin y
 * 12 pacientes ficticios, horarios de lunes a viernes, asignaciones de la semana y
 * algunas citas de hoy y mañana.
 *
 * Todas las cuentas usan la contraseña `Demo2026medicita`.
 */
import * as argon2 from 'argon2';
import { DateTime } from 'luxon';
import { crearClienteBase } from '../src/prisma/extensiones';

const prisma = crearClienteBase();
const ZONA = 'America/Bogota';
const PASSWORD = 'Demo2026medicita';

async function main() {
  const existente = await prisma.clinica.findFirst({ where: { nombre: 'Clínica Demo MediCita' } });
  if (existente) {
    console.log('La clínica demo ya existe; no se hace nada.');
    return;
  }

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const clinica = await prisma.clinica.create({
    data: {
      nombre: 'Clínica Demo MediCita',
      direccion: 'Cra. 7 # 72-41, Bogotá',
      telefono: '+576015550100',
      zonaHoraria: ZONA,
      pais: 'CO',
    },
  });
  const clinicaId = clinica.id;

  const [general, pediatria, cardiologia] = await Promise.all(
    [
      { nombre: 'Medicina general', duracionCitaMin: 30 },
      { nombre: 'Pediatría', duracionCitaMin: 30 },
      { nombre: 'Cardiología', duracionCitaMin: 40 },
    ].map((e) => prisma.especialidad.create({ data: { clinicaId, ...e } })),
  );

  const consultorios = await Promise.all(
    [
      { nombre: 'Consultorio 1', especialidadId: general.id },
      { nombre: 'Consultorio 2', especialidadId: pediatria.id },
      { nombre: 'Consultorio 3', especialidadId: cardiologia.id },
    ].map((c) => prisma.consultorio.create({ data: { clinicaId, ...c } })),
  );

  async function crearPersonal(
    email: string,
    rol: 'MEDICO' | 'ENFERMERA' | 'RECEPCION' | 'ADMIN',
    nombre: string,
    extra: { especialidadId?: string; consultorioId?: string; licencia?: string } = {},
  ) {
    const usuario = await prisma.usuario.create({ data: { clinicaId, email, rol, passwordHash } });
    return prisma.personal.create({ data: { clinicaId, usuarioId: usuario.id, nombre, ...extra } });
  }

  const medicos = [
    await crearPersonal('medico.general@demo.medicita.app', 'MEDICO', 'Dra. Laura Méndez', {
      especialidadId: general.id,
      consultorioId: consultorios[0].id,
      licencia: 'RM-10231',
    }),
    await crearPersonal('pediatra@demo.medicita.app', 'MEDICO', 'Dr. Andrés Castillo', {
      especialidadId: pediatria.id,
      consultorioId: consultorios[1].id,
      licencia: 'RM-20877',
    }),
    await crearPersonal('cardiologo@demo.medicita.app', 'MEDICO', 'Dra. Sofía Rincón', {
      especialidadId: cardiologia.id,
      consultorioId: consultorios[2].id,
      licencia: 'RM-31450',
    }),
  ];
  const enfermeras = [
    await crearPersonal('enfermera1@demo.medicita.app', 'ENFERMERA', 'Enf. Carolina Duarte', {
      licencia: 'EN-5521',
    }),
    await crearPersonal('enfermera2@demo.medicita.app', 'ENFERMERA', 'Enf. Miguel Ospina', {
      licencia: 'EN-5678',
    }),
  ];
  await crearPersonal('recepcion@demo.medicita.app', 'RECEPCION', 'Paula Herrera');
  await crearPersonal('admin@demo.medicita.app', 'ADMIN', 'Jorge Salazar');

  // Lunes a viernes, 08:00–12:00 y 14:00–18:00.
  for (const medico of medicos) {
    await prisma.horarioAtencion.createMany({
      data: [1, 2, 3, 4, 5].flatMap((diaSemana) => [
        { clinicaId, personalId: medico.id, diaSemana, horaInicio: '08:00', horaFin: '12:00' },
        { clinicaId, personalId: medico.id, diaSemana, horaInicio: '14:00', horaFin: '18:00' },
      ]),
    });
  }

  // Asignaciones de los próximos 7 días: enfermera 1 con medicina general y pediatría,
  // enfermera 2 con cardiología.
  const hoy = DateTime.now().setZone(ZONA).startOf('day');
  for (let d = 0; d < 7; d++) {
    const fecha = new Date(`${hoy.plus({ days: d }).toISODate()}T00:00:00.000Z`);
    for (const turno of ['MANANA', 'TARDE'] as const) {
      await prisma.asignacionTurno.createMany({
        data: [
          { clinicaId, fecha, turno, medicoId: medicos[0].id, enfermeraId: enfermeras[0].id },
          { clinicaId, fecha, turno, medicoId: medicos[1].id, enfermeraId: enfermeras[0].id },
          { clinicaId, fecha, turno, medicoId: medicos[2].id, enfermeraId: enfermeras[1].id },
        ],
      });
    }
  }

  const nombres = [
    ['Ana María', 'Rojas Díaz', '1985-04-12', 'Penicilina'],
    ['Carlos', 'Gómez Pérez', '1978-09-30', null],
    ['Lucía', 'Martínez Soto', '1992-01-18', null],
    ['Mateo', 'Hernández Ruiz', '2016-06-05', 'Ibuprofeno'],
    ['Valentina', 'López Castro', '2019-11-22', null],
    ['Jorge', 'Ramírez Vega', '1960-03-14', null],
    ['Isabela', 'Torres Mejía', '2000-07-09', 'Mariscos'],
    ['Santiago', 'Moreno Parra', '1988-12-01', null],
    ['Daniela', 'Vargas León', '1995-05-27', null],
    ['Andrés', 'Suárez Pineda', '1972-08-16', 'Sulfas'],
    ['Camila', 'Jiménez Ríos', '2010-02-03', null],
    ['Felipe', 'Cárdenas Mora', '1955-10-25', null],
  ] as const;

  const pacientes = [];
  for (const [i, [n, a, nacimiento, alergias]] of nombres.entries()) {
    // El primer paciente tiene acceso al portal.
    const usuario =
      i === 0
        ? await prisma.usuario.create({
            data: { clinicaId, email: 'paciente@demo.medicita.app', rol: 'PACIENTE', passwordHash },
          })
        : null;
    pacientes.push(
      await prisma.paciente.create({
        data: {
          clinicaId,
          usuarioId: usuario?.id,
          nombres: n,
          apellidos: a,
          documento: String(1000000000 + i * 7919),
          fechaNacimiento: new Date(`${nacimiento}T00:00:00.000Z`),
          telefono: `+57300${String(1000000 + i).padStart(7, '0')}`,
          email: `paciente${i + 1}@example.com`,
          alergias,
          consentimientoEn: new Date(),
        },
      }),
    );
  }

  // Citas de ejemplo en el próximo día hábil y el siguiente.
  let dia = hoy.plus({ days: 1 });
  while (dia.weekday > 5) dia = dia.plus({ days: 1 });
  let citas = 0;
  for (const [m, medico] of medicos.entries()) {
    const duracion = m === 2 ? 40 : 30;
    for (let k = 0; k < 3; k++) {
      const inicio = dia.set({ hour: 8 + k, minute: 0 });
      const cita = await prisma.cita.create({
        data: {
          clinicaId,
          pacienteId: pacientes[m * 3 + k].id,
          medicoId: medico.id,
          consultorioId: consultorios[m].id,
          inicio: inicio.toJSDate(),
          fin: inicio.plus({ minutes: duracion }).toJSDate(),
          motivo: 'Control',
          canalOrigen: 'RECEPCION',
        },
      });
      await prisma.citaHistorialEstado.create({
        data: { clinicaId, citaId: cita.id, a: 'PROGRAMADA' },
      });
      citas++;
    }
  }

  console.log(
    `Clínica demo creada (${clinicaId}) con ${pacientes.length} pacientes y ${citas} citas.`,
  );
  console.log(`Cuentas (*@demo.medicita.app), contraseña: ${PASSWORD}`);
  console.log(
    '  admin@ · recepcion@ · medico.general@ · pediatra@ · cardiologo@ · enfermera1@ · enfermera2@ · paciente@',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
