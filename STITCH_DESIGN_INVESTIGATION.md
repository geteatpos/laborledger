# Stitch Design Investigation Report

## 1. Qué Ocurrió

**El diseño Stitch AutoBody oscuro NO fue revertido — fue intencionalmente reemplazado por un tema claro.**

El codebase ahora usa un **tema claro** que se parece al diseño original pre-Stitch. Coexistieron dos proyectos Stitch separados:

- **AutoBody Management Suite** (Project ID `1439959134656122579`) — aplicado Jul 16, reemplazado Jul 26
- **FleetStaff Pro** (Project ID `1210310471041466440`) — exportado Jul 27, nunca aplicado

---

## 2. Cuándo Ocurrió

| Fecha/Hora | Evento |
|------------|--------|
| **Jul 16, 17:28** | Commit `7b3b578` — Aplicó diseño oscuro Stitch AutoBody |
| **Jul 17, 15:51** | Commit `3126048` — Redesign PWA dashboard e invoices (tema oscuro mantenido) |
| **Jul 21, 15:18** | Commit `a0937b5` — Archivó y eliminó `stitch-output/` del repositorio |
| **Jul 26, 17:40** | Commit `9849c07` — **Reemplazó tema oscuro con tema claro** |
| **Jul 26, 19:50** | Commit `b6f8000` — Refinó tokens semánticos (tema claro) |
| **Jul 27, 17:59** | Directorio `.stitch-fleetstaff/` creado (nuevo export Stitch, no trackeado) |

El tema oscuro existió por **10 días** (Jul 16–26) antes de ser reemplazado.

---

## 3. Qué Cambio Lo Provocó

**Commit `9849c07`** ("fix(ui): complete LaborLedger visual system integration") cambió:

```diff
- color-scheme: dark
+ color-scheme: light
- background-color: #0b1326
+ background-color: #F8FAFC
- color: #dae2fd
+ color: #0F172A
```

También reemplazó la clase CSS `glass-panel` de efectos oscuros (`rgba(255,255,255,0.05)`) a cristal claro (`bg-white/80 backdrop-blur-md`).

---

## 4. Dónde Está o Estaba el Diseño de Stitch

### AutoBody Design (REEMPLAZADO)

| Aspecto | Ubicación |
|---------|-----------|
| **Export Stitch original** | Eliminado del repositorio en `a0937b5`, archivado externamente en `/home/ubuntu/backups/laborledger/archive/c1-documentation-20260721/stitch-output/` |
| **Código aplicado** | Todavía presente en `tailwind.config.ts`, `globals.css` y componentes — pero cambiado a tema claro |
| **Project ID Stitch** | `1439959134656122579` |

### FleetStaff Pro Design (NUNCA APLICADO)

| Aspecto | Ubicación |
|---------|-----------|
| **16 pantallas HTML** | `/home/ubuntu/apps/laborledger/.stitch-fleetstaff/html/` |
| **Screenshots** | `/home/ubuntu/apps/laborledger/.stitch-fleetstaff/screenshots/` |
| **Metadatos** | `/home/ubuntu/apps/laborledger/.stitch-fleetstaff/manifest.json` (1,936 bytes, modificado Jul 27 17:59) |
| **Project ID Stitch** | `1210310471041466440` |
| **Estado en git** | NO trackeado — solo existe en disco |

---

## 5. ¿Puede Recuperarse?

| Diseño | Recuperable | Cómo |
|--------|------------|------|
| AutoBody tema oscuro | **SÍ** | `git show 7b3b578` — diff completo existe en historial git |
| AutoBody archivos Stitch | **SÍ** | Archivados externamente según `docs/audits/C1_DOCUMENTATION_CLEANUP_REPORT.md` |
| FleetStaff Pro | **SÍ** | Archivos existen en `.stitch-fleetstaff/` (no trackeado, en disco) |

---

## 6. Recomendación de Acciones (Sin Ejecutar)

1. **Decidir dirección de diseño:** El tema oscuro AutoBody puede restaurarse desde commit `7b3b578`; alternativamente, el tema claro actual representa la dirección activa según commit `9849c07`

2. **Si se restaura tema oscuro:** 
   ```bash
   git checkout 7b3b578 -- apps/admin/src/app/globals.css apps/admin/tailwind.config.ts
   ```
   Luego revisar todos los componentes afectados.

3. **Si se mantiene tema claro:** Archivar o eliminar `.stitch-fleetstaff/` para evitar confusión.

4. **Limpiar archivos no trackeados:** `.stitch-fleetstaff/` no está trackeado por git y contiene un diseño de otro producto — aclarar su propósito o removerlo.

5. **Documentar en MEMORY.md:** Registrar la elección de diseño para prevenir confusión futura.

---

## Evidencias

- **Reporte completo de auditoría:** `docs/audits/REDESIGN_AUDIT_REPORT.md` (líneas 38–51 explican incompatibilidad template/implementación)
- **Reporte de limpieza C1:** `docs/audits/C1_DOCUMENTATION_CLEANUP_REPORT.md` (documenta el archivo stitch-output)
- **Diffs exactos de commits:** `7b3b578`, `9849c07`, `b6f8000`
- **Archivo de diseño FleetStaff:** `.stitch-fleetstaff/manifest.json` (1,936 bytes, creado Jul 27)

---

## Archivos del Reporte

- `STITCH_DESIGN_INVESTIGATION.md` — este archivo (raíz del repositorio)
- `docs/audits/REDESIGN_AUDIT_REPORT.md` — auditoría completa del redesign
- `docs/audits/C1_DOCUMENTATION_CLEANUP_REPORT.md` — reporte de archivado C1
