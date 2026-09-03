import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.6-flash";

export type ParsedExercise = {
  name: string;
  muscle_group: string | null;
  planned_sets: number | null;
  planned_reps: string | null;
  planned_weight_kg: number | null;
  actual_reps: number[];
  performed: boolean;
  notes: string | null;
  action: string | null;
};

export type ParsedSession = {
  day_number: number | null;
  session_date: string | null;
  title: string | null;
  notes: string | null;
  exercises: ParsedExercise[];
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callGemini(model: string, messages: ChatMessage[], temperature = 0.4) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Falta la API key del gateway de IA en el servidor.");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("AI gateway error", res.status, detail);
    if (res.status === 429) throw new Error("Demasiadas consultas seguidas. Probá en un minuto.");
    if (res.status === 402) throw new Error("Se agotaron los créditos de IA del proyecto.");
    throw new Error(`El agente de IA devolvió un error (${res.status}).`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

type SupabaseCtx = { supabase: any; userId: string };

function normalizeModel(model: string | null | undefined): string {
  if (!model) return DEFAULT_MODEL;
  // Modelos guardados sin prefijo de proveedor (o de NVIDIA NIM) se normalizan.
  if (model.startsWith("google/") || model.startsWith("openai/")) return model;
  if (model.startsWith("gemini")) return `google/${model}`;
  if (model.startsWith("gpt")) return `openai/${model}`;
  return DEFAULT_MODEL;
}


async function buildUserContext({ supabase, userId }: SupabaseCtx) {
  const [{ data: profile }, { data: weights }, { data: sessions }, { data: pending }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("body_weight_logs")
        .select("logged_on, weight_kg")
        .order("logged_on", { ascending: false })
        .limit(10),
      supabase
        .from("sessions")
        .select("id, day_number, session_date, title, notes, session_exercises(*)")
        .order("session_date", { ascending: false })
        .limit(8),
      supabase
        .from("session_exercises")
        .select("name, action, notes, planned_weight_kg, planned_reps")
        .not("action", "is", null)
        .limit(30),
    ]);

  const lines: string[] = [];
  lines.push("PERFIL DEL USUARIO:");
  lines.push(JSON.stringify(profile ?? {}, null, 0));
  lines.push("HISTORIAL DE PESO CORPORAL (más reciente primero):");
  lines.push(JSON.stringify(weights ?? []));
  lines.push("ÚLTIMAS SESIONES DE ENTRENO (con sus ejercicios):");
  lines.push(JSON.stringify(sessions ?? []));
  lines.push("EJERCICIOS CON ACCIÓN PENDIENTE:");
  lines.push(JSON.stringify(pending ?? []));

  return { context: lines.join("\n"), model: normalizeModel(profile?.ai_model) };
}

export const askAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[] }) => {
    if (!input || !Array.isArray(input.messages)) throw new Error("Mensajes inválidos");
    return {
      messages: input.messages.slice(-20).map((m) => ({
        role: m.role,
        content: String(m.content ?? "").slice(0, 6000),
      })) as ChatMessage[],
    };
  })
  .handler(async ({ data, context }) => {
    const { context: userContext, model } = await buildUserContext(context as SupabaseCtx);

    const system: ChatMessage = {
      role: "system",
      content: [
        "Sos un entrenador personal experto en gimnasio, fuerza e hipertrofia.",
        "Respondés SIEMPRE en español rioplatense, breve y concreto, con bullets cuando ayude.",
        "Usás los datos reales del usuario que están más abajo para personalizar la respuesta:",
        "podés responder qué peso usó, cuántas repeticiones hizo, qué tiene pendiente de revisar, etc.",
        "Si un dato no está en el contexto, decilo en lugar de inventarlo.",
        "No des diagnósticos médicos; ante dolor persistente sugerí consultar a un profesional.",
        "",
        userContext,
      ].join("\n"),
    };

    const reply = await callGemini(model, [system, ...data.messages], 0.5);
    return { reply, model };
  });

export const parseWorkoutText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) => {
    const text = String(input?.text ?? "").trim();
    if (!text) throw new Error("Pegá el texto de la rutina");
    return { text: text.slice(0, 12000) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_model")
      .eq("id", userId)
      .maybeSingle();
    const model = normalizeModel(profile?.ai_model);

    const system: ChatMessage = {
      role: "system",
      content: `Convertís rutinas de gimnasio escritas a mano (estilo WhatsApp) en JSON estructurado.
Devolvés EXCLUSIVAMENTE un objeto JSON válido, sin markdown ni explicaciones, con esta forma:
{
  "day_number": number|null,
  "session_date": "YYYY-MM-DD"|null,
  "title": string|null,
  "notes": string|null,
  "exercises": [
    {
      "name": string,
      "muscle_group": string|null,
      "planned_sets": number|null,
      "planned_reps": string|null,
      "planned_weight_kg": number|null,
      "actual_reps": number[],
      "performed": boolean,
      "notes": string|null,
      "action": "subir_peso"|"bajar_peso"|"mantener"|"cambiar_ejercicio"|"revisar_tecnica"|null
    }
  ]
}
Reglas:
- "4 x 10 - 41kg" => planned_sets 4, planned_reps "10", planned_weight_kg 41. "3 x 8/12" => planned_reps "8/12".
- Una línea suelta de números ("12, 11, 9, 8") justo debajo de un ejercicio son las repeticiones reales => actual_reps.
- Encabezados tipo "--BICEPS--" definen el muscle_group de los ejercicios siguientes.
- Bloques de "aproximación" o calentamiento van en notes de la sesión o del ejercicio, no como ejercicio aparte.
- "No hice por tiempo" => performed false y ese texto en notes.
- Comentarios de técnica ("bajé a 32 x 12 para mejorar técnica") van en notes y sugieren action "revisar_tecnica".
- Fechas dd/mm/yyyy => YYYY-MM-DD.`,
    };

    const raw = await callGemini(model, [system, { role: "user", content: data.text }], 0.1);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("El agente no devolvió un JSON válido. Probá de nuevo.");
    try {
      return JSON.parse(match[0]) as ParsedSession;
    } catch {
      throw new Error("No pude interpretar la respuesta del agente. Probá de nuevo.");
    }
  });
