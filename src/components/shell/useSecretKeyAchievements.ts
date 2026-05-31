import { useEffect } from "react";
import { useGameStore } from "@/store";

/**
 * Global keydown listener for secret key-triggered achievements. Pressing "F"
 * (no modifier, not while typing in a field) unlocks Pay Respect.
 *
 * `enabled` is false on /dev/* routes so the listener never fires while the
 * designer tools' text inputs are in use. The input-focus guard is a second
 * line of defense for the game's own inputs (e.g. the bug-report textarea).
 */
export function useSecretKeyAchievements(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      const s = useGameStore.getState();
      s.incrementStat("lifetime", "fPresses", 1);
      s.evaluateAchievements();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
