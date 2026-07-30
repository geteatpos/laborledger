# laborledger-testing

## Cuándo usar

Cuando necesites correr tests, escribir tests nuevos, o diagnosticar fallos en tests existentes.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `apps/api/vitest.config.ts` | Config vitest para API tests (serial, timeout 30s) |
| `apps/api/test/integration-test-db.ts` | Setup DB: truncate + reseed superadmin |
| `tests/` | Tests unitarios (29 files) |
| `apps/api/test/` | Tests API (50 files: 34 integración + 16 unit) |

## Comandos

```bash
pnpm test                                      # todos los tests
pnpm --filter @laborledger/tests test          # solo unit tests (rápido)
pnpm --filter @laborledger/api test            # solo API tests (~2-5 min)
pnpm --filter @laborledger/api test -- --run   # single run (no watch)
```

## Estructura

| Categoría | Cantidad | Cobertura |
|-----------|----------|-----------|
| Unit tests (`tests/admin/`, `tests/field/`, `tests/worker/`, `tests/foundation/`) | 141 tests | Utils puras (formateo, validación, transformación) |
| API domain tests (`apps/api/test/*.spec.ts`) | 90 tests | Lógica de negocio sin DB |
| Integration tests (`apps/api/test/*.integration.spec.ts`) | 101 tests | HTTP + DB real (NestJS + Postgres) |

## Cómo escribir tests

### Unit test pattern

```typescript
import { describe, expect, it } from "vitest";
import { formatX } from "../../apps/admin/src/lib/module";

describe("module-name", () => {
  it("does specific thing", () => {
    expect(formatX(input)).toBe(expected);
  });
});
```

### Integration test pattern

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/modules/app.module";
import { resetIntegrationDatabase } from "./integration-test-db";

describe("feature", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## Tests críticos

| Archivo | Qué prueba |
|---------|-----------|
| `tenant-isolation.integration.spec.ts` | Multi-tenancy: datos no cruzan compañías |
| `kiosk-punch.integration.spec.ts` | State machine de punches, idempotencia |
| `supervisor-scope.integration.spec.ts` | Supervisores solo ven sus locations |
| `shift-review.integration.spec.ts` | Aprobación de turnos, reglas de negocio |
| `weekly-close.integration.spec.ts` | Cierre semanal, lock, reopen |

## Reglas

- No modificar `integration-test-db.ts` sin entender el truncate + reseed.
- Los tests de integración requieren PostgreSQL en `localhost:55432`.
- Correr `pnpm lint && pnpm typecheck && pnpm build` antes de commitear.
- Si un test falla, primero verificar que no sea por datos existentes en DB compartida.
- Preferir bloques `it()` pequeños y enfocados (evitar tests de 50+ aserciones).
