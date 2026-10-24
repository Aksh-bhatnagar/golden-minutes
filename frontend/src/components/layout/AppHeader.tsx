import { ArrowUpRight } from "lucide-react";
import LogoMark from "./LogoMark"; // Make sure this path matches where you saved the LogoMark component

export default function AppHeader() {
  return (
    <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
      <a href="/" className="flex items-center gap-2.5">
        
        {/* Commented out the static image as requested
        <img 
          src="/logo.png" 
          alt="Golden Minutes Logo" 
          className="w-9 h-9 object-cover shrink-0 drop-shadow-sm rounded-full" 
        />
        */}
        
        {/* Using the new flat SVG LogoMark instead */}
        <LogoMark size={36} />
        
        <span className="text-base font-semibold tracking-tight">Golden Minutes</span>
        <span className="rounded-full border border-line bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-mute">
          VOICE BY GNANI.AI
        </span>
      </a>
      <a 
        href="https://cybercrime.gov.in/" 
        target="_blank" 
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-mute transition hover:text-ink"
      >
        Official portal <ArrowUpRight size={15} />
      </a>
    </header>
  );
}