# Repetir sesión en 1 tap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar botón "Repetir" que duplica cualquier sesión como plantilla con fecha de hoy y reps reales vacías.

**Architecture:** Nueva función pura `buildDuplicateDraft` en `src/lib/duplicateSession.ts` (testeable sin DB) + función `duplicateSession` que lee sesión+ejercicios y los inserta. UI la consume desde Dashboard, Historial y Editar. Sin cambios de schema.

**Tech Stack:** TypeScript, TanStack Router/Start, Supabase JS, Tailwind, sonner.

**Spec:** `README.md` (modelo de datos sesiones/ejercicios) + este plan. No hay spec separada: feature bounded sobre flujo existente en `src/routes/_authenticated/`.

## Global Constraints

- No reescribir historia de `main` (Lovable sincroniza `main`); trabajar solo en branch `opencode/freedom`.
- Mobile-first, oscuro por defecto; no hardcodear colores, usar tokens (`bg-card`, `text-muted-foreground`, etc.).
- `session_exercises.actual_reps` es `INTEGER[] NOT NULL DEFAULT '{}'`; el duplicado inserta `[]`.
- `sessions.session_date` es `DATE NOT NULL`; el duplicado usa hoy local `YYYY-MM-DD`.
- Respetar RLS: todo insert lleva `user_id` del usuario autenticado.
- `npx tsc --noEmit` y `npx eslint <archivos>` deben pasar en cada task.
- No agregar framework de tests en este plan (el repo no tiene runner); verificación = typecheck + lint + flujo UI manual.

---

### Task 1: Función pura + persistencia del duplicado

**Files:**
- Create: `src/lib/duplicateSession.ts`
- Test: verificación con `npx tsc --noEmit` + script node efímero (no se commitea)
- Docs a leer: `src/lib/workout.ts:15-37`, `src/components/SessionForm.tsx:99-135`, `supabase/migrations/20260902215056_0ca8244a-a88f-4867-813f-a8432c73e4d7.sql:41-74`

**Interfaces:**
- Consumes: tipos `SessionRow`, `ExerciseRow` de `@/lib/workout`; cliente `supabase` de `@/integrations/supabase/client`.
- Produces: `buildDuplicateDraft(s: SessionRow) -> { day_number, session_date, title, notes }` + filas de ejercicios listas; `duplicateSession(supabase: any, sessionId: string) -> Promise<string>` que retorna el nuevo session id.

- [ ] **Step 1: Crear `src/lib/duplicateSession.ts` con la implementación mínima**

```ts
import type { SessionRow } from "@/lib/workout";

export function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function buildDuplicateDraft(s: SessionRow) {
  return {
    day_number: s.day_number ?? null,
    session_date: todayLocal(),
    title: s.title ?? null,
    notes: s.notes ?? null,
  };
}

export async function duplicateSession(supabase: any, sessionId: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sesión expirada");

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("*, session_exercises(*)")
    .eq("id", sessionId)
    .single();
  if (sErr || !session) throw new Error("No se pudo leer la sesión");

  const draft = buildDuplicateDraft(session as SessionRow);
  const { data: created, error: cErr } = await supabase
    .from("sessions")
    .insert({ user_id: userId, ...draft })
    .select("id")
    .single();
  if (cErr || !created) throw new Error("No se pudo duplicar la sesión");

  const exs = [...((session as SessionRow).session_exercises ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  if (exs.length) {
    const rows = exs.map((ex, i) => ({
      session_id: created.id,
      user_id: userId,
      position: i,
      name: ex.name,
      muscle_group: ex.muscle_group,
      planned_sets: ex.planned_sets,
      planned_reps: ex.planned_reps,
      planned_weight_kg: ex.planned_weight_kg,
      actual_reps: [],
      performed: true,
      notes: ex.notes,
      action: null,
    }));
    const { error: iErr } = await supabase.from("session_exercises").insert(rows);
    if (iErr) throw new Error("Sesión creada pero fallaron los ejercicios");
  }
  return created.id as string;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS (sin salida)

- [ ] **Step 3: Verificar lint del archivo**

Run: `npx eslint src/lib/duplicateSession.ts`
Expected: PASS (sin salida)

- [ ] **Step 4: Commit**

```bash
git add src/lib/duplicateSession.ts
git commit -m "feat(sesiones): duplicar sesion como plantilla con fecha de hoy"
```

### Task 2: Botón Repetir en Dashboard (último entreno)

**Files:**
- Modify: `src/routes/_authenticated/index.tsx:66-97`
- Test: `npx tsc --noEmit`, `npx eslint src/routes/_authenticated/index.tsx`, flujo manual: Inicio → Repetir → cae en Historial/Editar con fecha hoy y reps vacías

**Interfaces:**
- Consumes: `duplicateSession` de `@/lib/duplicateSession` (Task 1).
- Produces: botón UI, sin nueva API pública.

- [ ] **Step 1: Agregar botón Repetir junto al último entreno**

En `Dashboard`, importar `useState`, `useNavigate`, `duplicateSession`, `toast`, `Button`, icono `Copy`. Agregar estado `busy`. Debajo del card del último entreno (después del `</Link>` que muestra `last`), agregar:

```tsx
<Button
  variant="secondary"
  className="w-full"
  disabled={busy || !last}
  onClick={async () => {
    if (!last) return;
    setBusy(true);
    try {
      const id = await duplicateSession(supabase, last.id);
      toast.success("Sesión duplicada para hoy");
      navigate({ to: "/sesion/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo duplicar");
    } finally {
      setBusy(false);
    }
  }}
>
  <Copy className="size-4" /> {busy ? "Duplicando…" : "Repetir hoy"}
</Button>
```

Nota: el card actual es un `<Link>`; el botón va fuera del Link (hermano), no anidado.

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/routes/_authenticated/index.tsx`
Expected: PASS

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`, abrir Inicio, pulsar "Repetir hoy", confirmar que navega a la sesión nueva con fecha de hoy y ejercicios con reps vacías.
Expected: sesión nueva visible en Historial con fecha hoy

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/index.tsx
git commit -m "feat(dashboard): boton Repetir hoy en ultimo entreno"
```

### Task 3: Botón Repetir en Historial (por item) y en Editar

**Files:**
- Modify: `src/routes/_authenticated/historial.tsx:66-106`
- Modify: `src/routes/_authenticated/sesion.$id.tsx:75-89`
- Test: `npx tsc --noEmit`, `npx eslint` de ambos, flujo manual en Historial y en Editar

**Interfaces:**
- Consumes: `duplicateSession` de `@/lib/duplicateSession` (Task 1).
- Produces: botones UI, sin nueva API pública.

- [ ] **Step 1: Repetir por item en Historial sin romper el Link**

El item actual es un `<Link className="surface block p-4">`. Cambiar a `<div className="surface block p-4">` contenedor + `<Link>` interno solo para el header/resumen + `<Button size="sm" variant="secondary">` con Repetir. Handler:

```tsx
async function repeat(id: string) {
  try {
    const newId = await duplicateSession(supabase, id);
    toast.success("Sesión duplicada para hoy");
    navigate({ to: "/sesion/$id", params: { id: newId } });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "No se pudo duplicar");
  }
}
```

Requiere importar `useNavigate` de `@tanstack/react-router`, `duplicateSession`, `toast`. Invalidar query `["sessions"]` tras duplicar si se queda en la lista (usar `useQueryClient`).

- [ ] **Step 2: Botón Duplicar en página Editar**

En `EditSession` (`sesion.$id.tsx`), junto al botón Borrar agregar botón "Duplicar hoy" que llama `duplicateSession(supabase, id)` y navega al nuevo id. Importar lo mismo.

```tsx
async function repeat() {
  try {
    const newId = await duplicateSession(supabase, id);
    toast.success("Sesión duplicada para hoy");
    navigate({ to: "/sesion/$id", params: { id: newId } });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "No se pudo duplicar");
  }
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/routes/_authenticated/historial.tsx src/routes/_authenticated/sesion.$id.tsx`
Expected: PASS

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`. En Historial, duplicar una sesión vieja → debe aparecer arriba con fecha hoy. En Editar, duplicar → navega a la copia.
Expected: ambas rutas crean copia con `actual_reps` vacío y `performed=true`

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/historial.tsx src/routes/_authenticated/sesion.$id.tsx
git commit -m "feat(historial): repetir sesion por item y desde editar"
```
