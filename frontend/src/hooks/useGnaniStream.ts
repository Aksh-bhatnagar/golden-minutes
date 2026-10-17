import { useCallback, useEffect, useRef, useState } from "react";
import { getWebSocketUrl } from "@/services/api";
import { useMicrophoneStream } from "@/hooks/useMicrophoneStream";
import type { SupportedLanguage } from "@/types/conversation";

interface GnaniTranscriptEvent {
  type: "transcript";
  text: string;
  segment_index?: number;
  audio_duration_ms?: number;
}

interface GnaniReadyEvent {
  type: "ready";
  language: string;
  sample_rate: number;
  frame_bytes: number;
}

interface GnaniErrorEvent {
  type: "error";
  message: string;
}

type GnaniEvent =
  | GnaniTranscriptEvent
  | GnaniReadyEvent
  | GnaniErrorEvent
  | { type: string; [key: string]: unknown };

interface UseGnaniStreamOptions {
  language: SupportedLanguage;
  onTranscript?: (event: GnaniTranscriptEvent) => void;
  onAudioLevel?: (rms: number) => void;
}

export function useGnaniStream({
  language,
  onTranscript,
  onAudioLevel,
}: UseGnaniStreamOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onAudioLevelRef = useRef(onAudioLevel);
  const readyRef = useRef(false);
  const startingRef = useRef(false);
  const microphone = useMicrophoneStream();

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onAudioLevelRef.current = onAudioLevel;
  }, [onAudioLevel]);

  const stop = useCallback(() => {
    readyRef.current = false;
    startingRef.current = false;

    const socket = socketRef.current;
    socketRef.current = null;

    microphone.stop();

    if (
      socket &&
      socket.readyState !== WebSocket.CLOSED &&
      socket.readyState !== WebSocket.CLOSING
    ) {
      socket.close(1000, "Voice session ended");
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, [microphone.stop]);

  const start = useCallback(async () => {
    if (socketRef.current || startingRef.current) return;

    startingRef.current = true;
    setError(null);
    setLatestTranscript("");
    setIsConnecting(true);
    readyRef.current = false;

    let socket: WebSocket;

    try {
      socket = new WebSocket(
        getWebSocketUrl(
          `/api/stt/stream?language=${encodeURIComponent(language)}`,
        ),
      );
    } catch (cause) {
      startingRef.current = false;
      setIsConnecting(false);

      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to create the speech-recognition connection.";

      setError(message);
      throw new Error(message);
    }

    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const settle = (cause?: Error) => {
          if (settled) return;
          settled = true;

          if (cause) reject(cause);
          else resolve();
        };

        socket.onmessage = async (message: MessageEvent) => {
          if (
            socketRef.current !== socket ||
            typeof message.data !== "string"
          ) {
            return;
          }

          let event: GnaniEvent;

          try {
            event = JSON.parse(message.data) as GnaniEvent;
          } catch {
            settle(
              new Error(
                "Received an invalid response from speech recognition.",
              ),
            );
            return;
          }

          if (event.type === "ready") {
            if (readyRef.current) return;

            const ready = event as GnaniReadyEvent;

            if (
              ready.sample_rate !== 16000 ||
              ready.frame_bytes !== 1024
            ) {
              settle(
                new Error(
                  "The speech-recognition audio format is unsupported.",
                ),
              );
              return;
            }

            try {
              await microphone.start(
                (frame) => {
                  if (
                    socketRef.current === socket &&
                    socket.readyState === WebSocket.OPEN &&
                    readyRef.current
                  ) {
                    socket.send(frame);
                  }
                },
                (rms) => onAudioLevelRef.current?.(rms),
              );

              // stop() may have been called while microphone access
              // was being requested.
              if (socketRef.current !== socket) {
                settle(new Error("The voice connection was stopped."));
                return;
              }

              readyRef.current = true;
              startingRef.current = false;
              setIsConnected(true);
              setIsConnecting(false);
              settle();
            } catch (cause) {
              settle(
                cause instanceof Error
                  ? cause
                  : new Error("Unable to start the microphone."),
              );
            }

            return;
          }

          if (event.type === "transcript") {
            const transcript = event as GnaniTranscriptEvent;
            const text = transcript.text?.trim();

            if (text) {
              setLatestTranscript(text);
              onTranscriptRef.current?.({ ...transcript, text });
            }

            return;
          }

          if (event.type === "error") {
            const messageText =
              (event as GnaniErrorEvent).message ||
              "Live speech recognition failed.";

            setError(messageText);

            if (!readyRef.current) {
              settle(new Error(messageText));
            }
          }
        };

        socket.onerror = () => {
          if (socketRef.current !== socket) return;

          settle(
            new Error(
              "Unable to connect to live speech recognition.",
            ),
          );
        };

        socket.onclose = () => {
          if (socketRef.current !== socket) {
            settle(new Error("The voice connection was closed."));
            return;
          }

          socketRef.current = null;
          readyRef.current = false;
          startingRef.current = false;

          microphone.stop();
          setIsConnected(false);
          setIsConnecting(false);

          if (!settled) {
            settle(
              new Error(
                "Speech recognition disconnected before it was ready.",
              ),
            );
          } else {
            setError("Speech recognition disconnected. Restart the session to continue.");
          }
        };
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "The speech-recognition connection failed.";

      if (socketRef.current === socket) {
        socketRef.current = null;
        readyRef.current = false;
        startingRef.current = false;

        microphone.stop();

        if (
          socket.readyState !== WebSocket.CLOSED &&
          socket.readyState !== WebSocket.CLOSING
        ) {
          socket.close(1000, "Voice connection failed");
        }

        setIsConnected(false);
        setIsConnecting(false);
        setError(message);
      }

      throw cause instanceof Error ? cause : new Error(message);
    }
  }, [language, microphone.start, microphone.stop]);

  useEffect(() => {
    return () => {
      readyRef.current = false;
      startingRef.current = false;

      const socket = socketRef.current;
      socketRef.current = null;

      microphone.stop();

      if (
        socket &&
        socket.readyState !== WebSocket.CLOSED &&
        socket.readyState !== WebSocket.CLOSING
      ) {
        socket.close(1000, "Voice hook unmounted");
      }
    };
  }, [microphone.stop]);

  const setMuted = useCallback(
    (muted: boolean) => microphone.setMuted(muted),
    [microphone.setMuted],
  );

  return {
    start,
    stop,
    setMuted,
    isConnected,
    isConnecting,
    latestTranscript,
    error: error ?? microphone.error,
  };
}