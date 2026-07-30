# laborledger-deploy

## Cuándo usar

Cuando necesites hacer deploy, diagnosticar problemas de producción, reiniciar procesos, ver logs, o modificar configuración de infraestructura.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `ecosystem.config.cjs` | PM2: define 3 procesos, carga `.env.production` |
| `.env.production` | Variables de entorno de producción (en .gitignore) |
| `.env.production.example` | Template (versionado, usar placeholders) |
| `deploy/deploy-vps.sh` | Script de deploy: install, migrate, build, PM2 reload, smoke checks |
| `deploy/setup-vps-first-run.sh` | One-time setup: Node 22, pnpm, PM2, Nginx, firewall |
| `deploy/nginx/admin.mariosautodetail.com.conf` | Nginx reverse proxy config |
| `deploy/README.md` | Runbook de deploy |

## PM2

```bash
pm2 list                                    # ver los 3 procesos
pm2 logs laborledger-api --lines 50         # logs del API (últimas 50 líneas)
pm2 logs laborledger-api --lines 50 --err   # solo stderr
pm2 restart laborledger-api                 # restart (cuidado: no refresca env)
pm2 delete laborledger-api && pm2 start ecosystem.config.cjs --only laborledger-api  # restart limpio con env nuevo
pm2 monit                                   # monitoreo en tiempo real
```

## Procesos

| Nombre | Puerto | Comando |
|--------|--------|---------|
| `laborledger-api` | 4000 | `pnpm --filter @laborledger/api start:prod` |
| `laborledger-admin` | 3000 | `pnpm --filter @laborledger/admin start` |
| `laborledger-field` | 3001 | `pnpm --filter @laborledger/field start` |

## Env vars requeridas

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DB_NAME?schema=public"
PLATFORM_SUPERADMIN_EMAIL=""
PLATFORM_SUPERADMIN_PASSWORD=""
PLATFORM_SUPERADMIN_NAME="Platform Superadmin"
API_BASE_URL="http://127.0.0.1:4000"
ADMIN_APP_URL="https://admin.mariosautodetail.com"
FIELD_SESSION_SECRET=""
WORKER_COMPANY_ID=""
KIOSK_ID=""
KIOSK_SECRET=""
EMAIL_PROVIDER=resend
RESEND_API_KEY=""
INVOICE_FROM_EMAIL=""
AUTH_FROM_EMAIL=""
VIN_DECODER=nhtsa
```

## Health check

```
GET http://127.0.0.1:4000/health
→ { "service": "api", "status": "ok" }
```

## Deploy steps

1. `git pull origin main`
2. `pnpm install`
3. `pnpm build`
4. `pnpm db:migrate` (si hay migraciones nuevas)
5. `pm2 delete laborledger-api && pm2 start ecosystem.config.cjs --only laborledger-api`
6. `pm2 delete laborledger-admin && pm2 start ecosystem.config.cjs --only laborledger-admin`
7. `pm2 delete laborledger-field && pm2 start ecosystem.config.cjs --only laborledger-field`
8. Verificar health endpoint
9. Verificar login en admin.mariosautodetail.com

## Reglas

- **NUNCA** commitear `.env.production`. Está en .gitignore.
- **NUNCA** hacer `pm2 restart --update-env` y asumir que funciona. Siempre `delete + start` desde ecosystem.config.cjs.
- **NUNCA** exponer la API en puerto público. Solo localhost:4000.
- **NUNCA** hacer migrate reset o db push en producción.
- El superadmin se sincroniza desde `.env.production` al iniciar el API. Cambiar password requiere reiniciar.
- Si Nginx da 502, verificar que PM2 tenga los procesos corriendo y los puertos correctos.
