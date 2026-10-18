import { ArrowLeft, LoaderCircle } from "lucide-react";

export default function ReportConsent({ busy = false, error = null, onBack, onConsent }: {
  busy?: boolean;
  error?: string | null;
  onBack: () => void;
  onConsent: (consent: boolean) => Promise<unknown> | unknown;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-12 pt-2">
      <button onClick={onBack} disabled={busy} className="btn-light !min-h-10 mb-6 !px-4">
        <ArrowLeft size={16} /> Back to review
      </button>

      <div className="card">
        <p className="text-xs font-semibold tracking-widest text-violet">FINAL STEP</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">May I save this summary?</h1>
        <p className="mt-3 text-sm leading-6 text-mute">
          Saving creates a PDF and a reference for authorised staff. It is not a police
          complaint. If you say no, nothing is saved.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 grid gap-3">
          <button disabled={busy} onClick={() => void onConsent(true)} className="btn-dark">
            {busy && <LoaderCircle size={17} className="animate-spin" />} Yes, save my report
          </button>
          <button disabled={busy} onClick={() => void onConsent(false)} className="btn-light">
            No, don't save
          </button>
        </div>
      </div>
    </main>
  );
}