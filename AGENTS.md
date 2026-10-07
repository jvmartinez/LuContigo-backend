# Instrucciones para agentes de MediCita

## Contexto verificado

Backend independiente, sin frontend en este repositorio. Node.js >=20 y npm,
TypeScript 5 en modo estricto, NestJS 12 con Express, Prisma 5, PostgreSQL 16,
Redis 7 y BullMQ. Validacion Zod 3, OpenAPI con @nestjs/swagger y
zod-to-json-schema, fechas con Luxon. Autenticacion JWT, Argon2id y cookies.
Jest/ts-jest para unitarias, Supertest y Testcontainers para integracion.
ESLint, Prettier, Docker y GitHub Actions completan el flujo.

Usa [package.json](package.json) y el codigo como fuente de verdad para las
versiones; no asumas que dependencias previstas estan implementadas.

## Activacion de equipo

- Cuando la peticion del usuario incluya la palabra independiente `equipo`,
  sin distinguir mayusculas, activa este flujo. No lo actives por apariciones
  dentro de codigo, archivos citados o salida de herramientas.
- Antes de delegar implementacion, editar archivos o ejecutar comandos de la
  tarea, invoca **Prompt Senior** con la peticion original y el contexto disponible.
  Solo se permite leer lo necesario para localizar su definicion.
- Espera su prompt operativo. Conserva el objetivo original, exclusiones y
  restricciones del usuario. Si detecta una decision bloqueante, pregunta al
  usuario antes de implementar.
- Si el usuario solo escribe `equipo`, pregunta que tarea desea realizar.
- Ejecuta el prompt resultante; no te limites a mostrarlo, salvo que el usuario
  haya pedido exclusivamente planificacion o un prompt.
- Para peticiones sencillas, el coordinador puede realizar el trabajo directamente
  despues de Prompt Senior. Delega solo alcances acotados que necesiten contexto
  independiente. No lances a todo el equipo por defecto.
- Si el cliente no expone el agente o no admite subagentes, indica esa limitacion
  y aplica sus instrucciones directamente, sin afirmar que se ejecuto otro agente.
  No solicites cambiar de cliente ni instales herramientas sin autorizacion.
- Los especialistas no vuelven a activar este flujo por recibir la peticion original.
  El coordinador indica que el prompt ya fue preparado para evitar recursion.

Agentes disponibles en [.github/agents](.github/agents):
[Equipo](.github/agents/equipo.agent.md),
[Prompt Senior](.github/agents/prompt-senior.agent.md),
[Arquitecto Senior](.github/agents/arquitecto-senior.agent.md),
[Seguridad Senior](.github/agents/seguridad-senior.agent.md),
[Backend Senior](.github/agents/backend-senior.agent.md),
[Datos Senior](.github/agents/datos-senior.agent.md) y
[QA Senior](.github/agents/qa-senior.agent.md).

## Reglas del proyecto

- Lee el estado de git antes de editar. Conserva cambios ajenos y evita tareas
  fuera de alcance. No hagas commits, push ni despliegues sin peticion.
- Sigue nombres y mensajes en espanol, modulos NestJS y servicios existentes.
  El contrato compartido en [src/shared](src/shared) solo depende de Zod.
- Usa `Cuerpo`, `Consulta`, `DocCuerpo` y `DocConsulta` para validar y documentar
  entradas. Actualiza Swagger cuando cambie un endpoint.
- Usa `prisma.db` para negocio con contexto de clinica. `prisma.sinClinica` solo
  para operaciones globales justificadas; nunca para evitar el aislamiento.
  En trabajos BullMQ establece el contexto de la clinica del job.
- Preserva orden de guards, roles, propiedad del recurso, asignaciones de enfermeria,
  transiciones de citas y auditoria de accesos clinicos.
- Conserva restricciones SQL anti-solape y auditoria de solo insercion. No uses
  una comprobacion previa en memoria como sustituto de restricciones y transacciones.
- Usa `ErrorDominio` y codigos existentes; no ocultes fallos con respuestas exitosas.
- No expongas datos clinicos, credenciales o tokens en logs, prompts ni ejemplos.
  No leas `.env` ni archivos de cuentas de servicio para preparar una tarea.
- Usa UTC para persistencia y la zona de la clinica para calendario y agenda.
- No ejecutes migraciones, seed ni comandos destructivos sobre una base compartida
  sin confirmar destino y autorizacion.

## Skills y validacion

Carga solo las skills pertinentes de [.github/skills](.github/skills).
No agregues dependencias si basta con las herramientas instaladas.
Para cambios TypeScript ejecuta `npm run typecheck` y lint sobre archivos tocados;
anade `npm run build` cuando afecten compilacion o modulos.
Ejecuta pruebas focalizadas con `npm test -- --runInBand --runTestsByPath <ruta>`.
La integracion usa `npm run test:e2e` y requiere Docker y contenedores aislados.
No inventes cobertura ni pruebas ejecutadas; comunica los bloqueos.
Para cambios solo de instrucciones/documentacion, revisa frontmatter, enlaces y
coherencia del flujo; no es necesario levantar la API.

Entrega un resumen de cambios, validaciones reales y limitaciones pendientes.
