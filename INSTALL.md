# Maxtracker · Instalación en una Mac nueva

## TL;DR

```
brew install node
cd maxtracker-functional
bash setup.sh
npm run dev
```

Después abrí <http://localhost:3000>.

---

## Pre-requisitos

### Homebrew

Si no lo tenés (verificá con `brew --version`):

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Al final del install, Homebrew te dice 1 o 2 comandos para agregar al PATH.
Hacelos.

### Node.js (versión 20 o superior)

```
brew install node
```

Verificá:

```
node --version
npm --version
```

Si `node --version` devuelve algo como `v18.x` o más viejo:

```
brew upgrade node
```

### Git (probablemente ya viene)

```
git --version
```

Si dice "command not found":

```
brew install git
```

---

## Instalación del proyecto

### 1. Descomprimí el zip

```
cd ~/Downloads
unzip maxtracker-functional.zip
cd maxtracker-functional
```

### 2. Corré el setup

```
bash setup.sh
```

Esto hace en orden:

1. Verifica que tengas Node ≥ 20
2. Instala las dependencias (`npm install`)
3. Crea la base de datos SQLite
4. La puebla con los datos de demo (~10k posiciones reales · 12 vehículos)

Tarda en total 2-3 minutos.

### 3. Arrancá el server

```
npm run dev
```

Abrí <http://localhost:3000> en tu browser.

---

## Si algo falla

### "command not found: node" o "npm"

Node.js no está en el PATH. Verificá con:

```
which node
```

Si no devuelve nada, repetí los pasos de pre-requisitos.

### Errores raros de TypeScript en el setup

Borrá `node_modules` y reintentá:

```
rm -rf node_modules
npm install
```

### "Cannot find module '@prisma/client'"

```
npx prisma generate
```

### El puerto 3000 está ocupado

```
PORT=3001 npm run dev
```

### Querés re-popular la DB con datos limpios

```
npm run db:seed
```

(Si hubo cambios en el schema, primero `npx prisma migrate dev` o `npm run db:reset`.)

### Querés ver la DB en una UI

```
npm run db:studio
```

Abre Prisma Studio en <http://localhost:5555>.

---

## Estructura del proyecto

```
maxtracker-functional/
├── src/
│   ├── app/                    Next.js routes
│   ├── components/             React components
│   └── lib/                    queries, format, helpers
├── prisma/
│   ├── schema.prisma           DB schema
│   ├── seed.ts                 seed script
│   ├── seed-data/              CSVs reales + parsers
│   └── dev.db                  SQLite (creada por setup.sh)
├── docs/
│   └── adr/                    decisiones de arquitectura
├── package.json
├── tsconfig.json
├── .env                        DATABASE_URL local
├── setup.sh                    instalación automatizada
├── README.md                   documentación general
└── INSTALL.md                  este archivo
```

---

## Próximos pasos

Una vez que ande, abrí el README.md que tiene la documentación completa:

- Lote actual: 3 (Históricos completo)
- Páginas implementadas: Seguridad/Dashboard, Alarmas, Gestión/Vehículos,
  Históricos
- ADRs documentando decisiones técnicas en `docs/adr/`
