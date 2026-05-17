import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";
import type { Item } from "@/store/workshopSlice";

const sampleBrush: Item = {
  id: "test-brush-1",
  slot: "brush",
  tier: "magic",
  affixes: [
    { kind: "+sell_price%", magnitude: 12 },
    { kind: "+speed%", magnitude: 8 },
  ],
  fuseCount: 0,
};

beforeEach(() => {
  useGameStore.setState({
    gold: big(0),
    inventory: [],
    equipped: {},
    workshopLevel: 1,
    workshopXp: 0,
    purchasedNodes: {},
  });
  setSeed(42);
});

describe("<WorkshopRoom />", () => {
  it("renders the workshop level header (Lv 1)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByText(/Lv\s*1/i)).toBeInTheDocument();
  });

  it("renders the XP progress (0 / 8 at L1)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByText(/0\s*\/\s*8/)).toBeInTheDocument();
  });

  it("renders craft button with current cost (100g at L1)", () => {
    render(<WorkshopRoom />);
    const btn = screen.getByTestId("craft-button");
    expect(btn).toHaveTextContent(/100/);
  });

  it("craft button disabled when gold insufficient", () => {
    useGameStore.setState({ gold: big(50) });
    render(<WorkshopRoom />);
    expect(screen.getByTestId("craft-button")).toBeDisabled();
  });

  it("craft button enabled when gold sufficient and inventory not full", () => {
    useGameStore.setState({ gold: big(200) });
    render(<WorkshopRoom />);
    expect(screen.getByTestId("craft-button")).not.toBeDisabled();
  });

  it("clicking craft adds an item to inventory", () => {
    useGameStore.setState({ gold: big(200) });
    render(<WorkshopRoom />);
    fireEvent.pointerDown(screen.getByTestId("craft-button"));
    expect(useGameStore.getState().inventory.length).toBe(1);
  });

  it("inventory item card shows tier label + slot kind badge + affix list", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    const equip = screen.getByTestId(`inventory-equip-${sampleBrush.id}`);
    expect(equip).toHaveTextContent(/magic/i);
    expect(equip).toHaveTextContent(/brush/i);
    expect(equip).toHaveTextContent("$12%");
    expect(equip).toHaveTextContent("»8%");
  });

  it("inventory item has data-tier matching its tier", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    expect(screen.getByTestId(`inventory-equip-${sampleBrush.id}`)).toHaveAttribute("data-tier", "magic");
  });

  it("equipped panel shows one row per unlocked slot kind (only 'brush' default)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByTestId("slot-brush")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-palette")).not.toBeInTheDocument();
  });

  it("equipped panel shows palette slot when gear_up purchased", () => {
    useGameStore.setState({ purchasedNodes: { gear_up: 1 } });
    render(<WorkshopRoom />);
    expect(screen.getByTestId("slot-palette")).toBeInTheDocument();
  });

  it("clicking an inventory item with matching slot equips it", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByTestId(`inventory-equip-${sampleBrush.id}`));
    expect(useGameStore.getState().equipped.brush?.id).toBe(sampleBrush.id);
  });

  it("clicking an equipped slot unequips that slot", () => {
    useGameStore.setState({ equipped: { brush: sampleBrush } });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByTestId("slot-unequip-brush"));
    expect(useGameStore.getState().equipped.brush).toBeUndefined();
  });

  it("right-clicking an inventory item discards it", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    fireEvent.contextMenu(screen.getByTestId(`inventory-equip-${sampleBrush.id}`));
    expect(useGameStore.getState().inventory).toEqual([]);
  });
});
