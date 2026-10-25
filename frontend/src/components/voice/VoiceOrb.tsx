import { useEffect, useRef } from "react";
import type { VoiceState } from "@/types/conversation";

const N = 520;     
const LOBES = 9;   

// Define how the waves behave for each state
const TARGET = {
  listening:  { amp: 0.5, waveSpeed: 1.0 },
  // Speaking: Waves get taller (1.5) and ripple faster (2.5) to look like an active voice
  speaking:   { amp: 1.5, waveSpeed: 2.5 }, 
  // Thinking: Waves become very shallow (0.2) and slow down (0.4) for a calm, concentrated look
  thinking:   { amp: 0.2, waveSpeed: 0.4 }, 
  connecting: { amp: 0.3, waveSpeed: 0.8 },
  error:      { amp: 0.1, waveSpeed: 0.1 }
};

const STOPS: [number, number, number][] = [
  [42, 138, 246], [232, 93, 255], [255, 122, 45], [30, 227, 181], [255, 232, 115],
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
    
    let curAmp = 0.5, curWaveSpeed = 1.0, waveOffset = 0, raf = 0;

    const draw = (t: number) => {
      const s = stateRef.current;
      const target = TARGET[s as keyof typeof TARGET] || TARGET.listening;

      // 1. Smoothly glide towards the target properties
      curAmp += (target.amp - curAmp) * 0.05;
      curWaveSpeed += (target.waveSpeed - curWaveSpeed) * 0.05;

      // 2. Accumulate wave position. This prevents the "glitch" when speeds change.
      waveOffset += curWaveSpeed * 0.015;

      ctx.clearRect(0, 0, size, size);

      const R = size * 0.32;
      // Constant, gentle overall rotation. Never spins fast or gets dizzy.
      const spin = t / 14000; 
      const depth = 0.07 + 0.06 * curAmp;                  

      const g = ctx.createRadialGradient(c, c, 0, c, c, R * 1.05);
      g.addColorStop(0, "rgba(255,255,255,.55)");
      g.addColorStop(1, "rgba(255,255,255,.12)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fill();

      for (const q of pts) {
        const a = q.a + spin;
        // The particles stay tightly bound to the line, just making the line taller/shorter
        const r = R + Math.sin(LOBES * a + waveOffset) * R * depth + q.o * (1.5 + 4 * curAmp * 0.4);
        ctx.fillStyle = s === "error" ? "rgb(200,90,90)" : dotColor(a);
        ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.8, 1.8);
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  // CSS only handles gentle scaling for presence, absolutely no spinning animations here
  const wrapperClass = 
    state === "speaking" ? "scale-[1.08]" : 
    state === "thinking" ? "scale-[0.98]" : 
    state === "connecting" ? "scale-95 opacity-80" : 
    "scale-100";

  return (
    <div className={`flex items-center justify-center transition-all duration-1000 ease-out ${wrapperClass}`}>
      <canvas 
        ref={ref} 
        role="img" 
        aria-label={`Voice assistant: ${state}`}
        style={{ width: size, height: size }} 
      />
    </div>
  );
}