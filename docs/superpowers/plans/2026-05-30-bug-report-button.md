# Bug Report Button — Implementation Plan

## Overview

Add a **Bug** button to the TopBar that opens a modal. Submitting POSTs a JSON
report to a new Vercel serverless function (`/api/report-bug`), which opens a
**GitHub issue** in `mitoufle/Artdle-web`. Reports include the user's description
plus auto-captured game/browser context. No screenshot.

Design spec: `docs/superpowers/specs/2026-05-30-bug-report-button-design.md`.

## Prerequisites

- Repo builds and tests pass (`npm test`, `npm run build`).
- `SAVE_VERSION` is exported from the store (`@/store` re-exports it, or import
  from its source module — confirm the exact path during Task 2 and use whichever
  the codebase already exposes; `useGameStore` is in `@/store`).
- `big`/`toStr`/`Big` are in `@/core/bigNumber`.
- Node-style serverless functions are supported by the Vercel project (default).

## Conventions reminder

- TDD: write the test, watch it fail, implement, watch it pass, commit.
- `@/` is the alias for `src/`.
- One commit per task step is fine; conventional commit prefixes.
- End every commit message with the Co-Authored-By trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- English only.

---

## Tasks

### Task 1: Pure bug-report core (`src/core/bugReport.ts`)

**Goal:** A deterministic module that builds the report object and formats the
GitHub issue title/body. No React, no DOM, no globals read inside — all inputs
are passed in, so it is fully testable.

**Files:**
- `src/core/bugReport.ts` — new
- `tests/core/bugReport.test.ts` — new

**Step 1: Write the test** — `tests/core/bugReport.test.ts`

```ts
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
  saveVersion: 5,
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
```

**Step 2: Run the test — verify it fails**

```
npm test -- bugReport
```
Expect: module-not-found / import errors.

**Step 3: Implement** — `src/core/bugReport.ts`

```ts
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
```

**Step 4: Run the test — verify it passes**

```
npm test -- bugReport
```

**Step 5: Commit**

```
core: add pure bug-report builder and GitHub issue formatters
```

---

### Task 2: Bug report modal (`BugReportModal`)

**Goal:** The modal UI. Collects the description, reads live game state once at
submit time, builds the report, POSTs to `/api/report-bug`, and shows
idle/submitting/success/error states.

**Files:**
- `src/components/shell/BugReportModal.tsx` — new
- `src/components/shell/BugReportModal.module.css` — new
- `tests/components/shell/BugReportModal.test.tsx` — new

**Step 1: Write the test** — `tests/components/shell/BugReportModal.test.tsx`

Mock the store and `fetch`. Verify: nothing renders when `open=false`; submit is
disabled while the textarea is empty; on submit, `fetch` is called against
`/api/report-bug` with a JSON body containing the description; success state shows
the returned issue URL.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BugReportModal } from "@/components/shell/BugReportModal";

// Minimal store mock — getState() returns the fields the modal reads.
vi.mock("@/store", () => ({
  useGameStore: {
    getState: () => ({
      playerId: "test-player",
      gold: { toString: () => "100" },
      inspiration: { toString: () => "0" },
      fame: { toString: () => "5" },
    }),
  },
  SAVE_VERSION: 5,
}));

describe("BugReportModal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, url: "https://github.com/x/y/issues/1" }),
      })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing when closed", () => {
    const { container } = render(<BugReportModal open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables submit until a description is typed", () => {
    render(<BugReportModal open onClose={() => {}} />);
    const submit = screen.getByRole("button", { name: /submit/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "broken" } });
    expect(submit).not.toBeDisabled();
  });

  it("POSTs the report and shows success", async () => {
    render(<BugReportModal open onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "broken" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/report-bug",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const [, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(opts.body)).toContain("broken");
    await screen.findByText(/issues\/1/);
  });
});
```

> Note: confirm the `@testing-library/jest-dom` matchers (`toBeDisabled`,
> `toBeEmptyDOMElement`) are set up in the test environment. If they are not
> globally imported, either add the import or fall back to plain assertions
> (`expect((submit as HTMLButtonElement).disabled).toBe(true)` and
> `expect(container.childElementCount).toBe(0)`).

**Step 2: Run the test — verify it fails**

```
npm test -- BugReportModal
```

**Step 3: Implement** — `src/components/shell/BugReportModal.tsx`

- Return `null` when `!open` (ExportModal pattern).
- Backdrop `div` with `role="dialog" aria-modal="true"`, close on backdrop click,
  Cancel button, and Escape key.
- `useState` for `description` and `status: "idle" | "submitting" | "success" | "error"`,
  plus `resultUrl`/`errorMsg`.
- On submit:
  ```ts
  const s = useGameStore.getState();
  const context: BugReportContext = {
    timestamp: new Date().toISOString(),
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    mode: import.meta.env.MODE,
    playerId: s.playerId,
    saveVersion: SAVE_VERSION,            // import alongside useGameStore from @/store
    gold: s.gold.toString(),
    inspiration: s.inspiration.toString(),
    fame: s.fame.toString(),
  };
  const report = buildBugReport({ description, context });
  const res = await fetch("/api/report-bug", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: issueTitle(report), body: issueBody(report) }),
  });
  ```
  Set success (read `url` from JSON) / error from the response; on a thrown/network
  error also go to the error state. Keep the typed text on error.
- A collapsible `<details>` "What's included" rendering the context as read-only
  pretty JSON so the user sees exactly what is sent.
- New `.module.css` reusing existing tokens (`--bg-1`, `--gold`, `--mono`,
  `--ink-*`, `--s-*`, `--r-*`); mirror `ExportModal.module.css` structure.

**Step 4: Run the test — verify it passes**

```
npm test -- BugReportModal
```

**Step 5: Commit**

```
ui: add BugReportModal (description + auto-captured context, POST to /api)
```

---

### Task 3: Wire the Bug button into the TopBar

**Goal:** A Bug button in the TopBar `meta` strip that opens the modal.

**Files:**
- `src/components/shell/TopBar.tsx` — edit
- `src/components/shell/TopBar.module.css` — edit

**Step 1 (verification approach):** TopBar has no dedicated unit test we extend
here; verification is the existing suite (`tests/components/shell/TopBar.test.tsx`
if present) still passing, plus the build, plus a manual smoke.

**Step 2: Implement**

- Import `BugReportModal` and a `Bug` icon from `lucide-react` (`useState` is
  already imported).
- Add `const [bugOpen, setBugOpen] = useState(false);`.
- In the `meta` strip (before the `↻ reset` button), add:
  ```tsx
  <button
    type="button"
    className={styles.bugBtn}
    onClick={() => setBugOpen(true)}
    title="Report a bug"
    aria-label="Report a bug"
  >
    <Bug size={12} aria-hidden /> Bug
  </button>
  ```
- After the `</header>` close (as a sibling, wrapped in a fragment), render:
  ```tsx
  <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
  ```
  (Returning a fragment `<>...</>` so the modal is a sibling of the header.)
- Add `.bugBtn` to `TopBar.module.css`, styled like `.resetBtn` but neutral/gold
  rather than red:
  ```css
  .bugBtn {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border: 1px solid var(--ink-line);
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
  }
  .bugBtn:hover {
    border-color: var(--gold);
    color: var(--gold);
  }
  ```

**Step 3: Verify**

```
npm test
npm run build
```
Both must pass (TypeScript strict + existing suite).

**Step 4: Commit**

```
ui(topbar): add Bug button that opens the bug report modal
```

---

### Task 4: Serverless function (`api/report-bug.ts`)

**Goal:** Receive the POST and create a GitHub issue. Token never reaches the
client.

**Files:**
- `api/report-bug.ts` — new
- `.gitignore` — add `bug-reports/` (reserved local scratch folder)

**Step 1: Implement** — `api/report-bug.ts`

Node serverless handler (Vercel `req`/`res` style):

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_BODY = 30_000;
const DEFAULT_REPO = "mitoufle/Artdle-web";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: "Server not configured" });
    return;
  }

  const { title, body } = (req.body ?? {}) as { title?: string; body?: string };
  if (!title || !body) {
    res.status(400).json({ ok: false, error: "Missing title or body" });
    return;
  }
  if (body.length > MAX_BODY || title.length > 200) {
    res.status(413).json({ ok: false, error: "Report too large" });
    return;
  }

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const gh = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "artdle-bug-reporter",
    },
    body: JSON.stringify({ title, body, labels: ["bug", "in-game-report"] }),
  });

  if (!gh.ok) {
    res.status(502).json({ ok: false, error: "Could not create issue" });
    return;
  }
  const issue = (await gh.json()) as { html_url: string };
  res.status(200).json({ ok: true, url: issue.html_url });
}
```

> If `@vercel/node` types are not installed, add it as a devDependency
> (`npm i -D @vercel/node`) for type safety. If that's friction, type `req`/`res`
> as `any` with a short comment and note it in the commit. `req.body` is parsed
> automatically by the Node runtime for JSON content-type.

**Step 2: Verify build**

```
npm run build
```
TypeScript must compile. (The function has no Vitest test per the design — its
pure formatting lives in `src/core/bugReport.ts`, which is tested.)

**Step 3: Commit**

```
feat(api): add /api/report-bug serverless function (creates GitHub issue)
```

---

### Task 5: Documentation + env var note

**Goal:** Record the required env var and the dev-vs-prod behavior so the feature
is operable.

**Files:**
- `docs/HANDOVER.md` — append a short note: the Bug button needs `GITHUB_TOKEN`
  (fine-grained PAT, Issues: read & write on `mitoufle/Artdle-web`) set in Vercel;
  optional `GITHUB_REPO` override; the button only creates issues on the deployed
  site / `vercel dev`, not plain `vite`.

**Step 1: Implement** — add the note.

**Step 2: Commit**

```
docs(handover): document GITHUB_TOKEN env var for bug report button
```

---

## Post-implementation (manual, by maintainer)

1. Create a fine-grained GitHub PAT (Issues: read & write, repo
   `mitoufle/Artdle-web`).
2. `vercel env add GITHUB_TOKEN` (Production + Preview) — or via the dashboard.
3. `npx vercel --prod`.
4. Verify: open the deployed site → Bug button → submit a test report → confirm a
   new issue appears in the repo, then close/delete the test issue.

## Plan review checklist

- [x] Test-first where a test is meaningful (Tasks 1–2); UI wiring and the
      serverless function rely on the existing suite + build + manual smoke
      (Tasks 3–4), which is appropriate for those layers.
- [x] Dependencies ordered: core → modal → wiring → API → docs.
- [x] Exact file paths, signatures, commands, and commit messages given.
- [x] Each task is small and independently reviewable.
