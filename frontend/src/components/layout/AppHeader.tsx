import { ArrowUpRight } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
      <a href="/" className="flex items-center gap-2.5">
        <span className="size-7 rounded-full" style={{ background: "linear-gradient(135deg,#f58a63,#7c5cf0)" }} />
        <span className="text-base font-semibold tracking-tight">Golden Minutes</span>
        <span className="rounded-full border border-line bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-mute">
          BY GNANI
        </span>
      </a>
      <a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer"
         className="inline-flex items-center gap-1 text-sm text-mute transition hover:text-ink">
        Official portal <ArrowUpRight size={15} />
      </a>
    </header>
  );
}