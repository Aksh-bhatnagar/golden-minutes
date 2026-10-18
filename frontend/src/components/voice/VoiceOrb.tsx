import { useEffect, useRef } from "react";
import type { VoiceState } from "@/types/conversation";

const N = 900;
const TARGET: Partial<Record<VoiceState, number>> = {
  speaking: 1, listening: 0.5, thinking: 0.7, connecting: 0.6,
};

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

    const pts = Array.from({ length: N }, () => ({
      a: Math.random() * Math.PI * 2,
      o: (Math.random() - 0.5) * 2,
      p: Math.random() * 6.28,
    }));
    let amp = 0, raf = 0;

    const draw = (t: number) => {
      const s = stateRef.current;
      amp += ((TARGET[s] ?? 0.2) - amp) * 0.05;
      ctx.clearRect(0, 0, size, size);
      const R = size * 0.34;
      const spin = t / (s === "thinking" ? 2500 : 9000);

      for (const q of pts) {
        const wob = Math.sin(t / 400 + q.p * 3 + q.a * 4) * amp;
        const r = R + q.o * (6 + 14 * amp) + wob * 8;
        const a = q.a + spin;
        const k = (Math.cos(a) + 1) / 2;
        ctx.fillStyle = s === "error"
          ? "rgb(200,90,90)"
          : `rgb(${245 - 121 * k | 0},${138 - 46 * k | 0},${99 + 141 * k | 0})`;
        ctx.fillRect(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 1.5, 1.5);
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