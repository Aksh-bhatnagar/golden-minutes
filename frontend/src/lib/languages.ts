import type { SupportedLanguage } from "@/types/conversation";

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  native: string;
  live: boolean;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "hinglish", label: "Hinglish", native: "Hinglish", live: true },
  { code: "en", label: "English", native: "English", live: true },
  { code: "hi", label: "Hindi", native: "हिन्दी", live: true },
  { code: "bn", label: "Bengali", native: "বাংলা", live: false },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", live: false },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", live: false },
  { code: "ml", label: "Malayalam", native: "മലയാളം", live: false },
  { code: "mr", label: "Marathi", native: "मराठी", live: false },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", live: false },
  { code: "ta", label: "Tamil", native: "தமிழ்", live: false },
  { code: "te", label: "Telugu", native: "తెలుగు", live: false },
];

export function languageLabel(code: SupportedLanguage): string {
  return LANGUAGES.find((l) => l.code === code)?.native ?? code;
}