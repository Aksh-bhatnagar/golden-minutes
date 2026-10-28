import { useEffect, useState } from "react";
import { ArrowRight, Mic, X } from "lucide-react";
import VoiceOrb from "@/components/voice/VoiceOrb";
import TypewriterHeadline from "@/components/landing/TypewriterHeadline";
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
  const [orbSize] = useState(() => (window.innerWidth >= 1024 ? 340 : 260));

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  const names = LANGUAGES.slice(0, 3).map((l) => l.native).join(", ");
  const more = LANGUAGES.length > 3 ? " and more" : "";

  return (
    <main className="mx-auto flex min-h-[calc(100svh-80px)] w-full max-w-7xl flex-col items-center justify-center px-4 sm:px-12 pb- text-center">
      <VoiceOrb state="idle" size={orbSize} />
      <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1 text-xs font-medium text-mute">
        <span className="size-1.5 rounded-full bg-emerald-500" /> Ready to listen
      </span>

{/* Changed text-4xl to text-3xl so longer regional languages fit the screen width */}
{/* Added w-full, widened padding, and adjusted max text size to 54px */}
<h1 className="mt-8 w-full min-h-[3.2em] sm:min-h-[2.6em] flex flex-col justify-center px-2 text-[28px] sm:text-5xl lg:text-[54px] font-medium leading-tight tracking-tight">
  <TypewriterHeadline />
</h1>

      <p className="mt-5 max-w-xl text-base leading-7 text-mute">
        Tell Golden Minutes what happened, in your own language. It asks the right
        questions and prepares a clear summary for you.
      </p>

      <button onClick={() => setPicking(true)} className="btn-dark mt-9 cursor-pointer">
        <Mic size={17} /> Start a conversation <ArrowRight size={17} />
      </button>
      <p className="mt-4 text-xs text-mute">Available in {names}{more}</p>

      <p className="mt-10 text-xs text-mute">
        Urgent? Call <b className="text-[#e8684a]">1930</b> or visit{" "}
        <a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer"
           className="font-medium text-[#e8684a] underline underline-offset-4">
          cybercrime.gov.in
        </a>
      </p>
      <p className="mt-3 max-w-md text-xs leading-5 text-mute/80">
        Golden Minutes is an AI prototype. It is not the police, a bank, or the official
        helpline, and it does not file complaints.
      </p>
      <button onClick={onOpenHandler} className="mt-3 text-xs text-mute underline underline-offset-4 hover:text-ink cursor-pointer">
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
              <button onClick={() => setPicking(false)} aria-label="Close" className="rounded-full p-1.5 text-mute hover:bg-paper cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => onStartCall(l.code)}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-left transition hover:border-violet hover:bg-paper cursor-pointer"
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