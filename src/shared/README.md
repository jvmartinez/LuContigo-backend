# shared

Tipos, enums y esquemas Zod del contrato de la API (BACKEND.md §2, "Validación").

Este directorio solo depende de `zod` para poder extraerse tal cual a `packages/shared`
cuando exista el monorepo y consumirlo desde la web y la app móvil. No importes aquí
nada de NestJS, Prisma ni de `src/modules`.
