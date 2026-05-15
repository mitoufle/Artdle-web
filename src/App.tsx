import type { JSX } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { TopBar } from "@/components/shell/TopBar";
import { BottomBar } from "@/components/shell/BottomBar";
import { InfoPanel } from "@/components/shell/InfoPanel";
import { TreeRoute } from "@/routes/TreeRoute";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { ConstellationRoute } from "@/routes/ConstellationRoute";
import { SkillDesignerRoute } from "@/dev/skill-designer/SkillDesignerRoute";
import { SchoolDesignerRoute } from "@/dev/school-designer/SchoolDesignerRoute";
import styles from "./App.module.css";

export function App(): JSX.Element {
  const location = useLocation();
  const isDev = location.pathname.startsWith("/dev/");

  if (isDev) {
    return (
      <Routes>
        <Route path="/dev/skill-designer" element={<SkillDesignerRoute />} />
        <Route path="/dev/school-designer" element={<SchoolDesignerRoute />} />
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
          <Route path="*" element={<Navigate to="/tree" replace />} />
        </Routes>
      </main>
      <InfoPanel />
      <BottomBar />
    </div>
  );
}
