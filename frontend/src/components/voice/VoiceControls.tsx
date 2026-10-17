
import { Mic, MicOff, PhoneOff } from "lucide-react";

interface VoiceControlsProps {
  muted: boolean;
  disabled?: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export default function VoiceControls({
  muted,
  disabled = false,
  onToggleMute,
  onEndCall,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center justify-center gap-5">
      <button
        type="button"
        onClick={onToggleMute}
        disabled={disabled}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        aria-pressed={muted}
        className={`grid size-12 place-items-center rounded-full border transition ${
          muted
            ? "border-amber-200/25 bg-amber-200/10 text-amber-100"
            : "border-white/15 bg-white/[0.05] text-white/80 hover:bg-white/10"
        } disabled:opacity-40`}
      >
        {muted ? <MicOff size={19} /> : <Mic size={19} />}
      </button>

      <button
        type="button"
        onClick={onEndCall}
        aria-label="End conversation"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-red-400 px-6 text-sm font-semibold text-[#260c0c] transition hover:bg-red-300 active:scale-[0.98]"
      >
        <PhoneOff size={17} />
        End conversation
      </button>
    </div>
  );
}
