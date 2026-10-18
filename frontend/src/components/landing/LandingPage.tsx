import { ArrowRight } from "lucide-react";
import VoiceOrb from "@/components/voice/VoiceOrb";

export default function LandingPage({ onStartCall }: { onStartCall: () => void }) {
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
        A calm voice assistant helps you get your details ready for the 1930 helpline.
        Speak in your own words, one step at a time.
      </p>

      <button onClick={onStartCall} className="btn-dark mt-9">
        Talk to Golden Minutes <ArrowRight size={17} />
      </button>
      <p className="mt-4 text-xs text-mute">English · हिन्दी · Hinglish</p>

      <p className="mt-14 max-w-md text-xs leading-5 text-mute/80">
        Golden Minutes is an AI prototype. It is not the police, a bank, or the official helpline,
        and it does not file complaints.
      </p>
    </main>
  );
}