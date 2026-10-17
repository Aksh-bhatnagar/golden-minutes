
import { Check, Clipboard, RotateCcw } from "lucide-react";

interface ReviewActionsProps {
  onConfirm: () => void;
  onCopy: () => void;
  onRestart: () => void;
  isLoading?: boolean;
  canConfirm?: boolean;
}

export default function ReviewActions({
  onConfirm,
  onCopy,
  onRestart,
  isLoading = false,
  canConfirm = true,
}: ReviewActionsProps) {
  return (
    <div className="review-actions">
      <button
        type="button"
        className="primary-button"
        onClick={onConfirm}
        disabled={isLoading || !canConfirm}
      >
        <Check size={17} />
        {isLoading ? "Please wait..." : "Confirm details"}
      </button>

      <button
        type="button"
        className="back-button"
        onClick={onCopy}
        disabled={isLoading}
      >
        <Clipboard size={17} />
        Copy summary
      </button>

      <button
        type="button"
        className="back-button"
        onClick={onRestart}
        disabled={isLoading}
      >
        <RotateCcw size={17} />
        Start over
      </button>
    </div>
  );
}
