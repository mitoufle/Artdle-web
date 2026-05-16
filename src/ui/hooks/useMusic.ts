import { useEffect, useRef, useState } from "react";

const SRC = "/assets/music/ambient.mp3";
const KEY_VOL = "artdle-music-volume";
const KEY_MUTED = "artdle-music-muted";

function loadVolume(): number {
  const v = parseFloat(localStorage.getItem(KEY_VOL) ?? "0.2");
  return isNaN(v) ? 0.2 : Math.max(0, Math.min(1, v));
}

function loadMuted(): boolean {
  return localStorage.getItem(KEY_MUTED) === "true";
}

export interface MusicControls {
  volume: number;
  muted: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
}

export function useMusic(): MusicControls {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolumeState] = useState(loadVolume);
  const [muted, setMutedState] = useState(loadMuted);

  useEffect(() => {
    const audio = new Audio(SRC);
    audio.loop = true;
    audio.volume = loadVolume();
    audio.muted = loadMuted();
    audioRef.current = audio;

    const start = () => audio.play().catch(() => {});

    audio.play().catch(() => {
      // Blocked by autoplay policy — start on first user gesture
      const onGesture = () => {
        start();
        document.removeEventListener("click", onGesture);
        document.removeEventListener("keydown", onGesture);
      };
      document.addEventListener("click", onGesture, { once: true });
      document.addEventListener("keydown", onGesture, { once: true });
    });

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(KEY_VOL, String(volume));
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    localStorage.setItem(KEY_MUTED, String(muted));
  }, [muted]);

  const setVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (clamped > 0 && muted) setMutedState(false);
  };

  const toggleMute = () => setMutedState((m) => !m);

  return { volume, muted, setVolume, toggleMute };
}
