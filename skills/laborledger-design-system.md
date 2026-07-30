# LaborLedger Design System Skill

## Cuándo usar
Para rediseñar pantallas Admin y Field/PWA con una estética elegante, moderna y B2B premium.

## Cómo usar con ui-ux-pro-max
Antes de implementar:
```bash
python3 .opencode/skills/ui-ux-pro-max/scripts/search.py \
  "laborledger B2B workforce saas timekeeping" --design-system -p "LaborLedger"
```
Usar `--domain style "minimal professional dark sidebar"`, `--domain ux "dashboard loading empty"` según necesidad.

## CodeGraph
Usar `codegraph explore` para encontrar componentes afectados y sus dependencias antes de modificar UI:
```bash
codegraph explore "login page component platform shell"
```

## Objetivo visual
- SaaS premium — confiable, profesional, sin ruido
- Limpio: máximo contraste, mínimo decorativo
- Mobile-first en Field (botones grandes, touch-friendly)
- Dashboard profesional en Admin (tablas, filtros, KPIs)
- Navegación clara y predecible
- Estados vacíos útiles con CTA
- Loading skeletons en transiciones
- Botones consistentes (3 variantes: primary, secondary, danger)
- Tipografía legible con jerarquía visual fuerte
- Menos ruido visual: bordes suaves, espaciado generoso

## Reglas visuales obligatorias

### No mostrar en producción
- "Design V2 Active" badge o cualquier badge de desarrollo
- Placeholders tipo "Live data in later slice" o "Coming soon"
- Errores de desarrollo (stack traces, IDs internos) al usuario
- Raw `globalRole` — usar `formatCompanyAccessLabel()`

### Consistencia
- Usar tokens de diseño para color, radius, spacing, shadow, typography
- No mezclar escalas de border-radius sin criterio (usar `rounded-lg` consistente)
- Íconos vectoriales (Phosphor), sin emojis como íconos estructurales
- Misma familia de íconos en toda la app
- 4/8dp spacing rhythm
- Sombras sutiles: `shadow-sm` para cards, `shadow-lg` para modals/dropdowns

### Layout
- Admin: B2B desktop-first responsive (max-w 88rem)
- Field/PWA: mobile-first con botones grandes, touch targets >=44pt
- Safe areas respetadas en Field
- Sidebar elegante y clara (nav items agrupados)
- Header con breadcrumb + acciones + company switcher
- Sidebar: slate-950, Header: white con borde slate-200

### Estados
- Empty states: mensaje claro + CTA button (no tablas vacías)
- Loading: skeleton placeholders (no spinners genéricos)
- Error: mensaje simple sin stack trace + retry action
- Disabled: opacidad reducida, sin pointer events

## Prioridades de diseño (orden de implementación)
1. Login elegante — fondo limpio, card centrada, tipografía clara
2. Superadmin platform shell — sidebar + header + main content
3. Customers list — tabla con filtros, estados vacíos
4. Customer detail + companies — info + acciones
5. Company workspace dashboard — KPIs, acceso rápido
6. Field/PWA home — tarjetas grandes, clock status
7. Labor Work — progreso visual
8. Labor Billing — preview + export

## Checklist antes de modificar UI
- [ ] Identificar página y componentes afectados
- [ ] Revisar datos reales disponibles (no inventar mock data)
- [ ] No romper permisos ni redirects existentes
- [ ] No tocar lógica de billing
- [ ] No tocar Prisma schema ni migraciones
- [ ] No tocar API salvo que la UI necesite un endpoint existente
- [ ] Mantener responsive (Admin desktop, Field mobile)
- [ ] Verificar con `pnpm lint && pnpm typecheck && pnpm build`

## Stack UI
- Next.js 15 App Router, React 19, Tailwind CSS 3
- Font: `Inter, system-ui, -apple-system, sans-serif` (Inter vía next/font)
- Íconos: Phosphor (`@phosphor-icons/react`)
- Sin shadcn, MUI, Chakra ni librerías externas de componentes
- Sin service worker (Field es online-first)

## Paleta recomendada (Tailwind base)
- Fondo página: `slate-50/100`
- Cards/superficies: `white`
- Sidebar: `slate-950`
- Primary: `brand-600` (#095bb5)
- Texto primary: `slate-900`
- Texto secondary: `slate-500`
- Bordes: `slate-200`
- Danger: `red-600`
- Success: `emerald-600`
- Warning: `amber-600`

## Copy guidelines
- **Billing disclaimer:** "Service times are reference only. Labor billing uses approved clock/punch hours."
- **Empty states:** "No [items] yet. Create your first [item] to get started."
- **Errores:** "Something went wrong. Please try again." (sin stack traces)
- **Acciones destructivas:** confirmación con explicación + botón rojo
- **Status labels:** lenguaje de negocio, no técnico. "Admin" en vez de "COMPANY_ADMIN"
