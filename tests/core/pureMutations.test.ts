import { describe, expect, it } from "vitest";
import { addCurrency, spendCurrency } from "@/core/pureMutations";
import { big } from "@/core/bigNumber";

describe("addCurrency", () => {
  it("adds positive amount", () => {
    const draft = { gold: big(10), inspiration: big(0), fame: big(0) } as any;
    addCurrency(draft, "gold", big(5));
    expect(draft.gold.toNumber()).toBe(15);
  });
  it("refuses negative", () => {
    const draft = { gold: big(10) } as any;
    addCurrency(draft, "gold", big(-5));
    expect(draft.gold.toNumber()).toBe(10);
  });
});

describe("spendCurrency", () => {
  it("subtracts and returns true on sufficient", () => {
    const draft = { gold: big(10) } as any;
    expect(spendCurrency(draft, "gold", big(3))).toBe(true);
    expect(draft.gold.toNumber()).toBe(7);
  });
  it("returns false and leaves balance on insufficient", () => {
    const draft = { gold: big(2) } as any;
    expect(spendCurrency(draft, "gold", big(5))).toBe(false);
    expect(draft.gold.toNumber()).toBe(2);
  });
});
