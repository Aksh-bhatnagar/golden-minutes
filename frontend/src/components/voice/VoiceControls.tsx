import { Mic, MicOff, PhoneOff } from "lucide-react";

export default function VoiceControls({ muted, disabled = false, onToggleMute, onEndCall }: {
  muted: boolean;
  disabled?: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button onClick={onToggleMute} disabled={disabled} aria-pressed={muted}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              className={`grid size-12 place-items-center rounded-full border transition disabled:opacity-40 ${
                muted ? "border-amber-300 bg-amber-100 text-amber-800" : "border-line bg-white hover:bg-paper"
              }`}>
        {muted ? <MicOff size={19} /> : <Mic size={19} />}
      </button>
      <button onClick={onEndCall}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-red-500 px-6 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-[.98]">
        <PhoneOff size={17} /> End conversation
      </button>
    </div>
  );
}