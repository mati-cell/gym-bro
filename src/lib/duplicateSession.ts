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

export async function duplicateSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sessionId: string,
): Promise<string> {
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
