# DOC-11 · Data Model

> **Maxtracker · Telemática IoT enterprise**
> Modelo de datos extraído del Lote 1 + entidades diferidas con plan de
> incorporación.
> Versión 1.0 · Sub-lote 2.2 · 2026-04-25

---

## Tabla de contenidos

| Documento | Contenido |
|---|---|
| **DOC-11 · Data Model** (este archivo) | Glosario, catálogo de entidades, cardinalities, migration path |
| [`erd.mermaid`](./erd.mermaid) | Diagrama ERD renderizable (GitHub, GitLab, VS Code, Mermaid Live) |
| [`naming-conventions.md`](./naming-conventions.md) | Convenciones de nombres en schema, queries y código |

Referencias cruzadas:

- Schema ejecutable: [`prisma/schema.prisma`](../../prisma/schema.prisma)
- Seed determinístico: [`prisma/seed.ts`](../../prisma/seed.ts)
- Tipos enriquecidos: [`src/types/domain.ts`](../../src/types/domain.ts)
- ADR-001 (cardinality Asset 1:N Group): [`../adr/ADR-001-asset-one-group.md`](../adr/ADR-001-asset-one-group.md)

---

## 1 · Filosofía del modelo

Maxtracker monitorea **objetos físicos** (vehículos, máquinas, animales,
silos, cargas) a lo largo del tiempo. Eso impone tres restricciones
permanentes sobre el modelo de datos:

1. **El objeto es más estable que cualquier proceso que ocurra sobre él.**
   Un Asset existe por años. Sus conductores cambian, sus dispositivos se
   reemplazan, sus eventos vienen y van. Por eso el modelo está
   **centrado en el Asset** — la mayoría de las entidades cuelgan de él
   por FK directa.

2. **Los datos de telemetría son inmutables.** Una `Position` reportada
   por un device a las 10:35 AM no se modifica nunca. Los eventos
   tampoco. Esto permite que las tablas de telemetría sean append-only,
   lo cual es crítico para escalar a 1M assets (objetivo de producción).

3. **El tiempo tiene dos dimensiones.** Cada observación tiene un
   `recordedAt` (cuándo sucedió en el mundo, según el reloj del device)
   y un `receivedAt` (cuándo llegó al servidor). Pueden divergir por
   horas o días si hubo backfill — el device estuvo sin señal y
   transmitió todo junto al recuperar conectividad. Confundir uno con
   el otro produce reportes incorrectos.

### Vocabulario crítico

Términos que tienen significado **preciso y estable** en este sistema:

| Término | Definición | Entidad/campo |
|---|---|---|
| **Asset** | El objeto físico monitoreado. Mobile o fixed. | `Asset` |
| **Account** | Cliente de Maxtracker. Todo lo que el usuario ve está scoped a un Account. | `Account` |
| **Organization** | Tenant de la plataforma. En v1 hay una sola: Maxtracker mismo. Reseller scenarios = más Organizations. | `Organization` |
| **Group / Subgroup** | Agrupación lógica de Assets dentro de un Account. Máximo 2 niveles. | `Group` |
| **Device** | Hardware IoT físico instalado en un Asset. Un Asset puede tener varios devices simultáneos; uno es marcado primary para reporting de posición. | `Device` |
| **Person** | Conductor u operador del Asset. Distinto del User (auth) que llega en lotes futuros. | `Person` |
| **Position** | Registro GPS individual: lat, lng, velocidad, ignición, timestamp. Append-only. | `Position` |
| **Event** | Observación discreta derivada de telemetría: frenado brusco, exceso, encendido. Severidad LOW-CRITICAL. | `Event` |
| **Alarm** | Event escalado que requiere atención humana. Tiene lifecycle (OPEN → ATTENDED → CLOSED). | `Alarm` |
| **Severity** | Escala de 4 niveles: LOW, MEDIUM, HIGH, CRITICAL. | enum `Severity` |
| **Mobility type** | MOBILE (vehículo, máquina móvil) o FIXED (silo, elevador, refrigerador). | enum `MobilityType` |

### Vocabulario que aparecerá en lotes futuros

Términos del dominio Maxtracker que **todavía no tienen entidad** pero
existen conceptualmente en el producto. Los listamos para que el equipo
no se invente sinónimos antes de tiempo:

| Término | Llegará en | Entidad futura |
|---|---|---|
| **Trip / Viaje** | Lote 2.x | `Trip` — composite event con start, end, kms, ruta |
| **Zone / Geofence** | Lote 2.x | `Zone` — polígono geográfico con reglas |
| **Service record** | Lote 3.x | `ServiceRecord` — mantenimiento aplicado al Asset |
| **Document** | Lote 3.x | `Document` — póliza, VTV, cédula, vinculado a Asset o Person |
| **POI** | Lote 3.x | `POI` — point of interest sin geometría compleja |
| **AlarmRule** | Lote 3.x | `AlarmRule` — definición que dispara alarms desde events |
| **KpiDailySnapshot** | Lote 3.x | `KpiDailySnapshot` — agregación pre-calculada |
| **User** (auth) | Lote 4.x | `User` — identidad para login (Auth0), distinta de Person |
| **Permission / Role** | Lote 4.x | `Role`, `Permission` — RBAC |

Si en discusiones aparece "el chofer" o "el chófer", se traduce a `Person`.
Si aparece "el equipo" o "el dispositivo", se traduce a `Device`. Si
aparece "el viaje", confirmar si es algo que existe hoy o si es deuda
para Lote 2.x.

---

## 2 · Catálogo de entidades · Lote 1 (implementadas)

Las 9 entidades del schema Prisma actual. Cada entrada documenta:
**propósito · campos · indexes · relaciones · invariantes**.

### 2.1 · Organization

Tenant de la plataforma. En v1 hay una sola: Maxtracker. Multi-tenant
reseller scenarios se modelarán agregando más Organizations.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `name` | String | | Nombre comercial |
| `slug` | String | UNIQUE | URL-friendly identifier |
| `createdAt` | DateTime | default(now()) | Fecha de creación |

**Relaciones:** `accounts` (1:N) — todas las cuentas de esta organization.

**Invariantes:**
- `slug` debe ser único globalmente.

### 2.2 · Account

Cliente de Maxtracker. Toda la data del producto está scoped a un Account
(o sea: un Account ve solo sus Assets, sus Persons, sus Alarms, etc.).

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `organizationId` | String | FK | Referencia a Organization |
| `name` | String | | Razón social del cliente |
| `slug` | String | UNIQUE | URL-friendly identifier |
| `tier` | enum Tier | default(PRO) | Plan comercial: BASE, PRO, ENTERPRISE |
| `industry` | String? | | Industria libre (opcional) |
| `createdAt` | DateTime | default(now()) | Fecha de alta |

**Relaciones:**
- `organization` (N:1)
- `groups`, `assets`, `persons`, `alarms` (1:N)

**Invariantes:**
- Cada `Group`, `Asset`, `Person`, `Alarm` pertenece a exactamente un Account
- `slug` único globalmente (en v1; en multi-org futuro podría ser único por Organization)

### 2.3 · Group

Agrupación lógica de Assets dentro de un Account. Soporta jerarquía de
**máximo 2 niveles** (Group padre → Subgroups hijos) vía self-relation.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `accountId` | String | FK, INDEX | Account dueño |
| `parentId` | String? | FK self | Group padre si es subgroup; null si es root |
| `name` | String | | Nombre del grupo |
| `createdAt` | DateTime | default(now()) | Fecha de creación |

**Relaciones:**
- `account` (N:1)
- `parent` (N:1 self-relation)
- `children` (1:N self-relation)
- `assets` (1:N)

**Invariantes:**
- Profundidad máxima de 2 niveles. Un subgroup no puede tener children
  (no se enforca en schema, se enforca en aplicación al crear)
- Un Asset puede pertenecer al Group padre directamente, no necesita
  pasar por un subgroup
- `parent.accountId === accountId` (subgroup vive en el mismo account
  que su padre)

**Indexes:**
- `@@index([accountId])` — para listar groups por account

### 2.4 · Asset

El objeto físico monitoreado. Centro del modelo de datos.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `accountId` | String | FK | Account dueño |
| `groupId` | String? | FK | Group asignado (nullable, ADR-001) |
| `name` | String | | Nombre human-readable |
| `plate` | String? | UNIQUE | Patente (vehículos) |
| `vin` | String? | UNIQUE | VIN (vehículos) |
| `mobilityType` | enum MobilityType | default(MOBILE) | MOBILE o FIXED |
| `make` | String? | | Marca (Mercedes-Benz, Caterpillar, etc.) |
| `model` | String? | | Modelo (Actros 2645, 777G, etc.) |
| `year` | Int? | | Año |
| `status` | enum AssetStatus | default(IDLE) | Estado operativo actual |
| `currentDriverId` | String? | FK | Person actualmente asignado (nullable) |
| `createdAt` | DateTime | default(now()) | Fecha de alta |

**Relaciones:**
- `account` (N:1)
- `group` (N:1, optional · ADR-001)
- `currentDriver` (N:1 a Person, optional)
- `devices` (1:N)
- `positions` (1:N, append-only)
- `events` (1:N)
- `alarms` (1:N)

**Invariantes (críticas):**
- Un Asset pertenece a **exactamente un Account** (no compartido)
- Un Asset pertenece a **0 ó 1 Group** (ADR-001)
- Si `group` existe, `group.accountId === asset.accountId`
- Si `currentDriver` existe, `currentDriver.accountId === asset.accountId`
- Los `devices` del Asset también deben pertenecer al mismo Account
  (transitiva via FK Asset.accountId)
- Solo **uno** de los `devices` activos tiene `isPrimary: true`

**Indexes:**
- `@@index([accountId, status])` — listar assets por account filtrando por status (Lista A)
- `@@index([groupId])` — listar assets por grupo

### 2.5 · Device

Hardware IoT físico instalado en un Asset.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `assetId` | String | FK, INDEX | Asset al que está instalado |
| `imei` | String | UNIQUE | IMEI del módulo (15 dígitos) |
| `vendor` | String | | Fabricante (Teltonika, Queclink, etc.) |
| `model` | String | | Modelo (FMB920, FMC650, etc.) |
| `isPrimary` | Boolean | default(false) | Si reporta posición principal |
| `lastSeenAt` | DateTime? | | Último heartbeat |
| `installedAt` | DateTime | default(now()) | Fecha de instalación |

**Relaciones:**
- `asset` (N:1)

**Invariantes:**
- `imei` único globalmente (no se reusa al desinstalar; queda registrado)
- Por Asset, **a lo sumo un** Device con `isPrimary: true` activo a la vez
- `lastSeenAt` puede quedar null si el device nunca reportó

**Indexes:**
- `@@index([assetId])` — listar devices por asset

### 2.6 · Person

Conductor u operador. **Distinto del User (auth)** que llegará en lotes
futuros con Auth0.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `accountId` | String | FK, INDEX | Account dueño |
| `firstName` | String | | Nombre |
| `lastName` | String | | Apellido |
| `document` | String? | | Documento de identidad (DNI, CI, etc.) |
| `licenseExpiresAt` | DateTime? | | Vencimiento de licencia profesional |
| `hiredAt` | DateTime? | | Fecha de ingreso |
| `safetyScore` | Int | default(75) | Score 0-100 (Geotab Hybrid Method) |

**Relaciones:**
- `account` (N:1)
- `drivenAssets` (1:N a Asset.currentDriver) — assets que actualmente conduce
- `events` (1:N) — eventos donde figuró como driver
- `alarms` (1:N)

**Invariantes:**
- `safetyScore` ∈ [0, 100]
- Una `Person` puede ser `currentDriver` de **0 ó N** Assets simultáneamente
  (un chofer puede manejar varios vehículos en distintos momentos del día)

**Indexes:**
- `@@index([accountId])`

### 2.7 · Position

Registro GPS individual. Append-only. En producción será una hypertable
TimescaleDB; en SQLite (Lote 1) es tabla normal.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `assetId` | String | FK | Asset que reportó |
| `recordedAt` | DateTime | INDEX | Hora del device (cuando ocurrió) |
| `receivedAt` | DateTime | default(now()) | Hora de ingesta server |
| `lat` | Float | | Latitud WGS84 |
| `lng` | Float | | Longitud WGS84 |
| `speedKmh` | Float | | Velocidad en km/h |
| `heading` | Int? | | Rumbo 0-359° |
| `ignition` | Boolean | default(true) | Estado de ignición |

**Relaciones:**
- `asset` (N:1)

**Invariantes:**
- `recordedAt ≤ receivedAt` salvo casos de clock skew del device (raros)
- Cuando `receivedAt - recordedAt > 1h`, marcar como "backfill" en lógica
  (memoria del proyecto: `backfill_flag`). El campo formal llega cuando
  TimescaleDB lo necesite.
- `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`
- `speedKmh ≥ 0`
- Tabla **append-only**: nunca se updatea ni se elimina un registro
  (en producción; en dev podemos truncar)

**Indexes:**
- `@@index([assetId, recordedAt])` — query crítica: "última posición
  del asset" + "posiciones del asset entre fechas"

### 2.8 · Event

Observación discreta derivada de telemetría. Cada vez que el sistema
detecta un patrón (frenado brusco, exceso de velocidad, etc.) emite un
Event.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `assetId` | String | FK | Asset que originó |
| `personId` | String? | FK | Person identificado al momento (puede ser null) |
| `type` | enum EventType | | Tipo del evento |
| `severity` | enum Severity | default(MEDIUM) | LOW, MEDIUM, HIGH, CRITICAL |
| `occurredAt` | DateTime | | Cuándo ocurrió |
| `lat` | Float? | | Posición (puede ser null si el evento no es geo-located) |
| `lng` | Float? | | Posición |
| `speedKmh` | Float? | | Velocidad al momento |
| `metadata` | String? | | JSON stringificado (SQLite no tiene Jsonb) |

**Relaciones:**
- `asset` (N:1)
- `person` (N:1, optional)

**Invariantes:**
- `metadata` válido JSON si presente
- `personId` es snapshot del momento del evento. Si después cambia el
  driver del asset, el event mantiene el person original.
- `occurredAt` viene del device cuando es derivado de telemetría;
  viene del server si es un evento de sistema (IGNITION, etc.)

**Indexes:**
- `@@index([assetId, occurredAt])` — eventos de un asset en un período
- `@@index([personId, occurredAt])` — eventos de un driver en un período (para safetyScore)

### 2.9 · Alarm

Event escalado que requiere atención humana. Tiene lifecycle propio.

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | String | PK, cuid | Primary key |
| `accountId` | String | FK | Account (denormalizado para queries cross-asset) |
| `assetId` | String | FK | Asset que disparó |
| `personId` | String? | FK | Person al momento |
| `type` | enum AlarmType | | PANIC, SPEEDING_CRITICAL, HARSH_DRIVING, etc. |
| `severity` | enum Severity | | Heredada del event que la disparó |
| `status` | enum AlarmStatus | default(OPEN) | OPEN, ATTENDED, CLOSED, DISMISSED |
| `triggeredAt` | DateTime | | Cuándo se creó la alarma |
| `attendedAt` | DateTime? | | Cuándo un operador la atendió |
| `closedAt` | DateTime? | | Cuándo se cerró/descartó |
| `lat` | Float? | | Posición |
| `lng` | Float? | | Posición |
| `notes` | String? | | Comentario libre del operador |

**Relaciones:**
- `account` (N:1)
- `asset` (N:1)
- `person` (N:1, optional)

**Invariantes:**
- Lifecycle de timestamps:
  - `OPEN`: solo `triggeredAt`
  - `ATTENDED`: `triggeredAt` + `attendedAt`
  - `CLOSED` o `DISMISSED`: los tres timestamps
  - `attendedAt ≥ triggeredAt`, `closedAt ≥ attendedAt`
- `account.id === asset.accountId` (denormalización debe ser consistente)
- Una vez `CLOSED` o `DISMISSED`, no debería volver a `OPEN`. Si se
  necesita reabrir, se crea una nueva alarma.

**Indexes:**
- `@@index([accountId, status, triggeredAt])` — Dashboard D: alarms abiertas del account ordenadas por fecha
- `@@index([assetId, triggeredAt])` — todas las alarms de un asset (Libro B)

---

## 3 · Catálogo de enums

| Enum | Valores | Uso |
|---|---|---|
| `Tier` | BASE, PRO, ENTERPRISE | Plan comercial del Account |
| `MobilityType` | MOBILE, FIXED | Tipo de movilidad del Asset |
| `AssetStatus` | MOVING, IDLE, STOPPED, OFFLINE, MAINTENANCE | Estado operativo |
| `AlarmDomain` | CONDUCCION, SEGURIDAD | Módulo del producto al que pertenece la alarma |
| `EventType` | (ver desglose abajo) | Categorización del Event por dominio |
| `Severity` | LOW, MEDIUM, HIGH, CRITICAL | Escala de 4 niveles |
| `AlarmType` | (ver desglose abajo) | Categorización del Alarm por dominio |
| `AlarmStatus` | OPEN, ATTENDED, CLOSED, DISMISSED | Lifecycle del Alarm |

### 3.1 · EventType desglosado por dominio

| Valor | Dominio | Significado |
|---|---|---|
| HARSH_BRAKING | Conducción | Frenado brusco detectado por acelerómetro |
| HARSH_ACCELERATION | Conducción | Aceleración brusca |
| HARSH_CORNERING | Conducción | Curva agresiva |
| SPEEDING | Conducción | Exceso de velocidad sostenido |
| IDLING | Conducción | Ralentí prolongado con vehículo detenido |
| IGNITION_ON | Conducción | Encendido del vehículo |
| IGNITION_OFF | Conducción | Apagado del vehículo |
| PANIC_BUTTON | Seguridad | Botón de pánico presionado por chofer/operador |
| UNAUTHORIZED_USE | Seguridad | Movimiento detectado fuera de horario o sin operador |
| DOOR_OPEN | Seguridad | Apertura de puerta del vehículo |
| SIDE_DOOR_OPEN | Seguridad | Apertura de puerta lateral |
| CARGO_DOOR_OPEN | Seguridad | Apertura de puerta de carga |
| TRAILER_DETACH | Seguridad | Desenganche de trailer detectado |
| GPS_DISCONNECT | Seguridad | Pérdida de señal GPS sospechosa |
| POWER_DISCONNECT | Seguridad | Desconexión de batería del device |
| JAMMING_DETECTED | Seguridad | Inhibidor de señal detectado |
| SABOTAGE | Seguridad | Sabotaje genérico al equipo |
| GEOFENCE_ENTRY | Seguridad | Entrada a zona definida |
| GEOFENCE_EXIT | Seguridad | Salida de zona definida |

### 3.2 · AlarmType desglosado por dominio

| Valor | Dominio | Disparado por |
|---|---|---|
| HARSH_DRIVING_PATTERN | Conducción | Múltiples HARSH_* en corta ventana de tiempo |
| SPEEDING_CRITICAL | Conducción | SPEEDING con severity CRITICAL |
| RECKLESS_BEHAVIOR | Conducción | Patrón de eventos de imprudencia |
| PANIC | Seguridad | PANIC_BUTTON de severidad alta |
| UNAUTHORIZED_USE | Seguridad | UNAUTHORIZED_USE escalado |
| SABOTAGE | Seguridad | SABOTAGE detectado |
| GPS_DISCONNECT | Seguridad | GPS_DISCONNECT sostenido |
| POWER_DISCONNECT | Seguridad | POWER_DISCONNECT inesperado |
| JAMMING | Seguridad | JAMMING_DETECTED confirmado |
| TRAILER_DETACH | Seguridad | TRAILER_DETACH fuera de zona autorizada |
| CARGO_BREACH | Seguridad | CARGO_DOOR_OPEN fuera de ruta autorizada |
| DOOR_BREACH | Seguridad | DOOR_OPEN/SIDE_DOOR_OPEN fuera de operación normal |
| GEOFENCE_BREACH_CRITICAL | Seguridad | Salida de zona prohibida |
| DEVICE_OFFLINE | Transversal | Device sin reportar > N minutos (pertenece a Seguridad por default) |

### 3.3 · Mapeo Event → Alarm

Cuando un Event de severidad HIGH o CRITICAL se escala a alarma, el
sistema usa este mapeo (implementado en `prisma/seed.ts#mapEventToAlarm`
y replicará la lógica el AlarmRule engine en Lote 4+):

```
Event                       →  Alarm
────────────────────────────────────────────────────────────────────
SPEEDING (CRITICAL)         →  CONDUCCION.SPEEDING_CRITICAL
HARSH_BRAKING/ACC/CORNER    →  CONDUCCION.HARSH_DRIVING_PATTERN
PANIC_BUTTON                →  SEGURIDAD.PANIC
UNAUTHORIZED_USE            →  SEGURIDAD.UNAUTHORIZED_USE
SABOTAGE                    →  SEGURIDAD.SABOTAGE
GPS_DISCONNECT              →  SEGURIDAD.GPS_DISCONNECT
POWER_DISCONNECT            →  SEGURIDAD.POWER_DISCONNECT
JAMMING_DETECTED            →  SEGURIDAD.JAMMING
TRAILER_DETACH              →  SEGURIDAD.TRAILER_DETACH
CARGO_DOOR_OPEN             →  SEGURIDAD.CARGO_BREACH
DOOR_OPEN | SIDE_DOOR_OPEN  →  SEGURIDAD.DOOR_BREACH
GEOFENCE_ENTRY|EXIT         →  SEGURIDAD.GEOFENCE_BREACH_CRITICAL
IDLING | IGNITION_*         →  (no escala — son informativos)
```

**Reglas para enums:**
- Valores en `SCREAMING_SNAKE_CASE` (convención Prisma)
- No agregar valores sin ADR cuando el enum está en uso por > 2 entidades
- Eliminar valores **nunca** — siempre deprecar primero, migrar data,
  después remover en una versión major
- Cualquier nuevo EventType o AlarmType debe declarar explícitamente su
  AlarmDomain en `format.ts` (`EVENT_TYPE_TO_DOMAIN`, `ALARM_TYPE_TO_DOMAIN`)

---

## 4 · Cardinalities y razones

Resumen de las decisiones de cardinality y por qué se eligieron así.

| Relación | Cardinality | Razón |
|---|---|---|
| Organization → Accounts | 1:N | Un Maxtracker tiene muchos clientes |
| Account → Groups | 1:N | Cada cliente organiza sus assets en grupos propios |
| Account → Assets | 1:N | El Asset es propiedad del cliente |
| Account → Persons | 1:N | Cada cliente tiene su staff |
| **Group → Asset** | **1:N** | **ADR-001:** un asset pertenece a UN group, no a varios. Decisión deliberada para simplificar UI y queries |
| Group → Subgroups | 1:N (self) | Jerarquía 2 niveles (memoria proyecto) |
| Asset → Devices | 1:N | Un asset puede tener varios devices simultáneos |
| Asset → currentDriver | N:1 (optional) | Un driver puede estar manejando este asset *ahora*. Snapshot, no historial. |
| Person → drivenAssets | 1:N | Un chofer puede manejar varios assets en distintos momentos |
| Asset → Positions | 1:N append-only | Telemetría ingesta-only, nunca update |
| Asset → Events | 1:N | Cada asset acumula sus events |
| Event → Person | N:1 (optional) | Snapshot del driver al momento del evento |
| Asset → Alarms | 1:N | Cada asset acumula sus alarms |
| Account → Alarms | 1:N | Denormalizado para query Dashboard D |

### Decisiones explícitas que NO son N:M

Para evitar discusiones futuras, dejamos documentado por qué algunas
relaciones que podrían ser N:M están como 1:N:

| Relación | Por qué NO es N:M |
|---|---|
| Asset ↔ Group | ADR-001 — simplifica queries de agregación, claridad UX |
| Person ↔ Asset (driver) | El campo `currentDriver` es snapshot. El historial de "qué driver manejó qué asset" se reconstruye desde Events que tienen `personId`. |
| Asset ↔ Account | Un asset es propiedad de un solo cliente, no se comparte. |
| Asset ↔ Device | El Device se instala en un Asset físico. Mover device a otro asset = nueva fila + lastSeenAt antiguo termina + nueva instalación. |

---

## 5 · Entidades diferidas (lotes futuros)

Conceptualmente existen pero no están en el schema todavía. Documentadas
para que el equipo no improvise sus equivalentes mientras tanto.

### 5.1 · Trip (Viaje) · Lote 2.x

Composite event que abarca desde un IGNITION_ON hasta el siguiente
IGNITION_OFF (con criterios de reagrupamiento — paradas cortas no
cortan el viaje).

```
Trip {
  id, assetId, personId?, accountId
  startedAt, endedAt
  startLat, startLng, endLat, endLng
  distanceKm, durationSec
  fuelLitres?, avgSpeedKmh, maxSpeedKmh
  status (IN_PROGRESS, COMPLETED, MANUAL)
}
```

Generación: automática (por ignición) o manual (despachador asigna).

### 5.2 · Zone / Geofence · Lote 2.x

Polígono geográfico con reglas asociadas. Disparan events `GEOFENCE_ENTRY`
y `GEOFENCE_EXIT`.

```
Zone {
  id, accountId, name, type (CIRCLE | POLYGON)
  geometry (GeoJSON o lat/lng/radius)
  rules (entry, exit, dwell)
}
```

### 5.3 · ServiceRecord · Lote 3.x

Mantenimiento aplicado al Asset. Memoria del proyecto: el service vive
con el Asset, no con el Device.

```
ServiceRecord {
  id, assetId, accountId
  type (PREVENTIVE | CORRECTIVE | INSPECTION)
  performedAt
  kmAtService, hourMeterAtService
  description, costAmount?, costCurrency?
  performedBy (string o ProviderId futuro)
}
```

### 5.4 · Document · Lote 3.x

Pólizas, VTV, cédulas verdes, contratos. Referencia genérica.

```
Document {
  id, accountId
  ownerType (ASSET | PERSON | ACCOUNT)
  ownerId
  type, number, issuedAt, expiresAt
  fileUrl?
}
```

### 5.5 · POI · Lote 3.x

Point of interest. A diferencia de Zone, es un punto, no un polígono.
Para marcar bases, talleres, paradas habituales.

### 5.6 · AlarmRule · Lote 3.x

Regla declarativa que dispara alarms desde events. Hoy las alarms se
crean directamente desde el seed; en producción una regla evalúa cada
event.

```
AlarmRule {
  id, accountId, scope (ACCOUNT | GROUP | ASSET), scopeId?
  enabled
  trigger { eventType, severity, threshold?, dwellTime? }
  action { alarmType, severity, notifyChannels? }
}
```

### 5.7 · KpiDailySnapshot · Lote 3.x

Pre-agregación diaria por (Account, Asset, Person) para que los
dashboards no tengan que recalcular sobre 16M+ events cada vez que
abren el Dashboard D.

```
KpiDailySnapshot {
  id, accountId, scope (ACCOUNT | ASSET | PERSON), scopeId
  date (DATE)
  eventCount, alarmCount
  kmDriven, hoursMoving
  fuelLitres?, co2Kg?
  safetyScore (calculado)
}
```

### 5.8 · User · Lote 4.x

Identidad para login (vía Auth0). **Distinto de Person.** Una Person es
un objeto del dominio (un chofer); un User es alguien que puede entrar al
sistema. Pueden coincidir (un dispatcher que también es user) o no (un
chofer que nunca abre la app).

```
User {
  id (sub de Auth0)
  email, name
  role (OWNER, ADMIN, DISPATCHER, OPERATOR, READ_ONLY, …)
  accountId (account default)
  accessibleAccountIds (puede manejar múltiples)
  linkedPersonId? (si el user es además un chofer)
}
```

### 5.9 · Role / Permission · Lote 4.x

RBAC. Memoria del proyecto: el sistema soporta 16 roles. Cada Role tiene
un set de Permissions. Permissions atómicas (`alarm:close`, `asset:edit`,
`report:export`, …).

---

## 6 · Migration path · SQLite → Postgres + TimescaleDB

Lote 1 vive en SQLite por simplicidad. La producción será Postgres con
TimescaleDB. Esta sección documenta qué cambia.

### 6.1 · Cambios mecánicos

| Aspecto | SQLite (hoy) | Postgres (producción) |
|---|---|---|
| Provider Prisma | `sqlite` | `postgresql` |
| Datasource URL | `file:./dev.db` | `postgresql://...` |
| Tipo `String` con JSON | almacena texto literal | reemplazar por `Json` (Jsonb) |
| Tipo `DateTime` | almacenado como ISO string | almacenado como `timestamptz` |
| Full-text search | `LIKE %x%` | `to_tsvector` + GIN index |
| Foreign keys | opt-in (PRAGMA) | enforced default |
| Aggregations complejas | limitadas | ventanas, CTEs, lateral joins |

### 6.2 · Campos que cambiarán de tipo

```diff
model Event {
- metadata String?   // JSON stringificado en SQLite
+ metadata Json?     // Jsonb nativo en Postgres
}

model Zone {  // futura
- geometry String    // GeoJSON stringificado
+ geometry Json      // Jsonb (o postgis si vamos a esa ruta)
}
```

### 6.3 · Hypertables TimescaleDB

Las tablas de telemetría se convierten en hypertables (particionadas por
tiempo automáticamente):

```sql
-- Después de crear las tablas con Prisma:
SELECT create_hypertable('Position', 'recordedAt',
  chunk_time_interval => INTERVAL '1 day');

SELECT create_hypertable('Event', 'occurredAt',
  chunk_time_interval => INTERVAL '7 days');
```

Beneficios:
- Queries por rango de fechas escanean solo los chunks relevantes
- Inserts mantienen performance constante a 100M+ rows
- Compresión automática de chunks viejos (5x-10x reducción)

### 6.4 · Indexes que se reemplazan

```diff
- @@index([assetId, recordedAt])     // SQLite B-tree
+ @@index([assetId, recordedAt DESC]) // Postgres + ASC/DESC explicit
```

Postgres respeta el orden del index para `ORDER BY` queries — clave para
"última posición" que ordena `recordedAt DESC LIMIT 1`.

### 6.5 · Full-text search

Cuando lleguemos a búsqueda libre cross-entity (Lote 3+):

```sql
ALTER TABLE Asset ADD COLUMN searchVec tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(plate, ''))
  ) STORED;

CREATE INDEX asset_search ON Asset USING GIN(searchVec);
```

En SQLite la búsqueda es `name LIKE '%foo%' OR plate LIKE '%foo%'`. En
producción esto no escala más allá de ~10k assets.

### 6.6 · Strategy de migración real

Cuándo: **Lote 3 o 4**, cuando la complejidad de queries lo justifique.
Antes de eso, SQLite alcanza para UX iteration.

Pasos:
1. Setup Postgres local con Docker Compose (incluyendo TimescaleDB extension)
2. Cambiar `provider` y `DATABASE_URL` en `prisma/schema.prisma` y `.env`
3. Resolver los 2-3 campos que cambian de tipo (`metadata String → Json`)
4. `npx prisma migrate dev --name postgres-init`
5. Adaptar el seed (cambios mínimos: faker funciona igual)
6. Convertir `Position`, `Event` a hypertables (SQL post-migrate)
7. Verificar todas las queries actuales siguen funcionando
8. Smoke test del demo end-to-end
9. ADR-XXX que documenta la migración

Estimación: 2-3 sesiones para setup + 1 sesión por cada lote para
re-validar queries.

---

## 7 · Cobertura de Lote 1

```
Entidades implementadas:        9
Entidades diferidas:            9 (Trip, Zone, ServiceRecord, Document,
                                   POI, AlarmRule, KpiDailySnapshot,
                                   User, Role)
Enums implementados:            7
Indexes definidos:              9
Cardinalities documentadas:    13

Cobertura del dominio Maxtracker:
  Asset & monitoring:        ████████████████████  100%
  Telemetry:                 ███████████████░░░░░   75%  (falta Trip)
  Alarming:                  ████████████░░░░░░░░   60%  (falta AlarmRule)
  Zoning & maps:             ██░░░░░░░░░░░░░░░░░░   10%  (falta Zone)
  Maintenance:               ░░░░░░░░░░░░░░░░░░░░    0%  (Lote 3)
  Documentation:             ░░░░░░░░░░░░░░░░░░░░    0%  (Lote 3)
  Authentication & RBAC:     ░░░░░░░░░░░░░░░░░░░░    0%  (Lote 4)
  Reporting/aggregations:    ████░░░░░░░░░░░░░░░░   20%  (queries on-the-fly)
```

---

## 8 · Reglas de mantenimiento

Cuándo y cómo se modifica este documento.

### Cuándo agregar una entidad nueva

Solo si:
1. El concepto aparece en al menos **2 conversaciones de producto distintas**
2. Tiene **comportamiento propio** (lifecycle, reglas, identidad), no es solo un campo de otra entidad
3. Hay un caso de uso concreto en el lote actual o el siguiente
4. Se documenta como ADR

### Cuándo agregar un campo a entidad existente

Más libre que agregar entidad. Igual:
1. Documentar en este DOC con descripción y constraints
2. Si afecta semántica (ej: nuevo enum), discutir con el equipo
3. Migración no destructiva (campo nullable o con default)

### Cuándo modificar una cardinality

Solo con ADR explícito. Cambiar 1:N a N:M (o viceversa) es **breaking
change** del schema y de toda la app.

### Cuándo deprecar / eliminar

Eliminar entidad o campo: **no se hace** sin pasar por:
1. Marcar como `deprecated` en código y doc
2. Período de transición (al menos 1 lote)
3. Migrar referencias
4. Eliminar en versión major + ADR

---

## 9 · Versioning

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 2026-04-25 | Catálogo inicial · 9 entidades de Lote 1 + 9 diferidas (Sub-lote 2.2) |
