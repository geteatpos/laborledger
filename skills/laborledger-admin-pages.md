# laborledger-admin-pages

## Cuándo usar

Cuando necesites trabajar con el Admin UI de LaborLedger: páginas, layout, middleware, componentes, o el BFF pattern.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `apps/admin/src/middleware.ts` | Guard de rutas: redirect a /login si no hay cookie `laborledger.sid` |
| `apps/admin/src/app/layout.tsx` | Root layout (html, globals.css, metadata) |
| `apps/admin/src/app/(workspace)/layout.tsx` | Workspace layout: verifica sesión, carga compañías, renderiza sidebar |
| `apps/admin/src/app/login/page.tsx` | Login form |
| `apps/admin/src/app/choose-company/page.tsx` | Selección de compañía |
| `apps/admin/src/app/(workspace)/page.tsx` | Dashboard (KPI placeholders) |
| `apps/admin/src/lib/api-bff.ts` | BFF client: proxy al API backend |
| `apps/admin/src/lib/workspace-auth.ts` | Auth helpers para workspace pages |
| `apps/admin/src/lib/auth-utils.ts` | Tipos y formatters de auth |
| `apps/admin/src/components/admin-shell.tsx` | Layout principal con sidebar + header |
| `apps/admin/src/components/admin-nav.tsx` | Navegación (20 items) |

## Páginas workspace

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | Dashboard | 4 KPIs placeholder + recent activity |
| `/employees` | EmployeesWorkspace | CRUD empleados, search/filter, detail drawer |
| `/users` | UsersWorkspace | Invitaciones, supervisores, asignaciones |
| `/locations` | LocationsWorkspace | CRUD locations, rates |
| `/service-clients` | ServiceClientsWorkspace | CRUD service clients |
| `/service-catalog` | ServiceCatalogWorkspace | CRUD catalog items |
| `/vehicles` | VehiclesWorkspace | CRUD vehículos, VIN decode |
| `/reception` | ReceptionWorkspace | Vehicle intake flow |
| `/jobs` | JobsWorkspace | Work orders list + detail |
| `/client-invoices` | ClientInvoicesWorkspace | CRUD invoices, issue/void, PDF, email |
| `/scheduling` | SchedulingWorkspace | Turnos semanales, copy week |
| `/review` | ReviewWorkspace | Shift review + approve |
| `/corrections` | CorrectionsWorkspace | Correcciones CRUD |
| `/weekly-close` | WeeklyCloseWorkspace | Close/reopen weekly periods |
| `/labor-billing` | LaborPayBillingWorkspace | Preview + CSV exports |
| `/labor-work` | LaborWorkLogWorkspace | Labor work assignments log |
| `/kiosks` | KiosksWorkspace | CRUD kioskos, rotate secret |
| `/rates` | RatesWorkspace | Employee + client labor rates |
| `/reports` | OperationsReportsWorkspace | KPIs |
| `/settings` | CompanySettingsWorkspace | Perfil de compañía |

## BFF Pattern

Todas las páginas workspace siguen este patrón:

1. Server component llama a `loadWorkspaceContext()` (cookie → /auth/me)
2. Page component hace `apiGet<T>(path, cookieHeader)` al API backend
3. Los datos se renderizan en client components

Las API routes en `apps/admin/src/app/api/` son proxies al backend (`http://127.0.0.1:4000`).

## Middleware

El middleware corre en todas las rutas excepto `_next/*` y `/api/*`. Si no hay cookie `laborledger.sid` y la ruta no es pública (/login, /choose-company, /forgot-password, /reset-password, /accept-invite), redirect a /login.

## Platform routes (superadmin)

Rutas bajo `/api/platform/customers/*` — solo accesibles para PLATFORM_SUPERADMIN.

## Reglas

- No llamar al API backend directamente desde el browser — siempre usar el BFF.
- No modificar `middleware.ts` sin entender el flujo de sesiones.
- Las páginas supervisor-scope usan `CompanyAccessContext.canManageCompany` para bloquear acciones.
- El workspace layout es server component — no poner lógica de cliente ahí.
- Los detail drawers son client components que fetchan datos individuales.
