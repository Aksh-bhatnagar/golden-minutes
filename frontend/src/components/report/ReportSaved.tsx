import { useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";

export default function ReportSaved({ reference, message, onFinish }: {
  reference: string;
  message?: string | null;
  onFinish: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-12 pt-6">
      <div className="card text-center">
        <CheckCircle2 size={34} className="mx-auto text-violet" />
        <h1 className="mt-4 text-2xl font-medium tracking-tight">Report saved</h1>

        <p className="mt-6 break-all font-mono text-2xl font-semibold">{reference}</p>
        <button className="btn-light !min-h-10 mt-3 !px-4 cursor-pointer"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(reference); setCopied(true); } catch { /* ignore */ }
                }}>
          <Copy size={15} /> {copied ? "Copied" : "Copy reference"}
        </button>

        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm leading-6 text-amber-900">
          This is not an official complaint number. Please call <b>1930</b> now and read your
          details out, or report on cybercrime.gov.in. Keep your messages and screenshots.
        </p>
        {message && <p className="mt-3 text-xs text-mute">{message}</p>}

        <button onClick={onFinish} className="btn-dark mt-6 w-full cursor-pointer">Return to home</button>
      </div>
    </main>
  );
}