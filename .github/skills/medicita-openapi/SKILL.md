---
name: medicita-openapi
description: Actualiza o verifica Swagger y OpenAPI de MediCita contrastando parametros, cuerpos, respuestas y autenticacion con la API implementada.
---

# Mantener Swagger alineado con la API

1. Revisa [configurar-app.ts](../../../src/configurar-app.ts), controlador,
   contrato Zod y servicio del endpoint. No deduzcas respuestas desde nombres.
2. Reutiliza [DocCuerpo y DocConsulta](../../../src/common/zod/zod.ts) para
   evitar esquemas de entrada duplicados. Revisa campos requeridos, defaults,
   enums, formatos, nullables y limites.
3. Documenta tags, resumen, parametros de ruta, codigos de respuesta y formas
   reales del cuerpo. No declares contenido en respuestas 204.
4. Marca Bearer solo donde se requiera. Distingue rutas publicas, cookie de refresh
   web y `X-Cliente: mobile`. Documenta restricciones de rol sin cambiar permisos.
5. Para errores usa el contrato del
   [filtro global](../../../src/common/filters/filtro-errores.ts), no un DTO inventado.
6. Usa ejemplos sinteticos validos segun Zod y sin secretos o datos clinicos reales.
7. Verifica el documento generado: paths bajo `/api/v1`, UI `/api/docs` y JSON
   `/api/docs/openapi.json`. Para cambios estructurales agrega una prueba de
   generacion con dependencias sustituidas o usa el entorno aislado existente.
   No levantes conexiones a una base compartida solo para inspeccionar Swagger.
8. Valida tipos/lint si cambian decoradores TypeScript. Un texto descriptivo
   no modifica el contrato real; explicita cualquier diferencia que quede.
