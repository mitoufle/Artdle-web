import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { EquippedItemsOverlay } from "@/components/painting/EquippedItemsOverlay";
import { getItemSpriteStyle } from "@/components/painting/itemSprites";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import type { Item } from "@/store/workshopSlice";

const brush = (over: Partial<Item> = {}): Item => ({
  id: "b1", slot: "brush", tier: "legendary",
  affixes: [{ kind: "+sell_price%", magnitude: 50 }],
  fuseCount: 0,
  ...over,
});

beforeEach(() => {
  useGameStore.setState({
    gold: big(0),
    inventory: [],
    equipped: {},
    workshopLevel: 1,
    purchasedNodes: {},
  });
});

const slot = (container: HTMLElement, name: string): HTMLElement =>
  container.querySelector(`[data-slot="${name}"]`) as HTMLElement;

describe("getItemSpriteStyle", () => {
  it("maps each slot to its grid cell position with a 300% 200% sprite size", () => {
    expect(getItemSpriteStyle("brush", "normal").backgroundPosition).toBe("50% 0%");
    expect(getItemSpriteStyle("palette", "normal").backgroundPosition).toBe("0% 0%");
    expect(getItemSpriteStyle("easel", "normal").backgroundPosition).toBe("100% 0%");
    expect(getItemSpriteStyle("apron", "normal").backgroundPosition).toBe("0% 100%");
    expect(getItemSpriteStyle("hat", "normal").backgroundPosition).toBe("50% 100%");
    expect(getItemSpriteStyle("boots", "normal").backgroundPosition).toBe("100% 100%");
    expect(getItemSpriteStyle("brush", "normal").backgroundSize).toBe("300% 200%");
  });

  it("uses a different sheet per tier", () => {
    const a = getItemSpriteStyle("brush", "normal").backgroundImage;
    const b = getItemSpriteStyle("brush", "legendary").backgroundImage;
    expect(a).not.toBe(b);
  });
});

describe("<EquippedItemsOverlay />", () => {
  it("renders all six slots, three per side", () => {
    const { container } = render(<EquippedItemsOverlay />);
    for (const s of ["brush", "palette", "easel", "hat", "apron", "boots"]) {
      expect(slot(container, s)).toBeInTheDocument();
    }
  });

  it("brush is unlocked-but-empty by default; the rest are locked", () => {
    const { container } = render(<EquippedItemsOverlay />);
    expect(slot(container, "brush")).toHaveAttribute("data-state", "empty");
    for (const s of ["palette", "easel", "hat", "apron", "boots"]) {
      expect(slot(container, s)).toHaveAttribute("data-state", "locked");
    }
  });

  it("shows an equipped item's tier on its slot", () => {
    useGameStore.setState({ equipped: { brush: brush({ tier: "epic" }) } });
    const { container } = render(<EquippedItemsOverlay />);
    const brushSlot = slot(container, "brush");
    expect(brushSlot).toHaveAttribute("data-state", "equipped");
    expect(brushSlot).toHaveAttribute("data-tier", "epic");
  });

  it("marks a slot fusable when an affordable fusion-ready candidate exists", () => {
    const equippedBrush = brush({ id: "eq", tier: "legendary" });
    const dropBrush = brush({ id: "drop", tier: "legendary" });
    useGameStore.setState({
      equipped: { brush: equippedBrush },
      inventory: [dropBrush],
      gold: big(1_000_000_000),
      workshopLevel: 1,
    });
    const { container } = render(<EquippedItemsOverlay />);
    expect(slot(container, "brush")).toHaveAttribute("data-fusable", "true");
  });

  it("does not mark fusable when gold can't cover the fuse cost", () => {
    useGameStore.setState({
      equipped: { brush: brush({ id: "eq" }) },
      inventory: [brush({ id: "drop" })],
      gold: big(0),
    });
    const { container } = render(<EquippedItemsOverlay />);
    expect(slot(container, "brush")).toHaveAttribute("data-fusable", "false");
  });
});
