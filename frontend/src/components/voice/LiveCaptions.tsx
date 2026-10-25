import { useEffect, useState } from "react";
import type { Caption } from "@/types/conversation";

export default function LiveCaptions({
  captions,
  currentTranscript,
  speakingText,
  getProgress,
}: {
  captions: Caption[];
  currentTranscript: string;
  speakingText: string | null;
  getProgress: () => number;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!speakingText) return;

    const total = speakingText.split(/\s+/).filter(Boolean).length;
    let raf = 0;

    setShown(1);
    const tick = () => {
      setShown(Math.max(1, Math.ceil(getProgress() * total * 1.08)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [speakingText, getProgress]);

  const last = [...captions].reverse().find((c) => c.speaker === "assistant");
  const text = speakingText
    ? speakingText.split(/\s+/).filter(Boolean).slice(0, shown).join(" ")
    : (last?.text ?? "Connecting…");

  return (
    // Fixed minimum height prevents layout shifting when text wraps
    <section className="flex w-full max-w-3xl flex-col items-center justify-end min-h-[180px] text-center" aria-live="polite">
      
      <div className="flex w-full flex-1 flex-col justify-center">
        <p className="text-xl font-medium leading-relaxed tracking-tight sm:text-3xl transition-all duration-300">
          {text}
        </p>
      </div>

      {/* Reserved fixed-height container for the user transcript so it doesn't push UI up when it appears */}
      <div className="mt-4 flex h-[60px] w-full items-center justify-center">
        {currentTranscript.trim() && (
          <p className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-line bg-white/70 px-4 py-2 text-sm leading-6 text-mute shadow-sm backdrop-blur-sm">
            <span className="mr-2 text-[10px] font-semibold tracking-widest text-violet">YOU</span>
            {currentTranscript}
          </p>
        )}
      </div>

    </section>
  );
}