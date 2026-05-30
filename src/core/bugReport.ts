export interface BugReportContext {
  timestamp: string;
  route: string;
  userAgent: string;
  viewport: { width: number; height: number };
  mode: string;
  playerId: string;
  saveVersion: number;
  gold: string;
  inspiration: string;
  fame: string;
}

export interface BugReport {
  description: string;
  context: BugReportContext;
}

const TITLE_PREFIX = "Bug report: ";
const TITLE_MAX = 80;

export function buildBugReport(input: {
  description: string;
  context: BugReportContext;
}): BugReport {
  return {
    description: input.description.trim(),
    context: input.context,
  };
}

export function issueTitle(report: BugReport): string {
  const firstLine = report.description.split("\n")[0]?.trim() ?? "";
  const summary =
    firstLine.length > TITLE_MAX ? `${firstLine.slice(0, TITLE_MAX - 1)}…` : firstLine;
  return `${TITLE_PREFIX}${summary || "(no description)"}`;
}

export function issueBody(report: BugReport): string {
  const context = JSON.stringify(report.context, null, 2);
  return [
    report.description || "(no description)",
    "",
    "---",
    "",
    "### Context",
    "",
    "```json",
    context,
    "```",
  ].join("\n");
}
