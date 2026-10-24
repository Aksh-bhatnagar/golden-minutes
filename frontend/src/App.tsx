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