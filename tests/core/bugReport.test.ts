import { describe, it, expect } from "vitest";
import {
  buildBugReport,
  issueTitle,
  issueBody,
  type BugReportContext,
} from "@/core/bugReport";

const ctx: BugReportContext = {
  timestamp: "2026-05-30T12:00:00.000Z",
  route: "/painting",
  userAgent: "Mozilla/5.0 (Test)",
  viewport: { width: 1280, height: 720 },
  mode: "production",
  playerId: "11111111-1111-4111-8111-111111111111",
  saveVersion: 28,
  gold: "1.23e45",
  inspiration: "0",
  fame: "42",
};

describe("buildBugReport", () => {
  it("trims the description and keeps the context intact", () => {
    const report = buildBugReport({ description: "  it broke  ", context: ctx });
    expect(report.description).toBe("it broke");
    expect(report.context).toEqual(ctx);
  });
});

describe("issueTitle", () => {
  it("prefixes and uses the first line of the description", () => {
    const report = buildBugReport({
      description: "Painting button does nothing\nmore detail here",
      context: ctx,
    });
    expect(issueTitle(report)).toBe("Bug report: Painting button does nothing");
  });

  it("truncates very long titles", () => {
    const long = "x".repeat(200);
    const report = buildBugReport({ description: long, context: ctx });
    const title = issueTitle(report);
    expect(title.length).toBeLessThanOrEqual("Bug report: ".length + 80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back when the description is empty", () => {
    const report = buildBugReport({ description: "   ", context: ctx });
    expect(issueTitle(report)).toBe("Bug report: (no description)");
  });
});

describe("issueBody", () => {
  it("contains the description and a JSON context fence", () => {
    const report = buildBugReport({ description: "it broke", context: ctx });
    const body = issueBody(report);
    expect(body).toContain("it broke");
    expect(body).toContain("```json");
    expect(body).toContain('"route": "/painting"');
    expect(body).toContain('"playerId": "11111111-1111-4111-8111-111111111111"');
  });
});
