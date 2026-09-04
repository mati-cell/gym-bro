# Rest Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Timer de descanso flotante global con presets 45/120/180s + custom, que avisa "¡Hora de la próxima serie!" al terminar.

**Architecture:** Helpers puros en `src/lib/restTimer.ts` (TDD real con script efímero) + componente `src/components/RestTimer.tsx` (FAB + panel, estilo `ChatWidget`) integrado con 1 línea en el layout autenticado. Sin backend, sin migraciones, estado en `localStorage` para sobrevivir reload.

**Tech Stack:** TypeScript, React 19, TanStack Router, Tailwind v4, sonner, WebAudio, navigator.vibrate.

**Spec:** Este plan + decisiones aprobadas por el usuario (2026-09-04): presets 45/120/180 + custom, FAB global que se ve lindo, al terminar beep + vibración + toast "¡Hora de la próxima serie!".

## Global Constraints

- Trabajar solo en branch `opencode/rest-timer` (no tocar `main` de Lovable).
- Mobile-first, oscuro por defecto; no hardcodear colores, usar tokens (`bg-card`, `text-muted-foreground`, `bg-primary`, etc.).
- No emojis en código ni textos (el mensaje de fin es texto plano).
- Mensaje de fin exacto: `¡Hora de la próxima serie!`
- Presets exactos: `45`, `120`, `180` (segundos) + custom por input numérico.
- `npx tsc --noEmit` y `npx eslint <archivos>` deben pasar en cada task.
- El repo no tiene runner de tests; TDD = script de check efímero (RED antes de implementar, GREEN después, se borra al commitear) + typecheck + lint + flujo manual.

---

### Task 1: Helpers puros del timer (TDD)

**Files:**
- Create: `src/lib/restTimer.ts`
- Create (efímero, se borra antes del commit): `scripts/rest-timer.check.mjs`
- Test: `node_modules/.bin/jiti scripts/rest-timer.check.mjs` (jiti es dependencia transitiva vía nitro; si el bin no existe, reportar NEEDS_CONTEXT en vez de adivinar)

**Interfaces:**
- Consumes: nada (módulo puro, cero dependencias).
- Produces (consumido por Task 2 con estas firmas exactas):
  - `REST_PRESETS: readonly [45, 120, 180]`
  - `REST_STORAGE_ENDS_AT: "gymlog:restEndsAt"`
  - `REST_STORAGE_TOTAL: "gymlog:restTotal"`
  - `formatCountdown(totalSeconds: number) => string` (`"m:ss"`, ej. `90 -> "1:30"`, `45 -> "0:45"`, negativos/clamp a `"0:00"`)
  - `remainingSeconds(endsAt: number, now: number) => number` (ceil de ms a s, clamp `>= 0`)

- [ ] **Step 1: Escribir el check que falla (RED)**

Crear `scripts/rest-timer.check.mjs`:

```js
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const m = await jiti.import("../src/lib/restTimer.ts");
import assert from "node:assert/strict";

assert.deepEqual([...m.REST_PRESETS], [45, 120, 180]);
assert.equal(m.REST_STORAGE_ENDS_AT, "gymlog:restEndsAt");
assert.equal(m.REST_STORAGE_TOTAL, "gymlog:restTotal");
assert.equal(m.formatCountdown(45), "0:45");
assert.equal(m.formatCountdown(90), "1:30");
assert.equal(m.formatCountdown(180), "3:00");
assert.equal(m.formatCountdown(0), "0:00");
assert.equal(m.formatCountdown(-5), "0:00");
assert.equal(m.formatCountdown(61.9), "1:01");
assert.equal(m.remainingSeconds(10_000, 5_000), 5);
assert.equal(m.remainingSeconds(5_000, 5_000), 0);
assert.equal(m.remainingSeconds(4_000, 5_000), 0);
assert.equal(m.remainingSeconds(5_500, 5_000), 1);
console.log("rest-timer checks PASS");
```

- [ ] **Step 2: Correr el check y ver que falla**

Run: `node_modules/.bin/jiti scripts/rest-timer.check.mjs`
Expected: FAIL (no existe `src/lib/restTimer.ts`)

- [ ] **Step 3: Implementación mínima (GREEN)**

Crear `src/lib/restTimer.ts`:

```ts
export const REST_PRESETS = [45, 120, 180] as const;

export const REST_STORAGE_ENDS_AT = "gymlog:restEndsAt";
export const REST_STORAGE_TOTAL = "gymlog:restTotal";

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function remainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
```

- [ ] **Step 4: Correr el check y ver que pasa**

Run: `node_modules/.bin/jiti scripts/rest-timer.check.mjs`
Expected: PASS con `rest-timer checks PASS`

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/lib/restTimer.ts`
Expected: PASS

- [ ] **Step 6: Borrar el script efímero y commitear**

```bash
Remove-Item -LiteralPath "scripts/rest-timer.check.mjs" -Force
git add src/lib/restTimer.ts
git commit -m "feat(timer): helpers puros de countdown y presets"
```

### Task 2: Componente RestTimer (FAB + panel)

**Files:**
- Create: `src/components/RestTimer.tsx`
- Leer antes: `src/components/ChatWidget.tsx:48-56` (patrón FAB), `src/components/ui/progress.tsx` (props del Progress)
- Test: `npx tsc --noEmit`, `npx eslint src/components/RestTimer.tsx`, flujo manual con `npm run dev`

**Interfaces:**
- Consumes: `REST_PRESETS`, `REST_STORAGE_ENDS_AT`, `REST_STORAGE_TOTAL`, `formatCountdown`, `remainingSeconds` de `@/lib/restTimer` (Task 1, firmas exactas de arriba); `Button`, `Input`, `Progress` de `@/components/ui/*`; `toast` de `sonner`.
- Produces: `export function RestTimer()` sin props (Task 3 lo monta en el layout).

- [ ] **Step 1: Crear `src/components/RestTimer.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  REST_PRESETS,
  REST_STORAGE_ENDS_AT,
  REST_STORAGE_TOTAL,
  formatCountdown,
  remainingSeconds,
} from "@/lib/restTimer";

type Phase = "idle" | "running" | "paused" | "done";

const FINISH_MESSAGE = "¡Hora de la próxima serie!";

function beep() {
  try {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Sin audio: el toast + vibración avisan igual.
  }
}

function notifyFinish() {
  beep();
  try {
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  } catch {
    // Sin vibración: el toast avisa igual.
  }
  toast.success(FINISH_MESSAGE);
}

function readStored(): { endsAt: number; total: number } | null {
  try {
    const e = window.localStorage.getItem(REST_STORAGE_ENDS_AT);
    const t = window.localStorage.getItem(REST_STORAGE_TOTAL);
    if (!e || !t) return null;
    const endsAt = Number.parseInt(e, 10);
    const total = Number.parseInt(t, 10);
    if (!Number.isFinite(endsAt) || !Number.isFinite(total) || total <= 0) return null;
    return { endsAt, total };
  } catch {
    return null;
  }
}

export function RestTimer() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [total, setTotal] = useState<number>(REST_PRESETS[0]);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(REST_PRESETS[0]);
  const [custom, setCustom] = useState("");
  const firedRef = useRef(false);

  useEffect(() => {
    const stored = readStored();
    if (!stored) return;
    const left = remainingSeconds(stored.endsAt, Date.now());
    setTotal(stored.total);
    if (left > 0) {
      setEndsAt(stored.endsAt);
      setRemaining(left);
      setPhase("running");
    } else {
      setRemaining(0);
      setPhase("done");
    }
  }, []);

  useEffect(() => {
    if (phase !== "running" || endsAt == null) return;
    const id = window.setInterval(() => {
      const left = remainingSeconds(endsAt, Date.now());
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        try {
          window.localStorage.removeItem(REST_STORAGE_ENDS_AT);
          window.localStorage.removeItem(REST_STORAGE_TOTAL);
        } catch {
          // Storage opcional.
        }
        setPhase("done");
        if (!firedRef.current) {
          firedRef.current = true;
          notifyFinish();
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, endsAt]);

  function persist(nextEndsAt: number, nextTotal: number) {
    try {
      window.localStorage.setItem(REST_STORAGE_ENDS_AT, String(nextEndsAt));
      window.localStorage.setItem(REST_STORAGE_TOTAL, String(nextTotal));
    } catch {
      // Storage opcional.
    }
  }

  function start(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const totalSec = Math.floor(seconds);
    const nextEndsAt = Date.now() + totalSec * 1000;
    firedRef.current = false;
    setTotal(totalSec);
    setEndsAt(nextEndsAt);
    setRemaining(totalSec);
    setPhase("running");
    persist(nextEndsAt, totalSec);
  }

  function pause() {
    setPhase("paused");
  }

  function resume() {
    if (remaining <= 0) return;
    const nextEndsAt = Date.now() + remaining * 1000;
    setEndsAt(nextEndsAt);
    setPhase("running");
    persist(nextEndsAt, total);
  }

  function reset() {
    try {
      window.localStorage.removeItem(REST_STORAGE_ENDS_AT);
      window.localStorage.removeItem(REST_STORAGE_TOTAL);
    } catch {
      // Storage opcional.
    }
    setEndsAt(null);
    setRemaining(total);
    setPhase("idle");
  }

  function startCustom() {
    const v = Number.parseInt(custom.replace(",", "."), 10);
    if (!Number.isFinite(v) || v <= 0) return;
    start(v);
  }

  const progress = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <>
      <button
        aria-label="Timer de descanso"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 flex h-14 min-w-14 items-center justify-center gap-1 rounded-full bg-secondary px-3 text-secondary-foreground shadow-glow transition-transform active:scale-95"
      >
        <Timer className="size-6" />
        {phase === "running" && (
          <span className="text-sm font-bold tabular-nums">{formatCountdown(remaining)}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Timer className="size-5 text-primary" />
              <span className="font-display font-semibold">Descanso</span>
            </div>
            <button
              aria-label="Cerrar timer"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
            {phase === "done" ? (
              <p className="text-center text-2xl font-bold">{FINISH_MESSAGE}</p>
            ) : (
              <p className="text-6xl font-bold tabular-nums">{formatCountdown(remaining)}</p>
            )}
            <Progress value={phase === "done" ? 0 : progress} className="w-full max-w-xs" />

            <div className="flex flex-wrap justify-center gap-2">
              {REST_PRESETS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={total === s && phase !== "idle" ? "default" : "secondary"}
                  onClick={() => start(s)}
                >
                  {s}s
                </Button>
              ))}
            </div>

            <div className="flex w-full max-w-xs gap-2">
              <Input
                inputMode="numeric"
                placeholder="Custom (seg)"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <Button variant="secondary" onClick={startCustom} disabled={!custom.trim()}>
                Usar
              </Button>
            </div>

            <div className="flex gap-2">
              {phase === "running" ? (
                <Button variant="secondary" onClick={pause}>
                  <Pause className="size-4" /> Pausar
                </Button>
              ) : phase === "paused" ? (
                <Button onClick={resume}>
                  <Play className="size-4" /> Seguir
                </Button>
              ) : (
                <Button onClick={() => start(total)}>
                  <Play className="size-4" /> Empezar
                </Button>
              )}
              <Button variant="ghost" onClick={reset}>
                <RotateCcw className="size-4" /> Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/components/RestTimer.tsx`
Expected: PASS

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`. Abrir cualquier pantalla autenticada, pulsar FAB izquierdo, preset 45s, dejar correr (o cambiar el preset a 5s temporalmente NO — no tocar el código; verificar con 45s o pausar/seguir). Cerrar y reabrir el panel: el countdown sigue. Recargar la página con timer corriendo: retoma desde `localStorage`.
Expected: countdown visible en FAB y panel; al llegar a 0, toast "¡Hora de la próxima serie!", panel muestra el mensaje, suena beep, vibra en celu

- [ ] **Step 4: Commit**

```bash
git add src/components/RestTimer.tsx
git commit -m "feat(timer): FAB global de descanso con presets y aviso de serie"
```

### Task 3: Montar RestTimer en el layout

**Files:**
- Modify: `src/routes/_authenticated/route.tsx:3-4,53` (import + montaje junto a `<ChatWidget />`)
- Test: `npx tsc --noEmit`, `npx eslint src/routes/_authenticated/route.tsx`, flujo manual

**Interfaces:**
- Consumes: `RestTimer` de `@/components/RestTimer` (Task 2, sin props).
- Produces: nada nuevo.

- [ ] **Step 1: Agregar import y montaje**

En `src/routes/_authenticated/route.tsx`, cambiar la línea del import:

```tsx
import { ChatWidget } from "@/components/ChatWidget";
```

por:

```tsx
import { ChatWidget } from "@/components/ChatWidget";
import { RestTimer } from "@/components/RestTimer";
```

y cambiar:

```tsx
      <ChatWidget />
```

por:

```tsx
      <ChatWidget />
      <RestTimer />
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/routes/_authenticated/route.tsx`
Expected: PASS

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`. Navegar Inicio → Historial → Ejercicios: el FAB del timer (izquierda) persiste y el countdown no se resetea al cambiar de ruta.
Expected: FAB visible en todas las pantallas autenticadas; no tapa el FAB del chat (derecha) ni la bottom nav

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/route.tsx
git commit -m "feat(timer): montar RestTimer en layout autenticado"
```
