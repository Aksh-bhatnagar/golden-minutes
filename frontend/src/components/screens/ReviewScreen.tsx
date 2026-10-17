
import { FileCheck2 } from "lucide-react";
import type { ReportField } from "../../types/report";
import ReportFieldCard from "../report/ReportFieldCard";
import ReviewActions from "../report/ReviewActions";
import SaveConsent from "../report/SaveConsent";

interface ReviewScreenProps {
  fields: ReportField[];
  isLoading: boolean;
  canConfirm: boolean;
  showConsent: boolean;
  reference?: string | null;
  message?: string;
  onConfirm: () => void;
  onCopy: () => void;
  onRestart: () => void;
  onConsent: (consent: boolean) => void;
}

export default function ReviewScreen({
  fields,
  isLoading,
  canConfirm,
  showConsent,
  reference,
  message,
  onConfirm,
  onCopy,
  onRestart,
  onConsent,
}: ReviewScreenProps) {
  const confirmedCount = fields.filter(
    (field) => field.status === "confirmed",
  ).length;

  const missingCount = fields.filter(
    (field) => field.status === "missing",
  ).length;

  return (
    <section className="screen">
      <p className="eyebrow">REPORT REVIEW</p>
      <h1>
        Review your
        <br />
        <span>incident details.</span>
      </h1>

      <p className="muted">
        Check the information carefully before confirming. Correct any
        inaccurate or missing details first.
      </p>

      {message && <div className="notice">{message}</div>}

      {reference && (
        <div className="panel">
          <FileCheck2 size={22} />
          <h2>Report saved</h2>
          <p>Your local report reference is:</p>
          <strong>{reference}</strong>
          <p className="muted">
            This is not an official complaint number.
          </p>
        </div>
      )}

      <div className="summary-counts">
        <div>
          <strong>{confirmedCount}</strong>
          <span>Confirmed</span>
        </div>
        <div>
          <strong>{missingCount}</strong>
          <span>Missing</span>
        </div>
      </div>

      <div className="field-list">
        {fields.map((field) => (
          <ReportFieldCard key={field.key} field={field} />
        ))}
      </div>

      {!reference && !showConsent && (
        <ReviewActions
          onConfirm={onConfirm}
          onCopy={onCopy}
          onRestart={onRestart}
          isLoading={isLoading}
          canConfirm={canConfirm}
        />
      )}

      {!reference && showConsent && (
        <SaveConsent onConsent={onConsent} isLoading={isLoading} />
      )}

      <p className="muted">
        Golden Minutes organizes information; it does not file an official
        complaint or guarantee recovery of funds.
      </p>
    </section>
  );
}
