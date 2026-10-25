import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import LandingPage from "@/components/landing/LandingPage";
import VoiceScreen from "@/components/voice/VoiceScreen";
import HandlerPage from "@/components/handler/HandlerPage";
import type { SupportedLanguage } from "@/types/conversation";

type Screen = "landing" | "voice" | "handler";

export default function App() {
  const [screen, setScreen] = useState<Screen>(
    window.location.hash === "#handler" ? "handler" : "landing",
  );
  const [language, setLanguage] = useState<SupportedLanguage>("en");

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-paper text-ink">
      <div className="glow" />
      
      {/* 
        New: Subtle bottom ambient glow
        pointer-events-none ensures it doesn't block clicks on footer links 
      */}
      <div 
        className="pointer-events-none fixed -bottom-32 left-0 right-0 z-0 h-64 bg-gradient-to-r from-orange-400 via-pink-400 to-indigo-500 opacity-20 blur-[80px]" 
        aria-hidden="true" 
      />

      <div className="relative z-10">
        <AppHeader />
        {screen === "landing" && (
          <LandingPage
            onStartCall={(chosen) => {
              setLanguage(chosen);
              setScreen("voice");
            }}
            onOpenHandler={() => setScreen("handler")}
          />
        )}
        {screen === "voice" && (
          <VoiceScreen
            initialLanguage={language}
            onEndCall={() => setScreen("landing")}
          />
        )}
        {screen === "handler" && (
          <HandlerPage
            onExit={() => {
              window.location.hash = "";
              setScreen("landing");
            }}
          />
        )}
      </div>
    </div>
  );
}