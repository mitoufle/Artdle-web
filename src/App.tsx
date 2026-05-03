import type { JSX } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { TopBar } from "@/components/shell/TopBar";
import { BottomBar } from "@/components/shell/BottomBar";
import { InfoPanel } from "@/components/shell/InfoPanel";
import { TreeRoute } from "@/routes/TreeRoute";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { ConstellationRoute } from "@/routes/ConstellationRoute";
import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";
import styles from "./App.module.css";

export function App(): JSX.Element {
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
        <WorkshopPopup />
      </main>
      <InfoPanel />
      <BottomBar />
    </div>
  );
}
