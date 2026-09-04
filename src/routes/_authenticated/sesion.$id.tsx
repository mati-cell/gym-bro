import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SessionForm, emptyExercise, type DraftSession } from "@/components/SessionForm";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { SessionRow } from "@/lib/workout";
import { duplicateSession } from "@/lib/duplicateSession";

export const Route = createFileRoute("/_authenticated/sesion/$id")({
  head: () => ({
    meta: [
      { title: "Editar sesión · GymLog" },
      { name: "description", content: "Editá o borrá una sesión de entrenamiento registrada." },
      { property: "og:title", content: "Editar sesión · GymLog" },
      { property: "og:description", content: "Editá una sesión de entrenamiento registrada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditSession,
});

function toDraft(s: SessionRow): DraftSession {
  const exercises = [...(s.session_exercises ?? [])].sort((a, b) => a.position - b.position);
  return {
    day_number: s.day_number?.toString() ?? "",
    session_date: s.session_date,
    title: s.title ?? "",
    notes: s.notes ?? "",
    exercises: exercises.length
      ? exercises.map((ex) => ({
          ...emptyExercise(),
          name: ex.name,
          muscle_group: ex.muscle_group ?? "",
          planned_sets: ex.planned_sets?.toString() ?? "",
          planned_reps: ex.planned_reps ?? "",
          planned_weight_kg: ex.planned_weight_kg?.toString() ?? "",
          actual_reps: (ex.actual_reps ?? []).join(", "),
          performed: ex.performed,
          notes: ex.notes ?? "",
          action: ex.action ?? "none",
        }))
      : [emptyExercise()],
  };
}

function EditSession() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, session_exercises(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as SessionRow;
    },
  });

  async function remove() {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sesión borrada");
    navigate({ to: "/historial" });
  }

  async function repeat() {
    try {
      const newId = await duplicateSession(supabase, id);
      toast.success("Sesión duplicada para hoy");
      navigate({ to: "/sesion/$id", params: { id: newId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo duplicar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar sesión</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void repeat()}>
            <Copy className="size-4" /> Duplicar hoy
          </Button>
          <Button variant="destructive" size="sm" onClick={() => void remove()}>
            <Trash2 className="size-4" /> Borrar
          </Button>
        </div>
      </div>
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <SessionForm sessionId={id} initial={toDraft(data)} />
      )}
    </div>
  );
}
