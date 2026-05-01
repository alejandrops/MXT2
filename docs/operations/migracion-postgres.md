# Migración a Postgres (Supabase)

> Procedimiento para mover el proyecto de SQLite local a un Postgres
> hosteado en Supabase. **One-way · destructivo de la DB local de SQLite.**

---

## Pre-requisitos

- Cuenta en Supabase ([https://supabase.com](https://supabase.com))
- Lote H1 aplicado (este documento + el patch del schema + .env.local.example)

---

## Paso 1 · Provisionar el proyecto Supabase

1. Login en [supabase.com/dashboard](https://supabase.com/dashboard) (recomendado: con GitHub, así aprovechás SSO en Vercel después)
2. **New Project**
   - **Name:** `maxtracker-prod` (o como prefieras)
   - **Database Password:** generá una password fuerte. **Guardala** (no se vuelve a mostrar)
   - **Region:** *South America (São Paulo)* · más cercano a Argentina
   - **Plan:** Free
3. Esperar 1-2 minutos al provisioning
4. **Settings → Database → Connection string**
   - Copiar el de modo **Transaction** (puerto 6543) → será tu `DATABASE_URL`
   - Copiar el de modo **Session** (puerto 5432) → será tu `DIRECT_URL`
   - Reemplazar `[YOUR-PASSWORD]` con la password real (URL-encoded si tiene caracteres especiales)

---

## Paso 2 · Configurar `.env.local`

```bash
# Si no lo tenés desde antes
cp .env.local.example .env.local
```

Editar `.env.local` y completar:

```
DATABASE_URL="postgresql://postgres.xxx:PASSWORD@...pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.xxx:PASSWORD@...pooler.supabase.com:5432/postgres"
FLESPI_INGEST_TOKEN="..."
```

**Cuidado** con caracteres especiales en la password. Si la password tiene
`@`, `#`, `?`, `&`, etc., URL-encodear antes de pegar:
- `@` → `%40`
- `#` → `%23`
- `?` → `%3F`
- `&` → `%26`

---

## Paso 3 · Aplicar el patch del schema

```bash
bash prisma/patches/patch-schema-postgres.sh
```

Esto:
- Hace backup de `prisma/schema.prisma` en `prisma/schema.prisma.bak-sqlite`
- Cambia `provider = "sqlite"` por `provider = "postgresql"`
- Agrega `directUrl = env("DIRECT_URL")`

---

## Paso 4 · Reset y migrar

Las migrations actuales son SQLite-specific · no aplican en Postgres.
Hay que regenerarlas para Postgres con un baseline limpio.

**Antes de seguir, asegurate de NO necesitar los datos del SQLite local.**
Si los necesitás, hacé backup:

```bash
cp prisma/dev.db prisma/dev.db.backup
```

Después:

```bash
# 1. Borrar las migrations viejas (SQLite-specific)
rm -rf prisma/migrations
rm -f prisma/dev.db prisma/dev.db-journal

# 2. Regenerar el cliente Prisma con el provider nuevo
npx prisma generate

# 3. Crear la nueva migration baseline para Postgres
#    Esto crea las tablas en Supabase y guarda la migration
npx prisma migrate dev --name initial_postgres

# Si todo va bien, vas a ver:
#   Applying migration `xxxxxx_initial_postgres`
#   The following migration(s) have been applied:
#   migrations/
#     └─ xxxxxx_initial_postgres/
#        └─ migration.sql
```

Si tira un error de conexión, verificá:
- `.env.local` tiene `DATABASE_URL` y `DIRECT_URL` correctos
- La password está URL-encoded si hace falta
- Tu IP no está bloqueada (Supabase no bloquea IPs por default, pero por si acaso revisar Settings → Database → Connection pooling)

---

## Paso 5 · Re-correr seeds

Los seeds se escriben en TypeScript · son agnósticos al provider, no necesitan cambios.

```bash
# Profiles + super admin
npx tsx prisma/force-seed-users.ts

# Datos de demo (vehículos, trips, alarmas simuladas)
npx tsx prisma/seed.ts

# Multi-tenant test data (4 cuentas, 12 users, 120 vehículos)
npx tsx prisma/seed-flespi-test.ts
```

---

## Paso 6 · Smoke test

```bash
rm -rf .next && npm run dev
```

En el browser:
- `http://localhost:3000` · login automático con cookie demo
- `/admin` · ver counters de devices · debería mostrar 120 INSTALLED
- `/catalogos/vehiculos` · ver los 120 vehículos del seed
- `/admin/ingestion-status` · counters en 0 (proceso recién arrancado)
- Disparar `bash scripts/simulate-flespi-trip.sh` y verificar que `/admin/ingestion-status` muestra los 9 messages

Si todo eso anda, **tenés Maxtracker corriendo localmente con DB en Supabase Postgres**.

---

## Verificar la DB en Supabase

En el dashboard de Supabase:
- **Table Editor** · vas a ver todas las tablas (Asset, Device, User, Profile, etc.)
- **SQL Editor** · podés correr queries SQL libres

Verificar count rápido:
```sql
SELECT 'accounts' AS t, COUNT(*) FROM "Account"
UNION ALL SELECT 'users', COUNT(*) FROM "User"
UNION ALL SELECT 'assets', COUNT(*) FROM "Asset"
UNION ALL SELECT 'devices', COUNT(*) FROM "Device";
```

Esperado: 4 accounts, 12+ users, 120+ assets, 120+ devices.

---

## Rollback (si algo falla)

```bash
# Volver al schema SQLite
mv prisma/schema.prisma.bak-sqlite prisma/schema.prisma
npx prisma generate

# Restaurar la DB SQLite si la habías guardado
mv prisma/dev.db.backup prisma/dev.db

# Restaurar las migrations · ESTAS NO LAS GUARDAMOS · si ya borraste
# prisma/migrations, hay que regenerarlas con `prisma migrate dev`
# desde el schema, o restaurar desde git
git checkout HEAD -- prisma/migrations
```

---

## Troubleshooting

### "Can't reach database server"
- Verificar `.env.local` · URL correcta
- Verificar que el proyecto Supabase esté **active** (no pausado)
- Free tier de Supabase pausa el proyecto después de 1 semana sin uso · entrar al dashboard reactiva

### "ERROR: prepared statement does not exist"
- Estás usando `DATABASE_URL` (transaction mode) para una operación que necesita session mode
- `prisma migrate` debería usar `DIRECT_URL` automáticamente · verificar que esté en el schema
- Si el problema persiste, agregá `?pgbouncer=true&connection_limit=1` al final de `DATABASE_URL`

### "permission denied for schema public"
- Pasar de Free a Pro tier capaz, o
- Verificar que estás conectando con el user `postgres` (no anon o service)

### "FATAL: Tenant or user not found"
- La password tiene un caracter que no URL-encodeaste · revisar las dos URLs de connection

---

## Próximos pasos

Una vez completado este lote:
- **H2** · Supabase Auth · reemplazar cookie demo por sesión real
- **H3** · Deploy a Vercel
