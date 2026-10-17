
import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import LandingPage from "@/components/landing/LandingPage";
import VoiceScreen from "@/components/voice/VoiceScreen";

type AppScreen = "landing" | "voice";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");

  return (
    <div className="min-h-screen bg-[#071310] text-white">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-20rem] h-[34rem] w-[50rem] -translate-x-1/2 rounded-full bg-teal-400/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-24rem] right-[-10rem] h-[36rem] w-[36rem] rounded-full bg-emerald-500/[0.05] blur-[120px]" />
      </div>

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
