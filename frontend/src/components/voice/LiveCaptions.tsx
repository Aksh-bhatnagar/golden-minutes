import type { Caption } from "@/types/conversation";

export default function LiveCaptions({ captions, currentTranscript }: {
  captions: Caption[];
  currentTranscript: string;
}) {
  const last = [...captions].reverse().find((c) => c.speaker === "assistant");

  return (
    <section className="w-full max-w-xl text-center" aria-live="polite">
      <p className="text-xl font-medium leading-relaxed tracking-tight sm:text-2xl">
        {last?.text ?? "Connecting…"}
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