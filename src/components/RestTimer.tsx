import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountdownRing } from "@/components/CountdownRing";
import { toast } from "sonner";
import {
  REST_PRESETS,
  REST_STORAGE_ENDS_AT,
  REST_STORAGE_TOTAL,
  formatCountdown,
  remainingSeconds,
} from "@/lib/restTimer";

type Phase = "idle" | "running" | "paused" | "done";

const FINISH_MESSAGE = "¡Hora de la próxima serie!";

function beep() {
  try {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Sin audio: el toast + vibración avisan igual.
  }
}

function notifyFinish() {
  beep();
  try {
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  } catch {
    // Sin vibración: el toast avisa igual.
  }
  toast.success(FINISH_MESSAGE);
}

function readStored(): { endsAt: number; total: number } | null {
  try {
    const e = window.localStorage.getItem(REST_STORAGE_ENDS_AT);
    const t = window.localStorage.getItem(REST_STORAGE_TOTAL);
    if (!e || !t) return null;
    const endsAt = Number.parseInt(e, 10);
    const total = Number.parseInt(t, 10);
    if (!Number.isFinite(endsAt) || !Number.isFinite(total) || total <= 0) return null;
    return { endsAt, total };
  } catch {
    return null;
  }
}

export function RestTimer() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [total, setTotal] = useState<number>(REST_PRESETS[0]);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(REST_PRESETS[0]);
  const [custom, setCustom] = useState("");
  const firedRef = useRef(false);

  useEffect(() => {
    const stored = readStored();
    if (!stored) return;
    const left = remainingSeconds(stored.endsAt, Date.now());
    setTotal(stored.total);
    if (left > 0) {
      setEndsAt(stored.endsAt);
      setRemaining(left);
      setPhase("running");
    } else {
      setRemaining(0);
      setPhase("done");
    }
  }, []);

  useEffect(() => {
    if (phase !== "running" || endsAt == null) return;
    const id = window.setInterval(() => {
      const left = remainingSeconds(endsAt, Date.now());
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        try {
          window.localStorage.removeItem(REST_STORAGE_ENDS_AT);
          window.localStorage.removeItem(REST_STORAGE_TOTAL);
        } catch {
          // Storage opcional.
        }
        setPhase("done");
        if (!firedRef.current) {
          firedRef.current = true;
          notifyFinish();
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, endsAt]);

  function persist(nextEndsAt: number, nextTotal: number) {
    try {
      window.localStorage.setItem(REST_STORAGE_ENDS_AT, String(nextEndsAt));
      window.localStorage.setItem(REST_STORAGE_TOTAL, String(nextTotal));
    } catch {
      // Storage opcional.
    }
  }

  function start(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const totalSec = Math.floor(seconds);
    const nextEndsAt = Date.now() + totalSec * 1000;
    firedRef.current = false;
    setTotal(totalSec);
    setEndsAt(nextEndsAt);
    setRemaining(totalSec);
    setPhase("running");
    persist(nextEndsAt, totalSec);
  }

  function pause() {
    setPhase("paused");
  }

  function resume() {
    if (remaining <= 0) return;
    const nextEndsAt = Date.now() + remaining * 1000;
    setEndsAt(nextEndsAt);
    setPhase("running");
    persist(nextEndsAt, total);
  }

  function reset() {
    try {
      window.localStorage.removeItem(REST_STORAGE_ENDS_AT);
      window.localStorage.removeItem(REST_STORAGE_TOTAL);
    } catch {
      // Storage opcional.
    }
    setEndsAt(null);
    setRemaining(total);
    setPhase("idle");
  }

  function startCustom() {
    const v = Number.parseInt(custom.replace(",", "."), 10);
    if (!Number.isFinite(v) || v <= 0) return;
    start(v);
  }

  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  return (
    <>
      <button
        aria-label="Timer de descanso"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 flex size-14 items-center justify-center rounded-full bg-secondary p-1 text-secondary-foreground shadow-glow transition-transform active:scale-95"
      >
        <CountdownRing
          progress={phase === "running" || phase === "paused" ? progress : 0}
          size={56}
          stroke={5}
          tone={phase === "running" && remaining <= 10 ? "urgent" : "active"}
        >
          {phase === "running" || phase === "paused" ? (
            <span className="text-xs font-bold tabular-nums">{formatCountdown(remaining)}</span>
          ) : (
            <Timer className="size-6" />
          )}
        </CountdownRing>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Timer className="size-5 text-primary" />
              <span className="font-display font-semibold">Descanso</span>
            </div>
            <button
              aria-label="Cerrar timer"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
            <CountdownRing
              progress={phase === "done" ? 0 : progress}
              size={220}
              stroke={14}
              tone={
                phase === "done"
                  ? "done"
                  : remaining <= 10 && phase === "running"
                    ? "urgent"
                    : "active"
              }
            >
              {phase === "done" ? (
                <p className="px-6 text-center text-xl font-bold">{FINISH_MESSAGE}</p>
              ) : (
                <p className="text-5xl font-bold tabular-nums">{formatCountdown(remaining)}</p>
              )}
            </CountdownRing>

            <div className="flex flex-wrap justify-center gap-2">
              {REST_PRESETS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={total === s && phase !== "idle" ? "default" : "secondary"}
                  onClick={() => start(s)}
                >
                  {s}s
                </Button>
              ))}
            </div>

            <div className="flex w-full max-w-xs gap-2">
              <Input
                inputMode="numeric"
                placeholder="Custom (seg)"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <Button variant="secondary" onClick={startCustom} disabled={!custom.trim()}>
                Usar
              </Button>
            </div>

            <div className="flex gap-2">
              {phase === "running" ? (
                <Button variant="secondary" onClick={pause}>
                  <Pause className="size-4" /> Pausar
                </Button>
              ) : phase === "paused" ? (
                <Button onClick={resume}>
                  <Play className="size-4" /> Seguir
                </Button>
              ) : (
                <Button onClick={() => start(total)}>
                  <Play className="size-4" /> Empezar
                </Button>
              )}
              <Button variant="ghost" onClick={reset}>
                <RotateCcw className="size-4" /> Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
