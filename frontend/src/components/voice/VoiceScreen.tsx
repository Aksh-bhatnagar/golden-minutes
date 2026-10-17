
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Languages,
  AlertCircle,
  ClipboardCheck,
} from "lucide-react";

import VoiceOrb from "@/components/voice/VoiceOrb";
import LiveCaptions from "@/components/voice/LiveCaptions";
import VoiceControls from "@/components/voice/VoiceControls";
import ReportReview from "@/components/report/ReportReview";
import ReportConsent from "@/components/report/ReportConsent";
import ReportSaved from "@/components/report/ReportSaved";

import { useVoiceSession } from "@/hooks/useVoiceSession";
import { useReportWorkflow } from "@/hooks/useReportWorkflow";
import type { SupportedLanguage } from "@/types/conversation";
import type { FraudReport } from "@/types/report";

interface VoiceScreenProps {
  onEndCall: () => void;
}

type ScreenMode = "conversation" | "review" | "consent" | "saved";

const languageLabels: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  hinglish: "Hinglish",
};

const statusLabels = {
  idle: "Ready to begin",
  connecting: "Connecting to Gnani",
  listening: "Listening",
  thinking: "Preparing a response",
  speaking: "Golden Minutes is speaking",
  reconnecting: "Reconnecting",
  error: "Something went wrong",
  ended: "Conversation ended",
} as const;

export default function VoiceScreen({ onEndCall }: VoiceScreenProps) {
  const session = useVoiceSession();
  const workflow = useReportWorkflow();

  const [screen, setScreen] = useState<ScreenMode>("conversation");
  const [sessionStopped, setSessionStopped] = useState(false);

  const {
    start: startVoiceSession,
    stop: stopVoiceSession,
    updateReport,
    report: sessionReport,
    status,
    language,
    setLanguage,
    muted,
    setMuted,
    captions,
    currentTranscript,
    errorMessage: sessionError,
  } = session;

  const {
    stage,
    report: workflowReport,
    reference,
    message,
    error: workflowError,
    busy,
    beginReview,
    saveCorrections,
    confirmDetails,
    submitConsent,
    resetWorkflow,
  } = workflow;

  const startSession = useCallback(async () => {
    if (!sessionStopped) return;

    setSessionStopped(false);

    try {
      await startVoiceSession({ preserveReport: true });
    } catch {
      // Connection errors are displayed by the voice session.
    }
  }, [sessionStopped, startVoiceSession]);

  useEffect(() => {
    void startVoiceSession();

    return () => {
      stopVoiceSession();
    };
    // Start one voice session when this screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSession = useCallback(() => {
    stopVoiceSession();
    setSessionStopped(true);
  }, [stopVoiceSession]);

  const handleEndCall = useCallback(() => {
    stopSession();
    onEndCall();
  }, [onEndCall, stopSession]);

  const handleBeginReview = useCallback(async () => {
    stopSession();
    await beginReview(sessionReport);
    setScreen("review");
  }, [beginReview, sessionReport, stopSession]);

  const handleSaveCorrections = useCallback(
    async (updatedReport: FraudReport) => {
      await saveCorrections(updatedReport);
      updateReport(updatedReport);
    },
    [saveCorrections, updateReport],
  );

  const handleConfirmDetails = useCallback(
    async (updatedReport: FraudReport) => {
      await confirmDetails(updatedReport);
      updateReport(updatedReport);
      setScreen("consent");
    },
    [confirmDetails, updateReport],
  );

  const handleConsent = useCallback(
    async (consent: boolean) => {
      await submitConsent(consent);

      if (consent) {
        setScreen("saved");
        return;
      }

      resetWorkflow();
      setScreen("conversation");
      await startSession();
    },
    [submitConsent, resetWorkflow, startSession],
  );

  const handleReturnToConversation = useCallback(() => {
    updateReport(workflowReport);
    setScreen("conversation");
    void startSession();
  }, [workflowReport, updateReport, startSession]);

  if (screen === "review") {
    return (
      <ReportReview
        report={workflowReport}
        busy={busy}
        error={workflowError}
        onBack={handleReturnToConversation}
        onSaveChanges={handleSaveCorrections}
        onConfirm={handleConfirmDetails}
      />
    );
  }

  if (screen === "consent") {
    return (
      <ReportConsent
        busy={busy}
        error={workflowError}
        onBack={() => setScreen("review")}
        onConsent={handleConsent}
      />
    );
  }

  if (screen === "saved" && reference) {
    return (
      <ReportSaved
        reference={reference}
        message={message}
        onFinish={handleEndCall}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-77px)] w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleEndCall}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
          <Languages size={15} className="text-teal-200" />
          <span className="sr-only">Conversation language</span>
          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as SupportedLanguage)
            }
            className="max-w-28 bg-transparent text-sm text-white outline-none"
            aria-label="Conversation language"
            disabled={
              status === "connecting" ||
              status === "listening" ||
              status === "speaking" ||
              status === "thinking" ||
              status === "reconnecting"
            }
          >
            {Object.entries(languageLabels).map(([value, label]) => (
              <option
                key={value}
                value={value}
                className="bg-[#0b1917]"
              >
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <p className="mb-8 text-xs font-semibold tracking-[0.24em] text-teal-200/70">
          GOLDEN MINUTES · VOICE ASSISTANT
        </p>

        <VoiceOrb state={status} />

        <p className="mt-5 text-sm text-white/60" aria-live="polite">
          {statusLabels[status]}
        </p>

        {(sessionError || workflowError) && (
          <div
            role="alert"
            className="mt-5 flex max-w-lg items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.08] p-4 text-sm text-red-100"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{sessionError || workflowError}</p>
          </div>
        )}

        <div className="mt-8 w-full max-w-xl">
          <LiveCaptions
            captions={captions}
            currentTranscript={currentTranscript}
          />
        </div>

        <p className="mt-6 max-w-sm text-center text-xs leading-5 text-white/40">
          Share only the details needed to understand what happened.
          Never share your OTP, PIN, password, or full payment credentials.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md pb-4">
        <VoiceControls
          muted={muted}
          disabled={
            status === "connecting" ||
            status === "ended" ||
            status === "error"
          }
          onToggleMute={() => setMuted(!muted)}
          onEndCall={handleEndCall}
        />

        <button
          type="button"
          disabled={
            busy ||
            status === "connecting" ||
            status === "thinking" ||
            status === "ended" ||
            status === "error" ||
            stage === "saving"
          }
          onClick={() => void handleBeginReview()}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-teal-300/25 bg-teal-300/[0.07] px-4 py-3 text-sm font-medium text-teal-100 transition hover:bg-teal-300/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ClipboardCheck size={17} />
          Review report
        </button>

        <p className="mt-4 text-center text-xs text-white/35">
          This assistant helps prepare an incident report. It does not
          file an official police complaint.
        </p>
      </div>
    </main>
  );
}
