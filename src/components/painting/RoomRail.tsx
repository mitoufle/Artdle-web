import type { JSX } from "react";
import { Hammer, User, GraduationCap, FlaskConical } from "lucide-react";
import { useGameStore } from "@/store";
import { getRosterCap } from "@/store/officeSlice";
import styles from "./RoomRail.module.css";

export type RoomId = "workshop" | "office" | "school" | "lab";

interface RoomDef {
  id: RoomId;
  label: string;
  Icon: typeof Hammer;
}

const ROOMS: ReadonlyArray<RoomDef> = [
  { id: "workshop", label: "Workshop", Icon: Hammer        },
  { id: "office",   label: "Office",   Icon: User          },
  { id: "school",   label: "School",   Icon: GraduationCap },
  { id: "lab",      label: "Lab",      Icon: FlaskConical  },
];

interface Props {
  readonly activeRoom: RoomId;
  readonly onSelect: (room: RoomId) => void;
}

export function RoomRail({ activeRoom, onSelect }: Props): JSX.Element {
  const officeEnabled = useGameStore((s) => getRosterCap(s) >= 1);

  return (
    <nav className={styles.rail} role="tablist" aria-label="Rooms" aria-orientation="vertical">
      {ROOMS.map(({ id, label, Icon }) => {
        const enabled = id === "workshop" || (id === "office" && officeEnabled);
        const active = activeRoom === id;
        return (
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
            onClick={() => enabled && onSelect(id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
