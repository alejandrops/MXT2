# Configurar Supabase Auth

> Procedimiento completo para activar el login con email + password
> en producción. Aplica solo cuando `AUTH_MODE=supabase`.

---

## 1. Habilitar Email provider en Supabase

1. En el dashboard de Supabase → tu proyecto → **Authentication** (sidebar izquierdo · ícono de candado)
2. Click en **Sign In / Providers**
3. **Email** debería estar habilitado por default. Si no, activarlo
4. Configurar:
   - **Confirm email**: por ahora **deshabilitar** (mientras estás en testing · prendelo después de tener custom SMTP)
   - **Secure email change**: dejar habilitado
   - **Secure password change**: dejar habilitado
5. Click en **Save**

### Razón de "Confirm email: off" temporal

Por default Supabase usa un SMTP compartido **que tiene rate limit de 4 emails por hora**. Inutilizable para testing real. Hay tres opciones:

- **Now**: deshabilitar confirm email, los users ingresan directo sin confirmar
- **Later**: configurar SMTP propio (Resend, SendGrid, AWS SES) cuando lo tengas
- **Lo correcto a largo plazo**: SMTP propio + confirm email obligatorio

Hacemos "Now" para no bloquearnos. Anota como tarea pendiente para H3 o después.

---

## 2. Configurar URLs de redirect

En **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (lo cambiamos a la URL de Vercel en H3)
- **Redirect URLs**: agregar:
  - `http://localhost:3000/**`
  - (cuando vayas a Vercel) `https://maxtracker.vercel.app/**`

Click en **Save**.

---

## 3. Variables de entorno

Necesitamos 2 variables más en `.env`. Sacalas del dashboard:

**Settings → API**:
- **URL**: `https://xxxxxxxxxxxx.supabase.co` → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** (project_anon key): la string `eyJ...` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Editar `.env`:

```bash
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJxxxxx..."

# Habilitar Auth real
AUTH_MODE="supabase"
```

⚠️ Si querés seguir con la cookie demo en local, **no agregues `AUTH_MODE`** (o ponelo `demo`). Las páginas y middleware respetan eso.

---

## 4. Crear tu user en Supabase Auth

Hay tres formas, te recomiendo la primera:

### A · Desde el dashboard (más simple)

1. **Authentication → Users** (sidebar)
2. Click en **Add user → Create new user**
3. Email: `alejandrops@gmail.com` (debe ser idéntico al de tu User local)
4. Password: la que vayas a usar para loguear · NO la pegues en chat
5. **Auto Confirm User** = ✓ (porque deshabilitamos confirm email)
6. Click **Create user**
7. **Copiá el UUID del user creado** · vas a verlo como `b1234567-89ab-cdef-...` en la lista

### B · Usar la API (programático)

```bash
SUPABASE_SERVICE_ROLE_KEY="..."  # de Settings → API → service_role (NO commitear)
curl -X POST 'https://xxxxxxxxxxxx.supabase.co/auth/v1/admin/users' \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alejandrops@gmail.com",
    "password": "...",
    "email_confirm": true
  }'
```

---

## 5. Linkear el user de Auth con el de la DB

Supabase Auth y nuestro `User` local son tablas separadas. Hay que conectarlos vía `User.supabaseAuthId`.

### En Supabase SQL Editor:

```sql
-- Reemplazá el UUID con el que copiaste del paso 4A
UPDATE "User"
SET "supabaseAuthId" = 'b1234567-89ab-cdef-...'
WHERE email = 'alejandrops@gmail.com';
```

Verificá:
```sql
SELECT email, "supabaseAuthId" FROM "User";
```

Tendría que devolver: `alejandrops@gmail.com | b1234567-...`

---

## 6. Probar el login

```bash
# Reiniciar dev server con AUTH_MODE=supabase
rm -rf .next
npm run dev
```

En el browser → `http://localhost:3000`:

1. Como no hay sesión y `AUTH_MODE=supabase`, el middleware te redirige a `/login`
2. Email: `alejandrops@gmail.com`
3. Password: la que pusiste en el dashboard de Supabase
4. Click "Ingresar"
5. Debería redirigirte a `/` con tu sesión activa

Si ves el producto y arriba a la derecha tu nombre, ¡listo!

---

## 7. Si querés volver a modo demo

Para iterar más rápido, podés volver a cookie demo:

```bash
# En .env
AUTH_MODE="demo"

# Reiniciar dev server
rm -rf .next
npm run dev
```

Volvés al comportamiento anterior · Switcher de identidad disponible, login automático con el primer SUPER_ADMIN.

---

## Provisionar más users

Cuando quieras crear más users (CLIENT_ADMIN, OPERATOR, etc. para clientes):

1. Crear el `User` en nuestra DB (con su accountId, profile, etc.)
2. Crear el user correspondiente en Supabase Auth (paso 4A)
3. Linkear con el UPDATE del paso 5

En el lote H3 (deploy a Vercel) vamos a agregar un endpoint en el backoffice para automatizar esto · "crear user" desde la UI de admin.

---

## Troubleshooting

### "Invalid login credentials"
- Verificá que el email en Supabase Auth y en `User.email` coincidan **exacto**
- Verificá que el password sea correcto (no espacios extras, mayúsculas)

### "user_not_provisioned" después del login
- El user existe en Auth pero no encontramos un `User` con ese `supabaseAuthId`
- Hacer el UPDATE del paso 5

### Loop infinito de redirects entre `/` y `/login`
- Verificá que las cookies de Supabase no estén bloqueadas (DevTools → Application → Cookies)
- Verificá que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén correctas
- Limpiá `.next` y reiniciá dev server

### El switcher de identidad sigue apareciendo en modo supabase
- Verificá que `AUTH_MODE=supabase` esté en `.env` (no `.env.local`)
- Reiniciá el dev server (Next.js no recarga env vars en HMR)
