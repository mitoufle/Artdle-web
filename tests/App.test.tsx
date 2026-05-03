import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { TreeRoute } from "@/routes/TreeRoute";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { ConstellationRoute } from "@/routes/ConstellationRoute";

function renderRoutesAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tree" element={<TreeRoute />} />
        <Route path="/painting" element={<PaintingRoute />} />
        <Route path="/ascension" element={<AscensionRoute />} />
        <Route path="/constellation" element={<ConstellationRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Routes (smoke tests)", () => {
  it("/tree renders without crashing", () => {
    expect(() => renderRoutesAt("/tree")).not.toThrow();
  });

  it("/painting renders without crashing", () => {
    expect(() => renderRoutesAt("/painting")).not.toThrow();
  });

  it("/ascension renders without crashing", () => {
    expect(() => renderRoutesAt("/ascension")).not.toThrow();
  });

  it("/constellation renders without crashing", () => {
    expect(() => renderRoutesAt("/constellation")).not.toThrow();
  });
});
