import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ClipboardCheck } from "lucide-react";

import VoiceOrb from "@/components/voice/VoiceOrb";
import LiveCaptions from "@/components/voice/LiveCaptions";
import VoiceControls from "@/components/voice/VoiceControls";
import ReportReview from "@/components/report/ReportReview";
import ReportConsent from "@/components/report/ReportConsent";
import ReportSaved from "@/components/report/ReportSaved";

import { useVoiceSession } from "@/hooks/useVoiceSession";
import { useReportWorkflow } from "@/hooks/useReportWorkflow";
import { languageLabel } from "@/lib/languages";
import type { SupportedLanguage } from "@/types/conversation";
import type { FraudReport } from "@/types/report";

interface VoiceScreenProps {
  initialLanguage: SupportedLanguage;
  onEndCall: () => void;
}

type ScreenMode = "conversation" | "review" | "consent" | "saved";

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

export default function VoiceScreen({
  initialLanguage,
  onEndCall,
}: VoiceScreenProps) {
  // Lets the voice hook trigger the review screen once every detail is collected.
  const allCollectedRef = useRef<() => void>(() => {});

  const session = useVoiceSession({
    language: initialLanguage,
    onAllCollected: () => allCollectedRef.current(),
  });
  const workflow = useReportWorkflow();

  const [screen, setScreen] = useState<ScreenMode>("conversation");
  const [sessionStopped, setSessionStopped] = useState(false);
  const [orbSize] = useState(() => (window.innerWidth >= 768 ? 320 : 260));

  const {
    start: startVoiceSession,
    stop: stopVoiceSession,
    updateReport,
    report: sessionReport,
    status,
    language,
    muted,
    setMuted,
    captions,
    currentTranscript,
    speakingText,
    getPlaybackProgress,
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

  allCollectedRef.current = () => {
    void handleBeginReview();
  };

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

  const blocked = ["connecting", "ended", "error"].includes(status);

  return (
    <main className="mx-auto flex min-h-[calc(100svh-80px)] w-full max-w-6xl flex-col px-6 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={handleEndCall} className="btn-light !min-h-10 !px-4">
          <ArrowLeft size={16} /> Back
        </button>
        <span className="rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs font-medium text-mute">
          {languageLabel(language)}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <VoiceOrb state={status} size={orbSize} />
        <p
          className="mt-2 rounded-full border border-line bg-white/80 px-3 py-1 text-xs font-medium text-mute"
          aria-live="polite"
        >
          {statusLabels[status]}
        </p>

        {(sessionError || workflowError) && (
          <div
            role="alert"
            className="mt-5 flex max-w-lg items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{sessionError || workflowError}</p>
          </div>
        )}

        <div className="mt-8 w-full max-w-3xl">
          <LiveCaptions
            captions={captions}
            currentTranscript={currentTranscript}
            speakingText={speakingText}
            getProgress={getPlaybackProgress}
          />
        </div>

        <p className="mt-6 max-w-sm text-center text-xs leading-5 text-mute/80">
          Never share your OTP, PIN, password, or full card number.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-3">
        <VoiceControls
          muted={muted}
          disabled={blocked}
          onToggleMute={() => setMuted(!muted)}
          onEndCall={handleEndCall}
        />
        <button
          onClick={() => void handleBeginReview()}
          disabled={
            busy || blocked || status === "thinking" || stage === "saving"
          }
          className="btn-light w-full"
        >
          <ClipboardCheck size={17} /> Review report
        </button>
      </div>
    </main>
  );
}