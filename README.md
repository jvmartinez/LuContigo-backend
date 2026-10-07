# MediCita · API

API REST multi-clínica de MediCita (NestJS 12 · Prisma 5 · PostgreSQL 16 · BullMQ/Redis 7).
Implementa el documento `BACKEND.md` (RF-01 a RF-20). La web y la app móvil consumen solo esta API.

## Puesta en marcha

```bash
# requisitos: Node 20+, Docker
npm install
cp .env.example .env                 # ya viene listo para desarrollo
docker compose up -d postgres redis  # en el host: Postgres 5433 y Redis 6380 (ver POSTGRES_PORT/REDIS_PORT)
npx prisma migrate deploy            # o `npm run prisma:migrate` si cambias el esquema
npm run prisma:seed                  # clínica demo
npm run dev                          # http://localhost:3000/api/v1
                                     # docs: http://localhost:3000/api/docs
                                     # OpenAPI JSON: /api/docs/openapi.json
```

Cuentas del seed (contraseña `Demo2026medicita`), todas en `@demo.medicita.app`:
`admin`, `recepcion`, `medico.general`, `pediatra`, `cardiologo`, `enfermera1`, `enfermera2`, `paciente`.

Con `EMAIL_PROVIDER=consola` y `SMS_PROVIDER=consola` los mensajes (recordatorios, invitaciones,
restablecer contraseña) se escriben en el log en lugar de enviarse; solo en `NODE_ENV=development`.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | API con recarga |
| `npm run build` / `npm start` | Compila a `dist/` y arranca |
| `npm run lint` · `npm run typecheck` | ESLint + Prettier · `tsc` |
| `npm test` · `npm run test:cov` | Pruebas unitarias (máquina de estados, agenda, signos, canales, errores) |
| `npm run test:e2e` | Integración con Postgres y Redis reales vía Testcontainers (requiere Docker) |

NestJS 12 se publica solo como ESM; Jest transpila `@nestjs/*` a CommonJS con
[`test/jest-esm.js`](test/jest-esm.js), usado por ambas configuraciones de Jest.

## Estructura

```
prisma/
  schema.prisma                         entidades de §5 (+ tokens de sesión y de confirmación)
  migrations/
    20260928000000_inicial/             generada por Prisma
    20260928000100_solape_y_auditoria/  manual: EXCLUDE anti doble reserva + auditoría solo inserción
                                        (cada migración trae su down.sql)
  seed.ts
src/
  shared/          esquemas Zod, enums y códigos de error del contrato (solo depende de zod)
  common/          guards (JWT, clínica, roles, límite), @Auditar + interceptor, filtro de errores,
                   contexto de clínica (AsyncLocalStorage), utilidades de fecha
  prisma/          cliente con extensiones: ids con prefijo (pac_…, cit_…) y aislamiento por clinica_id
  modules/
    auth/ clinicas/ personal/ asignaciones/ pacientes/ citas/ enfermeria/
    consultas/ notificaciones/ indicadores/ auditoria/
test/app.e2e-spec.ts
```

## Agentes y skills de Copilot

Las reglas del proyecto y el flujo de trabajo están en [AGENTS.md](AGENTS.md).
Copilot también las referencia desde
[copilot-instructions.md](.github/copilot-instructions.md).

| Agente | Responsabilidad |
| --- | --- |
| [Equipo](.github/agents/equipo.agent.md) | Coordinar la petición y usar solo los especialistas necesarios |
| [Prompt Senior](.github/agents/prompt-senior.agent.md) | Preparar primero un prompt operativo con alcance y criterios verificables |
| [Arquitecto Senior](.github/agents/arquitecto-senior.agent.md) | Revisar diseño, módulos, contratos, escalabilidad y decisiones técnicas |
| [Seguridad Senior](.github/agents/seguridad-senior.agent.md) | Revisar autenticación, autorización, privacidad clínica y vulnerabilidades |
| [Backend Senior](.github/agents/backend-senior.agent.md) | API NestJS, reglas clínicas, Zod, Swagger y notificaciones |
| [Datos Senior](.github/agents/datos-senior.agent.md) | Prisma, PostgreSQL, migraciones y concurrencia |
| [QA Senior](.github/agents/qa-senior.agent.md) | Pruebas unitarias y de integración |

Las [skills](.github/skills) cubren preparación de prompts, backend, Prisma,
OpenAPI, pruebas y notificaciones. Se cargan según la tarea, no todas a la vez.
Los agentes usan el modelo seleccionado por el usuario, sin fijar otro modelo.

Para activar el flujo en un cliente que cargue las instrucciones del repositorio:

```text
equipo actualiza Swagger de auditoría sin cambiar los permisos
equipo corrige la doble reserva y agrega pruebas de concurrencia
equipo analiza el flujo de recordatorios, sin modificar código
```

La primera delegación será a **Prompt Senior**; después, el coordinador ejecutará
la tarea o pedirá una aclaración si falta una decisión esencial. Escribir únicamente
`equipo` hará que solicite la tarea. También puedes seleccionar **Equipo** en el
selector de agentes de Copilot para usar siempre ese flujo.

La palabra no es un comando del backend ni un disparador de teclado: el enrutamiento
depende del soporte de instrucciones y subagentes del cliente. Si no puede invocar
el agente, debe indicarlo y aplicar su definición directamente, sin simular la
delegación. Si no aparecen las personalizaciones nuevas, abre una conversación
nueva o recarga VS Code y verifica que las personalizaciones del repositorio estén habilitadas.

## Cómo se cumplen las reglas clave

- **Multi-clínica.** `ClinicaGuard` fija la clínica del token en un `AsyncLocalStorage`; la extensión
  de Prisma (`src/prisma/extensiones.ts`) añade `clinicaId` a cada consulta de negocio y **falla si no
  hay clínica**. Lo que ocurre antes de conocerla (login, tokens) usa `prisma.sinClinica` explícitamente.
- **Sin doble reserva (RF-05).** Restricciones `EXCLUDE USING gist` por médico y por consultorio;
  el error `23P01` se traduce a `409 HORARIO_OCUPADO`. Crear y reprogramar toman antes un advisory
  lock por médico y consultorio: sin él, dos reservas simultáneas que chocan en ambas restricciones
  terminan en deadlock (`40P01`). Hay prueba de dos reservas simultáneas.
- **Máquina de estados (RF-03).** Tabla pura en `citas/cita-estado.ts` con prueba por cada fila y cada
  estado/rol inválido. Los cambios son condicionales (`WHERE estado = actual`), así que dos usuarios
  moviendo la misma cita no se pisan; cada cambio escribe en `CitaHistorialEstado`.
- **Permisos (RF-19).** `@Roles` para el control grueso; las reglas finas (dueño de la cita, médico de
  la cita, enfermera asignada ese día) viven en los servicios.
- **Auditoría (RF-20).** `@Auditar` en lectura/escritura de paciente, historial, consulta, signos y
  tareas. La bitácora se escribe antes de responder; un trigger rechaza `UPDATE`, `DELETE` y `TRUNCATE`.
- **Recordatorios (RF-04).** Cola `recordatorios` con job a `inicio − 24 h` (o inmediato), 3 reintentos
  exponenciales y estado `FALLIDO` al agotarlos. Canal: preferido del paciente → push → WhatsApp → SMS →
  email. Enlace `APP_WEB_URL/c/{token}`: JWT que vence a la hora de la cita, de un solo uso (`jti`).
  Job horario que a las 23:00 de cada clínica marca `NO_ASISTIO`.
- **Seguridad.** Argon2id; bloqueo 15 min tras 5 intentos; refresh token rotado y guardado como hash
  (reutilizarlo revoca todas las sesiones); cookie `httpOnly; Secure; SameSite=Strict` para la web y
  cuerpo para mobile (`X-Cliente: mobile`); 100 req/min por usuario y 10 req/min en `/auth` y
  `/confirmaciones`. Los logs no incluyen cuerpos de petición ni datos clínicos.

## Decisiones y desviaciones respecto a BACKEND.md

- **Repositorio independiente, no monorepo.** Este directorio contiene solo la API y usa npm. Los
  esquemas compartidos están en `src/shared/` sin dependencias de Nest/Prisma, listos para moverse a
  `packages/shared` cuando exista el monorepo con web y mobile.
- **Endpoints añadidos** que el documento no lista pero la web/app necesitan: `GET /medicos` (para elegir
  médico al agendar), `GET /clinica`, `GET /citas/:id/consulta` y
  `DELETE /personal/:id/ausencias/:ausenciaId`.
- **App móvil.** `GET /pacientes/yo` devuelve los datos propios del paciente (contacto y canal
  preferido). `POST /auth/logout` acepta `dispositivoToken` opcional para borrar el token push del
  mismo usuario al cerrar sesión. La push de recordatorio lleva en `data`
  `{ tipo: 'RECORDATORIO_CITA', citaId, enlace }` para abrir la cita en la app; los enlaces de
  email (invitación, restablecer contraseña, confirmación) siguen apuntando a `APP_WEB_URL`.
- **Códigos de error añadidos** a los base: `FUERA_DE_HORARIO`, `SIN_ENFERMERA_ASIGNADA`,
  `CONSULTA_CERRADA`, `DUPLICADO` (409) y `TOKEN_INVALIDO` (410). La cuenta bloqueada responde
  `LIMITE_EXCEDIDO` (429).
- **Turno** de una cita: `MANANA` antes de las 13:00 locales, `TARDE` después. Para ver o atender
  una cita basta que la enfermera esté asignada al médico ese día (cualquier turno).
- **Borradores de nota**: solo los ve el médico que los escribe; la enfermera ve notas cerradas.
- **Email**: implementado Resend; Amazon SES queda pendiente (se añade como otro proveedor).
- **Migraciones reversibles**: Prisma no ejecuta bajadas, así que cada migración trae un `down.sql`.

## Pendiente

- Definir el país de lanzamiento (§10) para el texto de consentimiento y la exportación de datos del
  paciente. Hoy se exige `consentimientoDatos: true` al registrar y se guarda la fecha.
- Almacenamiento del límite de peticiones en Redis si se despliegan varias réplicas.
- Pruebas de carga (semana 12) y cobertura ≥ 80 % en `citas`, `enfermeria` y `consultas`: las
  pruebas de integración cubren esos flujos, pero la cobertura combinada aún no se mide en CI.
