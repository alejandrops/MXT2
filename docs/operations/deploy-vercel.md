# Deploy a Vercel (H3)

> Procedimiento completo para deployar Maxtracker a Vercel. Asume
> que H1 (Postgres) y H2 (Auth) están aplicados y funcionando local.

---

## Paso 1 · Push del lote H3 a GitHub

Antes de conectar Vercel al repo, asegurate de que los archivos
nuevos del lote H3 estén pusheados:

```bash
git add vercel.json package.json
git commit -m "chore(deploy): vercel config + vercel-build script (H3)"
git push origin main
```

⚠️ **Importante**: NO commitear `.env`. Verificá que esté en `.gitignore`:

```bash
grep -E "^\.env$" .gitignore || echo ".env" >> .gitignore
```

---

## Paso 2 · Importar el repo a Vercel

1. Ir a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click en **Add New → Project**
3. **Import Git Repository** · si tu repo no aparece:
   - Click en **Adjust GitHub App Permissions**
   - Otorgar acceso al repo de Maxtracker
   - Volver y click **Import**
4. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: dejar default (vercel.json sobreescribe)
   - **Output Directory**: dejar default
   - **Install Command**: `npm install` (default)

**NO HAGAS CLICK EN DEPLOY TODAVÍA.** Antes hay que configurar las env vars.

---

## Paso 3 · Variables de entorno

En la misma pantalla de configuración del proyecto, scroll a
**Environment Variables**. Agregá estas, **una por una**:

### Database

| Name           | Value                                                                | Environments |
|----------------|----------------------------------------------------------------------|--------------|
| `DATABASE_URL` | (la misma que tenés en `.env` · la del puerto 6543 con `?pgbouncer=true`) | Production, Preview, Development |
| `DIRECT_URL`   | (la misma que tenés en `.env` · la del puerto 5432)                  | Production, Preview, Development |

### Supabase Auth

| Name                            | Value                                       | Environments |
|---------------------------------|---------------------------------------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://rybxamotrazvvhjvkadw.supabase.co` (sin `/rest/v1/`!) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (el `eyJ...` que tenés en `.env`)            | Production, Preview, Development |
| `AUTH_MODE`                     | `supabase`                                  | Production, Preview |

⚠️ **Para Development** (preview branches), podés dejar `AUTH_MODE=demo`
si querés que branches de testing tengan login automático sin Supabase.
Pero para el primer deploy lo más simple es dejar `supabase` en todos.

### Flespi

| Name                  | Value                                       | Environments |
|-----------------------|---------------------------------------------|--------------|
| `FLESPI_INGEST_TOKEN` | (el token que generaste con `openssl`)      | Production, Preview, Development |

---

## Paso 4 · Deploy inicial

Click en **Deploy** abajo a la derecha.

Va a tomar **3-7 minutos**. El build hace:

1. `npm install` (instala deps + corre `postinstall: prisma generate`)
2. `prisma migrate deploy` (aplica migrations pendientes · debería decir "No pending migrations" porque ya están todas)
3. `next build` (compila Next.js)

### Si el deploy FALLA

Mirá los logs en Vercel. Causas comunes:

- **"Can't reach database server"** → revisar `DATABASE_URL` y `DIRECT_URL`
- **"P3014: Prisma Migrate could not create the shadow database"** → ya pasó · pasamos `directUrl` en el schema, debería resolver
- **Type errors en build** → bug de TypeScript que no detectaste local; mostrame el log y lo arreglo

---

## Paso 5 · Configurar Site URL en Supabase

Una vez que el deploy termine, Vercel te asigna una URL tipo
`https://maxtracker-xxxx.vercel.app`. Anotala.

En Supabase:

1. **Authentication → URL Configuration**
2. **Site URL**: cambiar a tu URL de Vercel · ej. `https://maxtracker-xxxx.vercel.app`
3. **Redirect URLs**: agregar:
   - `https://maxtracker-xxxx.vercel.app/**`
   - **Mantener** los de localhost también: `http://localhost:3000/**`
4. Click **Save**

Si no hacés esto, el callback de password reset / OAuth va a redirigir mal.

---

## Paso 6 · Smoke tests en producción

Abrir `https://maxtracker-xxxx.vercel.app` en el browser:

### Test 1 · Login real

- Te debería redirigir a `/login`
- Email: `alejandrops@gmail.com` · Password: la de Supabase
- Click Ingresar → debería entrarte al producto

### Test 2 · Ingestion endpoint público

```bash
# Healthcheck (debería decir token_configured: true)
curl https://maxtracker-xxxx.vercel.app/api/ingest/flespi | jq .
```

### Test 3 · Ingestion con auth · simular un POST de flespi desde Internet

```bash
# Reemplazá la URL y el token
NGROK_URL_DEPRECATED_USE_VERCEL="https://maxtracker-xxxx.vercel.app"
TOKEN=$(grep "^FLESPI_INGEST_TOKEN=" .env | cut -d'"' -f2)

curl -X POST "$NGROK_URL_DEPRECATED_USE_VERCEL/api/ingest/flespi" \
  -H "Content-Type: application/json" \
  -H "X-Flespi-Token: $TOKEN" \
  -d @scripts/flespi-trip-fixture.json | jq .
```

⚠️ Va a fallar con "Skipped: 9 / IMEI desconocido" porque la DB de
producción está limpia (no hay devices). Es esperado · el endpoint
sí está vivo.

### Test 4 · Ver `/admin/ingestion-status` en producción

Logueado como Alejandro, ir a `https://maxtracker-xxxx.vercel.app/admin/ingestion-status`.
Verás los counters subir si seguiste haciendo curls.

---

## Paso 7 · Configurar el stream de flespi (cuando tengas devices)

Cuando tu primer device esté listo:

1. Panel de flespi → tu cuenta → **Streams** → **New HTTPS Stream**
2. **Configuration**:
   - URL: `https://maxtracker-xxxx.vercel.app/api/ingest/flespi`
   - HTTP method: POST
   - Custom HTTP headers:
     - `X-Flespi-Token: TU_TOKEN_DE_VERCEL`
     - `Content-Type: application/json`
   - Format: **default JSON**
3. Asociar al channel/device(s) que quieras reenviar
4. Save

---

## Limitaciones conocidas en Vercel Hobby

- **Function timeout**: 10s default, 30s max → ya configurado en vercel.json
- **No procesos background persistentes** → las métricas in-memory se resetean en cold start
- **Sleep mode** → si no hay tráfico, el endpoint puede tardar 1-2s en levantarse el primer request

Para lotes más grandes o ingestion sostenida 24/7, hay que migrar a
Fly.io eventualmente (decisión documentada · sigue siendo el plan).

---

## Rollback

Si algo en producción rompe, en Vercel:

1. **Deployments** (sidebar)
2. Buscar el último deploy que funcionaba
3. Click **"..."** → **Promote to Production**

Esto te devuelve al estado anterior en 5 segundos. La DB no se toca.

---

## Custom domain (opcional · más adelante)

Cuando tengas un dominio (ej. `maxtracker.app`):

1. Vercel → tu proyecto → **Settings → Domains**
2. **Add domain**: `maxtracker.app`
3. Configurar los DNS records que te pide Vercel en tu registrar
4. Esperar la propagación (5min - 48h)
5. **Actualizar** Site URL en Supabase Auth a `https://maxtracker.app`
6. **Actualizar** Redirect URLs incluyendo el nuevo dominio
