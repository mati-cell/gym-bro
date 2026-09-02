import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ACTIONS, actionLabel, formatDate, formatPlan, type SessionRow } from "@/lib/workout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({
    meta: [
      { title: "Historial · GymLog" },
      { name: "description", content: "Todas tus sesiones de entrenamiento ordenadas por fecha." },
      { property: "og:title", content: "Historial · GymLog" },
      { property: "og:description", content: "Línea de tiempo de tus entrenos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: History,
});

function History() {
  const [filter, setFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, session_exercises(*)")
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const sessions = (data ?? []).filter((s) =>
    filter ? (s.session_exercises ?? []).some((ex) => ex.action === filter) : true,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Historial</h1>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter ? "secondary" : "default"} onClick={() => setFilter(null)}>
          Todas
        </Button>
        {ACTIONS.map((a) => (
          <Button
            key={a.value}
            size="sm"
            variant={filter === a.value ? "default" : "secondary"}
            onClick={() => setFilter(filter === a.value ? null : a.value)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay sesiones para este filtro.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const exercises = [...(s.session_exercises ?? [])].sort((a, b) => a.position - b.position);
            return (
              <Link key={s.id} to="/sesion/$id" params={{ id: s.id }} className="surface block p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display font-semibold">
                    {s.day_number ? `Día ${s.day_number}` : "Sesión"}
                    {s.title ? ` · ${s.title}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(s.session_date)}</span>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {exercises.map((ex) => (
                    <li key={ex.id}>
                      <div className="flex justify-between gap-3">
                        <span className={ex.performed ? "" : "text-muted-foreground line-through"}>
                          {ex.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatPlan(ex)}
                        </span>
                      </div>
                      {ex.actual_reps?.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Reps: {ex.actual_reps.join(", ")}
                        </div>
                      )}
                      {ex.notes && <div className="text-xs text-muted-foreground">{ex.notes}</div>}
                      {ex.action && (
                        <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] text-primary">
                          {actionLabel(ex.action)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
