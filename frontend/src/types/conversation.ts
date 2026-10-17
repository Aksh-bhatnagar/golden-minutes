
export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "error"
  | "ended";

export type SupportedLanguage = "en" | "hi" | "hinglish";

export interface Caption {
  id: string;
  speaker: "user" | "assistant";
  text: string;
  final: boolean;
  timestamp: number;
}

export interface VoiceSessionState {
  status: VoiceState;
  language: SupportedLanguage;
  captions: Caption[];
  currentTranscript: string;
  errorMessage: string | null;
}
