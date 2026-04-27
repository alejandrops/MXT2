# Setup del repo en GitHub · paso a paso

## Pre-requisitos · una vez en cada máquina

### 1. Tener Git instalado

```bash
git --version
```

Si no lo tenés:
- **macOS:** ya viene preinstalado (sale al ejecutar arriba), o
  instalá [Xcode Command Line Tools](https://developer.apple.com/download)
- **Linux:** `sudo apt install git`

### 2. Configurar tu identidad (la primera vez)

```bash
git config --global user.name "Alejandro PS"
git config --global user.email "alejandrops@gmail.com"
```

### 3. Crear cuenta de GitHub (si no tenés)

Andá a <https://github.com/signup> · gratis · 2 minutos.

---

## En la primera máquina · setup inicial (1 sola vez)

### 1. Crear el repo en GitHub

1. Click en el `+` arriba a la derecha → **New repository**
2. Repository name: `maxtracker` (o el nombre que quieras)
3. Description: `Maxtracker · IoT fleet telematics LATAM`
4. **PRIVATE** (importante! · gratis es ilimitado en planes nuevos)
5. **NO** marques "Add a README", "Add .gitignore", "Choose a license"
   (ya los tenemos en el proyecto)
6. Click **Create repository**

### 2. Conectar tu proyecto local con el repo remoto

GitHub te muestra una pantalla con instrucciones. Ignora las que
dicen "create a new repository" y usá las de **"push an existing
repository"**. Te las pego acá adaptadas:

```bash
cd ~/Downloads/maxtracker-functional

# Inicializar git en el proyecto (solo si no existe .git/)
git init -b main

# Agregar todos los archivos
git add .

# Primer commit
git commit -m "Initial Maxtracker functional demo

- 23 real-trajectory vehicles (16 trucks, 6 motos, 1 pickup)
- Live tracking map with multi-view (4/6/9/12/16 mini-maps)
- Histórico replay per vehicle/day
- Safety dashboard
"

# Conectar al repo remoto (cambia TU_USUARIO por el tuyo)
git remote add origin https://github.com/TU_USUARIO/maxtracker.git

# Subir todo (la primera vez con -u para guardar la conexión)
git push -u origin main
```

GitHub te va a pedir credenciales. Hay 2 formas:

#### Opción A · Personal Access Token (clásica, 5 minutos)

1. GitHub → Settings (avatar arriba derecha) → Developer settings →
   Personal access tokens → Tokens (classic) → Generate new token
2. Note: `maxtracker dev`
3. Expiration: `90 days` o `No expiration`
4. Scopes: marcá `repo` (todo lo de adentro)
5. Generate token · COPIALO ya (no lo vas a ver de nuevo)
6. Cuando git pida password, pegás ese token

#### Opción B · GitHub CLI (más cómoda, 2 minutos)

```bash
brew install gh        # macOS
gh auth login          # te guía paso a paso por el browser
```

Después de eso, los `git push` se autentican solos.

### 3. Verificá que subió

Andá a `https://github.com/TU_USUARIO/maxtracker` · deberías ver
todos los archivos.

---

## En la SEGUNDA máquina (donde estás ahora)

### 1. Clonar el repo

```bash
cd ~/Downloads
git clone https://github.com/TU_USUARIO/maxtracker.git
cd maxtracker
```

### 2. Instalar y poblar la DB local

```bash
npm install
DATABASE_URL="file:./dev.db" npx prisma db push --skip-generate
DATABASE_URL="file:./dev.db" npx prisma generate
npm run db:seed
npm run dev
```

Listo. Ya estás corriendo el proyecto en la segunda máquina, con
exactamente el mismo código que la primera.

---

## Workflow diario · de ahora en adelante

### Cuando empezás a trabajar en una máquina

```bash
cd ~/Downloads/maxtracker
git pull
```

Esto trae los cambios que hayas hecho en la otra compu.

### Cuando hiciste cambios y querés guardarlos

```bash
git add .
git commit -m "describe lo que cambió"
git push
```

### Si me pasás un patch de mi parte (zip o pegado)

```bash
# Guardar tu trabajo actual primero (por si lo querés conservar)
git add .
git commit -m "WIP antes del patch"

# Aplicar el patch (manual o con apply.sh)
bash apply.sh

# Commitear los cambios del patch
git add .
git commit -m "Apply Claude patch · descripción"
git push
```

---

## Cosas útiles que vas a querer saber

### Ver el historial de cambios

```bash
git log --oneline -20
```

### Ver qué archivos cambiaron pero todavía no commiteaste

```bash
git status
```

### Ver QUÉ cambió exactamente (diff)

```bash
git diff
```

### Deshacer cambios locales (CUIDADO · pierde el trabajo)

```bash
git checkout -- nombre-de-archivo
```

### Trabajar con branches (recomendado para features grandes)

```bash
# Crear branch nueva
git checkout -b feature/conduccion-dashboard

# Trabajás, commiteás, push como siempre
git push -u origin feature/conduccion-dashboard

# Cuando termina, mergeás de vuelta a main
git checkout main
git merge feature/conduccion-dashboard
git push
```

---

## Problemas comunes y solución

### "fatal: refusing to merge unrelated histories"

```bash
git pull --allow-unrelated-histories
```

### "Updates were rejected because the remote contains work..."

Alguien (vos en otra compu) commiteó algo que vos no tenés. Pull primero:

```bash
git pull
git push
```

### "Authentication failed"

Tu Personal Access Token se venció. Generá uno nuevo (paso "Opción A"
de arriba). Si usaste GitHub CLI: `gh auth login` de nuevo.

---

## Tip pro · `.gitignore` ya está configurado

El proyecto ya viene con un `.gitignore` que excluye:

- `node_modules/` (600MB · regenerable con npm install)
- `.next/` (build cache · regenerable)
- `dev.db` (SQLite · regenerable con db:seed)
- `.DS_Store` (basura de macOS)
- `.env.local` (configs locales privados)

**SÍ se commitean:**

- `prisma/seed-data/real-trajectories/*.csv` · los 23 CSVs reales
- `prisma/seed.ts` · el seed
- Todo `src/`
- `package.json` y `package-lock.json`
- ADRs en `docs/`
