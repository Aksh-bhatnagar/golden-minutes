
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import type { FraudReport, YesNoUnknown } from "@/types/report";

interface Props {
  report: FraudReport;
  busy?: boolean;
  error?: string | null;
  onBack: () => void;
  onSaveChanges: (r: FraudReport) => Promise<void> | void;
  onConfirm: (r: FraudReport) => Promise<void> | void;
}

const FIELDS: [keyof FraudReport, string, string?][] = [
  ["fraud_type", "What happened"],
  ["bank_or_payment_app", "Bank or payment app"],
  ["amount_inr", "Amount lost (₹)", "number"],
  ["transaction_reference", "Transaction ID"],
  ["incident_date", "Date"],
  ["incident_time", "Time"],
  ["registered_phone_last4", "Registered phone, last 4 digits", "tel"],
];

const CHOICES: [keyof FraudReport, string][] = [
  ["otp_or_pin_shared", "Did you share an OTP or PIN?"],
  ["contacted_bank", "Have you contacted your bank or payment app?"],
];

export default function ReportReview({
  report,
  busy = false,
  error = null,
  onBack,
  onSaveChanges,
  onConfirm,
}: Props) {
  const [d, setD] = useState(report);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setD(report);
  }, [report]);

  const set = (k: keyof FraudReport, v: unknown) => {
    setD((p) => ({ ...p, [k]: v }));
    setErr(null);
  };

  const missing = FIELDS.filter(
    ([k]) => d[k] === null || d[k] === "",
  ).map((f) => f[1]);

  async function run(
    fn: (r: FraudReport) => Promise<void> | void,
  ) {
    if (
      d.amount_inr !== null &&
      (!Number.isFinite(d.amount_inr) || d.amount_inr < 0)
    ) {
      setErr("Enter a valid amount.");
      return;
    }

    if (
      d.registered_phone_last4 &&
      !/^\d{4}$/.test(d.registered_phone_last4)
    ) {
      setErr("Phone needs exactly 4 digits.");
      return;
    }

    setErr(null);

    try {
      await fn(d);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Something went wrong.",
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-12 pt-2">
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="btn-light !min-h-10 mb-6 !px-4"
      >
        <ArrowLeft size={16} />
        Back to conversation
      </button>

      <h1 className="text-3xl font-medium tracking-tight">
        Review your <span className="grad-text">report</span>
      </h1>

      <p className="mt-2 text-sm text-mute">
        Correct anything that is wrong, then confirm.
      </p>

      {missing.length > 0 && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Still empty: {missing.join(", ")}
        </p>
      )}

      <form
        className="card mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run(onConfirm);
        }}
      >
        {FIELDS.map(([k, label, type]) => (
          <label key={k} className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {label}
            </span>

            <input
              className="input"
              type={type ?? "text"}
              min={type === "number" ? 0 : undefined}
              placeholder="Not provided"
              value={String(d[k] ?? "")}
              onChange={(e) => {
                const v = e.target.value;

                if (k === "amount_inr") {
                  set(k, v === "" ? null : Number(v));
                } else if (k === "registered_phone_last4") {
                  set(
                    k,
                    v.replace(/\D/g, "").slice(0, 4) || null,
                  );
                } else {
                  set(k, v || null);
                }
              }}
            />
          </label>
        ))}

        {CHOICES.map(([k, label]) => (
          <fieldset key={k}>
            <legend className="mb-1.5 text-sm font-medium">
              {label}
            </legend>

            <div className="grid grid-cols-3 gap-2">
              {(["yes", "no", "unknown"] as YesNoUnknown[]).map(
                (o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={d[k] === o}
                    onClick={() => set(k, o)}
                    className={`rounded-xl border px-3 py-2.5 text-sm capitalize transition ${
                      d[k] === o
                        ? "border-violet bg-violet/10 text-violet"
                        : "border-line bg-white text-mute hover:bg-paper"
                    }`}
                  >
                    {o === "unknown" ? "Not sure" : o}
                  </button>
                ),
              )}
            </div>
          </fieldset>
        ))}

        {(err || error) && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {err || error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onSaveChanges)}
            className="btn-light"
          >
            {busy ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <Save size={17} />
            )}
            Save corrections
          </button>

          <button
            type="submit"
            disabled={busy}
            className="btn-dark"
          >
            {busy ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <CheckCircle2 size={17} />
            )}
            Confirm details
          </button>
        </div>
      </form>
    </main>
  );
}
