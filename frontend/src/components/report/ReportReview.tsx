
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { FraudReport, YesNoUnknown } from "@/types/report";

interface ReportReviewProps {
  report: FraudReport;
  busy?: boolean;
  error?: string | null;
  onBack: () => void;
  onSaveChanges: (report: FraudReport) => Promise<void> | void;
  onConfirm: (report: FraudReport) => Promise<void> | void;
}

interface ReportFieldProps {
  label: string;
  value: string | number | null;
  placeholder?: string;
  type?: "text" | "number" | "date" | "time" | "tel";
  onChange: (value: string) => void;
}

function ReportField({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: ReportFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-300">
        {label}
      </span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder ?? "Not provided"}
        min={type === "number" ? 0 : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/10"
      />
    </label>
  );
}

interface ChoiceFieldProps {
  label: string;
  value: YesNoUnknown;
  onChange: (value: YesNoUnknown) => void;
}

function ChoiceField({ label, value, onChange }: ChoiceFieldProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-slate-300">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {(["yes", "no", "unknown"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`rounded-xl border px-3 py-2.5 text-sm capitalize transition ${
              value === option
                ? "border-teal-400/60 bg-teal-400/10 text-teal-200"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {option === "unknown" ? "Not sure" : option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function ReportReview({
  report,
  busy = false,
  error = null,
  onBack,
  onSaveChanges,
  onConfirm,
}: ReportReviewProps) {
  const [draft, setDraft] = useState<FraudReport>(report);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(report);
  }, [report]);

  function updateField<K extends keyof FraudReport>(
    field: K,
    value: FraudReport[K],
  ) {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
    setLocalError(null);
  }

  function validate(): string | null {
    if (
      draft.amount_inr !== null &&
      (!Number.isFinite(draft.amount_inr) || draft.amount_inr < 0)
    ) {
      return "Enter a valid, non-negative amount.";
    }

    if (
      draft.registered_phone_last4 &&
      !/^\d{4}$/.test(draft.registered_phone_last4)
    ) {
      return "Enter exactly the last four digits of the registered phone number.";
    }

    return null;
  }

  async function handleSaveChanges() {
    const validationError = validate();

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      setLocalError(null);
      await onSaveChanges(draft);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your corrections.",
      );
    }
  }

  async function handleConfirm() {
    const validationError = validate();

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      setLocalError(null);
      await onConfirm(draft);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "Unable to confirm the report.",
      );
    }
  }

  const missingCount = draft.missing_fields.length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="mb-6 inline-flex items-center gap-2 rounded-lg py-2 text-sm text-slate-400 transition hover:text-white disabled:opacity-50"
      >
        <ArrowLeft size={17} />
        Back to conversation
      </button>

      <div className="mb-6 flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
          <FileText size={23} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
            Golden Minutes
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Review your report
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Check the information collected during your conversation.
            Correct anything that is inaccurate before confirming.
          </p>
        </div>
      </div>

      {missingCount > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
          <p className="text-sm font-medium text-amber-200">
            Some details may still be missing
          </p>
          <p className="mt-1 text-sm leading-5 text-amber-100/70">
            {draft.missing_fields.join(", ")}
          </p>
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleConfirm();
        }}
      >
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
          <h2 className="mb-5 text-base font-semibold text-white">
            Incident details
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ReportField
                label="Type of fraud"
                value={draft.fraud_type}
                placeholder="Describe the type of fraud"
                onChange={(value) =>
                  updateField("fraud_type", value || null)
                }
              />
            </div>

            <ReportField
              label="Bank or payment app"
              value={draft.bank_or_payment_app}
              placeholder="Bank, UPI app, or payment service"
              onChange={(value) =>
                updateField("bank_or_payment_app", value || null)
              }
            />

            <ReportField
              label="Amount lost (₹)"
              value={draft.amount_inr}
              type="number"
              placeholder="Amount in rupees"
              onChange={(value) =>
                updateField(
                  "amount_inr",
                  value === "" ? null : Number(value),
                )
              }
            />

            <ReportField
              label="Transaction reference"
              value={draft.transaction_reference}
              placeholder="Transaction ID or reference"
              onChange={(value) =>
                updateField("transaction_reference", value || null)
              }
            />

            <ReportField
              label="Incident date"
              value={draft.incident_date}
              type="date"
              onChange={(value) =>
                updateField("incident_date", value || null)
              }
            />

            <ReportField
              label="Incident time"
              value={draft.incident_time}
              type="time"
              onChange={(value) =>
                updateField("incident_time", value || null)
              }
            />

            <ReportField
              label="Registered phone — last four digits only"
              value={draft.registered_phone_last4}
              type="tel"
              placeholder="1234"
              onChange={(value) =>
                updateField(
                  "registered_phone_last4",
                  value.replace(/\D/g, "").slice(0, 4) || null,
                )
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
          <h2 className="mb-5 text-base font-semibold text-white">
            Follow-up information
          </h2>

          <div className="space-y-6">
            <ChoiceField
              label="Did you share an OTP or PIN?"
              value={draft.otp_or_pin_shared}
              onChange={(value) =>
                updateField("otp_or_pin_shared", value)
              }
            />

            <ChoiceField
              label="Have you contacted your bank or payment provider?"
              value={draft.contacted_bank}
              onChange={(value) =>
                updateField("contacted_bank", value)
              }
            />
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-teal-300"
          />
          <p className="text-xs leading-5 text-slate-400">
            Never enter an OTP, PIN, password, or full payment
            credential here. This is an intake summary, not an
            officially filed police complaint, and recovery is not
            guaranteed.
          </p>
        </div>

        {(localError || error) && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200"
          >
            {localError || error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleSaveChanges()}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            Save corrections
          </button>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle size={17} className="animate-spin" />
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
