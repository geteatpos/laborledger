# laborledger-database

## Cuándo usar

Cuando necesites trabajar con la base de datos: schema, migraciones, seed, consultas, o diagnosticar problemas de datos.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `packages/database/prisma/schema.prisma` | Modelo de datos completo (24 modelos, 19 enums) |
| `packages/database/prisma/migrations/` | 21 migraciones (0001 a 0021) |
| `packages/database/src/seed-demo.ts` | Seed script con datos demo |
| `packages/database/src/index.ts` | Exporta PrismaClient (pero no se usa desde apps — cada app tiene su propia instancia) |
| `apps/api/src/modules/identity-access/prisma.service.ts` | PrismaService de NestJS (conecta/desconecta en lifecycle) |

## Comandos

```bash
pnpm db:generate                  # regenerar Prisma client desde schema
pnpm db:migrate                   # aplicar migraciones pendientes (migrate deploy)
pnpm db:validate                  # validar schema Prisma
pnpm seed:demo                    # sembrar datos demo (solo desarrollo)
pnpm --filter @laborledger/database prisma -- --help  # acceso directo a Prisma CLI
```

## Modelos principales

| Dominio | Modelos |
|---------|---------|
| Auth/Tenancy | `User`, `Session`, `Group`, `Company`, `GroupMembership`, `CompanyMembership`, `Invitation`, `PasswordResetToken` |
| Time Tracking | `Shift`, `Kiosk`, `KioskCredential`, `PunchEvent`, `CorrectionRequest`, `PunchCorrection`, `WeeklyPeriod`, `WeeklyCloseSnapshot`, `ScheduleTemplate`, `ShiftGenerationBatch` |
| Field Operations | `Employee`, `EmployeePinCredential`, `EmployeeRate`, `ClientLaborRate`, `SupervisorLocationAssignment`, `Location`, `ServiceClient` |
| Work Orders | `WorkOrder`, `WorkOrderServiceLine`, `WorkOrderStatusHistory`, `WorkOrderAssignment`, `Vehicle`, `VehicleResponsibilityLog`, `WorkerScanEvent`, `ServiceCompletion` |
| Billing | `ClientInvoice`, `ClientInvoiceLine`, `ClientInvoiceDelivery`, `ServiceCatalogItem` |
| Labor | `LaborWorkAssignment` |

## Reglas críticas

- **NUNCA** ejecutar `prisma migrate reset`, `db push --force-reset`, `drop database` en producción.
- **NUNCA** modificar migraciones ya aplicadas. Crear una nueva migración.
- La `DATABASE_URL` se resuelve desde env var. No commitear la real — usar `.env.production` (en .gitignore).
- No hay Prisma middleware (`$use()` o `$extends()`) — soft-deletes y auditoría son manuales.
- El schema usa `map:` en todos los modelos (nombres snake_case en DB, camelCase en Prisma).

## Seed

El seed crea: 1 superadmin, 1 group owner, 1 company admin, 1 compañía demo, 5 service clients, 4 catalog items, 6 employees con PINs, 1 kiosko, y 2 semanas de turnos.

El seed **no es seguro para producción** — expone credenciales en stdout.

## Prisma version

Actualmente hay mismatch: root/api usan `@prisma/client@6.10.1`, database usa `6.19.3`. Alinear antes de trabajar.
