
import { CheckCircle2, CircleHelp, CircleX } from "lucide-react";
import type { ReportField } from "../../types/report";

interface ReportFieldCardProps {
  field: ReportField;
}

const statusLabels = {
  confirmed: "Confirmed",
  unclear: "Needs review",
  missing: "Missing",
};

export default function ReportFieldCard({ field }: ReportFieldCardProps) {
  const StatusIcon =
    field.status === "confirmed"
      ? CheckCircle2
      : field.status === "unclear"
        ? CircleHelp
        : CircleX;

  return (
    <article className="field-card">
      <div>
        <p className="field-label">{field.label}</p>
        <p className="field-value">{field.value || "Not provided"}</p>
      </div>

      <span className={`field-status ${field.status}`}>
        <StatusIcon size={15} />
        {statusLabels[field.status]}
      </span>
    </article>
  );
}
