import { useEffect, useMemo, useState } from "react";
import { LANGUAGES } from "@/lib/languages";

// Question + answer pairs, one per language code. Only codes that exist in
// LANGUAGES are shown, so the page never advertises a language the call can't
// handle. Have a native speaker check the non-English lines before recording.
const PHRASES: { code: string; top: string; bottom: string }[] = [
  { code: "en", top: "Suspect cyber fraud?", bottom: "Start with your story." },
  { code: "hi", top: "साइबर ठगी का शक है?", bottom: "अपनी कहानी से शुरुआत करें।" },
  { code: "hinglish", top: "Cyber fraud ka shak hai?", bottom: "Apni kahani se shuru karein." },
  { code: "ta", top: "சைபர் மோசடி என்று சந்தேகமா?", bottom: "உங்கள் கதையிலிருந்து தொடங்குங்கள்." },
  { code: "te", top: "సైబర్ మోసం అనుమానమా?", bottom: "మీ కథతో మొదలుపెట్టండి." },
  { code: "bn", top: "সাইবার প্রতারণার সন্দেহ?", bottom: "আপনার গল্প দিয়ে শুরু করুন।" },
  { code: "mr", top: "सायबर फसवणुकीचा संशय आहे?", bottom: "तुमच्या गोष्टीने सुरुवात करा." },
];

const FONT =
  "'Noto Sans Devanagari','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Bengali',system-ui,sans-serif";

type Segmenter = new (
  locale?: string,
  options?: { granularity: "grapheme" },
) => { segment(input: string): Iterable<{ segment: string }> };

// Split by grapheme so Indic conjuncts are never cut mid-glyph.
function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: Segmenter }).Segmenter;
  return Seg
    ? Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment)
    : Array.from(text);
}

export default function TypewriterHeadline() {
  const phrases = useMemo(() => {
    const live = new Set<string>(LANGUAGES.map((l) => l.code));
    const picked = PHRASES.filter((p) => live.has(p.code));
    return (picked.length >= 2 ? picked : PHRASES.slice(0, 3)).map((p) => ({
      top: graphemes(p.top),
      bottom: graphemes(p.bottom),
    }));
  }, []);

  const reduced = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );

  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(0); // characters shown across both lines
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const { top, bottom } = phrases[index];
    const total = top.length + bottom.length;
    let wait: number;

    if (!deleting) wait = pos < total ? (pos === top.length ? 400 : 70) : 1900;
    else wait = pos > 0 ? 22 : 300;

    const id = window.setTimeout(() => {
      if (!deleting) {
        if (pos < total) setPos(pos + 1);
        else setDeleting(true);
      } else if (pos > 0) {
        setPos(pos - 1);
      } else {
        setDeleting(false);
        setIndex((index + 1) % phrases.length);
      }
    }, wait);

    return () => window.clearTimeout(id);
  }, [pos, deleting, index, phrases, reduced]);

  const cur = phrases[index];
  const p = reduced ? cur.top.length + cur.bottom.length : pos;
  const line1 = cur.top.slice(0, Math.min(p, cur.top.length)).join("");
  const line2 = cur.bottom.slice(0, Math.max(0, p - cur.top.length)).join("");
  const onSecond = p > cur.top.length;

  const cursor = !reduced && (
    <span className="ml-1 inline-block h-[0.8em] w-[3px] translate-y-[0.06em] animate-pulse rounded-full bg-violet" />
  );

 return (
    <>
      <span className="sr-only">Suspect cyber fraud? Start with your story.</span>
      <span aria-hidden="true" style={{ fontFamily: FONT }}>
        <span className="block min-h-[1.25em]">
          {line1}
          {!onSecond && cursor}
          {/* Zero-width space forces the browser to maintain exact text height even when empty */}
          &#8203;
        </span>
        <span className="block min-h-[1.25em]">
          <span className="grad-text">{line2}</span>
          {onSecond && cursor}
          &#8203;
        </span>
      </span>
    </>
  );
}