
import { useCallback, useEffect, useRef, useState } from "react";
import { useGnaniStream } from "@/hooks/useGnaniStream";
import { apiRequest } from "@/services/api";
import {
  createEmptyReport,
  type FraudReport,
} from "@/types/report";
import type {
  Caption,
  SupportedLanguage,
  VoiceState,
} from "@/types/conversation";
import {
  submitConversationTurn,
  synthesizeSpeech,
} from "@/services/conversationApi";

const SILENCE_DELAY_MS = 1400;
const INTERRUPTION_RMS_THRESHOLD = 0.075;
const INTERRUPTION_CONFIRM_MS = 180;

interface OpeningQuestion {
  field?: string;
  question?: string;
}

interface OpeningResponse {
  question: string | OpeningQuestion;
  summary?: string;
}

interface StartOptions {
  preserveReport?: boolean;
}

function normalizeQuestion(
  value: OpeningResponse["question"],
): { text: string; field: string | null } {
  if (typeof value === "string") {
    return { text: value.trim(), field: null };
  }

  if (value && typeof value === "object") {
    return {
      text:
        typeof value.question === "string"
          ? value.question.trim()
          : "",
      field:
        typeof value.field === "string"
          ? value.field
          : null,
    };
  }

  return { text: "", field: null };
}

function makeCaption(
  speaker: Caption["speaker"],
  text: string,
): Caption {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    speaker,
    text,
    final: true,
    timestamp: Date.now(),
  };
}

export function useVoiceSession() {
  const [status, setStatus] = useState<VoiceState>("idle");
  const [language, setLanguageState] =
    useState<SupportedLanguage>("en");
  const [muted, setMutedState] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [report, setReport] =
    useState<FraudReport>(createEmptyReport);
  const [currentField, setCurrentField] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const reportRef = useRef(report);
  const currentFieldRef = useRef(currentField);
  const languageRef = useRef(language);
  const statusRef = useRef<VoiceState>("idle");
  const mutedRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const silenceTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptionStartedRef = useRef<number | null>(null);

  const processingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const sessionIdRef = useRef(0);
  const pendingTranscriptRef = useRef("");
  const processTranscriptRef =
    useRef<(() => Promise<void>) | null>(null);

  const updateStatus = useCallback((next: VoiceState) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  useEffect(() => {
    currentFieldRef.current = currentField;
  }, [currentField]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const updateReport = useCallback((nextReport: FraudReport) => {
    reportRef.current = nextReport;
    setReport(nextReport);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;

    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const playAssistantResponse = useCallback(
    async (text: string, expectedSessionId: number) => {
      if (
        !sessionActiveRef.current ||
        sessionIdRef.current !== expectedSessionId ||
        !text.trim()
      ) {
        return;
      }

      stopPlayback();
      updateStatus("speaking");

      try {
        const audioBlob = await synthesizeSpeech(
          text,
          languageRef.current,
        );

        if (
          !sessionActiveRef.current ||
          sessionIdRef.current !== expectedSessionId ||
          statusRef.current !== "speaking"
        ) {
          return;
        }

        const url = URL.createObjectURL(audioBlob);
        audioUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          if (
            audioRef.current !== audio ||
            sessionIdRef.current !== expectedSessionId
          ) {
            return;
          }

          audioRef.current = null;

          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }

          if (
            sessionActiveRef.current &&
            statusRef.current === "speaking"
          ) {
            updateStatus("listening");
          }
        };

        audio.onerror = () => {
          if (
            audioRef.current !== audio ||
            sessionIdRef.current !== expectedSessionId
          ) {
            return;
          }

          audioRef.current = null;

          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }

          if (sessionActiveRef.current) {
            setErrorMessage(
              "Unable to play the assistant's audio response.",
            );
            updateStatus("error");
          }
        };

        await audio.play();
      } catch (cause) {
        if (
          !sessionActiveRef.current ||
          sessionIdRef.current !== expectedSessionId
        ) {
          return;
        }

        setErrorMessage(
          cause instanceof Error
            ? cause.message
            : "Unable to generate or play the assistant's response.",
        );
        updateStatus("error");
      }
    },
    [stopPlayback, updateStatus],
  );

  const processPendingTranscript = useCallback(async () => {
    if (
      processingRef.current ||
      !sessionActiveRef.current
    ) {
      return;
    }

    const transcript = pendingTranscriptRef.current.trim();
    if (!transcript) return;

    const expectedSessionId = sessionIdRef.current;

    processingRef.current = true;
    pendingTranscriptRef.current = "";
    clearSilenceTimer();
    setCurrentTranscript("");
    stopPlayback();

    setCaptions((previous) => [
      ...previous,
      makeCaption("user", transcript),
    ]);

    updateStatus("thinking");

    try {
      const result = await submitConversationTurn(
        reportRef.current,
        transcript,
        currentFieldRef.current,
      );

      if (
        !sessionActiveRef.current ||
        sessionIdRef.current !== expectedSessionId
      ) {
        return;
      }

      reportRef.current = result.report;
      setReport(result.report);

      currentFieldRef.current = result.current_field;
      setCurrentField(result.current_field);

      const responseText =
        typeof result.response === "string"
          ? result.response
          : "";

      if (!responseText.trim()) {
        throw new Error(
          "The conversation service returned an empty response.",
        );
      }

      setCaptions((previous) => [
        ...previous,
        makeCaption("assistant", responseText),
      ]);

      await playAssistantResponse(
        responseText,
        expectedSessionId,
      );
    } catch (cause) {
      if (
        sessionActiveRef.current &&
        sessionIdRef.current === expectedSessionId
      ) {
        setErrorMessage(
          cause instanceof Error
            ? cause.message
            : "The conversation service is unavailable.",
        );
        updateStatus("error");
      }
    } finally {
      if (sessionIdRef.current !== expectedSessionId) return;

      processingRef.current = false;

      if (!sessionActiveRef.current) return;

      if (statusRef.current === "thinking") {
        updateStatus("listening");
      }

      if (pendingTranscriptRef.current.trim()) {
        clearSilenceTimer();

        silenceTimerRef.current = setTimeout(() => {
          void processTranscriptRef.current?.();
        }, SILENCE_DELAY_MS);
      }
    }
  }, [
    clearSilenceTimer,
    playAssistantResponse,
    stopPlayback,
    updateStatus,
  ]);

  useEffect(() => {
    processTranscriptRef.current = processPendingTranscript;
  }, [processPendingTranscript]);

  const handleTranscript = useCallback(
    (event: { text: string }) => {
      const text = event.text.trim();

      if (!text || !sessionActiveRef.current) return;

      pendingTranscriptRef.current = [
        pendingTranscriptRef.current,
        text,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      setCurrentTranscript(pendingTranscriptRef.current);

      if (statusRef.current === "speaking") {
        stopPlayback();
        interruptionStartedRef.current = null;
        updateStatus("listening");
      } else if (
        statusRef.current !== "thinking" &&
        statusRef.current !== "error"
      ) {
        updateStatus("listening");
      }

      clearSilenceTimer();

      silenceTimerRef.current = setTimeout(() => {
        void processTranscriptRef.current?.();
      }, SILENCE_DELAY_MS);
    },
    [clearSilenceTimer, stopPlayback, updateStatus],
  );

  const handleAudioLevel = useCallback(
    (rms: number) => {
      if (
        !sessionActiveRef.current ||
        mutedRef.current ||
        statusRef.current !== "speaking"
      ) {
        interruptionStartedRef.current = null;
        return;
      }

      if (rms < INTERRUPTION_RMS_THRESHOLD) {
        interruptionStartedRef.current = null;
        return;
      }

      if (interruptionStartedRef.current === null) {
        interruptionStartedRef.current = Date.now();
        return;
      }

      if (
        Date.now() - interruptionStartedRef.current >=
        INTERRUPTION_CONFIRM_MS
      ) {
        interruptionStartedRef.current = null;
        stopPlayback();
        updateStatus("listening");
      }
    },
    [stopPlayback, updateStatus],
  );

  const stream = useGnaniStream({
    language,
    onTranscript: handleTranscript,
    onAudioLevel: handleAudioLevel,
  });

  const start = useCallback(
    async (options: StartOptions = {}) => {
      if (sessionActiveRef.current) return;

      const preserveReport = options.preserveReport === true;
      const sessionId = sessionIdRef.current + 1;

      sessionIdRef.current = sessionId;
      sessionActiveRef.current = true;

      setErrorMessage(null);
      setMutedState(false);
      mutedRef.current = false;
      updateStatus("connecting");

      clearSilenceTimer();
      stopPlayback();

      if (!preserveReport) {
        const emptyReport = createEmptyReport();

        reportRef.current = emptyReport;
        setReport(emptyReport);

        currentFieldRef.current = null;
        setCurrentField(null);
        setCaptions([]);
      }

      setCurrentTranscript("");
      pendingTranscriptRef.current = "";
      processingRef.current = false;
      interruptionStartedRef.current = null;

      try {
        await stream.start();

        if (
          !sessionActiveRef.current ||
          sessionIdRef.current !== sessionId
        ) {
          return;
        }

        if (preserveReport) {
          updateStatus("listening");
          return;
        }

        const opening = await apiRequest<OpeningResponse>(
          "/conversation/next",
          {
            method: "POST",
            body: JSON.stringify({ report: reportRef.current }),
          },
        );

        if (
          !sessionActiveRef.current ||
          sessionIdRef.current !== sessionId
        ) {
          return;
        }

        const normalized = normalizeQuestion(opening.question);

        if (!normalized.text) {
          throw new Error(
            "The conversation service returned an invalid opening question.",
          );
        }

        if (normalized.field) {
          currentFieldRef.current = normalized.field;
          setCurrentField(normalized.field);
        }

        setCaptions((previous) => [
          ...previous,
          makeCaption("assistant", normalized.text),
        ]);

        await playAssistantResponse(
          normalized.text,
          sessionId,
        );
      } catch (cause) {
        if (
          !sessionActiveRef.current ||
          sessionIdRef.current !== sessionId
        ) {
          return;
        }

        setErrorMessage(
          cause instanceof Error
            ? cause.message
            : "Unable to start the voice conversation.",
        );
        updateStatus("error");
      }
    },
    [
      clearSilenceTimer,
      playAssistantResponse,
      stopPlayback,
      stream.start,
      updateStatus,
    ],
  );

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    sessionActiveRef.current = false;

    clearSilenceTimer();
    stopPlayback();
    stream.stop();

    interruptionStartedRef.current = null;
    pendingTranscriptRef.current = "";
    processingRef.current = false;

    setCurrentTranscript("");
    updateStatus("ended");
  }, [
    clearSilenceTimer,
    stopPlayback,
    stream.stop,
    updateStatus,
  ]);

  const setMuted = useCallback(
    (nextMuted: boolean) => {
      mutedRef.current = nextMuted;
      setMutedState(nextMuted);
      stream.setMuted(nextMuted);

      if (nextMuted) {
        interruptionStartedRef.current = null;
      }
    },
    [stream.setMuted],
  );

  const setLanguage = useCallback(
    (nextLanguage: SupportedLanguage) => {
      if (sessionActiveRef.current) return;

      languageRef.current = nextLanguage;
      setLanguageState(nextLanguage);
    },
    [],
  );

  useEffect(() => {
    return () => {
      sessionIdRef.current += 1;
      sessionActiveRef.current = false;

      clearSilenceTimer();
      stopPlayback();
      stream.stop();
    };
  }, [clearSilenceTimer, stopPlayback, stream.stop]);

  return {
    status,
    language,
    setLanguage,
    muted,
    setMuted,
    captions,
    currentTranscript,
    report,
    updateReport,
    currentField,
    errorMessage: errorMessage ?? stream.error,
    isConnected: stream.isConnected,
    isConnecting: stream.isConnecting,
    start,
    stop,
  };
}
