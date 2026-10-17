
import type { VoiceState } from "@/types/conversation";

interface VoiceOrbProps {
  state: VoiceState;
}

const stateLabels: Record<VoiceState, string> = {
  idle: "READY",
  connecting: "CONNECTING",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
  reconnecting: "RECONNECTING",
  error: "CONNECTION ISSUE",
  ended: "CONVERSATION ENDED",
};

export default function VoiceOrb({ state }: VoiceOrbProps) {
  const isActive = state === "listening" || state === "speaking";
  const isThinking = state === "thinking" || state === "connecting";
  const isError = state === "error";

  return (
    <div
      className="relative flex aspect-square w-full max-w-[360px] items-center justify-center"
      role="img"
      aria-label={`Voice assistant: ${stateLabels[state].toLowerCase()}`}
    >
      <div
        className={`absolute inset-[3%] rounded-full border transition-colors duration-500 ${
          isError ? "border-red-300/20" : "border-teal-200/10"
        }`}
      />

      <div
        className={`absolute inset-[13%] rounded-full border transition-colors duration-500 ${
          isActive
            ? "border-teal-200/30"
            : "border-teal-200/[0.12]"
        }`}
      />

      <div
        className={`absolute inset-[22%] rounded-full blur-3xl transition-colors duration-500 ${
          isError ? "bg-red-400/10" : "bg-teal-400/15"
        } ${isActive ? "scale-110" : "scale-100"}`}
      />

      <div
        className={`relative flex size-[55%] items-center justify-center overflow-hidden rounded-full border transition-all duration-500 ${
          isError
            ? "border-red-200/30 bg-[radial-gradient(circle_at_30%_25%,#fca5a5,#a33b45_48%,#271012)]"
            : "border-teal-100/35 bg-[radial-gradient(circle_at_30%_25%,#b8fff0,#5de4c3_18%,#20a98f_43%,#10594f_70%,#071110)]"
        } ${
          state === "speaking"
            ? "scale-105 shadow-[0_0_85px_rgba(45,212,191,0.32)]"
            : "shadow-[0_0_55px_rgba(45,212,191,0.16)]"
        } ${
          isThinking
            ? "motion-safe:animate-[pulse_1.5s_ease-in-out_infinite]"
            : isActive
              ? "motion-safe:animate-[pulse_3s_ease-in-out_infinite]"
              : ""
        }`}
      >
        <div className="absolute left-[17%] top-[15%] h-[15%] w-[30%] rotate-[-35deg] rounded-full bg-white/35 blur-md" />

        <div
          className={`size-[38%] rounded-full border border-teal-100/20 bg-teal-100/10 transition-transform duration-300 ${
            state === "speaking" ? "scale-125" : "scale-100"
          }`}
        />
      </div>
    </div>
  );
}
