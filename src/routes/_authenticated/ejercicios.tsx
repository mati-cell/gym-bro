import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionLabel, formatDate, formatPlan } from "@/lib/workout";

export const Route = createFileRoute("/_authenticated/ejercicios")({
  head: () => ({
    meta: [
      { title: "Evolución por ejercicio · GymLog" },
      {
        name: "description",
        content: "Gráfico de progresión de peso y repeticiones por ejercicio.",
      },
      { property: "og:title", content: "Evolución por ejercicio · GymLog" },
      { property: "og:description", content: "Progresión de cargas y notas de técnica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExerciseView,
});

type Row = {
  id: string;
  name: string;
  planned_sets: number | null;
  planned_reps: string | null;
  planned_weight_kg: number | null;
  actual_reps: number[];
  notes: string | null;
  action: string | null;
  performed: boolean;
  sessions: { session_date: string } | null;
};

function ExerciseView() {
  const [selected, setSelected] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["all-exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercises")
        .select(
          "id, name, planned_sets, planned_reps, planned_weight_kg, actual_reps, notes, action, performed, sessions(session_date)",
        );
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const names = useMemo(
    () => [...new Set((data ?? []).map((r) => r.name))].sort((a, b) => a.localeCompare(b)),
    [data],
  );

  const current = useMemo(() => {
    const name = selected || names[0];
    return (data ?? [])
      .filter((r) => r.name === name)
      .sort((a, b) => (a.sessions?.session_date ?? "").localeCompare(b.sessions?.session_date ?? ""));
  }, [data, selected, names]);

  const chartData = current.map((r) => ({
    fecha: r.sessions?.session_date ? formatDate(r.sessions.session_date) : "",
    peso: r.planned_weight_kg ?? null,
    reps: r.actual_reps?.length
      ? Math.round(r.actual_reps.reduce((a, b) => a + b, 0) / r.actual_reps.length)
      : null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Por ejercicio</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : names.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ejercicios registrados.</p>
      ) : (
        <>
          <Select value={selected || names[0] || ""} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {names.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="surface h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="peso"
                  name="Peso (kg)"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="reps"
                  name="Reps promedio"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {[...current].reverse().map((r) => (
              <div key={r.id} className="surface p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {r.sessions?.session_date ? formatDate(r.sessions.session_date) : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatPlan(r)}</span>
                </div>
                {r.actual_reps?.length > 0 && <div>Reps: {r.actual_reps.join(", ")}</div>}
                {r.notes && <div className="text-muted-foreground">{r.notes}</div>}
                {r.action && <span className="text-xs text-primary">{actionLabel(r.action)}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
