# Maxtracker

> **Telemática IoT enterprise para LATAM**
> B2B SaaS de gestión de flotas y activos monitoreados.
> Demo funcional con datos simulados, embrión del producto real.

**Versión actual:** `0.2.0` · **Estado:** Lote 1 + Lote 2 cerrados · **Stack:** TypeScript · Next.js 15 · Prisma · SQLite

---

## Qué es esto

Maxtracker es una plataforma B2B de monitoreo de activos IoT para el
mercado latinoamericano. La meta de producción es soportar hasta
**1.000.000 de activos** (vehículos, máquinas, animales, silos, cargas)
con throughput de **~11.500 eventos/segundo**.

Este repositorio contiene **el demo funcional** que sirve como:

1. **Spec ejecutable** — referencia para handoff a una software factory
2. **Living style guide** — el Design System (DOC-10) está implementado y
   visible
3. **Pista de aterrizaje** — toda decisión arquitectónica que tomamos acá
   migra sin rewrite a producción

El demo cubre el módulo **Seguridad** end-to-end (3 pantallas funcionales
con datos simulados coherentes). El resto de los módulos llegará en
lotes siguientes.

---

## Quick start

### Requisitos

- **macOS / Linux / WSL** (Windows nativo no testeado)
- **Node.js 20+**
- **npm 10+**
- **Git**
- **VS Code** (recomendado, no obligatorio)

### Clonar el repo

```bash
git clone https://github.com/TU_USUARIO/maxtracker.git
cd maxtracker
```

### Setup local · 5 comandos

Desde la raíz del proyecto:

```bash
npm install
```

```bash
DATABASE_URL="file:./dev.db" npx prisma db push --skip-generate
```

```bash
DATABASE_URL="file:./dev.db" npx prisma generate
```

```bash
npm run db:seed
```

Tarda 30-60 segundos. Genera la estructura organizacional + parsea
los 23 CSVs reales de `prisma/seed-data/real-trajectories/` para
poblar ~250.000 posiciones reales más events sintéticos para el
Safety Dashboard.

```bash
npm run dev
```

Abrí <http://localhost:3000>.

### Workflow diario con Git

```bash
# Antes de empezar a trabajar (trae cambios remotos)
git pull

# Después de hacer cambios
git add .
git commit -m "describe el cambio"
git push
```

### Lo que vas a ver

| URL | Pantalla |
|---|---|
| `/seguridad/dashboard` | Dashboard de Seguridad |
| `/seguridad/alarmas` | Alarmas con filtros |
| `/seguimiento/mapa` | Mapa en vivo + multi-vista (1, 4, 6, 9, 12, 16 mapas) |
| `/seguimiento/historial` | Reproducción de recorrido por vehículo y día |
| `/gestion/vehiculos` | Lista de vehículos con filtros |
| `/gestion/conductores/[id]` | Ficha del conductor |
| `/debug` | Verificación del seed |

---

## Project structure

```
maxtracker-functional/
├── prisma/
│   ├── schema.prisma             ← 9 entidades (DOC-11)
│   ├── seed.ts                   ← seed determinístico (ADR-008)
│   └── seed-data/geo.ts          ← waypoints geográficos
│
├── src/
│   ├── app/                      ← Next.js App Router (Server Components)
│   │   ├── globals.css           ← design tokens (DOC-10)
│   │   ├── layout.tsx            ← shell global
│   │   ├── seguridad/
│   │   │   ├── page.tsx          ← Dashboard D
│   │   │   ├── assets/
│   │   │   │   ├── page.tsx      ← Lista A
│   │   │   │   └── [id]/page.tsx ← Libro B
│   │   └── debug/page.tsx
│   │
│   ├── components/
│   │   ├── shell/                ← ModuleBar, Sidebar, Topbar
│   │   └── maxtracker/           ← 15 componentes (DOC-10 §4)
│   │
│   ├── lib/
│   │   ├── db.ts                 ← Prisma client singleton
│   │   ├── format.ts             ← traducciones es-AR + helpers
│   │   ├── url.ts                ← URL state (ADR-003)
│   │   └── queries/              ← funciones de query por dominio
│   │
│   └── types/domain.ts           ← tipos enriquecidos
│
├── docs/
│   ├── adr/                      ← 9 ADRs (decisiones arquitectónicas)
│   ├── design-system/            ← DOC-10 (filosofía + tokens + componentes)
│   ├── data-model/               ← DOC-11 (entidades + ERD + naming)
│   └── architecture.md           ← high-level + production target
│
├── prisma.config.ts              ← config Prisma (ADR-002)
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Status del proyecto

```
LOTE 1 · DEMO FUNCIONAL — CERRADO ✅
├─ 1.1 Foundation             scaffold + schema + shell
├─ 1.2 Datos + Query Layer    seed determinístico (3 accounts · 80 assets)
├─ 1.3 Dashboard D            KPI strip + alarmas + leaderboards
├─ 1.4 Lista A                URL state + filters + sort + pagination
├─ 1.5 Libro B                header + KPIs + tabs + Leaflet map
└─ 1.6 Polish                 4 deudas visuales + ADR-002

LOTE 2 · DOCUMENTACIÓN — CERRADO ✅
├─ 2.1 Design System DOC-10   filosofía + tokens + 15 componentes
├─ 2.2 Data Model DOC-11      9 entidades + 9 diferidas + ERD + naming
├─ 2.3 ADRs estructurales     URL state, layering, RSC, CSS, dynamic, seed
└─ 2.4 Master README          ← este archivo + architecture.md

LOTE 3 · siguiente · pendiente
└─ Pantallas adicionales (Alarmas bandeja, Históricos, Zonas, módulo Conducción)

LOTE 4 · futuro
└─ Multi-tenancy + Auth0 + migración Postgres + TimescaleDB
```

### Métricas de Lote 1

```
Componentes:           15
Entidades schema:       9
ADRs:                   9
Patrones implementados: 3 de 4 (A · B · D · falta C)
Líneas de TS/TSX:    ~3.200
Líneas de CSS:       ~1.800
Líneas de docs:      ~4.700
```

---

## Stack técnico

| Capa | Tecnología | Rol |
|---|---|---|
| **Frontend framework** | Next.js 15 (App Router) | RSC + Server-side rendering |
| **Lenguaje** | TypeScript 5.9 (strict) | Type-safety end-to-end |
| **Styling** | CSS Modules + variables CSS | ADR-006 |
| **Database (demo)** | SQLite 3 | Cero setup, embebida |
| **ORM** | Prisma 6.19 | Schema declarativo, type-safe |
| **Mapas** | Leaflet + react-leaflet | OpenStreetMap, sin API keys |
| **Iconografía** | Lucide React | Stroke-based, customizable |
| **Tipografía** | IBM Plex Sans + Mono | SCADA aesthetic |
| **Seed** | @faker-js/faker | Datos determinísticos |

### Stack target de producción (no implementado todavía)

| Capa | Tecnología | Lote estimado |
|---|---|---|
| Database | PostgreSQL + TimescaleDB | Lote 3 o 4 |
| Auth | Auth0 | Lote 4 |
| Hosting frontend | Vercel | Lote 4 |
| Hosting backend | Fly.io | Lote 4 |
| Storage | Supabase | Lote 4 |
| API IoT | TCP custom (Teltonika Codec 8/8E/16) | Lote 5+ |

---

## Comandos disponibles

```bash
# Desarrollo
npm run dev                # Dev server (http://localhost:3000)
npm run build              # Build de producción
npm run start              # Servir build de producción

# Database
npm run db:generate        # Regenerar cliente Prisma desde schema
npm run db:migrate         # Crear/aplicar migraciones (interactivo)
npm run db:seed            # Sembrar datos simulados
npm run db:reset           # Drop + migrate + seed (destructivo)
npm run db:studio          # GUI Prisma Studio (browse local)

# Quality
npm run lint               # ESLint
npm run typecheck          # tsc --noEmit
```

---

## Documentación

### Para entender QUÉ hace el sistema

- [`docs/design-system/DOC-10-design-system.md`](./docs/design-system/DOC-10-design-system.md) — filosofía visual, principios, mapa
- [`docs/design-system/tokens.md`](./docs/design-system/tokens.md) — todos los design tokens
- [`docs/design-system/components.md`](./docs/design-system/components.md) — catálogo de los 15 componentes

### Para entender CON QUÉ DATOS trabaja

- [`docs/data-model/DOC-11-data-model.md`](./docs/data-model/DOC-11-data-model.md) — glosario, entidades, cardinalities
- [`docs/data-model/erd.mermaid`](./docs/data-model/erd.mermaid) — diagrama ERD renderizable
- [`docs/data-model/naming-conventions.md`](./docs/data-model/naming-conventions.md) — convenciones de nombres

### Para entender POR QUÉ se hizo así

- [`docs/adr/ADR-000-inaugural-stack.md`](./docs/adr/ADR-000-inaugural-stack.md) — stack inaugural
- [`docs/adr/ADR-001-asset-one-group.md`](./docs/adr/ADR-001-asset-one-group.md) — Asset 1:N Group
- [`docs/adr/ADR-002-prisma-config-ts.md`](./docs/adr/ADR-002-prisma-config-ts.md) — migración a prisma.config.ts
- [`docs/adr/ADR-003-url-state-pattern.md`](./docs/adr/ADR-003-url-state-pattern.md) — URL como source of truth
- [`docs/adr/ADR-004-component-layering.md`](./docs/adr/ADR-004-component-layering.md) — 5 capas estrictas
- [`docs/adr/ADR-005-server-components-first.md`](./docs/adr/ADR-005-server-components-first.md) — RSC default
- [`docs/adr/ADR-006-css-modules-and-tokens.md`](./docs/adr/ADR-006-css-modules-and-tokens.md) — CSS Modules vs Tailwind
- [`docs/adr/ADR-007-dynamic-import-strategy.md`](./docs/adr/ADR-007-dynamic-import-strategy.md) — Leaflet pattern
- [`docs/adr/ADR-008-seed-determinism.md`](./docs/adr/ADR-008-seed-determinism.md) — faker.seed(42)

### Para entender CÓMO está armado

- [`docs/architecture.md`](./docs/architecture.md) — arquitectura del sistema, request lifecycle, production target

---

## Cómo extender el sistema

Si vas a agregar código nuevo, leé al menos estos 3 docs antes:

1. **DOC-10 §4** — capas de componentes y dónde poner cosas nuevas
2. **DOC-11 §8** — reglas de mantenimiento del schema
3. **`naming-conventions.md`** — convenciones de nombres en todo el código

Si vas a tomar una decisión arquitectónica nueva, agregá un ADR
siguiendo el formato de los existentes (`ADR-NNN-kebab-case-summary.md`).

---

## Contributing workflow

```
1. Crear branch desde main:
   git checkout -b feature/descripción

2. Commits con prefijo de sub-lote o tipo:
   git commit -m "Sub-lote X.Y · Descripción"
   git commit -m "Hotfix · Descripción"
   git commit -m "Refactor · Descripción"

3. Push y PR.
```

Ver `docs/data-model/naming-conventions.md` §7 para detalle de mensajes
de commit.

---

## Decisiones inaugurales clave

Las decisiones más importantes ya tomadas (no son negociables sin ADR):

| Decisión | Doc |
|---|---|
| Stack: Next.js 15 + Prisma + SQLite + CSS Modules | ADR-000 |
| Asset pertenece a UN solo Group | ADR-001 |
| Filtros y tabs en URL como source of truth | ADR-003 |
| 5 capas estrictas de componentes | ADR-004 |
| Server Components first | ADR-005 |
| CSS Modules con design tokens, no Tailwind | ADR-006 |
| Seed determinístico con faker.seed(42) | ADR-008 |
| 3 patrones de página: A (lista) · B (libro) · D (dashboard) | DOC-10 §4 |
| Severity scale de 4 niveles + Score de 3 bandas | DOC-10 §3 |

---

## Roadmap a producción

```
HOY                    LOTE 3-4               LOTE 5+               PRODUCCIÓN
────                   ────────               ───────               ──────────
SQLite local      →    Postgres + TS    →     RDS/Aurora      →    1M assets
3 pantallas        →   10+ pantallas    →     Cobertura full  →    11.5k events/s
Demo seed         →    Multi-tenancy    →     Real ingestion  →    Codec 8/8E/16
1 user            →    Auth0 + 16 roles →     Audit trails    →    Compliance
Single account    →    N accounts       →     Reseller        →    White-label
```

El roadmap está modelado para que **cada salto sea aditivo, no
destructivo**. Las decisiones de Lote 1 sobreviven hasta producción.

---

## Licencia

Privado / propietario. Todos los derechos reservados.

---

## Contacto

- **Project owner:** Alejandro
- **Repo:** privado en GitHub (TBD · Lote 4)
- **Issues:** TBD
