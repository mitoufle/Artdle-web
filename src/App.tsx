import type { JSX } from "react";
import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { resumeTickLoop } from "@/core/tickLoop";
import { TopBar } from "@/components/shell/TopBar";
import { BottomBar } from "@/components/shell/BottomBar";
import { AchievementToast } from "@/components/shell/AchievementToast";
import { TreeRoute } from "@/routes/TreeRoute";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { ConstellationRoute } from "@/routes/ConstellationRoute";
import { AchievementsRoute } from "@/routes/AchievementsRoute";
import { SkillDesignerRoute } from "@/dev/skill-designer/SkillDesignerRoute";
import { SchoolDesignerRoute } from "@/dev/school-designer/SchoolDesignerRoute";
import { AchievementDesignerRoute } from "@/dev/achievement-designer/AchievementDesignerRoute";
import styles from "./App.module.css";

export function App(): JSX.Element {
  const location = useLocation();
  const isDev = location.pathname.startsWith("/dev/");

  // Pair with the pauseTickLoop() in TopBar's NavLink onClick: resume after
  // the new route commits + first paint. This effect fires AFTER React has
  // finished the heavy concurrent render that was previously being preempted
  // by store updates from the tick loop. Pause window is typically 20-200ms.
  // Measured improvement on /painting -> /constellation: 5028ms -> 61ms.
  useEffect(() => {
    resumeTickLoop();
  }, [location.pathname]);

  if (isDev) {
    return (
      <Routes>
        <Route path="/dev/skill-designer" element={<SkillDesignerRoute />} />
        <Route path="/dev/school-designer" element={<SchoolDesignerRoute />} />
        <Route path="/dev/achievement-designer" element={<AchievementDesignerRoute />} />
      </Routes>
    );
  }

  return (
    <div className={styles.app}>
      <TopBar />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/tree" replace />} />
          <Route path="/tree" element={<TreeRoute />} />
          <Route path="/painting" element={<PaintingRoute />} />
          <Route path="/ascension" element={<AscensionRoute />} />
          <Route path="/constellation" element={<ConstellationRoute />} />
          <Route path="/achievements" element={<AchievementsRoute />} />
          <Route path="*" element={<Navigate to="/tree" replace />} />
        </Routes>
      </main>
      <BottomBar />
      <AchievementToast />
    </div>
  );
}
