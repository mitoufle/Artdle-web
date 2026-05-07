import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeCard } from "@/components/constellation/NodeCard";
import { useGameStore } from "@/store";

describe("NodeCard hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
    });
  });

  it("hover on Acquire (not owned, affordable) shows 'Acquire {name}' title and cost/description body", () => {
    render(
      <NodeCard
        nodeId="get_inspired" name="Get Inspired"
        description="each level increase inspiration gain by 25%"
        numericEffect="25%"
        currentLevel={0} maxLevel={5} nextCost={1}
        prereqMet={true} affordable={true}
        onAcquire={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("node-acquire-get_inspired"));
    expect(useGameStore.getState().hoverTitle).toBe("Acquire Get Inspired");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Cost: 1 fame/);
    expect(container.textContent).toMatch(/Level: 0 \/ 5/);
    expect(container.textContent).toMatch(/each level increase inspiration gain by 25%/);
    expect(String(useGameStore.getState().hoverFooter)).toBe("25%");
  });

  it("hover on Upgrade (already owned) shows 'Upgrade {name}' title", () => {
    render(
      <NodeCard
        nodeId="get_inspired" name="Get Inspired"
        description="..."
        numericEffect="25%"
        currentLevel={2} maxLevel={5} nextCost={10}
        prereqMet={true} affordable={true}
        onAcquire={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("node-acquire-get_inspired"));
    expect(useGameStore.getState().hoverTitle).toBe("Upgrade Get Inspired");
  });

  it("hover on Maxed shows '(Maxed)' title and the maxed body", () => {
    render(
      <NodeCard
        nodeId="rainbow" name="Rainbow"
        description="..."
        numericEffect="50%"
        currentLevel={1} maxLevel={1} nextCost={null}
        prereqMet={true} affordable={false}
        onAcquire={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("node-acquire-rainbow"));
    expect(useGameStore.getState().hoverTitle).toBe("Rainbow (Maxed)");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/fully upgraded/);
  });

  it("hover when prereq is locked appends 'Locked: prerequisites not met.'", () => {
    render(
      <NodeCard
        nodeId="rainbow" name="Rainbow"
        description="canvas sell price 50%"
        numericEffect="50%"
        currentLevel={0} maxLevel={1} nextCost={100}
        prereqMet={false} affordable={true}
        onAcquire={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("node-acquire-rainbow"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Locked: prerequisites not met/);
  });

  it("hover when prereq met but unaffordable appends 'Need more fame.'", () => {
    render(
      <NodeCard
        nodeId="rainbow" name="Rainbow"
        description="canvas sell price 50%"
        numericEffect="50%"
        currentLevel={0} maxLevel={1} nextCost={100}
        prereqMet={true} affordable={false}
        onAcquire={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("node-acquire-rainbow"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Need more fame/);
  });
});
