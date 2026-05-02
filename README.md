# Lote L2B-2 · Dashboard Seguridad → fleet-metrics

Cierra **cross-tenant leak crítico** · pre-L2B-2, CA y OP veían en su dashboard datos de TODOS los clientes (alarmas, eventos, conductores).

## Qué hace

2 archivos:

1. **`src/lib/queries/safety.ts`** · 4 queries (getSafetyKpis, getOpenAlarms, getWorstDrivers, getTopAssetsByEvents) ahora aceptan `scope?: FleetScope` con default `{ accountId: null }` (backward compat). `getSafetyKpis` delega a `getFleetOpenAlarmsCount` para el count de alarmas.
2. **`src/app/(product)/seguridad/dashboard/page.tsx`** · resuelve scope vía `resolveAccountScope(session, "seguridad")` y lo pasa a las 4 queries.

## Bug que resuelve

| Query | Pre-L2B-2 | Post-L2B-2 |
|---|---|---|
| `getSafetyKpis` | Cross-tenant siempre | Filtra por scope del user |
| `getOpenAlarms` | Cross-tenant siempre | Idem |
| `getWorstDrivers` | Cross-tenant siempre | Idem |
| `getTopAssetsByEvents` | Cross-tenant siempre | Idem |

## Apply

```bash
cd ~/Downloads && unzip -o L2B-2-dashboard-seguridad.zip -d maxtracker-functional && \
  cd maxtracker-functional && bash apply.sh
```

## Validación crítica

```bash
# 1. typecheck
npx tsc --noEmit; echo exit=$?

# 2. Bug que se cierra · cambiar identidad a CA, ir a /seguridad/dashboard
#    Esperado · KPIs MENORES que como SA (solo su account)
#    Antes (bug) · CA veía mismos números que SA
```

## Próximo lote

**L2B-3** · Boletín · resuelve el OTRO cross-tenant leak (vista directiva · más crítico).
