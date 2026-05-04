import type { JSX } from "react";
import { Hammer, User, GraduationCap, FlaskConical } from "lucide-react";
import styles from "./RoomRail.module.css";

interface RoomDef {
  id: "workshop" | "office" | "school" | "lab";
  label: string;
  Icon: typeof Hammer;
  active: boolean;
  enabled: boolean;
}

const ROOMS: ReadonlyArray<RoomDef> = [
  { id: "workshop", label: "Workshop", Icon: Hammer,        active: true,  enabled: true  },
  { id: "office",   label: "Office",   Icon: User,          active: false, enabled: false },
  { id: "school",   label: "School",   Icon: GraduationCap, active: false, enabled: false },
  { id: "lab",      label: "Lab",      Icon: FlaskConical,  active: false, enabled: false },
];

/**
 * 64px-wide vertical room rail. Workshop is the only active and enabled
 * room in v2.0; Office/School/Lab tabs are visible-but-disabled with
 * "Coming soon" title attribute.
 *
 * Future waves will: (a) take an `activeRoom` prop + `onSelect` callback,
 * (b) enable Office/School/Lab one wave at a time as their content ships.
 */
export function RoomRail(): JSX.Element {
  return (
    <nav className={styles.rail} role="tablist" aria-label="Rooms" aria-orientation="vertical">
      {ROOMS.map(({ id, label, Icon, active, enabled }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active ? "true" : "false"}
          aria-label={label}
          disabled={!enabled}
          title={enabled ? label : `${label} — coming soon`}
          className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          data-room={id}
        >
          <Icon size={20} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
