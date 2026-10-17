
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  ShieldCheck,
} from "lucide-react";

interface LandingPageProps {
  onStartCall: () => void;
}

export default function LandingPage({ onStartCall }: LandingPageProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <section className="grid min-h-[calc(100svh-180px)] items-center gap-8 py-12 md:grid-cols-2 md:gap-12 md:py-16">
        <div className="relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/15 bg-teal-200/[0.05] px-3 py-2 text-[10px] font-semibold tracking-[0.16em] text-teal-200 sm:text-xs">
            <span className="size-1.5 rounded-full bg-teal-300" />
            YOUR FIRST STEP TOWARD CLARITY
          </div>

          <h1 className="mx-auto mt-7 max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.065em] text-white sm:text-6xl md:mx-0 md:text-7xl">
            When fraud happens,
            <span className="mt-1 block text-teal-200">
              start here.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-white/60 sm:text-base sm:leading-8 md:mx-0">
            Talk through what happened with a guided voice assistant.
            Organize the important details at your own pace, one step at a
            time.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 md:items-start">
            <button
              type="button"
              onClick={onStartCall}
              className="inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-teal-200 px-6 py-3.5 text-sm font-semibold text-[#09211c] shadow-[0_0_40px_rgba(94,234,212,0.08)] transition hover:bg-teal-100 active:scale-[0.98]"
            >
              <AudioLines size={19} />
              Talk to Golden Minutes
              <ArrowRight size={17} />
            </button>

            <p className="text-xs leading-6 text-white/40">
              English · हिंदी · Hinglish
            </p>
          </div>
        </div>

        <div
          className="relative mx-auto flex aspect-square w-full max-w-[430px] items-center justify-center"
          aria-hidden="true"
        >
          <div className="absolute inset-[5%] rounded-full border border-teal-200/[0.08]" />
          <div className="absolute inset-[15%] rounded-full border border-teal-200/[0.12]" />
          <div className="absolute inset-[25%] rounded-full border border-teal-200/[0.08]" />

          <div className="absolute size-[65%] rounded-full bg-teal-400/10 blur-[65px]" />

          <div className="relative flex size-[51%] items-center justify-center overflow-hidden rounded-full border border-teal-100/40 bg-[radial-gradient(circle_at_32%_24%,#b8fff0_0%,#67e8cf_12%,#25b99b_34%,#12665d_63%,#081c1a_100%)] shadow-[inset_-20px_-25px_45px_rgba(0,0,0,0.45),0_0_70px_rgba(45,212,191,0.13)] motion-safe:animate-[pulse_5s_ease-in-out_infinite]">
            <div className="absolute left-[18%] top-[17%] h-[14%] w-[29%] rotate-[-35deg] rounded-full bg-white/30 blur-md" />
            <div className="size-[37%] rounded-full border border-teal-100/20 bg-teal-100/10 shadow-[0_0_35px_rgba(153,246,228,0.16)]" />
          </div>

          <div className="absolute bottom-[4%] inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b1716]/90 px-4 py-2.5 text-[10px] font-semibold tracking-[0.18em] text-teal-100/80">
            <span className="size-1.5 rounded-full bg-teal-300 shadow-[0_0_10px_rgba(94,234,212,0.8)]" />
            READY TO LISTEN
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 border-y border-white/[0.08] py-6 sm:flex-row sm:items-center sm:gap-12">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.025] text-teal-200">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-white/90">
              Guided, not judged
            </p>
            <p className="mt-1 text-xs text-white/50">
              Explain things in your own words.
            </p>
          </div>
        </div>

        <div className="hidden h-9 w-px bg-white/10 sm:block" />

        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.025] text-teal-200">
            <AudioLines size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-white/90">
              Speak naturally
            </p>
            <p className="mt-1 text-xs text-white/50">
              Start with a conversation, not a form.
            </p>
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-3 py-6 text-xs leading-6 text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">
          Golden Minutes helps organize information. It is not a police
          service and does not itself file an official complaint.
        </p>

        <a
          href="https://cybercrime.gov.in/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-white/60 transition hover:text-teal-200"
        >
          Official cybercrime reporting
          <ArrowUpRight size={14} />
        </a>
      </footer>
    </main>
  );
}
