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
      // Reveal slightly ahead of the audio so the text never lags the voice.
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
    <section className="w-full max-w-3xl text-center" aria-live="polite">
      <p className="min-h-[3.5rem] text-xl font-medium leading-relaxed tracking-tight sm:text-3xl">
        {text}
      </p>
      {currentTranscript.trim() && (
        <p className="mt-5 rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm leading-6 text-mute">
          <span className="mr-2 text-[10px] font-semibold tracking-widest text-violet">YOU</span>
          {currentTranscript}
        </p>
      )}
    </section>
  );
}