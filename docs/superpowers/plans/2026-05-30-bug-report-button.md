# Bug Report Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bug button to the TopBar that opens a modal whose submission creates a GitHub issue in `mitoufle/Artdle-web` via a Vercel serverless function, including auto-captured game/browser context.

**Architecture:** Three isolated layers — a pure formatter (`src/core/bugReport.ts`), a modal UI (`BugReportModal`), and a serverless function (`api/report-bug.ts`) that holds the GitHub token. The browser POSTs `{ title, body }`; the function calls the GitHub REST API. No screenshot.

**Tech Stack:** React 19 + TS strict, Zustand (read once via `getState`), Vitest + React Testing Library, Vercel Node serverless function, GitHub REST API via `fetch`.

Design spec: `docs/superpowers/specs/2026-05-30-bug-report-button-design.md`.

---

## Notes for the implementer (verified facts)

- `useGameStore` is exported from `@/store` (`src/store/index.ts`).
- `SAVE_VERSION` is currently `const SAVE_VERSION = 28;` in `src/store/index.ts` and is **NOT exported** — Task 2 adds an `export` so the modal can read it.
- jest-dom matchers (`toBeDisabled`, `toBeInTheDocument`, `toBeEmptyDOMElement`) are available in the Vitest environment (used across `tests/components/**`).
- `vite.config.ts` already registers dev-only middleware for `/api/skill-design` and `/api/school-design`. Those are **dev-server** writers; our `api/report-bug.ts` is a real Vercel serverless function for production. Do not confuse the two — `/api/report-bug` is NOT added to `vite.config.ts`, so it will not work under plain `vite` (expected; see spec).
- `@/` is the alias for `src/`. English only. Conventional commits.
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 1: Pure bug-report core

**Files:**
- Create: `src/core/bugReport.ts`
- Test: `tests/core/bugReport.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/core/bugReport.test.ts`

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- bugReport`
Expected: FAIL — cannot resolve `@/core/bugReport`.

- [ ] **Step 3: Write the implementation** — `src/core/bugReport.ts`

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- bugReport`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/bugReport.ts tests/core/bugReport.test.ts
git commit -m "core: add pure bug-report builder and GitHub issue formatters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Export SAVE_VERSION from the store

**Files:**
- Modify: `src/store/index.ts:44`

This is a one-line change so the modal can stamp the save version into the report.

- [ ] **Step 1: Make the constant exported** — `src/store/index.ts`

Change line 44 from:

```ts
const SAVE_VERSION = 28;
```

to:

```ts
export const SAVE_VERSION = 28;
```

(Leave the existing `version: SAVE_VERSION` usage untouched.)

- [ ] **Step 2: Verify the build still compiles**

Run: `npm run build`
Expected: PASS (no type errors; this is an additive export).

- [ ] **Step 3: Commit**

```bash
git add src/store/index.ts
git commit -m "store: export SAVE_VERSION for use in bug reports

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Bug report modal

**Files:**
- Create: `src/components/shell/BugReportModal.tsx`
- Create: `src/components/shell/BugReportModal.module.css`
- Test: `tests/components/shell/BugReportModal.test.tsx`

- [ ] **Step 1: Write the failing test** — `tests/components/shell/BugReportModal.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BugReportModal } from "@/components/shell/BugReportModal";

vi.mock("@/store", () => ({
  useGameStore: {
    getState: () => ({
      playerId: "test-player",
      gold: { toString: () => "100" },
      inspiration: { toString: () => "0" },
      fame: { toString: () => "5" },
    }),
  },
  SAVE_VERSION: 28,
}));

describe("<BugReportModal />", () => {
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

  it("shows an error state and keeps the text when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, error: "nope" }) })),
    );
    render(<BugReportModal open onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "broken" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText(/couldn.t submit|error/i);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("broken");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- BugReportModal`
Expected: FAIL — cannot resolve `@/components/shell/BugReportModal`.

- [ ] **Step 3: Write the implementation** — `src/components/shell/BugReportModal.tsx`

```tsx
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useGameStore, SAVE_VERSION } from "@/store";
import {
  buildBugReport,
  issueBody,
  issueTitle,
  type BugReportContext,
} from "@/core/bugReport";
import styles from "./BugReportModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "submitting" | "success" | "error";

function captureContext(): BugReportContext {
  const s = useGameStore.getState();
  return {
    timestamp: new Date().toISOString(),
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    mode: import.meta.env.MODE,
    playerId: s.playerId,
    saveVersion: SAVE_VERSION,
    gold: s.gold.toString(),
    inspiration: s.inspiration.toString(),
    fame: s.fame.toString(),
  };
}

export function BugReportModal({ open, onClose }: Props): JSX.Element | null {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset transient state whenever the modal is freshly opened.
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setResultUrl(null);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = description.trim().length > 0 && status !== "submitting";

  async function handleSubmit(): Promise<void> {
    setStatus("submitting");
    try {
      const report = buildBugReport({ description, context: captureContext() });
      const res = await fetch("/api/report-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: issueTitle(report), body: issueBody(report) }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (res.ok && data.ok && data.url) {
        setResultUrl(data.url);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Report a bug"
      onClick={onClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Report a bug</h3>

        {status === "success" ? (
          <div className={styles.successBox}>
            <p>Thanks! Your report was submitted.</p>
            {resultUrl && (
              <a href={resultUrl} target="_blank" rel="noreferrer" className={styles.link}>
                {resultUrl}
              </a>
            )}
            <div className={styles.footer}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className={styles.label}>
              <span className={styles.labelText}>What went wrong?</span>
              <textarea
                className={styles.textarea}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the bug and what you were doing…"
                autoFocus
              />
            </label>

            <details className={styles.details}>
              <summary className={styles.summary}>What's included</summary>
              <pre className={styles.context}>
                {JSON.stringify(captureContext(), null, 2)}
              </pre>
            </details>

            {status === "error" && (
              <p className={styles.error}>Couldn&apos;t submit — please try again.</p>
            )}

            <div className={styles.footer}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
              >
                {status === "submitting" ? "Submitting…" : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the styles** — `src/components/shell/BugReportModal.module.css`

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  border: 2px solid var(--gold);
  border-radius: var(--r-md);
  background: var(--bg-1);
  box-shadow: var(--shadow-card);
}

.title {
  margin: 0;
  font-family: var(--serif);
  font-size: 18px;
  color: var(--gold);
}

.label {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
}

.labelText {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--ink-3);
}

.textarea {
  font-family: var(--sans, inherit);
  font-size: 13px;
  width: 100%;
  padding: var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-1);
  resize: vertical;
}

.details {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}

.summary {
  cursor: pointer;
  text-transform: uppercase;
}

.context {
  margin: var(--s-2) 0 0;
  padding: var(--s-2);
  max-height: 180px;
  overflow: auto;
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.error {
  margin: 0;
  font-family: var(--mono);
  font-size: 11px;
  color: #c44;
}

.successBox {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-1);
}

.link {
  color: var(--gold);
  word-break: break-all;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-2);
}

.primaryBtn {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  padding: var(--s-1) var(--s-3);
  border: 1px solid var(--gold);
  border-radius: var(--r-sm);
  background: var(--gold);
  color: var(--bg-1);
  cursor: pointer;
}

.primaryBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondaryBtn {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  padding: var(--s-1) var(--s-3);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-2);
  cursor: pointer;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- BugReportModal`
Expected: PASS (all four cases).

> If the success/error test can't find text because of how `fetch` is mocked,
> double-check the mock returns an object with both `ok` and a `json()` resolving
> to `{ ok, url }` — the component requires `res.ok && data.ok && data.url`.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/BugReportModal.tsx src/components/shell/BugReportModal.module.css tests/components/shell/BugReportModal.test.tsx
git commit -m "ui: add BugReportModal (description + auto-captured context, POST to /api)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire the Bug button into the TopBar

**Files:**
- Modify: `src/components/shell/TopBar.tsx`
- Modify: `src/components/shell/TopBar.module.css`

- [ ] **Step 1: Add imports** — `src/components/shell/TopBar.tsx`

After the existing imports, add:

```tsx
import { Bug } from "lucide-react";
import { BugReportModal } from "./BugReportModal";
```

- [ ] **Step 2: Add modal open state** — inside `TopBar`, near the other `useState`:

```tsx
const [bugOpen, setBugOpen] = useState(false);
```

- [ ] **Step 3: Add the button to the meta strip**

In the `<div className={styles.meta}>` block, immediately before the
`{confirming ? (` expression (i.e. before the reset/confirm controls), insert:

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

- [ ] **Step 4: Render the modal as a sibling of the header**

Wrap the returned `<header>…</header>` in a fragment and add the modal after it:

```tsx
return (
  <>
    <header className={styles.bar}>
      {/* …unchanged header contents… */}
    </header>
    <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
  </>
);
```

- [ ] **Step 5: Add the button style** — append to `src/components/shell/TopBar.module.css`

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

- [ ] **Step 6: Verify the full suite and build**

Run: `npm test`
Expected: PASS (existing TopBar test, if any, still green).
Run: `npm run build`
Expected: PASS (TypeScript strict).

- [ ] **Step 7: Commit**

```bash
git add src/components/shell/TopBar.tsx src/components/shell/TopBar.module.css
git commit -m "ui(topbar): add Bug button that opens the bug report modal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Serverless function (creates the GitHub issue)

**Files:**
- Create: `api/report-bug.ts`
- Modify: `.gitignore` (add `bug-reports/` scratch folder line)
- Optional: `package.json` devDependency `@vercel/node` (for types)

- [ ] **Step 1: Add `@vercel/node` for types (recommended)**

Run: `npm i -D @vercel/node`

> If you prefer not to add a dep, skip this and in Step 2 type `req`/`res` as
> `any` with a `// eslint-disable-next-line` comment and note it in the commit.

- [ ] **Step 2: Write the function** — `api/report-bug.ts`

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_BODY = 30_000;
const MAX_TITLE = 200;
const DEFAULT_REPO = "mitoufle/Artdle-web";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
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
  if (body.length > MAX_BODY || title.length > MAX_TITLE) {
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

- [ ] **Step 3: Add the scratch folder to `.gitignore`**

Append a line to `.gitignore`:

```
bug-reports/
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: PASS. (The serverless function has no Vitest test by design — its pure
formatting logic lives in `src/core/bugReport.ts`, which is tested. If `tsc -b`
does not include `api/`, the file is still validated by Vercel at deploy; do a
quick `npx tsc --noEmit api/report-bug.ts` if you want local assurance.)

- [ ] **Step 5: Commit**

```bash
git add api/report-bug.ts .gitignore package.json package-lock.json
git commit -m "feat(api): add /api/report-bug serverless function (creates GitHub issue)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Document the env var and dev/prod behavior

**Files:**
- Modify: `docs/HANDOVER.md`

- [ ] **Step 1: Append a short operations note** to `docs/HANDOVER.md`

```markdown
## Bug Report button

The TopBar "Bug" button opens a modal that POSTs to `/api/report-bug`, a Vercel
serverless function that creates a GitHub issue in `mitoufle/Artdle-web`.

- Requires env var **`GITHUB_TOKEN`** — a fine-grained PAT with *Issues: Read and
  write* on `mitoufle/Artdle-web`. Set in Vercel (Production + Preview).
- Optional **`GITHUB_REPO`** overrides the target repo (default
  `mitoufle/Artdle-web`).
- Works on the deployed site and under `vercel dev` only — plain `vite` does not
  run `/api` functions, so the button shows its error state in local dev.
```

- [ ] **Step 2: Commit**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): document GITHUB_TOKEN env var for bug report button

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Post-implementation (manual, by maintainer)

1. Create a fine-grained GitHub PAT (Issues: read & write on `mitoufle/Artdle-web`).
2. Add it: `vercel env add GITHUB_TOKEN` (Production + Preview), or via the dashboard.
3. Deploy: `npx vercel --prod`.
4. Smoke test: open the deployed site → Bug button → submit a test report →
   confirm a new issue appears in the repo, then close/delete the test issue.

---

## Self-review

- [x] **Spec coverage:** button (Task 4), modal with description + context + "what's
      included" (Task 3), GitHub-issue delivery via serverless fn (Task 5),
      `GITHUB_TOKEN`/`GITHUB_REPO` config + dev/prod note (Tasks 5–6), pure
      tested formatter (Task 1). Screenshot intentionally omitted per spec.
- [x] **Placeholder scan:** no TBD/TODO; every code step shows complete code.
- [x] **Type consistency:** `BugReportContext`/`BugReport`, `buildBugReport`,
      `issueTitle`, `issueBody` used identically across Tasks 1, 3; `SAVE_VERSION`
      export (Task 2) consumed in Task 3; API contract `{ title, body }` →
      `{ ok, url }` consistent between Task 3 (client) and Task 5 (server).
