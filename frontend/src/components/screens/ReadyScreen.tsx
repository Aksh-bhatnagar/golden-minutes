
import { ArrowRight, Mic, ShieldCheck } from "lucide-react";
import type { Language } from "../../types/report";

interface ReadyScreenProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onStart: () => void;
  isLoading?: boolean;
}

export default function ReadyScreen({
  language,
  onLanguageChange,
  onStart,
  isLoading = false,
}: ReadyScreenProps) {
  return (
    <section className="screen">
      <p className="eyebrow">YOUR FIRST STEP TOWARD CLARITY</p>

      <h1>
        Let's understand
        <br />
        <span>what happened.</span>
      </h1>

      <p className="muted">
        A guided conversation to organize the details of a suspected cyber-fraud
        incident. You can speak naturally in your preferred language.
      </p>

      <div className="panel">
        <label htmlFor="language">Conversation language</label>
        <select
          id="language"
          value={language}
          onChange={(event) =>
            onLanguageChange(event.target.value as Language)
          }
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="hinglish">Hinglish</option>
        </select>

        <div className="privacy-note">
          <ShieldCheck size={18} />
          <span>
            Never share an OTP, PIN, password, or full card details.
          </span>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={onStart}
          disabled={isLoading}
        >
          <Mic size={18} />
          {isLoading ? "Preparing..." : "Start conversation"}
          {!isLoading && <ArrowRight size={18} />}
        </button>
      </div>

      <p className="muted">
        This assistant helps organize information. It does not file an official
        complaint or guarantee recovery of funds.
      </p>
    </section>
  );
}
