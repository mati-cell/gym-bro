import { useId } from "react";

const TONES = {
  active: "var(--color-primary)",
  urgent: "var(--color-warning)",
  done: "var(--color-success)",
} as const;

export function CountdownRing({
  progress,
  size = 220,
  stroke = 14,
  tone,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  tone: keyof typeof TONES;
  children?: React.ReactNode;
}) {
  const id = useId();
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(p * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ width: size, height: size }}
      className={`relative ${tone === "urgent" ? "animate-pulse" : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONES[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
        />
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--color-primary)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-chart-2)" }} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
