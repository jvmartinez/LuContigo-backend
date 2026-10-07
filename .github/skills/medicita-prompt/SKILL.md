---
name: medicita-prompt
description: Prepara prompts operativos para peticiones de MediCita, especialmente cuando el usuario activa equipo o solicita reformular una tarea.
---

# Preparar un prompt operativo

1. Clasifica la entrega solicitada sin convertir preguntas o planes en implementacion.
2. Consulta [AGENTS.md](../../../AGENTS.md) y
   [package.json](../../../package.json). Lee solo evidencia pertinente.
3. Extrae objetivo, limites y resultado observable de la peticion original.
4. Identifica superficie afectada: contrato Zod, controlador, servicio, datos,
   cola, documentacion y pruebas, sin dar por hecho que todas deben cambiar.
5. Define criterios verificables, incluidos permisos, errores y regresiones relevantes.
6. Describe pasos y validacion minima. No fijes modelos ni convoques a todo el equipo.
7. Si falta una decision de producto esencial, marca el bloqueo y formula una
   pregunta concreta para que el coordinador la traslade al usuario.
8. Devuelve el prompt con las ocho secciones de
   [Prompt Senior](../../agents/prompt-senior.agent.md). No implementes ni crees notas.

Ejemplo: "equipo actualiza Swagger de auditoria" debe resultar en una tarea para
contrastar filtros y respuestas con el controlador, esquema y servicio reales,
preservando el acceso ADMIN y sin modificar la funcionalidad ni los datos.
