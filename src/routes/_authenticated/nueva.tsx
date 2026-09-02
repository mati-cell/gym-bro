import { createFileRoute } from "@tanstack/react-router";
import { SessionForm, emptyDraft } from "@/components/SessionForm";

export const Route = createFileRoute("/_authenticated/nueva")({
  head: () => ({
    meta: [
      { title: "Nueva sesión · GymLog" },
      { name: "description", content: "Registrá una nueva sesión de entrenamiento rápido." },
      { property: "og:title", content: "Nueva sesión · GymLog" },
      { property: "og:description", content: "Registrá una nueva sesión de entrenamiento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nueva sesión</h1>
      <SessionForm initial={emptyDraft()} />
    </div>
  ),
});
