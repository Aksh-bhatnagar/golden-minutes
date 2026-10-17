import { useCallback, useRef, useState } from "react";

const TARGET_SAMPLE_RATE = 16_000;
const FRAME_BYTES = 1_024;
const FRAME_SAMPLES = FRAME_BYTES / 2;

type AudioFrameHandler = (frame: ArrayBuffer) => void;
type AudioLevelHandler = (rms: number) => void;

export function useMicrophoneStream() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);

  const samplesRef = useRef<number[]>([]);
  const handlerRef = useRef<AudioFrameHandler | null>(null);
  const levelHandlerRef = useRef<AudioLevelHandler | null>(null);

  const mutedRef = useRef(false);
  const startingRef = useRef(false);
  const generationRef = useRef(0);

  const stop = useCallback(() => {
    // Invalidate any pending getUserMedia()/AudioContext startup.
    generationRef.current += 1;
    startingRef.current = false;

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    silentGainRef.current?.disconnect();
    silentGainRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const context = contextRef.current;
    contextRef.current = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => {});
    }

    samplesRef.current = [];
    handlerRef.current = null;
    levelHandlerRef.current = null;
    mutedRef.current = false;

    setIsCapturing(false);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;

    if (muted) {
      samplesRef.current = [];
    }
  }, []);

  const start = useCallback(
    async (
      onFrame: AudioFrameHandler,
      onAudioLevel?: AudioLevelHandler,
    ) => {
      if (startingRef.current || streamRef.current) return;

      const generation = generationRef.current + 1;
      generationRef.current = generation;
      startingRef.current = true;

      setError(null);
      samplesRef.current = [];
      handlerRef.current = onFrame;
      levelHandlerRef.current = onAudioLevel ?? null;

      let acquiredStream: MediaStream | null = null;
      let acquiredContext: AudioContext | null = null;
      let acquiredSource: MediaStreamAudioSourceNode | null = null;
      let acquiredProcessor: ScriptProcessorNode | null = null;
      let acquiredGain: GainNode | null = null;

      const wasCancelled = () =>
        generationRef.current !== generation;

      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (wasCancelled()) {
          acquiredStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = acquiredStream;

        acquiredContext = new AudioContext();
        contextRef.current = acquiredContext;

        if (acquiredContext.state === "suspended") {
          await acquiredContext.resume();
        }

        if (wasCancelled()) return;

        acquiredSource =
          acquiredContext.createMediaStreamSource(acquiredStream);
        sourceRef.current = acquiredSource;

        acquiredProcessor = acquiredContext.createScriptProcessor(
          4096,
          1,
          1,
        );
        processorRef.current = acquiredProcessor;

        acquiredGain = acquiredContext.createGain();
        acquiredGain.gain.value = 0;
        silentGainRef.current = acquiredGain;

        acquiredProcessor.onaudioprocess = (
          event: AudioProcessingEvent,
        ) => {
          if (wasCancelled()) return;

          const input = event.inputBuffer.getChannelData(0);
          if (input.length === 0) return;

          let sumSquares = 0;

          for (let i = 0; i < input.length; i += 1) {
            sumSquares += input[i] * input[i];
          }

          const rms = Math.sqrt(sumSquares / input.length);

          levelHandlerRef.current?.(
            mutedRef.current ? 0 : rms,
          );

          if (mutedRef.current || !handlerRef.current) return;

          const ratio = acquiredContext!.sampleRate / TARGET_SAMPLE_RATE;
          const outputLength = Math.floor(input.length / ratio);

          for (let i = 0; i < outputLength; i += 1) {
            const position = i * ratio;
            const left = Math.floor(position);
            const right = Math.min(left + 1, input.length - 1);
            const fraction = position - left;

            const sample =
              input[left] * (1 - fraction) +
              input[right] * fraction;

            const clamped = Math.max(-1, Math.min(1, sample));

            samplesRef.current.push(
              clamped < 0
                ? Math.round(clamped * 32768)
                : Math.round(clamped * 32767),
            );
          }

          while (samplesRef.current.length >= FRAME_SAMPLES) {
            const frameSamples = samplesRef.current.splice(
              0,
              FRAME_SAMPLES,
            );
            const pcm = new Int16Array(FRAME_SAMPLES);

            for (let i = 0; i < FRAME_SAMPLES; i += 1) {
              pcm[i] = frameSamples[i];
            }

            handlerRef.current?.(pcm.buffer);
          }
        };

        acquiredSource.connect(acquiredProcessor);
        acquiredProcessor.connect(acquiredGain);
        acquiredGain.connect(acquiredContext.destination);

        if (wasCancelled()) {
          stop();
          return;
        }

        setIsCapturing(true);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to access the microphone.";

        // Only clean up this startup's resources. A newer startup must
        // not be stopped by an older, cancelled startup.
        if (!wasCancelled()) {
          stop();
          setError(message);
        } else {
          acquiredProcessor?.disconnect();
          acquiredSource?.disconnect();
          acquiredGain?.disconnect();

          acquiredStream?.getTracks().forEach((track) => track.stop());

          if (
            acquiredContext &&
            acquiredContext.state !== "closed"
          ) {
            void acquiredContext.close().catch(() => {});
          }
        }

        throw new Error(message);
      } finally {
        if (!wasCancelled()) {
          startingRef.current = false;
        }
      }
    },
    [stop],
  );

  return {
    start,
    stop,
    setMuted,
    isCapturing,
    error,
  };
}