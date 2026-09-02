import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ACTIONS, parseRepsInput, type ActionValue } from "@/lib/workout";

export type DraftExercise = {
  name: string;
  muscle_group: string;
  planned_sets: string;
  planned_reps: string;
  planned_weight_kg: string;
  actual_reps: string;
  performed: boolean;
  notes: string;
  action: ActionValue | "none";
};

export type DraftSession = {
  day_number: string;
  session_date: string;
  title: string;
  notes: string;
  exercises: DraftExercise[];
};

export function emptyExercise(): DraftExercise {
  return {
    name: "",
    muscle_group: "",
    planned_sets: "",
    planned_reps: "",
    planned_weight_kg: "",
    actual_reps: "",
    performed: true,
    notes: "",
    action: "none",
  };
}

export function emptyDraft(): DraftSession {
  return {
    day_number: "",
    session_date: new Date().toISOString().slice(0, 10),
    title: "",
    notes: "",
    exercises: [emptyExercise()],
  };
}

function num(v: string) {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function SessionForm({
  initial,
  sessionId,
}: {
  initial: DraftSession;
  sessionId?: string;
}) {
  const [draft, setDraft] = useState<DraftSession>(initial);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function updateEx(i: number, patch: Partial<DraftExercise>) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)),
    }));
  }

  async function save() {
    const exercises = draft.exercises.filter((ex) => ex.name.trim());
    if (!exercises.length) {
      toast.error("Agregá al menos un ejercicio");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sesión expirada");

      const payload = {
        user_id: userId,
        day_number: draft.day_number ? Number.parseInt(draft.day_number, 10) : null,
        session_date: draft.session_date,
        title: draft.title || null,
        notes: draft.notes || null,
      };

      let id = sessionId;
      if (id) {
        const { error } = await supabase.from("sessions").update(payload).eq("id", id);
        if (error) throw error;
        const { error: delErr } = await supabase
          .from("session_exercises")
          .delete()
          .eq("session_id", id);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.from("sessions").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      const rows = exercises.map((ex, i) => ({
        session_id: id!,
        user_id: userId,
        position: i,
        name: ex.name.trim(),
        muscle_group: ex.muscle_group || null,
        planned_sets: ex.planned_sets ? Number.parseInt(ex.planned_sets, 10) : null,
        planned_reps: ex.planned_reps || null,
        planned_weight_kg: num(ex.planned_weight_kg),
        actual_reps: parseRepsInput(ex.actual_reps),
        performed: ex.performed,
        notes: ex.notes || null,
        action: ex.action === "none" ? null : ex.action,
      }));

      const { error: insErr } = await supabase.from("session_exercises").insert(rows);
      if (insErr) throw insErr;

      toast.success("Sesión guardada");
      navigate({ to: "/historial" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="day">Día N°</Label>
            <Input
              id="day"
              inputMode="numeric"
              value={draft.day_number}
              onChange={(e) => setDraft({ ...draft, day_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              value={draft.session_date}
              onChange={(e) => setDraft({ ...draft, session_date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            placeholder="Espalda y bíceps"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="snotes">Notas de la sesión / aproximación</Label>
          <Textarea
            id="snotes"
            rows={3}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
      </div>

      {draft.exercises.map((ex, i) => (
        <div key={i} className="surface space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ejercicio"
              value={ex.name}
              onChange={(e) => updateEx(i, { name: e.target.value })}
            />
            <button
              aria-label="Quitar ejercicio"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
              onClick={() =>
                setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, idx) => idx !== i) }))
              }
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <Input
            placeholder="Grupo muscular (ej. espalda)"
            value={ex.muscle_group}
            onChange={(e) => updateEx(i, { muscle_group: e.target.value })}
          />

          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Series"
              inputMode="numeric"
              value={ex.planned_sets}
              onChange={(e) => updateEx(i, { planned_sets: e.target.value })}
            />
            <Input
              placeholder="Reps (10 u 8/12)"
              value={ex.planned_reps}
              onChange={(e) => updateEx(i, { planned_reps: e.target.value })}
            />
            <Input
              placeholder="Peso kg"
              inputMode="decimal"
              value={ex.planned_weight_kg}
              onChange={(e) => updateEx(i, { planned_weight_kg: e.target.value })}
            />
          </div>

          <Input
            placeholder="Reps reales por serie: 12, 11, 9, 8"
            value={ex.actual_reps}
            onChange={(e) => updateEx(i, { actual_reps: e.target.value })}
          />

          <Textarea
            rows={2}
            placeholder="Notas: técnica, pausas, motivo de no haberlo hecho…"
            value={ex.notes}
            onChange={(e) => updateEx(i, { notes: e.target.value })}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={ex.action}
              onValueChange={(v) => updateEx(i, { action: v as ActionValue | "none" })}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Acción sugerida" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin etiqueta</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={ex.performed}
                onCheckedChange={(v) => updateEx(i, { performed: v })}
              />
              {ex.performed ? "Realizado" : "No lo hice"}
            </label>
          </div>
        </div>
      ))}

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setDraft((d) => ({ ...d, exercises: [...d.exercises, emptyExercise()] }))}
      >
        <Plus className="size-4" /> Agregar ejercicio
      </Button>

      <Button className="w-full" disabled={saving} onClick={() => void save()}>
        {saving ? "Guardando…" : "Guardar sesión"}
      </Button>
    </div>
  );
}
