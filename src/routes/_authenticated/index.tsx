import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardPaste, Copy, Flame, PlusCircle, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  actionLabel,
  actionTone,
  countThisWeek,
  formatDate,
  formatPlan,
  type SessionRow,
} from "@/lib/workout";
import { duplicateSession } from "@/lib/duplicateSession";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Inicio · GymLog" },
      { name: "description", content: "Resumen de tu último entreno y accesos rápidos." },
      { property: "og:title", content: "Inicio · GymLog" },
      { property: "og:description", content: "Resumen de tu último entreno y accesos rápidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [last, pending, all] = await Promise.all([
        supabase
          .from("sessions")
          .select("*, session_exercises(*)")
          .order("session_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("session_exercises")
          .select("id, name, action")
          .not("action", "is", null)
          .limit(12),
        supabase
          .from("sessions")
          .select("id, session_date")
          .order("session_date", { ascending: false })
          .limit(60),
      ]);
      return {
        last: (last.data as SessionRow | null) ?? null,
        pending: pending.data ?? [],
        weekCount: countThisWeek((all.data ?? []) as Array<{ session_date: string }>),
      };
    },
  });

  const last = data?.last;
  const exercises = [...(last?.session_exercises ?? [])].sort((a, b) => a.position - b.position);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5">
        <div
          aria-hidden
          className="absolute -top-20 -right-20 size-56 rounded-full"
          style={{
            background: "radial-gradient(circle, var(--color-primary) 0%, transparent 70%)",
            opacity: 0.22,
          }}
        />
        <p className="text-xs text-muted-foreground">
          {formatDate(new Date().toISOString().slice(0, 10))}
        </p>
        <h1 className="text-2xl font-bold">Hola 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.weekCount
            ? `${data.weekCount} entrenos en los últimos 7 días`
            : "Hoy es buen día para entrenar"}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/nueva"
          className="surface flex flex-col gap-2 p-4 transition-colors hover:bg-accent"
        >
          <span className="rounded-xl bg-primary/15 p-2 text-primary">
            <PlusCircle className="size-5" />
          </span>
          <span className="font-display font-semibold">Nueva sesión</span>
          <span className="text-xs text-muted-foreground">Registrá en el momento</span>
        </Link>
        <Link
          to="/importar"
          className="surface flex flex-col gap-2 p-4 transition-colors hover:bg-accent"
        >
          <span className="rounded-xl bg-primary/15 p-2 text-primary">
            <ClipboardPaste className="size-5" />
          </span>
          <span className="font-display font-semibold">Importar de WhatsApp</span>
          <span className="text-xs text-muted-foreground">Pegá tu texto de WhatsApp</span>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Flame className="size-4" /> Último entreno
        </h2>
        {isLoading ? (
          <div className="surface p-4 text-sm text-muted-foreground">Cargando…</div>
        ) : !last ? (
          <div className="surface p-4 text-sm text-muted-foreground">
            Todavía no registraste ninguna sesión.
          </div>
        ) : (
          <>
            <Link
              to="/sesion/$id"
              params={{ id: last.id }}
              className="surface block border-primary/40 p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display font-semibold">
                  {last.day_number ? `Día ${last.day_number}` : "Sesión"}
                  {last.title ? ` · ${last.title}` : ""}{" "}
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                    Último
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(last.session_date)}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {exercises.map((ex) => (
                  <li key={ex.id} className="flex justify-between gap-3">
                    <span className={ex.performed ? "" : "text-muted-foreground line-through"}>
                      {ex.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatPlan(ex)}</span>
                  </li>
                ))}
              </ul>
            </Link>
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
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Tag className="size-4" /> Pendientes
        </h2>
        {data?.pending?.length ? (
          <div className="flex flex-wrap gap-2">
            {data.pending.map((p) => (
              <span
                key={p.id}
                className={`rounded-full border border-border px-3 py-1 text-xs ${actionTone(p.action)}`}
              >
                {p.name} · <span>{actionLabel(p.action)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nada etiquetado por ahora.</p>
        )}
      </section>
    </div>
  );
}
