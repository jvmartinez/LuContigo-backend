---
name: medicita-backend
description: Implementa o corrige endpoints y reglas de negocio NestJS en MediCita, incluyendo Zod, permisos, errores, citas y auditoria.
---

# Cambiar el backend

1. Lee controlador, servicio, modulo, contrato y pruebas del flujo en
   [src/modules](../../../src/modules) y [src/shared](../../../src/shared).
2. Sigue [decoradores](../../../src/common/decorators/index.ts) y
   [helpers Zod](../../../src/common/zod/zod.ts). Usa `Cuerpo`/`Consulta` para
   validacion real y `DocCuerpo`/`DocConsulta` para Swagger.
3. Revisa roles y autorizacion fina: usuario propietario, medico de la cita o
   enfermera asignada. Sin `@Roles`, cualquier usuario autenticado puede acceder;
   no inventes restricciones ni hagas publicas rutas por comodidad.
4. Consulta [AppModule](../../../src/app.module.ts) antes de cambiar guards,
   interceptor o filtro global. Preserva su orden y contexto de clinica.
5. Para citas, revisa [maquina de estados](../../../src/modules/citas/cita-estado.ts)
   y [agenda](../../../src/modules/citas/agenda.ts). Usa las transiciones del
   servicio, persistencia condicional y restricciones SQL existentes.
6. Propaga fallos mediante [ErrorDominio](../../../src/common/errores/error-dominio.ts).
   Conserva codigos, status y formato del filtro global.
7. Actualiza pruebas y Swagger; aplica la skill OpenAPI si cambia el contrato.
8. Valida tipos, lint de archivos tocados y pruebas focalizadas. Verifica
   resultados y documenta incompatibilidades intencionales antes de cerrar.
