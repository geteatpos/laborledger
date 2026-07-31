# Plan de Implementación — Redesign LaborLedger Admin

## Sistema Elegido: LaborLedger (Inter, 8px, #2563EB)

---

## Resumen de Cambios vs Actual

| Aspecto | Actual | Nuevo (Stitch) | Diferencia |
|---------|--------|----------------|------------|
| Primary | #2563EB | #004AC6 | Oscurece un poco |
| Primary Container | #EFF6FF | #2563EB | AHORA es el azul de acento |
| Surface BG | #F8FAFC | #F8FAFA | casi igual |
| Error | #DC2626 | #BA1A1A | más oscuro |
| Body text | #0F172A | #191C1D | casi igual |
| Border | #E2E8F0 | #E5E7EB | muy similar |

**Buena noticia:** El actual `#2563EB` se convierte en `primary-container` — el cambio es menor.

---

## FASE 1: Tokenización

### 1.1 tailwind.config.ts — Actualizar colores

```typescript
colors: {
  // PRIMARY: #004ac6 (era #2563EB)
  primary: "#004ac6",
  "primary-container": "#2563eb",  // El azul actual se mueve a container
  "on-primary": "#ffffff",
  "on-primary-container": "#eeefff",
  
  // SURFACE TOKENS (Material Design 3)
  surface: "#f8f9fa",
  "surface-dim": "#d9dadb",
  "surface-bright": "#f8f9fa",
  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#f3f4f5",
  "surface-container": "#edeeef",
  "surface-container-high": "#e7e8e9",
  "surface-container-highest": "#e1e3e4",
  
  // ON SURFACE
  "on-surface": "#191c1d",
  "on-surface-variant": "#434655",
  
  // SECONDARY
  secondary: "#575e70",
  "secondary-container": "#d9dff5",
  "on-secondary": "#ffffff",
  
  // TERTIARY
  tertiary: "#4c5664",
  "tertiary-container": "#646e7d",
  
  // ERROR
  error: "#ba1a1a",
  "error-container": "#ffdad6",
  
  // OUTLINE
  outline: "#737686",
  "outline-variant": "#c3c6d7",
}
```

### 1.2 tailwind.config.ts — Espaciado

```typescript
spacing: {
  gutter: "20px",  // era 24px
  "margin-desktop": "48px",  // era 32px
}
```

### 1.3 tailwind.config.ts — Border Radius

```typescript
borderRadius: {
  stitch: "0.75rem",  // 12px — mantener
  // Nuevos para componentes
  "radius-sm": "0.25rem",  // 4px
  "radius-md": "0.5rem",   // 8px
  "radius-lg": "0.75rem",  // 12px
  "radius-xl": "1rem",     // 16px
  "radius-full": "9999px", // pill
}
```

### 1.4 tailwind.config.ts — Box Shadows

```typescript
boxShadow: {
  subtle: "0 1px 2px 0 rgba(0,0,0,0.05)",
  // Nivel 2 (hover cards)
  "level-2": "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)",
  // Nivel 3 (modals/overlays)
  "level-3": "0 20px 25px -5px rgba(0,0,0,0.1)",
}
```

---

## FASE 2: Layout Base

### 2.1 Sidebar (280px fixed)

- Actual: funcionalmente correcto
- Actualizar: active indicator con 4px left border + light blue tint
- Clase actual: `.stitch-nav-active` → ajustar

### 2.2 TopNavBar

- Actual: funcionalmente correcto
- Actualizar: espaciado de 48px margin-desktop

---

## FASE 3: Componentes Core

### 3.1 Botones

| Botón | Estado Actual | Nuevo |
|-------|--------------|-------|
| Primary | bg #2563EB | bg #2563EB (container), text oscuro |
| Secondary | border #E2E8F0 | border #E5E7EB |
| Danger | bg #DC2626 | bg #BA1A1A |

### 3.2 Inputs

- Border: #E5E7EB → Focus: #2563EB con glow 3px
- Label: 12px, medium, #4B5563 → #434655

### 3.3 Status Chips

| Status | Actual | Nuevo |
|--------|---------|-------|
| Success | bg #DCFCE7 | Soft green bg |
| Warning | bg #FEF3C7 | Soft amber bg |
| Error | bg #FEE2E2 | Soft red bg |

### 3.4 Cards

- Level 1: white + 1px border #E5E7EB (NO shadow)
- Level 2 (hover): shadow-level-2

---

## FASE 4: Pantallas a Implementar

1. **Login** — Split screen, left blue panel
2. **Dashboard Métricas** — KPIs cards + charts
3. **Directorio de Clientes** — Table + stats cards
4. **Gestión de Empleados** — CRUD table
5. **Control de Asistencia** — Time clock UI
6. **Facturación** — Invoice list
7. **Detalle Factura** — Full invoice view
8. **Registrar Pago** — Modal
9. **Reportes** — Analytics dashboard

---

## Archivos a Modificar

```
apps/admin/tailwind.config.ts          ← tokens
apps/admin/src/app/globals.css         ← component classes  
apps/admin/src/app/layout.tsx          ← verify fonts/spacing
apps/admin/src/components/             ← individual components
apps/admin/src/app/(dashboard)/        ← page layouts
```

---

## Orden de Implementación Sugerido

1. **Tokens** (tailwind.config.ts) — 1 subagent
2. **globals.css** — 1 subagent  
3. **Sidebar + Nav** — 1 subagent
4. **Botones + Inputs** — 1 subagent
5. **Dashboard/Login** (primera pantalla) — 1 subagent
6. **Resto de pantallas** — subagents paralelos
7. **QA + tests** — verificacion final

---

## Validación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## Notas Importantes

- No cambiar BFF routes ni API contracts
- Mantener backward compatibility con clases .stitch-*
- Prioridad: primero tokens y globals, luego pantallas
- Las pantallas de Carbon (IBM Plex) requieren cambio de fuente — postergar si hay tiempo
