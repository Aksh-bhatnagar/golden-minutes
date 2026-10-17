
import { ShieldCheck } from "lucide-react";

interface SaveConsentProps {
  onConsent: (consent: boolean) => void;
  isLoading?: boolean;
}

export default function SaveConsent({
  onConsent,
  isLoading = false,
}: SaveConsentProps) {
  return (
    <div className="panel">
      <div className="privacy-note">
        <ShieldCheck size={20} />
        <div>
          <strong>Permission to save your report</strong>
          <p className="muted">
            Your report will be saved locally as a PDF after you give consent.
            This does not file an official complaint.
          </p>
        </div>
      </div>

      <div className="review-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => onConsent(true)}
          disabled={isLoading}
        >
          Yes, save my report
        </button>

        <button
          type="button"
          className="back-button"
          onClick={() => onConsent(false)}
          disabled={isLoading}
            >
            No, don't save
            </button>
        </div>
    </div>
  );
}
