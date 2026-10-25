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
    <main className="mx-auto flex min-h-[calc(100svh-80px)] w-full max-w-5xl flex-col px-6 pb-8 pt-4">
      
      {/* Reactive Ambient Smoke Layer */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[-1] flex justify-center" aria-hidden="true">
        <div 
          className={`w-full max-w-5xl aspect-[2/1] rounded-t-full blur-[100px] transition-all duration-1000 ease-in-out ${
            status === "speaking" 
              ? "translate-y-[10%] scale-y-[1.8] opacity-50 bg-gradient-to-t from-[#e85dff] to-[#2a8af6]"
            : status === "listening"
              ? "translate-y-[40%] scale-y-100 opacity-30 bg-gradient-to-t from-[#1ee3b5] to-[#2a8af6]"
            : status === "thinking"
              ? "translate-y-[30%] scale-y-[1.2] opacity-40 bg-gradient-to-t from-[#ff7a2d] to-[#e85dff] animate-pulse"
            : status === "error"
              ? "translate-y-[30%] scale-y-100 opacity-40 bg-gradient-to-t from-red-500 to-orange-500"
            : "translate-y-[60%] opacity-0" 
          }`}
        />
      </div>

      {/* Persistent Premium Top Bar (Always visible) */}
      <header className="flex items-center justify-between mb-0">
        <button onClick={handleEndCall} className="group flex items-center gap-2 rounded-full border border-line bg-white/50 px-4 py-2 text-sm font-medium text-mute transition hover:bg-white hover:text-ink">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back
        </button>
        <span className="rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs font-semibold tracking-wide text-mute shadow-sm">
          {languageLabel(language)}
        </span>
      </header>

      {/* Sub-screens rendered inside the persistent layout */}
      {screen === "review" && (
        <ReportReview
          report={workflowReport}
          busy={busy}
          error={workflowError}
          onBack={handleReturnToConversation}
          onSaveChanges={handleSaveCorrections}
          onConfirm={handleConfirmDetails}
        />
      )}

      {screen === "consent" && (
        <ReportConsent
          busy={busy}
          error={workflowError}
          onBack={() => setScreen("review")}
          onConsent={handleConsent}
        />
      )}

      {screen === "saved" && reference && (
        <ReportSaved
          reference={reference}
          message={message}
          onFinish={handleEndCall}
        />
      )}

      {/* Primary Conversation UI */}
      {screen === "conversation" && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center py-8">
            <VoiceOrb state={status} size={orbSize} />
            
            <div className="mt-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="rounded-full border border-line bg-white/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-mute shadow-sm">
                {statusLabels[status]}
              </span>
            </div>

            {(sessionError || workflowError) && (
              <div
                role="alert"
                className="mt-6 flex max-w-md items-start gap-3 rounded-2xl border border-red-200/60 bg-red-50/50 p-4 text-sm text-red-600 backdrop-blur-md"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p className="leading-relaxed">{sessionError || workflowError}</p>
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
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="flex flex-col gap-3 rounded-[2rem] border border-white/60 bg-white/40 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
              <VoiceControls
                muted={muted}
                disabled={blocked}
                onToggleMute={() => setMuted(!muted)}
                onEndCall={handleEndCall}
              />
              <button
                onClick={() => void handleBeginReview()}
                disabled={busy || blocked || status === "thinking" || stage === "saving"}
                className="btn-dark w-full !rounded-2xl"
              >
                <ClipboardCheck size={17} /> Review report
              </button>
            </div>
            
            <p className="mt-5 text-center text-xs font-medium text-mute/60">
              Never share your OTP, PIN, password, or full card number.
            </p>
          </div>
        </>
      )}
    </main>
  );
}