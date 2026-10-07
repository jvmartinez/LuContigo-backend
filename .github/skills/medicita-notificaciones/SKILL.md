---
name: medicita-notificaciones
description: Modifica recordatorios y notificaciones BullMQ de MediCita, incluidos Redis, reintentos, email Resend, SMS Twilio, WhatsApp y push FCM.
---

# Cambiar colas y notificaciones

1. Lee [modulo de notificaciones](../../../src/modules/notificaciones/notificaciones.module.ts),
   [programacion](../../../src/modules/notificaciones/recordatorios.service.ts),
   [processor](../../../src/modules/notificaciones/recordatorios.processor.ts) y
   [seleccion de canal](../../../src/modules/notificaciones/canal.ts).
2. Conserva `clinicaId` en el job y restaura el contexto de clinica al procesarlo.
   Respeta IDs deterministas, reprogramacion y cancelacion de jobs pendientes.
3. Preserva programacion a inicio menos 24 horas o inmediata, tres intentos y
   backoff exponencial salvo cambio explicitamente solicitado.
4. Evalua carreras entre envio, cancelacion y reprogramacion; no supongas que
   eliminar un job pendiente detiene uno activo.
5. Conserva el fallback de canales implementado. Verifica estado persistido y
   tratamiento de fallos al agotar intentos; no marques ENVIADO tras un error.
6. Para enlaces publicos, revisa
   [tokens de confirmacion](../../../src/modules/notificaciones/confirmacion-token.service.ts)
   y [controlador](../../../src/modules/citas/confirmaciones.controller.ts).
   Preserva caducidad, un solo uso y consumo transaccional.
7. Lee [configuracion](../../../src/config/configuracion.ts) antes de agregar
   variables. No incluyas claves en codigo, logs, ejemplos o prompts.
8. Usa dobles de proveedores o simulacion en desarrollo/pruebas. No envies
   notificaciones reales para validar. Ejecuta pruebas de canal y del flujo tocado.
