import { useEffect, useRef } from "react";
import { useGameStore } from "@/store";
import soldSfx from "@/assets/sounds/Canvas_sold.mp3";

// Shared with the music controls (no separate SFX control), so the volume
// slider AND the mute button both govern this sound.
const KEY_VOL = "artdle-music-volume";
const KEY_MUTED = "artdle-music-muted";
// gain = volume × BOOST, capped. At the default slider (0.2) that's ~1.0 (unity);
// the slider still scales it down to silence at 0.
const SFX_BOOST = 5;
const SFX_MAX_GAIN = 3;

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
    if (localStorage.getItem(KEY_MUTED) === "true") return; // mute button
    const raw = parseFloat(localStorage.getItem(KEY_VOL) ?? "0.2");
    const volume = Number.isNaN(raw) ? 0.2 : Math.max(0, Math.min(1, raw));
    if (volume <= 0) return; // volume slider at zero → silent
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;
    if (ctx.state === "suspended") void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(SFX_MAX_GAIN, volume * SFX_BOOST);
    src.connect(gain).connect(ctx.destination);
    src.start();
  }, [canvasesSold]);

  return null;
}
