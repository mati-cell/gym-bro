export const ACTIONS = [
  { value: "subir_peso", label: "Subir peso" },
  { value: "bajar_peso", label: "Bajar peso" },
  { value: "mantener", label: "Mantener" },
  { value: "cambiar_ejercicio", label: "Cambiar ejercicio" },
  { value: "revisar_tecnica", label: "Revisar técnica" },
] as const;

export type ActionValue = (typeof ACTIONS)[number]["value"];

export function actionLabel(value?: string | null) {
  return ACTIONS.find((a) => a.value === value)?.label ?? null;
}

export type ExerciseRow = {
  id: string;
  session_id: string;
  position: number;
  name: string;
  muscle_group: string | null;
  planned_sets: number | null;
  planned_reps: string | null;
  planned_weight_kg: number | null;
  actual_reps: number[];
  performed: boolean;
  notes: string | null;
  action: ActionValue | null;
};

export type SessionRow = {
  id: string;
  day_number: number | null;
  session_date: string;
  title: string | null;
  notes: string | null;
  session_exercises?: ExerciseRow[];
};

export function formatPlan(ex: {
  planned_sets: number | null;
  planned_reps: string | null;
  planned_weight_kg: number | null;
}) {
  const parts: string[] = [];
  if (ex.planned_sets && ex.planned_reps) parts.push(`${ex.planned_sets} x ${ex.planned_reps}`);
  else if (ex.planned_sets) parts.push(`${ex.planned_sets} series`);
  else if (ex.planned_reps) parts.push(`${ex.planned_reps} reps`);
  if (ex.planned_weight_kg != null) parts.push(`${ex.planned_weight_kg} kg`);
  return parts.join(" · ");
}

export function parseRepsInput(value: string): number[] {
  return value
    .split(/[,\s]+/)
    .map((v) => Number.parseInt(v, 10))
    .filter((n) => Number.isFinite(n));
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

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
