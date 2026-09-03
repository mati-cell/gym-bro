import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.6-flash";

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
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Falta la API key de Google AI (Gemini) en el servidor.");

  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content);
  const turns = messages.filter((m) => m.role !== "system");

  const contents = turns.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  // Gemini exige que la conversación empiece con un turno de usuario.
  while (contents.length > 0 && contents[0]?.role !== "user") contents.shift();

  const res = await fetch(
    `${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        ...(systemParts.length
          ? { systemInstruction: { parts: [{ text: systemParts.join("\n\n") }] } }
          : {}),
        contents,
        generationConfig: { temperature },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("Gemini error", res.status, detail);
    throw new Error(`El agente de IA devolvió un error (${res.status}).`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (
    json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

type SupabaseCtx = { supabase: any; userId: string };

function normalizeModel(model: string | null | undefined): string {
  // Modelos viejos de NVIDIA NIM ("openai/...", "meta/...") ya no aplican.
  if (!model || model.includes("/")) return DEFAULT_MODEL;
  return model;
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
