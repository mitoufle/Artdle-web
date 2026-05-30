import { useEffect, useRef } from "react";
import { useGameStore } from "@/store";
import soldSfx from "@/assets/sounds/Canvas_sold.mp3";

// Reuse the music settings — there is no separate SFX control, so the existing
// mute/volume toggle governs this sound too.
const KEY_VOL = "artdle-music-volume";
const KEY_MUTED = "artdle-music-muted";

/**
 * Plays the canvas-sold sound whenever a canvas sells (`statsRun.canvasesSold`
 * increments). Renders nothing. One play per tick-batch; the single Audio
 * element restarts on rapid sales rather than overlapping. Respects the music
 * mute + volume. Self-subscribes to the sale counter so only this leaf
 * re-renders on a sale, not the whole app shell.
 */
export function CanvasSoldSfx(): null {
  const canvasesSold = useGameStore((s) => s.statsRun.canvasesSold);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevRef = useRef(canvasesSold);

  useEffect(() => {
    const audio = new Audio(soldSfx);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = canvasesSold;
    if (canvasesSold <= prev) return; // no new sale (or reset to 0 on ascend)
    if (localStorage.getItem(KEY_MUTED) === "true") return;
    const audio = audioRef.current;
    if (!audio) return;
    const v = parseFloat(localStorage.getItem(KEY_VOL) ?? "0.2");
    audio.volume = Number.isNaN(v) ? 0.2 : Math.max(0, Math.min(1, v));
    try {
      audio.currentTime = 0;
    } catch {
      /* currentTime can throw before the clip is seekable; ignore */
    }
    void audio.play().catch(() => {});
  }, [canvasesSold]);

  return null;
}
