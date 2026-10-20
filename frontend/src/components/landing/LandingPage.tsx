import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import VoiceOrb from "@/components/voice/VoiceOrb";
import { LANGUAGES } from "@/lib/languages";
import type { SupportedLanguage } from "@/types/conversation";

export default function LandingPage({
  onStartCall,
  onOpenHandler,
}: {
  onStartCall: (language: SupportedLanguage) => void;
  onOpenHandler: () => void;
}) {
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  return (
    <main className="mx-auto flex min-h-[calc(100svh-80px)] max-w-3xl flex-col items-center justify-center px-6 pb-16 text-center">
      <VoiceOrb state="idle" size={280} />
      <span className="mt-1 rounded-full border border-line bg-white/80 px-3 py-1 text-xs font-medium">
        <span className="grad-text">&lt;ready to listen&gt;</span>
      </span>

      <h1 className="mt-8 text-4xl font-medium leading-tight tracking-tight sm:text-6xl">
        When money goes missing,
        <br />
        <span className="grad-text">start by talking.</span>
      </h1>

      <p className="mt-5 max-w-lg text-base leading-7 text-mute">
        Golden Minutes takes your report the way a helpline operator would. Just talk,
        and your details go straight to the case handler.
      </p>

      <button onClick={() => setPicking(true)} className="btn-dark mt-9">
        Talk to Golden Minutes <ArrowRight size={17} />
      </button>

      <p className="mt-14 max-w-md text-xs leading-5 text-mute/80">
        Golden Minutes is an AI prototype. It is not the police, a bank, or the official
        helpline, and it does not file complaints.
      </p>
      <button onClick={onOpenHandler} className="mt-3 text-xs text-mute underline underline-offset-4 hover:text-ink">
        Handler console (demo)
      </button>

      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
          onClick={() => setPicking(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose your language"
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-lg !bg-white text-left"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-medium tracking-tight">
                  Choose your <span className="grad-text">language</span>
                </h2>
                <p className="mt-1 text-sm text-mute">
                  अपनी भाषा चुनें · The call starts when you choose.
                </p>
              </div>
              <button onClick={() => setPicking(false)} aria-label="Close" className="rounded-full p-1.5 text-mute hover:bg-paper">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => onStartCall(l.code)}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-left transition hover:border-violet hover:bg-paper"
                >
                  <span className="block text-base font-medium">{l.native}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-mute">
                    {l.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        l.live ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {l.live ? "Live" : "Beta"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}