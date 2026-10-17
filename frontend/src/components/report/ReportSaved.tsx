
import {
  CheckCircle2,
  Copy,
  FileCheck2,
  Headset,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

interface ReportSavedProps {
  reference: string;
  message?: string | null;
  onFinish: () => void;
}

export default function ReportSaved({
  reference,
  message,
  onFinish,
}: ReportSavedProps) {
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-12 pt-10 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-center sm:p-9">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full border border-teal-300/20 bg-teal-300/10 text-teal-200">
          <CheckCircle2 size={34} />
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
          Golden Minutes
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Report saved
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Your report has been saved. Keep the reference number
          somewhere safe in case you need to retrieve it later.
        </p>

        <div className="mt-8 rounded-2xl border border-teal-300/20 bg-teal-300/[0.06] p-5 text-left">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-200">
            <FileCheck2 size={18} />
            Your reference number
          </div>

          <p className="break-all font-mono text-2xl font-semibold tracking-wide text-white sm:text-3xl">
            {reference}
          </p>

          <button
            type="button"
            onClick={() => void copyReference()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            {copied ? (
              <CheckCircle2 size={16} />
            ) : (
              <Copy size={16} />
            )}
            {copied ? "Copied" : "Copy reference"}
          </button>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-left">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-amber-200"
          />
          <div>
            <p className="text-sm font-medium text-amber-100">
              This is not an official complaint number
            </p>
            <p className="mt-1 text-sm leading-5 text-amber-100/70">
              Your report has been saved by Golden Minutes. To report
              cybercrime officially in India, visit cybercrime.gov.in
              or call 1930 when appropriate.
            </p>
          </div>
        </div>

        {message && (
          <p className="mt-4 text-left text-xs leading-5 text-slate-500">
            {message}
          </p>
        )}

        <div className="mt-7 grid gap-3">
          <button
            type="button"
            onClick={onFinish}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200"
          >
            <RotateCcw size={17} />
            Return to home
          </button>

          <a
            href="https://cybercrime.gov.in/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            <Headset size={17} />
            Visit official cybercrime portal
          </a>
        </div>
      </div>
    </main>
  );
}
