# Análisis de Diseño Stitch — LaborLedger Admin
**Fecha:** 2026-07-30  
**Proyecto Stitch:** 701253251056388989  
**Total pantallas analizadas:** 16+

---

## 🔴 HALLAZGO CRÍTICO: Sistema de Diseño Duplicado

El proyecto Stitch usa **DOS sistemas de diseño** simultáneamente:

| Sistema | Asset ID | Font | Primary | Border Radius |
|---------|----------|------|---------|---------------|
| **LaborLedger** (✅ recomendado) | `2213ec35...` | Inter | `#2563EB` | ROUND_EIGHT (8px) |
| **Carbon** (❌ descartar) | `15636522...` | IBM Plex Sans | `#0f62fe` | ROUND_FOUR (4px) |

### Pantallas por Sistema

**LaborLedger (Inter, 8px):**
- Dashboard Métricas
- Registrar Pago (modal)
- Registrar Nuevo Cliente
- Detalle Factura
- Directorio de Clientes
- Recepción de Vehículo
- Reportes y Analítica
- (y más)

**Carbon (IBM Plex, 4px):**
- Login
- Control de Asistencia
- Métricas de Clientes
- Gestión de Empleados
- Módulo de Facturación
- Gestión de Usuarios
- (y más)

---

## Sistema de Diseño LABORLEDGER (Recomendado)

### Paleta de Colores

```
primary:          #004ac6
primary-container: #2563EB  ← color de acento principal
on-primary:        #ffffff
on-primary-container: #eeefff

surface:          #f8f9fa
surface-dim:      #d9dadb
surface-bright:   #f8f9fa
surface-container: #edeeef
surface-container-high: #e7e8e9
surface-container-highest: #e1e3e4
surface-container-low: #f3f4f5
surface-container-lowest: #ffffff

on-surface:       #191c1d
on-surface-variant: #434655

secondary:       #575e70
secondary-container: #d9dff5
on-secondary:     #ffffff

tertiary:         #4c5664
tertiary-container: #646e7d
on-tertiary:      #ffffff

error:           #ba1a1a
error-container:  #ffdad6
on-error:        #ffffff
on-error-container: #93000a

outline:         #737686
outline-variant: #c3c6d7

inverse-surface: #2e3132
inverse-on-surface: #f0f1f2
inverse-primary: #b4c5ff

background:      #f8f9fa
on-background:   #191c1d
```

### Tipografía

```
display-lg:   Inter 48px/56px 700 -0.02em
headline-lg:  Inter 32px/40px 600 -0.01em
headline-md:  Inter 24px/32px 600 0
title-md:     Inter 18px/28px 600 0
body-lg:      Inter 16px/24px 400 0
body-md:      Inter 14px/20px 400 0
label-sm:     Inter 12px/16px 500 0.01em
```

### Espaciado

```
unit: 4px
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
gutter: 20px
margin-mobile: 16px
margin-desktop: 48px
```

### Elevation (Sombras)

- **Level 0 (Base):** `#f8f9fa` background
- **Level 1 (Surface):** white `#ffffff` + 1px border `#e5e7eb` — NO shadow
- **Level 2 (Interactive):** `0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)`
- **Level 3 (Overlays/Modals):** `0 20px 25px -5px rgba(0,0,0,0.1)`

### Componentes

#### Botones
- **Primary:** `background: #2563EB`, `text: #ffffff`, `radius: 8px`, hover: `#1D4ED8`
- **Secondary:** `background: #ffffff`, `border: #e5e7eb`, `text: #4b5563`
- **Ghost:** solo texto primary
- **Danger:** `background: #ba1a1a`

#### Inputs
- Default: white bg, `#e5e7eb` border, 8px radius
- Focus: border `#2563EB` + soft blue glow (3px spread)

#### Status Chips (badges)
- **Pagado (Success):** soft green bg, dark green text
- **Pendiente (Warning):** soft amber bg, dark amber text
- **Vencido (Error):** soft red bg, dark red text

#### Tablas
- Header: `#f9fafb` bg, 12px bold, uppercase
- Rows: 1px border-bottom `#e5e7eb`, hover `#f9fafb`
- Numeric data: tabular lining

#### Navegación (Sidebar)
- Fixed 280px width
- Active: 4px primary blue bar on left + light blue tint
- 20px icons, 14px text

---

## PLAN DE IMPLEMENTACIÓN

### FASE 0: Decisión Previa (Requerida)
- [ ] **Decidir:** ¿Mantener LaborLedger (Inter) o cambiar a Carbon (IBM Plex)?
- [ ] **Recomendación:** LaborLedger — ya usa Inter que es el actual del admin

### FASE 1: Tokenización (Foundation)
1. Actualizar `tailwind.config.ts` con nuevos tokens del sistema LaborLedger
2. Actualizar `globals.css` — reemplazar clases `.stitch-*` con nuevos valores
3. Mantener compatibilidad hacia atrás con clases existentes

### FASE 2: Layout Base
1. Actualizar `layout.tsx` con nuevos valores de tipografía
2. Verificar Sidebar (280px fixed, active indicator)
3. TopNavBar con nuevos espaciados

### FASE 3: Componentes Core
1. Botones (primary, secondary, ghost, danger)
2. Inputs y forms
3. Cards y containers
4. Status badges/chips
5. Tablas

### FASE 4: Pantallas
1. Login
2. Dashboard / Métricas
3. Directorio de Clientes
4. Gestión de Empleados
5. Control de Asistencia
6. Facturación
7. Detalle de Factura
8. Reportes

### FASE 5: Validación
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Verificación visual de cada pantalla

---

## ARCHIVOS A MODIFICAR

```
apps/admin/tailwind.config.ts     ← nuevos tokens de color
apps/admin/src/app/globals.css    ← nuevas clases de componentes
apps/admin/src/app/layout.tsx     ← tipografía
apps/admin/src/components/...     ← componentes uno por uno
```

## RIESGOS

1. **Conflicto de tokens:** Hay que mantener backward compatibility
2. **Carbon vs LaborLedger:** Mezcla de sistemas — hay que unificar
3. **Gran alcance:** 20+ pantallas — implementar por fases
4. **No romper funcionalidad existente:** Mantener todos los BFF routes

---

## RECOMENDACIÓN FINAL

**Usar el sistema LaborLedger** (Inter, 8px radius, #2563EB) porque:
- Ya usa Inter que es la fuente actual
- El color #2563EB ya existe en el código
- Es el sistema "oficial" del proyecto según el asset ID

Descartar Carbon — requiere cambiar fuente y esquema de color.
