# ADR-015 · Back navigation dinámica

**Status:** Accepted
**Date:** 2026-05-02
**Lote:** L4

## Contexto

Feedback de Jere: los botones "Volver" siempre van a la vista general (lista de vehículos), no al lugar de origen (un grupo, una flota). UX rota cuando navegas anidado.

## Decisión

Mantener stack de URLs visitadas en `sessionStorage`, cap 10. BackButton lee el penúltimo entry y navega ahí. Si está vacío, fallback a URL hardcoded por la página.

## Por qué sessionStorage y no React state

- React state se pierde en cada nav (cada page es server-rendered).
- localStorage persistiría cross-tab y cross-session · no queremos eso · "Volver" en una sesión nueva debe ir al fallback, no a una URL random de la sesión anterior.
- sessionStorage = scope = tab + sesión. Exactamente lo que queremos.

## Trade-off del fallback

Mantenemos `backHref` (URL hardcoded de la página) como fallback cuando el stack está vacío. Razón · si el user llega a una pantalla por link directo (compartido por Slack, etc.), el stack está vacío y no podemos adivinar de dónde vino.

## Cap de 10 entries

Previene crecimiento infinito del stack en sesiones largas (alguien deja la pestaña abierta días). 10 entries cubre 99% de los casos · navegación más profunda no es UX común.

## Tracking universal vs opt-in

Decisión · universal. El `<NavTracker />` se monta en el layout y trackea TODAS las pantallas. Alternativa · cada page importa el hook. Universal es menos código en cada page y zero olvidos.

Costo · sessionStorage write en cada nav. ~1ms · imperceptible.

## Limpieza al hacer back

Cuando el user hace back, las entries posteriores al destino se eliminan del stack. Razón · evita "ir adelante" inesperado · si el user vuelve y luego navega a otra cosa, el flujo lineal se respeta.
