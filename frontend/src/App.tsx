import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import LandingPage from "@/components/landing/LandingPage";
import VoiceScreen from "@/components/voice/VoiceScreen";

export default function App() {
  const [screen, setScreen] = useState<"landing" | "voice">("landing");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="glow" />
      <div className="relative z-10">
        <AppHeader />
        {screen === "landing" ? (
          <LandingPage onStartCall={() => setScreen("voice")} />
        ) : (
          <VoiceScreen onEndCall={() => setScreen("landing")} />
        )}
      </div>
    </div>
  );
}