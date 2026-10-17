
import { ArrowUpRight, ShieldCheck } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="mx-auto flex min-h-[76px] w-full max-w-6xl items-center justify-between gap-4 border-b border-white/[0.08] px-5 sm:px-8">
      <a
        href="/"
        className="flex items-center gap-3"
        aria-label="Golden Minutes home"
      >
        <span className="grid size-10 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/[0.08] text-teal-200">
          <ShieldCheck size={21} strokeWidth={1.8} />
        </span>

        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-tight text-white sm:text-base">
            Golden Minutes
          </span>
          <span className="text-[10px] font-semibold tracking-[0.24em] text-white/45">
            BY GNANI
          </span>
        </span>
      </a>

      <a
        href="https://cybercrime.gov.in/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-right text-xs text-white/60 transition-colors hover:text-teal-200 sm:text-sm"
      >
        Official reporting portal
        <ArrowUpRight size={15} />
      </a>
    </header>
  );
}
