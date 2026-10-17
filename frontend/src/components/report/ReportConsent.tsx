
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

interface ReportConsentProps {
  busy?: boolean;
  error?: string | null;
  onBack: () => void;
  onConsent: (consent: boolean) => Promise<unknown> | unknown;
}

export default function ReportConsent({
  busy = false,
  error = null,
  onBack,
  onConsent,
}: ReportConsentProps) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-12 pt-8 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="mb-8 inline-flex items-center gap-2 rounded-lg py-2 text-sm text-slate-400 transition hover:text-white disabled:opacity-50"
      >
        <ArrowLeft size={17} />
        Back to review
      </button>

      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
          <ShieldCheck size={28} />
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
          Final step
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Do you consent to save this report?
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Please review what saving means before making your choice.
        </p>

        <div className="my-7 space-y-4">
          <div className="flex items-start gap-3">
            <FileText
              size={20}
              className="mt-0.5 shrink-0 text-teal-300"
            />
            <div>
              <p className="text-sm font-medium text-white">
                Your report will be saved
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Golden Minutes will save the report through its local
                report workflow and provide a reference number.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-teal-300"
            />
            <div>
              <p className="text-sm font-medium text-white">
                This is not an official complaint
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Saving this report does not submit a police or
                cybercrime complaint. Keep the reference for
                retrieving or correcting the report through the
                authorized workflow.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/10 p-4">
          <p className="text-sm leading-6 text-slate-300">
            Only proceed if you have reviewed the details and want
            this report saved. You should never provide an OTP, PIN,
            password, or full payment credential.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <div className="mt-7 grid gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConsent(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            I consent — save report
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void onConsent(false)}
            className="min-h-12 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            No, do not save
          </button>
        </div>
      </div>
    </main>
  );
}
