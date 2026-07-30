# laborledger-api-auth

## Cuándo usar

Cuando necesites trabajar con autenticación, sesiones, roles, control de acceso, superadmin, invitaciones o password reset.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `apps/api/src/modules/identity-access/auth.controller.ts` | Endpoints de auth: login, logout, me, select-company, password-reset, invitations |
| `apps/api/src/modules/identity-access/auth.service.ts` | Lógica de login/logout/context |
| `apps/api/src/modules/identity-access/session.service.ts` | Creación/revocación de sesiones cookie-based |
| `apps/api/src/modules/identity-access/password.service.ts` | Argon2id hash/verify |
| `apps/api/src/modules/identity-access/password-reset.service.ts` | Flujo de reset password |
| `apps/api/src/modules/identity-access/auth-session.middleware.ts` | Middleware global: parsea cookie, valida sesión, attach principal |
| `apps/api/src/modules/identity-access/authenticated.guard.ts` | Guard: verifica `request.principal` existe |
| `apps/api/src/modules/identity-access/superadmin.guard.ts` | Guard: solo PLATFORM_SUPERADMIN |
| `apps/api/src/modules/identity-access/company-access.service.ts` | Build principal, listar compañías, resolver roles |
| `apps/api/src/modules/identity-access/company-scope.service.ts` | Control de acceso fino: management vs operational, location scoping |
| `apps/api/src/modules/identity-access/superadmin-bootstrap.service.ts` | Sincroniza superadmin desde env a DB al iniciar el API |
| `apps/api/src/modules/identity-access/prisma.service.ts` | PrismaService (conexión BD) |

## Sesiones

- Cookie name: `laborledger.sid`
- Token: 32 bytes random, base64url, hash SHA-256 antes de almacenar
- TTL: 7 días
- Cookie flags: `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=<seconds>`
- Sesión expiró/revocada → 401 → redirect a /login

## Roles (jerarquía)

| Rol | Acceso |
|-----|--------|
| `PLATFORM_SUPERADMIN` | Todo el sistema, todas las compañías |
| `GROUP_OWNER` | Grupo específico + todas sus compañías |
| `COMPANY_ADMIN` | Compañía específica (gestión completa) |
| `SUPERVISOR` | Solo locations asignadas (no users, kiosks, weekly close) |

## Endpoints de auth

| Método | Ruta | Auth | Propósito |
|--------|------|------|-----------|
| POST | `/auth/login` | No | Login email+password |
| POST | `/auth/logout` | Sí | Logout + revocar sesión |
| GET | `/auth/me` | Sí | Info usuario + compañías |
| POST | `/auth/select-company` | Sí | Seleccionar compañía activa |
| POST | `/auth/password-reset/request` | No | Solicitar reset (email) |
| POST | `/auth/password-reset/confirm` | No | Confirmar reset (token) |
| GET | `/auth/invitations` | Sí | Listar invitaciones |
| POST | `/auth/invitations` | Sí | Crear invitación |
| POST | `/auth/invitations/accept` | No | Aceptar invitación |
| POST | `/auth/invitations/:id/revoke` | Sí | Revocar invitación |

## Tenant isolation

- `CompanyScopeService` verifica que el principal tenga acceso a la compañía.
- `requireManagementCompany`: solo SUPERADMIN, GROUP_OWNER, COMPANY_ADMIN.
- `requireOperationalCompany`: incluye SUPERVISOR.
- Supervisores tienen `allowedLocationIds` — filtran queries de shifts, corrections, work orders.

## Superadmin bootstrap

Al iniciar el API, `superadmin-bootstrap.service.ts` lee:

```
PLATFORM_SUPERADMIN_EMAIL
PLATFORM_SUPERADMIN_PASSWORD
PLATFORM_SUPERADMIN_NAME
```

Hace `upsert` del usuario con `globalRole: PLATFORM_SUPERADMIN`. Si las vars no están definidas, no hace nada.

## Reglas

- No exponer información de usuarios en errores de login (no decir "usuario no encontrado" vs "password incorrecto").
- No permitir login de usuarios sin compañías activas.
- Password reset revoca TODAS las sesiones del usuario.
- Superadmin creado por bootstrap no tiene company memberships — el superadmin debe asignarse manualmente si necesita acceso company-level.
