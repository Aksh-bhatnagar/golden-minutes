
import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "../types/report";

const API_BASE = "http://127.0.0.1:8000/api";

interface UseVoiceOptions {
  language: Language;
  onTranscript: (transcript: string) => Promise<void>;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * bytesPerSample;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, index) => buffer.getChannelData(index),
  );

  let offset = 44;

  for (let i = 0; i < frames; i++) {
    let sample = 0;

    for (const channel of channels) {
      sample += channel[i] / channels.length;
    }

    sample = Math.max(-1, Math.min(1, sample));

    view.setInt16(
      offset,
      sample < 0 ? sample * 32768 : sample * 32767,
      true,
    );

    offset += 2;
  }

  return new Blob([wav], { type: "audio/wav" });
}

export function useVoice({ language, onTranscript }: UseVoiceOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("Ready to begin");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const languageRef = useRef(language);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    languageRef.current = language;
    onTranscriptRef.current = onTranscript;
  }, [language, onTranscript]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsSpeaking(false);
  }, []);

  const speakText = useCallback(
    async (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      stopSpeaking();
      setStatus("Generating assistant speech...");

      try {
        const response = await fetch(`${API_BASE}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            language: languageRef.current,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(
            error.detail || `Speech synthesis failed (${response.status}).`,
          );
        }

        const audioUrl = URL.createObjectURL(await response.blob());
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          if (audioRef.current === audio) {
            audioRef.current = null;
            setIsSpeaking(false);
            setStatus("Ready for your answer");
          }

          if (audioUrlRef.current === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrlRef.current = null;
          }
        };

        audio.onerror = () => {
          if (audioRef.current === audio) {
            audioRef.current = null;
            setIsSpeaking(false);
            setStatus("Speech playback failed. Read the question on screen.");
          }

          if (audioUrlRef.current === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrlRef.current = null;
          }
        };

        setIsSpeaking(true);
        setStatus("Assistant is speaking...");
        await audio.play();
      } catch (error) {
        setIsSpeaking(false);
        setStatus(
          error instanceof Error
            ? `Speech unavailable: ${error.message}`
            : "Speech unavailable. You can still read the question.",
        );
      }
    },
    [stopSpeaking],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) return;

    stopSpeaking();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires localhost or HTTPS.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        setStatus("Converting audio and transcribing...");

        let audioContext: AudioContext | null = null;

        try {
          const recording = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          if (!recording.size) {
            throw new Error("No audio was recorded. Please try again.");
          }

          audioContext = new AudioContext();

          const buffer = await audioContext.decodeAudioData(
            await recording.arrayBuffer(),
          );

          const wav = audioBufferToWav(buffer);

          const response = await fetch(
            `${API_BASE}/stt?language=${encodeURIComponent(languageRef.current)}&filename=recording.wav`,
            {
              method: "POST",
              headers: { "Content-Type": "audio/wav" },
              body: wav,
            },
          );

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(
              error.detail || `Transcription failed (${response.status}).`,
            );
          }

          const result: { transcript: string } = await response.json();
          const transcript = result.transcript.trim();

          if (!transcript) {
            throw new Error("No speech was recognized. Please try again.");
          }

          await onTranscriptRef.current(transcript);
        } catch (error) {
          setStatus(
            error instanceof Error
              ? error.message
              : "Audio processing failed.",
          );
        } finally {
          if (audioContext) {
            await audioContext.close().catch(() => undefined);
          }

          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          recorderRef.current = null;
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setStatus("Listening — speak clearly");
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      setStatus(
        error instanceof Error
          ? error.message
          : "Could not access the microphone.",
      );
    }
  }, [isRecording, isTranscribing, stopSpeaking]);

  const cleanup = useCallback(() => {
    stopSpeaking();

    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current?.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, [stopSpeaking]);

  useEffect(() => cleanup, [cleanup]);

  return {
    isRecording,
    isTranscribing,
    isSpeaking,
    status,
    setStatus,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
    cleanup,
  };
}
