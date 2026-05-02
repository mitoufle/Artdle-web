import type { JSX } from "react";
import { useGameStore } from "@/store";
import { TopBar } from "@/ui/widgets/TopBar";
import { BottomBar } from "@/ui/widgets/BottomBar";
import { InfoPanel } from "@/ui/widgets/InfoPanel";
import { HomeView } from "@/ui/views/HomeView";
import { PaintingView } from "@/ui/views/PaintingView";
import { AscensionView } from "@/ui/views/AscensionView";
import { SkillTreeView } from "@/ui/views/SkillTreeView";

export function App(): JSX.Element {
  const currentView = useGameStore((s) => s.currentView);
  let body: JSX.Element;
  switch (currentView) {
    case "home":
      body = <HomeView />;
      break;
    case "painting":
      body = <PaintingView />;
      break;
    case "ascension":
      body = <AscensionView />;
      break;
    case "skills":
      body = <SkillTreeView />;
      break;
  }
  return (
    <div className="flex h-screen w-screen flex-col bg-app-bg text-app-text">
      <TopBar />
      <main className="flex-1 overflow-auto">{body}</main>
      <InfoPanel />
      <BottomBar />
    </div>
  );
}
