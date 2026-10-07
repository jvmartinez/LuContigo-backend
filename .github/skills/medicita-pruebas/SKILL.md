---
name: medicita-pruebas
description: Crea, ejecuta o depura pruebas unitarias e integracion de MediCita con Jest, ts-jest, Supertest y Testcontainers.
---

# Verificar cambios

1. Lee [jest.config.js](../../../jest.config.js),
   [configuracion e2e](../../../test/jest-e2e.json) y las pruebas del flujo.
   NestJS 12 es solo ESM: [jest-esm.js](../../../test/jest-esm.js) transpila `@nestjs/*`
   a CommonJS; conserva ese transform en ambas configuraciones.
2. Usa `src/**/*.spec.ts` para unidades y
   [app.e2e-spec.ts](../../../test/app.e2e-spec.ts) como patron de integracion.
3. Para la prueba minima: `npm test -- --runInBand --runTestsByPath <ruta>`.
   Combina rutas relacionadas en una ejecucion.
4. Usa Supertest y contenedores PostgreSQL/Redis aislados para flujos HTTP,
   persistencia, cookies, auditoria y reservas simultaneas.
   Ejecuta `npm run test:e2e -- -t "<patron>"` para un caso acotado; su setup
   sigue requiriendo contenedores. Confirma disponibilidad de Docker.
5. Cubre, segun alcance, roles, propiedad, otra clinica, datos invalidos,
   transiciones invalidas, limites de fecha y concurrencia.
6. Evita tests dependientes del dia real; controla el reloj para unidades.
   No apliques timers falsos indiscriminadamente a conexiones o workers reales.
7. No uses tokens de produccion ni envies SMS, correos o push reales.
8. Ejecuta cobertura solo cuando se pida o el criterio lo requiera. El objetivo
   pendiente del README no equivale a una garantia medida.
9. Reporta pruebas pasadas, fallidas, omitidas y bloqueadas por separado.
   No instales dependencias salvo que falten o la tarea exija cambiar el manifiesto.
