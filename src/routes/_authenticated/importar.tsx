import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { parseWorkoutText } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SessionForm, emptyExercise, type DraftSession } from "@/components/SessionForm";
import type { ActionValue } from "@/lib/workout";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar rutina · GymLog" },
      {
        name: "description",
        content: "Pegá tu rutina escrita en WhatsApp y el agente la convierte en datos.",
      },
      { property: "og:title", content: "Importar rutina · GymLog" },
      { property: "og:description", content: "Convertí texto de WhatsApp en una sesión estructurada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

const str = (v: unknown) => (v == null ? "" : String(v));

function toDraft(parsed: any): DraftSession {
  const exercises = Array.isArray(parsed?.exercises) ? parsed.exercises : [];
  return {
    day_number: str(parsed?.day_number),
    session_date: str(parsed?.session_date) || new Date().toISOString().slice(0, 10),
    title: str(parsed?.title),
    notes: str(parsed?.notes),
    exercises: exercises.length
      ? exercises.map((ex: any) => ({
          ...emptyExercise(),
          name: str(ex?.name),
          muscle_group: str(ex?.muscle_group),
          planned_sets: str(ex?.planned_sets),
          planned_reps: str(ex?.planned_reps),
          planned_weight_kg: str(ex?.planned_weight_kg),
          actual_reps: Array.isArray(ex?.actual_reps) ? ex.actual_reps.join(", ") : "",
          performed: ex?.performed !== false,
          notes: str(ex?.notes),
          action: (ex?.action ?? "none") as ActionValue | "none",
        }))
      : [emptyExercise()],
  };
}

function ImportPage() {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<DraftSession | null>(null);
  const [busy, setBusy] = useState(false);
  const parse = useServerFn(parseWorkoutText);

  async function run() {
    setBusy(true);
    try {
      const parsed = await parse({ data: { text } });
      setDraft(toDraft(parsed));
      toast.success("Rutina interpretada. Revisá y guardá.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo interpretar el texto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importar de WhatsApp</h1>
      <p className="text-sm text-muted-foreground">
        Pegá la rutina tal cual la escribís y el agente la convierte en campos estructurados.
      </p>

      <Textarea
        rows={10}
        value={text}
        placeholder={"Día 1, lunes 26/08/2026\nJalón al pecho 4 x 8 - 50 kg\n12, 11, 9, 8"}
        onChange={(e) => setText(e.target.value)}
      />
      <Button className="w-full" disabled={busy || !text.trim()} onClick={() => void run()}>
        <Sparkles className="size-4" /> {busy ? "Interpretando…" : "Interpretar con IA"}
      </Button>

      {draft && <SessionForm key={JSON.stringify(draft).length} initial={draft} />}
    </div>
  );
}
