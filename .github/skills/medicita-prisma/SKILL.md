---
name: medicita-prisma
description: Trabaja con Prisma y PostgreSQL en MediCita para cambios de modelos, migraciones, aislamiento multi-clinica o concurrencia de reservas.
---

# Cambiar datos y persistencia

1. Lee [schema.prisma](../../../prisma/schema.prisma),
   [migraciones](../../../prisma/migrations),
   [extensiones](../../../src/prisma/extensiones.ts) y el servicio consumidor.
2. Usa `prisma.db` para modelos de negocio. Justifica cualquier uso de
   `prisma.sinClinica`; no lo uses para evitar un fallo de contexto.
3. Si agregas un modelo de negocio, revisa `MODELOS_CON_CLINICA`, los prefijos en
   [ids.ts](../../../src/prisma/ids.ts), relaciones y contexto dentro de transacciones.
4. Preserva `timestamptz`, relaciones e indices. Revisa la zona de la clinica para
   fechas de calendario. No sustituyas restricciones SQL anti-solape por consultas previas.
5. Agrega una migracion nueva; incluye `down.sql` conforme al repositorio.
   Si revertir perderia datos, documenta el riesgo y pide una decision.
   Prisma no ejecuta automaticamente esos archivos de bajada.
6. No hagas `migrate reset`, seed, deploy ni cambios en bases compartidas sin
   confirmar destino y autorizacion. Genera migraciones en un entorno aislado.
7. Valida con `npx prisma validate`, `npm run prisma:generate` si cambia el modelo,
   tipos y pruebas pertinentes. Si Prisma requiere DATABASE_URL, usa un destino
   de prueba aprobado; no extraigas credenciales de produccion.
8. Verifica migraciones, concurrencia y aislamiento usando Testcontainers cuando
   aplique. Validar un esquema no demuestra que la migracion se haya aplicado.
