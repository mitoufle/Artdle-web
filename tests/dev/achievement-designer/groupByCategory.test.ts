import { describe, it, expect } from "vitest";
import { groupByCategory } from "@/dev/achievement-designer/groupByCategory";
import type { DesignAchievement, DesignFile } from "@/dev/achievement-designer/types";

function ach(id: string, category: DesignAchievement["category"]): DesignAchievement {
  return {
    id,
    _stableKey: id,
    name: id,
    description: "",
    icon: "",
    category,
    condition: { stat: "x", op: ">=", value: 0 },
    effects: [],
  };
}

describe("groupByCategory", () => {
  it("returns an empty array for empty input", () => {
    expect(groupByCategory([] as DesignFile)).toEqual([]);
  });

  it("returns one group when all achievements share a category", () => {
    const design: DesignFile = [ach("a", "canvas"), ach("b", "canvas"), ach("c", "canvas")];
    const groups = groupByCategory(design);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe("canvas");
    expect(groups[0]!.achievements.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves first-occurrence order of categories", () => {
    const design: DesignFile = [
      ach("a", "canvas"),
      ach("b", "secret"),
      ach("c", "canvas"),
      ach("d", "workshop"),
      ach("e", "secret"),
    ];
    const groups = groupByCategory(design);
    expect(groups.map((g) => g.category)).toEqual(["canvas", "secret", "workshop"]);
  });

  it("preserves flat-array order within each group", () => {
    const design: DesignFile = [
      ach("a", "canvas"),
      ach("b", "secret"),
      ach("c", "canvas"),
      ach("d", "canvas"),
    ];
    const groups = groupByCategory(design);
    expect(groups[0]!.achievements.map((a) => a.id)).toEqual(["a", "c", "d"]);
    expect(groups[1]!.achievements.map((a) => a.id)).toEqual(["b"]);
  });
});
