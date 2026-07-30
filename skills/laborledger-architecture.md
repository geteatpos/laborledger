# laborledger-architecture

## Cuándo usar

Cuando necesites entender la estructura del monorepo, cómo se relacionan las apps, cómo correr el proyecto, o cómo hacer build/deploy.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `pnpm-workspace.yaml` | Define los workspaces: `apps/*`, `packages/*`, `tests` |
| `package.json` (root) | Scripts globales: `dev`, `build`, `test`, `db:*` |
| `ecosystem.config.cjs` | PM2: define 3 procesos (api, admin, field) con env desde `.env.production` |
| `tsconfig.base.json` | Config TypeScript base (ES2022, strict, Bundler resolution) |
| `packages/config/tsconfig/` | Presets: `base.json`, `nest.json`, `next.json` |

## Apps

| App | Puerto | Framework | Propósito |
|-----|--------|-----------|-----------|
| `apps/api` | 4000 (localhost) | NestJS 11 | REST API, auth, kiosk, billing, etc. |
| `apps/admin` | 3000 (Nginx) | Next.js 15 | Admin UI para company admins y superadmins |
| `apps/field` | 3001 | Next.js 15 PWA | App mobile para empleados en campo |

## Packages

| Package | Propósito |
|---------|-----------|
| `packages/database` | Prisma schema, migraciones, seed |
| `packages/config` | TSConfig presets compartidos |

## Scripts clave

```bash
pnpm dev              # api:4000 + admin:3000 + field:3001 en paralelo
pnpm build            # build todos los packages
pnpm test             # todos los tests (unit + integración)
pnpm lint             # ESLint en todos los packages
pnpm typecheck        # TypeScript type-checking
pnpm db:generate      # regenerar Prisma client
pnpm db:migrate       # aplicar migraciones a producción
pnpm seed:demo        # sembrar datos demo
```

## PM2

```bash
pm2 list                                    # ver procesos
pm2 logs laborledger-api --lines 50         # ver logs del API
pm2 delete laborledger-api && pm2 start ecosystem.config.cjs --only laborledger-api  # restart limpio
```

## Reglas

- No ejecutar comandos destructivos de Prisma en producción.
- No modificar `ecosystem.config.cjs` sin validar los 3 procesos.
- No exponer la API directamente (BFF pattern es obligatorio).
- Siempre usar `pnpm` (no npm/yarn). Versión: 11.5.2.
