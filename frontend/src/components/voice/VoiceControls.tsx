import { Mic, MicOff, PhoneOff } from "lucide-react";

export default function VoiceControls({ muted, disabled = false, onToggleMute, onEndCall }: {
  muted: boolean;
  disabled?: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button 
        onClick={onToggleMute} 
        disabled={disabled} 
        aria-pressed={muted}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        className={`flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 disabled:opacity-40 ${
          muted 
            ? "border-amber-200 bg-amber-50 text-amber-700 shadow-inner" 
            : "border-transparent bg-white text-ink shadow-sm hover:scale-105 hover:shadow-md"
        }`}
      >
        {muted ? <MicOff size={22} /> : <Mic size={22} />}
      </button>
      
      <button 
        onClick={onEndCall}
        className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#ff4b4b] px-6 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#e63e3e] hover:shadow-md active:scale-[.98]"
      >
        <PhoneOff size={18} /> End conversation
      </button>
    </div>
  );
}