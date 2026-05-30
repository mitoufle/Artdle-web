import { useEffect, useRef } from "react";
import { useGameStore } from "@/store";
import soldSfx from "@/assets/sounds/Canvas_sold.mp3";

// Shared with the music mute toggle (no separate SFX control).
const KEY_MUTED = "artdle-music-muted";
// Web Audio gain — can exceed 1.0 to amplify a quietly-recorded clip above the
// HTMLAudioElement ceiling so the short sale cue cuts through the music.
const SFX_GAIN = 4;

type AudioCtor = typeof AudioContext;

/**
 * Plays the canvas-sold sound whenever a canvas sells (`statsRun.canvasesSold`
 * increments), amplified through a Web Audio GainNode (gain > 1) so it's clearly
 * audible over the ambient track. Renders nothing. Respects the music mute.
 * Self-subscribes to the sale counter so only this leaf re-renders on a sale.
 */
export function CanvasSoldSfx(): null {
  const canvasesSold = useGameStore((s) => s.statsRun.canvasesSold);
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const prevRef = useRef(canvasesSold);

  useEffect(() => {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return; // no Web Audio (e.g. jsdom) — silently no-op
    const ctx = new Ctor();
    ctxRef.current = ctx;

    // Browsers start the context suspended until a user gesture; resume on the
    // first interaction so it's running by the time a sale fires.
    const resume = (): void => {
      void ctx.resume();
    };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);

    let cancelled = false;
    fetch(soldSfx)
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        if (!cancelled) bufferRef.current = decoded;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
      void ctx.close();
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = canvasesSold;
    if (canvasesSold <= prev) return; // no new sale (or reset to 0 on ascend)
    if (localStorage.getItem(KEY_MUTED) === "true") return;
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;
    if (ctx.state === "suspended") void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = SFX_GAIN;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }, [canvasesSold]);

  return null;
}
