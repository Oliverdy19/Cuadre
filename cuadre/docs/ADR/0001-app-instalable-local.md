# ADR 0001 — App web instalable con datos locales para la versión 1

**Fecha:** 2026-10-18 · **Estado:** aceptada

## Contexto
El usuario quiere la app en su teléfono, sin depender de Claude ni de servicios externos, y que se instale "con un botón". El documento de requisitos sugiere evaluar React Native + Expo + Supabase.

## Opciones
1. **App web instalable (PWA) con almacenamiento local.** Ventajas: se instala desde el navegador en Android y en iPhone, funciona sin conexión, no tiene costo y no requiere cuentas. Desventajas: no puede leer notificaciones, no sincroniza entre dispositivos y el almacenamiento está limitado por el navegador.
2. **Expo + Supabase.** Ventajas: app nativa, sincronización y acceso a notificaciones en Android. Desventajas: requiere cuentas de Expo y Supabase, compilar e instalar el APK, mantener un servidor y cumplir más obligaciones de seguridad.

## Decisión
Opción 1 para la versión 1, con el motor financiero aislado en `engine.js` para reutilizarlo en la opción 2.

## Consecuencias
- Los datos viven en el teléfono. El respaldo JSON es la forma de moverlos.
- La importación de CSV/Excel reemplaza la conexión bancaria.
- La captura de notificaciones de Android queda para la versión nativa.
