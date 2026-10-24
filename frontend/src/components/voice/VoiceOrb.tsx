import { useEffect, useRef } from "react";
import type { VoiceState } from "@/types/conversation";

const N = 520;     // dots on the ring
const LOBES = 9;   // number of waves around the ring (tweak to match your shape)
const TARGET: Partial<Record<VoiceState, number>> = {
  speaking: 1, listening: 0.5, thinking: 0.7, connecting: 0.6,
};

// Pastel orb palette: blue, violet, pink, orange, yellow, green, teal.
const STOPS: [number, number, number][] = [
  [47, 123, 246], [155, 123, 240], [255, 127, 165], [255, 159, 85],
  [245, 194, 61], [95, 211, 160], [25, 195, 165],
];

function dotColor(a: number): string {
  const u = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * STOPS.length;
  const i = Math.floor(u), f = u - i;
  const p = STOPS[i % STOPS.length], q = STOPS[(i + 1) % STOPS.length];
  const m = (k: number) => (p[k] + (q[k] - p[k]) * f) | 0;
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

export default function VoiceOrb({ state, size = 300 }: { state: VoiceState; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const pts = Array.from({ length: N }, (_, i) => ({
      a: (i / N) * Math.PI * 2,
      o: Math.random() * 2 - 1,
    }));
    const c = size / 2;
    let amp = 0, raf = 0;

    const draw = (t: number) => {
      const s = stateRef.current;
      amp += ((TARGET[s] ?? 0.2) - amp) * 0.05;
      ctx.clearRect(0, 0, size, size);

      const R = size * 0.32;
      const spin = t / (s === "thinking" ? 3000 : 14000);
      const wave = t / (s === "thinking" ? 500 : 1500); // how fast the waves travel
      const depth = 0.07 + 0.06 * amp;                   // how deep the waves are

      // soft light centre, like the cream inside your shape
      const g = ctx.createRadialGradient(c, c, 0, c, c, R * 1.05);
      g.addColorStop(0, "rgba(255,255,255,.55)");
      g.addColorStop(1, "rgba(255,255,255,.12)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fill();

      for (const q of pts) {
        const a = q.a + spin;
        const r = R + Math.sin(LOBES * a + wave) * R * depth + q.o * (1.5 + 4 * amp);
        ctx.fillStyle = s === "error" ? "rgb(200,90,90)" : dotColor(a);
        ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.8, 1.8);
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas ref={ref} role="img" aria-label={`Voice assistant: ${state}`}
            style={{ width: size, height: size }} />
  );
}