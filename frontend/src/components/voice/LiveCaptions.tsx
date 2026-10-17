
import type { Caption } from "@/types/conversation";

interface LiveCaptionsProps {
  captions: Caption[];
  currentTranscript: string;
}

export default function LiveCaptions({
  captions,
  currentTranscript,
}: LiveCaptionsProps) {
  const latestAssistantCaption = [...captions]
    .reverse()
    .find((caption) => caption.speaker === "assistant");

  return (
    <section
      className="w-full max-w-xl text-center"
      aria-label="Live conversation captions"
      aria-live="polite"
    >
      {latestAssistantCaption ? (
        <p className="text-xl font-medium leading-relaxed tracking-tight text-white sm:text-2xl">
          {latestAssistantCaption.text}
        </p>
      ) : (
        <p className="text-xl font-medium tracking-tight text-white/80 sm:text-2xl">
          How can I help you today?
        </p>
      )}

      {currentTranscript.trim() && (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold tracking-[0.15em] text-teal-200/70">
            YOU
          </p>
          <p className="text-sm leading-6 text-white/65">
            {currentTranscript}
          </p>
        </div>
      )}
    </section>
  );
}
