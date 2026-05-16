import type { JSX } from "react";
import type { MusicControls } from "@/ui/hooks/useMusic";
import styles from "./MusicControls.module.css";

interface Props {
  controls: MusicControls;
}

export function MusicControls({ controls }: Props): JSX.Element {
  const { volume, muted, setVolume, toggleMute } = controls;
  const displayVolume = muted ? 0 : volume;

  const icon = muted || volume === 0 ? "♪×" : volume < 0.5 ? "♪" : "♫";

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`${styles.muteBtn}${muted ? ` ${styles.mutedState}` : ""}`}
        onClick={toggleMute}
        title={muted ? "Unmute music" : "Mute music"}
        aria-label={muted ? "Unmute music" : "Mute music"}
      >
        {icon}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={displayVolume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className={styles.slider}
        aria-label="Music volume"
      />
    </div>
  );
}
