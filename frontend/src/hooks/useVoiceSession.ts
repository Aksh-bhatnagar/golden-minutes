import { useCallback, useEffect, useRef, useState } from "react";
import { useGnaniStream } from "@/hooks/useGnaniStream";
import { apiRequest } from "@/services/api";
import { createEmptyReport, type FraudReport } from "@/types/report";
import type {
  Caption,
  SupportedLanguage,
  VoiceState,
} from "@/types/conversation";
import {
  submitConversationTurn,
  synthesizeSpeech,
  type HistoryItem,
} from "@/services/conversationApi";

const INTERRUPTION_RMS_THRESHOLD = 0.075;
const INTERRUPTION_CONFIRM_MS = 180;

// How long to wait after the caller stops talking before answering.
const SILENCE_SENTENCE_END_MS = 600;
const SILENCE_DEFAULT_MS = 900;
const SILENCE_INCOMPLETE_MS = 1900;
const SILENCE_DIGITS_MS = 2000;
const SILENCE_SHORT_ANSWER_MS = 450; // a bare yes / no / skip is already complete
const SILENCE_AMOUNT_WAIT_MS = 2200; // "it was around ..." and the number is still coming
const SILENCE_AMOUNT_DONE_MS = 1200; // the amount has digits or a word like lakh
const SILENCE_PHONE_DONE_MS = 600; // four digits heard
const SILENCE_REF_DONE_MS = 1200; // twelve or more digits heard

// If the caller keeps talking within this window after we submitted,
// it is the same answer: discard our reply and merge.
const CONTINUATION_WINDOW_MS = 4500;

const INCOMPLETE_END =
  /(?:\b(?:and|but|so|because|then|also|um+|uh+|like|aur|lekin|toh|phir|matlab|ki|ya|woh|wo|mera|meri|around|about|roughly|approximately|nearly|almost|is|was|are|were|the|of|to|a|an|at|for|with|my|lagbhag|kareeb)\b|[,:;\-–…])\s*$/i;
const INCOMPLETE_END_DEVANAGARI =
  /(?:^|\s)(?:और|लेकिन|तो|फिर|मतलब|कि|या|वो|मेरा|मेरी|लगभग|करीब)\s*$/u;
const SHORT_ANSWER =
  /^[^\p{L}\p{M}\p{N}]*(?:yes|yeah|yep|no|nope|haan|han|haa|ji|nahi|nahin|skip|हाँ|हां|हा|जी|नहीं|नही|ना|छोड़िए|छोड़ो)[^\p{L}\p{M}\p{N}]*$/iu;
const NUMBER_WORD =
  /\d|\b(?:lakh|lakhs|lac|lacs|hazaar|hazar|thousand|crore|hundred|sau)\b|लाख|हज़ार|हजार|करोड़|सौ/iu;
const DIGIT_FIELDS = new Set(["transaction_reference", "registered_phone_last4"]);

let lastSpeechAt = 0;

function mark(label: string) {
  const now = performance.now();
  const since = lastSpeechAt
    ? ` (+${Math.round(now - lastSpeechAt)}ms after last speech)`
    : "";
  console.log(`${new Date().toISOString().slice(11, 23)} [UI] ${label}${since}`);
}

function silenceDelayFor(text: string, field: string | null): number {
  const t = text.trim();
  if (INCOMPLETE_END.test(t) || INCOMPLETE_END_DEVANAGARI.test(t)) {
    return SILENCE_INCOMPLETE_MS;
  }

  // A bare yes / no / skip is a complete answer.
  if (SHORT_ANSWER.test(t)) return SILENCE_SHORT_ANSWER_MS;

  if (field === "amount_inr") {
    return NUMBER_WORD.test(t) ? SILENCE_AMOUNT_DONE_MS : SILENCE_AMOUNT_WAIT_MS;
  }

  if (field && DIGIT_FIELDS.has(field) && /\d\s*$/.test(t)) {
    const count = (t.match(/\d/g) ?? []).length;
    if (field === "registered_phone_last4" && count >= 4) return SILENCE_PHONE_DONE_MS;
    if (field === "transaction_reference" && count >= 12) return SILENCE_REF_DONE_MS;
    return SILENCE_DIGITS_MS;
  }

  if (/[.?!।]$/.test(t)) return SILENCE_SENTENCE_END_MS;
  return SILENCE_DEFAULT_MS;
}

interface OpeningQuestion {
  field?: string;
  question?: string;
}

interface OpeningResponse {
  question: string | OpeningQuestion;
  summary?: unknown;
}

interface StartOptions {
  preserveReport?: boolean;
}

interface SessionOptions {
  language?: SupportedLanguage;
  onAllCollected?: () => void;
}

interface TurnSnapshot {
  report: FraudReport;
  field: string | null;
  historyLen: number;
  captionsLen: number;
  transcript: string;
  at: number;
  applied: boolean;
}

function normalizeQuestion(
  value: OpeningResponse["question"],
): { text: string; field: string | null } {
  if (typeof value === "string") {
    return { text: value.trim(), field: null };
  }

  if (value && typeof value === "object") {
    return {
      text: typeof value.question === "string" ? value.question.trim() : "",
      field: typeof value.field === "string" ? value.field : null,
    };
  }

  return { text: "", field: null };
}

function makeCaption(speaker: Caption["speaker"], text: string): Caption {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    speaker,
    text,
    final: true,
    timestamp: Date.now(),
  };
}

export function useVoiceSession(options: SessionOptions = {}) {
  const [status, setStatus] = useState<VoiceState>("idle");
  const [language, setLanguageState] = useState<SupportedLanguage>(
    options.language ?? "en",
  );
  const [muted, setMutedState] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [report, setReport] = useState<FraudReport>(createEmptyReport);
  const [currentField, setCurrentField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [speakingText, setSpeakingText] = useState<string | null>(null);

  const reportRef = useRef(report);
  const currentFieldRef = useRef(currentField);
  const languageRef = useRef(language);
  const statusRef = useRef<VoiceState>("idle");
  const mutedRef = useRef(false);
  const historyRef = useRef<HistoryItem[]>([]);
  const captionsRef = useRef<Caption[]>([]);
  const snapshotRef = useRef<TurnSnapshot | null>(null);
  const turnTokenRef = useRef(0);
  const spokenLanguageRef = useRef<Exclude<SupportedLanguage, "auto">>(
    options.language && options.language !== "auto" ? options.language : "en",
  );
  const pendingCompleteRef = useRef(false);
  const onAllCollectedRef = useRef(options.onAllCollected);
  onAllCollectedRef.current = options.onAllCollected;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptionStartedRef = useRef<number | null>(null);

  const processingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const sessionIdRef = useRef(0);
  const pendingTranscriptRef = useRef("");
  const processTranscriptRef = useRef<(() => Promise<void>) | null>(null);

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

  const pushCaption = useCallback((caption: Caption) => {
    captionsRef.current = [...captionsRef.current, caption];
    setCaptions(captionsRef.current);
  }, []);

  const resetCaptions = useCallback(() => {
    captionsRef.current = [];
    setCaptions([]);
  }, []);

  const rollbackCaptions = useCallback((snap: TurnSnapshot) => {
    captionsRef.current = captionsRef.current.slice(0, snap.captionsLen);
    setCaptions(captionsRef.current);
  }, []);

  // Undo a turn whose reply was already applied.
  const restoreSnapshot = useCallback(
    (snap: TurnSnapshot) => {
      reportRef.current = snap.report;
      setReport(snap.report);

      currentFieldRef.current = snap.field;
      setCurrentField(snap.field);

      historyRef.current = historyRef.current.slice(0, snap.historyLen);
      rollbackCaptions(snap);
    },
    [rollbackCaptions],
  );

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();

    silenceTimerRef.current = setTimeout(
      () => {
        void processTranscriptRef.current?.();
      },
      silenceDelayFor(
        pendingTranscriptRef.current,
        currentFieldRef.current,
      ),
    );
  }, [clearSilenceTimer]);

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

    setSpeakingText(null);
  }, []);

  // Progress (0..1) of the audio that is currently playing.
  const getPlaybackProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !Number.isFinite(audio.duration)) {
      return 0;
    }
    return Math.min(1, audio.currentTime / audio.duration);
  }, []);

  // When the last reply completed the report, close the call after it is heard.
  const finishIfComplete = useCallback(() => {
    if (!pendingCompleteRef.current) return;
    pendingCompleteRef.current = false;
    onAllCollectedRef.current?.();
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
          languageRef.current === "auto"
            ? spokenLanguageRef.current
            : languageRef.current,
        );
        mark("TTS audio received");

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
          // The caller heard the whole reply: a new answer is a new turn.
          snapshotRef.current = null;
          setSpeakingText(null);

          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }

          if (sessionActiveRef.current && statusRef.current === "speaking") {
            updateStatus("listening");
          }

          finishIfComplete();
        };

        audio.onerror = () => {
          if (
            audioRef.current !== audio ||
            sessionIdRef.current !== expectedSessionId
          ) {
            return;
          }

          audioRef.current = null;
          setSpeakingText(null);

          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }

          if (sessionActiveRef.current) {
            setErrorMessage("Unable to play the assistant's audio response.");
            updateStatus("error");
          }
        };

        await audio.play();
        mark("audio playing");

        // Show the caption only now, and let it reveal as the audio plays.
        pushCaption(makeCaption("assistant", text));
        setSpeakingText(text);
      } catch (cause) {
        if (
          !sessionActiveRef.current ||
          sessionIdRef.current !== expectedSessionId
        ) {
          return;
        }

        // No audio: still show the text so the call can continue.
        pushCaption(makeCaption("assistant", text));
        setSpeakingText(null);

        setErrorMessage(
          cause instanceof Error
            ? cause.message
            : "Unable to generate or play the assistant's response.",
        );
        updateStatus("error");
        finishIfComplete();
      }
    },
    [finishIfComplete, pushCaption, stopPlayback, updateStatus],
  );

  const processPendingTranscript = useCallback(async () => {
    if (processingRef.current || !sessionActiveRef.current) return;

    const transcript = pendingTranscriptRef.current.trim();
    if (!transcript) return;

    const expectedSessionId = sessionIdRef.current;
    const turn = turnTokenRef.current + 1;
    turnTokenRef.current = turn;

    processingRef.current = true;
    pendingTranscriptRef.current = "";
    clearSilenceTimer();
    setCurrentTranscript("");
    stopPlayback();

    const snapshot: TurnSnapshot = {
      report: reportRef.current,
      field: currentFieldRef.current,
      historyLen: historyRef.current.length,
      captionsLen: captionsRef.current.length,
      transcript,
      at: Date.now(),
      applied: false,
    };
    snapshotRef.current = snapshot;

    pushCaption(makeCaption("user", transcript));
    updateStatus("thinking");
    mark("silence timer fired, sending turn");

    try {
      const result = await submitConversationTurn(
        reportRef.current,
        transcript,
        currentFieldRef.current,
        languageRef.current,
        historyRef.current.slice(-4),
      );
      mark("LLM reply received");

      // Superseded because the caller kept talking, or the session ended.
      if (
        !sessionActiveRef.current ||
        sessionIdRef.current !== expectedSessionId ||
        turn !== turnTokenRef.current
      ) {
        return;
      }

      const responseText =
        typeof result.response === "string" ? result.response : "";

      if (!responseText.trim()) {
        throw new Error("The conversation service returned an empty response.");
      }

      snapshot.applied = true;
      pendingCompleteRef.current = result.action === "confirm";
      if (result.language) spokenLanguageRef.current = result.language;

      reportRef.current = result.report;
      setReport(result.report);

      currentFieldRef.current = result.current_field;
      setCurrentField(result.current_field);

      historyRef.current.push(
        { role: "user", content: transcript },
        { role: "assistant", content: responseText },
      );

      await playAssistantResponse(responseText, expectedSessionId);
    } catch (cause) {
      if (
        sessionActiveRef.current &&
        sessionIdRef.current === expectedSessionId &&
        turn === turnTokenRef.current
      ) {
        setErrorMessage(
          cause instanceof Error
            ? cause.message
            : "The conversation service is unavailable.",
        );
        updateStatus("error");
      }
    } finally {
      if (sessionIdRef.current === expectedSessionId) {
        processingRef.current = false;

        if (sessionActiveRef.current) {
          if (statusRef.current === "thinking") {
            updateStatus("listening");
          }

          if (pendingTranscriptRef.current.trim()) {
            armSilenceTimer();
          }
        }
      }
    }
  }, [
    armSilenceTimer,
    clearSilenceTimer,
    playAssistantResponse,
    pushCaption,
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

      mark(`transcript: "${text.slice(0, 40)}"`);
      lastSpeechAt = performance.now();

      const snap = snapshotRef.current;
      const continuing =
        snap !== null && Date.now() - snap.at < CONTINUATION_WINDOW_MS;

      if (continuing && snap) {
        // The caller is still on the previous answer. Drop our reply,
        // restore the state from before it, and treat both parts as one.
        turnTokenRef.current += 1;
        pendingCompleteRef.current = false;
        stopPlayback();

        if (snap.applied) restoreSnapshot(snap);
        else rollbackCaptions(snap);

        pendingTranscriptRef.current = [
          snap.transcript,
          pendingTranscriptRef.current,
          text,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        snapshotRef.current = null;
        interruptionStartedRef.current = null;

        if (statusRef.current !== "thinking") updateStatus("listening");
      } else {
        pendingTranscriptRef.current = [pendingTranscriptRef.current, text]
          .filter(Boolean)
          .join(" ")
          .trim();

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
      }

      setCurrentTranscript(pendingTranscriptRef.current);
      armSilenceTimer();
    },
    [
      armSilenceTimer,
      restoreSnapshot,
      rollbackCaptions,
      stopPlayback,
      updateStatus,
    ],
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
    async (startOptions: StartOptions = {}) => {
      if (sessionActiveRef.current) return;

      const preserveReport = startOptions.preserveReport === true;
      const sessionId = sessionIdRef.current + 1;

      sessionIdRef.current = sessionId;
      sessionActiveRef.current = true;

      setErrorMessage(null);
      setMutedState(false);
      mutedRef.current = false;
      updateStatus("connecting");

      clearSilenceTimer();
      stopPlayback();
      snapshotRef.current = null;
      pendingCompleteRef.current = false;

      spokenLanguageRef.current =
        languageRef.current === "auto" ? "en" : languageRef.current;

      if (!preserveReport) {
        const emptyReport = createEmptyReport();

        reportRef.current = emptyReport;
        setReport(emptyReport);

        currentFieldRef.current = null;
        setCurrentField(null);
        resetCaptions();
        historyRef.current = [];
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
            body: JSON.stringify({
              report: reportRef.current,
              language: spokenLanguageRef.current,
            }),
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

        historyRef.current.push({
          role: "assistant",
          content: normalized.text,
        });

        await playAssistantResponse(normalized.text, sessionId);
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
      resetCaptions,
      stopPlayback,
      stream.start,
      updateStatus,
    ],
  );

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    sessionActiveRef.current = false;
    pendingCompleteRef.current = false;

    clearSilenceTimer();
    stopPlayback();
    stream.stop();

    snapshotRef.current = null;
    interruptionStartedRef.current = null;
    pendingTranscriptRef.current = "";
    processingRef.current = false;

    setCurrentTranscript("");
    updateStatus("ended");
  }, [clearSilenceTimer, stopPlayback, stream.stop, updateStatus]);

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

  const setLanguage = useCallback((nextLanguage: SupportedLanguage) => {
    if (sessionActiveRef.current) return;

    languageRef.current = nextLanguage;
    setLanguageState(nextLanguage);
  }, []);

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
    speakingText,
    getPlaybackProgress,
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