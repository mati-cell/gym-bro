import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDate } from "@/lib/workout";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil · GymLog" },
      {
        name: "description",
        content: "Peso, altura, objetivo y evolución corporal usados por el agente de IA.",
      },
      { property: "og:title", content: "Mi perfil · GymLog" },
      { property: "og:description", content: "Datos personales y evolución de peso corporal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type Form = {
  weight_kg: string;
  height_cm: string;
  age: string;
  goal: string;
  experience_level: string;
  notes: string;
  ai_model: string;
};

const EMPTY: Form = {
  weight_kg: "",
  height_cm: "",
  age: "",
  goal: "",
  experience_level: "",
  notes: "",
  ai_model: "gemini-2.0-flash",
};

function num(v: string) {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ProfilePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [newWeight, setNewWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;
      const [{ data: profile }, { data: logs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("body_weight_logs")
          .select("*")
          .order("logged_on", { ascending: true }),
      ]);
      return { userId, profile, logs: logs ?? [] };
    },
  });

  useEffect(() => {
    if (data?.profile) {
      setForm({
        weight_kg: data.profile.weight_kg?.toString() ?? "",
        height_cm: data.profile.height_cm?.toString() ?? "",
        age: data.profile.age?.toString() ?? "",
        goal: data.profile.goal ?? "",
        experience_level: data.profile.experience_level ?? "",
        notes: data.profile.notes ?? "",
        ai_model: data.profile.ai_model ?? EMPTY.ai_model,
      });
    }
  }, [data?.profile]);

  async function save() {
    if (!data?.userId) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: data.userId,
      weight_kg: num(form.weight_kg),
      height_cm: num(form.height_cm),
      age: form.age ? Number.parseInt(form.age, 10) : null,
      goal: form.goal || null,
      experience_level: form.experience_level || null,
      notes: form.notes || null,
      ai_model: form.ai_model || EMPTY.ai_model,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Perfil guardado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  }

  async function addWeight() {
    const w = num(newWeight);
    if (!data?.userId || w == null) return;
    const { error } = await supabase
      .from("body_weight_logs")
      .insert({ user_id: data.userId, weight_kg: w });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewWeight("");
    setForm((f) => ({ ...f, weight_kg: String(w) }));
    await supabase.from("profiles").update({ weight_kg: w }).eq("id", data.userId);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Peso registrado");
  }

  const chart = (data?.logs ?? []).map((l: any) => ({
    fecha: formatDate(l.logged_on),
    peso: Number(l.weight_kg),
  }));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Mi perfil</h1>

      <div className="surface space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>Peso (kg)</Label>
            <Input
              inputMode="decimal"
              value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Altura (cm)</Label>
            <Input
              inputMode="decimal"
              value={form.height_cm}
              onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Edad</Label>
            <Input
              inputMode="numeric"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Objetivo</Label>
          <Input
            placeholder="Hipertrofia, fuerza, pérdida de grasa…"
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nivel de experiencia</Label>
          <Input
            placeholder="Principiante / intermedio / avanzado"
            value={form.experience_level}
            onChange={(e) => setForm({ ...form, experience_level: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Notas (lesiones, restricciones)</Label>
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Modelo de IA (Google Gemini)</Label>
          <Input
            value={form.ai_model}
            onChange={(e) => setForm({ ...form, ai_model: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Ej: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro
          </p>
        </div>
        <Button className="w-full" disabled={saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar perfil"}
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Peso corporal
        </h2>
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder="Peso de hoy"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
          />
          <Button onClick={() => void addWeight()}>Registrar</Button>
        </div>
        {chart.length > 1 && (
          <div className="surface h-56 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
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
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
