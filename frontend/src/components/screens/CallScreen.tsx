
import { ArrowLeft } from "lucide-react";
import type { Language } from "../../types/report";
import VoiceOrb from "../voice/VoiceOrb";
import VoiceControls from "../voice/VoiceControls";

interface CallScreenProps {
  language: Language;
  status: string;
  transcript: string;
  assistantMessage: string;
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopSpeaking: () => void;
  onRepeat: () => void;
  onBack: () => void;
}

const languageLabels: Record<Language, string> = {
  en: "English",
  hi: "हिन्दी",
  hinglish: "Hinglish",
};

export default function CallScreen({
  language,
  status,
  transcript,
  assistantMessage,
  isRecording,
  isTranscribing,
  isSpeaking,
  onStartRecording,
  onStopRecording,
  onStopSpeaking,
  onRepeat,
  onBack,
}: CallScreenProps) {
  return (
    <section className="screen call-screen">
      <button type="button" className="back-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Exit conversation
      </button>

      <p className="eyebrow">GOLDEN MINUTES · {languageLabels[language]}</p>

      <VoiceOrb
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        isSpeaking={isSpeaking}
      />

      <p className="status-line">{status}</p>

      <div className="transcript-panel">
        <p className="eyebrow">ASSISTANT</p>
        <p>{assistantMessage || "Preparing your conversation..."}</p>

        {transcript && (
          <>
            <p className="eyebrow">YOU SAID</p>
            <p>{transcript}</p>
          </>
        )}
      </div>

      <VoiceControls
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        isSpeaking={isSpeaking}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onStopSpeaking={onStopSpeaking}
        onRepeat={onRepeat}
      />

      <p className="muted">
        Never share an OTP, PIN, password, or other payment secret.
      </p>
    </section>
  );
}
