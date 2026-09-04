# UI Energía Gym — Design Spec

Fecha: 2026-09-04 | Rama: `opencode/ui-energy` | Estado: aprobada por usuario (3/3 secciones)

## 1. Objetivo

Subir el impacto visual de GymLog sin cambiar layout, navegación, datos ni backend.
Estética: energía gym (lima, anillos de progreso, números grandes, glow puntual).
Lo feo que ataca: timer plano con barra lineal, dashboard tipo CRUD, historial
monótono, gráficos finitos por defecto, auth olvidable.

## 2. No-objetivos

- No se cambian tokens en `src/styles.css` ni componentes base de `src/components/ui/*`.
- No hay cambios de schema, queries ni rutas. Todo lo "nuevo" se computa en cliente
  desde datos existentes.
- No incluye ROI#3 (racha/volumen semanal histórico queda para su propio plan);
  solo conteos puntuales descritos abajo.

## 3. Tokens permitidos (existentes)

`--color-primary` (lima), `--color-primary-foreground`, `--color-secondary`,
`--color-card`, `--color-muted`, `--color-muted-foreground`, `--color-border`,
`--color-success`, `--color-warning`, `--color-destructive`,
`--color-chart-1/2/4`. Nada hardcodeado: en SVG usar
`style={{ stopColor: "var(--color-primary)" }}` y `stroke="var(--color-border)"`.

## 4. Sección 1 — Timer circular

### 4.1 `CountdownRing` (nuevo `src/components/CountdownRing.tsx`)

Props exactas:

```ts
export function CountdownRing(props: {
  progress: number; // 0..1 fracción RESTANTE (1 = lleno)
  size?: number; // default 220
  stroke?: number; // default 14
  tone: "active" | "urgent" | "done";
  children?: React.ReactNode;
}): React.JSX.Element;
```

Render: `div` relative `size` px; `svg` rotado -90°; círculo fondo
`stroke="var(--color-muted)"`; círculo frente con `strokeLinecap="round"`,
`strokeDasharray = C`, `strokeDashoffset = C * (1 - clamp(progress,0,1))`,
donde `C = 2πr`, `r = (size - stroke) / 2`.
Color frente: `active` → `var(--color-primary)`; `urgent` → `var(--color-warning)`
+ clase `animate-pulse` en el wrapper; `done` → `var(--color-success)`.
`children` centrados con absolute inset flex (el tiempo `m:ss` en tabular).
`role="progressbar"`, `aria-valuenow={Math.round(progress*100)}`.

### 4.2 Helper `ringOffset` (`src/lib/restTimer.ts`)

```ts
export function ringOffset(circumference: number, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return circumference * (1 - p);
}
```

Test: `ringOffset(100, 1) === 0`, `ringOffset(100, 0) === 100`,
`ringOffset(100, 0.25) === 75`, clamps fuera de rango.

### 4.3 Cambios en `RestTimer.tsx`

- Reemplazar `<p className="text-6xl...">` + `<Progress>` por
  `<CountdownRing progress={phase === "done" ? 0 : progress} size={220} stroke={14} tone={...}>`
  con el tiempo/mensaje de fin como children. `tone = phase === "done" ? "done" : remaining <= 10 && phase === "running" ? "urgent" : "active"`.
- Quitar import de `Progress` (si queda sin uso, tsc/eslint lo exigen).
- FAB: círculo 56px con mini-anillo (mismo componente, `size={56} stroke={5}`,
  sin children de texto grande): corriendo muestra tiempo `xs` bold tabular al
  centro; idle/paused/done muestra icono `Timer`. Mantener posición
  `bottom-20 left-4` y `aria-label="Timer de descanso"`.
- Lógica (presets, persistencia, beep, vibrate, toast) SIN cambios.

## 5. Sección 2 — Dashboard hero (`src/routes/_authenticated/index.tsx`)

- Hero: `div` rounded-3xl border bg-card p-5 relative overflow-hidden con
  `div` decorativo absolute `-top-20 -right-20 size-56 rounded-full`
  con `style={{ background: "radial-gradient(circle, var(--color-primary) 0%, transparent 70%)", opacity: 0.22 }}`.
  Contenido: "Hola 👋" + fecha hoy (`formatDate(todayLocal)` — agregar
  `todayLocal()` a `lib/workout.ts` o reutilizar si existe) + línea
  "{n} entrenos en los últimos 7 días" vía `countThisWeek`.
- `countThisWeek` en `src/lib/workout.ts`:

```ts
export function countThisWeek(
  sessions: Array<{ session_date: string }>,
  now: Date = new Date(),
): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return sessions.filter((s) => {
    const d = new Date(`${s.session_date}T00:00:00`);
    return d >= start && d <= now;
  }).length;
}
```

- CTAs "Nueva sesión" / "Importar": tarjetas con icono en pastilla
  `bg-primary/15 text-primary rounded-xl p-2` + título + subtítulo xs
  ("Registrá en el momento" / "Pegá tu texto de WhatsApp").
- Último entreno: card con `border-primary/40` + header con badge
  "Último" (`bg-primary text-primary-foreground text-[11px] rounded-full px-2 py-0.5`)
  + botón Repetir existente intacto.
- Pendientes: chips con color por acción vía `actionTone` (sección 6).

## 6. Sección 3 — Historial, gráficos, detalles

### 6.1 Helpers (`src/lib/workout.ts`)

```ts
export function sessionVolume(
  exercises: Array<{
    planned_weight_kg: number | null;
    planned_sets: number | null;
    planned_reps: string | null;
    performed: boolean;
  }>,
): number {
  let total = 0;
  for (const ex of exercises) {
    if (!ex.performed) continue;
    const m = ex.planned_reps?.match(/\d+/);
    const reps = m ? Number.parseInt(m[0], 10) : 0;
    if (ex.planned_weight_kg == null || ex.planned_sets == null || !reps) continue;
    total += ex.planned_weight_kg * ex.planned_sets * reps;
  }
  return Math.round(total);
}

export function actionTone(action: string | null): string {
  switch (action) {
    case "subir_peso":
      return "bg-success/15 text-success";
    case "bajar_peso":
      return "bg-warning/15 text-warning";
    case "revisar_tecnica":
      return "bg-chart-4/15 text-chart-4";
    case "cambiar_ejercicio":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}
```

Nota: clases `bg-success/15` requieren que Tailwind v4 genere opacidad sobre
colores custom — el proyecto ya usa `bg-primary/15`-style? Verificar en build;
si no genera, fallback: `text-*` + `border-*` con `border-current/30`.
El implementador lo confirma con `npm run build` + inspección visual.

### 6.2 Historial (`historial.tsx`)

- Cada item: header con badge de fecha (día `text-xl font-bold` + mes corto es
  `toLocaleDateString("es-UY", { month: "short" })`) a la izquierda del título.
- Sub-línea: "{n} ejercicios · ≈{sessionVolume} kg" (`text-xs text-muted-foreground`).
- Tags de acción usan `actionTone(ex.action)` en vez de `bg-secondary text-primary`.
- Estructura Link/div existente y botón Repetir intactos.

### 6.3 Ejercicios (`ejercicios.tsx`)

- Reemplazar `LineChart`+`Line` por `AreaChart`+`Area` con `defs`:
  dos `linearGradient` (`pesoGrad` con `var(--color-chart-1)`,
  `repsGrad` con `var(--color-chart-2)`), `fillOpacity` 0.35→0.02,
  `strokeWidth={2.5}`, `dot={false}`, `activeDot={{ r: 4 }}`.
- Badge de récord sobre el gráfico: "Récord {max} kg · {fecha}"
  calculado del `current` (max `planned_weight_kg`, fecha de su sesión).
- Resto (select, lista de notas) intacto.

### 6.4 Auth (`auth.tsx`, mínimo)

- `main` con fondo: `style={{ background: "radial-gradient(60% 40% at 50% 0%, color-mix(in oklch, var(--color-primary) 12%, transparent), transparent)" }}`.
- Logo: agregar `shadow-glow` al span existente. Nada más.

## 7. Testing

- `npx tsc --noEmit` + `npx eslint` archivos tocados + `npm run build`.
- Check TDD efímero para `ringOffset` (+ existentes `formatCountdown`,
  `remainingSeconds` si se tocan) con jiti, borrado antes del commit.
- QA visual en Lovable (usuario): timer anillo + fases, hero, badges,
  área con PR, auth. Sin capturas en este entorno.

## 8. Rollout

Branch `opencode/ui-energy` → review → merge a `main` (Lovable) + espejo
`gym-bro`, mismo flujo que ROI#1/#2. Sin migraciones ni env vars nuevas.
