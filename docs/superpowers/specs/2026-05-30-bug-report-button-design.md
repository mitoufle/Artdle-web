# Bug Report Button — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)

## Goal

Add a **Bug** button to the TopBar that lets a player report a bug from inside the
game. Submitting creates a **GitHub issue** in `mitoufle/Artdle-web` so reports are
retrievable by the maintainer without the user having to send anything manually.

## Scope decisions (from brainstorming)

- **No screenshot.** Dropped to keep the payload pure JSON text and the flow simple.
- **Delivery: GitHub issue** via a Vercel serverless function (`/api/report-bug`).
  The browser never sees the GitHub token.
- **Auto-captured context is included** in every report (route, userAgent, viewport,
  Vite `MODE`, `playerId`, `saveVersion`, and `gold`/`inspiration`/`fame`).
- **No new runtime dependencies.** Uses `lucide-react` (already installed) for the
  icon; the serverless function uses the GitHub REST API via `fetch` (no Octokit).

## User flow

1. Player clicks the **🐛 Bug** button in the TopBar's right-hand `meta` strip
   (next to `↻ reset`).
2. A modal opens (same backdrop/dialog pattern as `ExportModal`):
   - A **Description** textarea (required; submit disabled until non-empty).
   - A collapsed **"What's included"** section showing the auto-captured context so
     the player can see exactly what is sent.
   - **Submit** and **Cancel** buttons.
3. On submit, the client POSTs JSON to `/api/report-bug`.
4. The function creates a GitHub issue and returns `{ ok: true, url }`.
5. The modal shows a success state with a link to the created issue, then can be
   closed. On failure it shows an error message and keeps the typed text so the
   user can retry.

## Architecture

Three layers, each independently testable.

### 1. `src/core/bugReport.ts` (pure, no React, no DOM)

The serializable shape and the formatting logic. Unit-tested with Vitest per repo
convention.

```ts
export interface BugReportContext {
  timestamp: string;      // ISO 8601
  route: string;          // window.location.pathname
  userAgent: string;
  viewport: { width: number; height: number };
  mode: string;           // import.meta.env.MODE
  playerId: string;
  saveVersion: number;
  gold: string;           // stringified Big
  inspiration: string;    // stringified Big
  fame: string;           // stringified Big
}

export interface BugReport {
  description: string;
  context: BugReportContext;
}

// Builds the report object from already-collected raw inputs (no globals read here,
// so it is fully deterministic and testable).
export function buildBugReport(input: {
  description: string;
  context: BugReportContext;
}): BugReport;

// Renders the GitHub issue title, e.g. "Bug report: <first line, truncated>".
export function issueTitle(report: BugReport): string;

// Renders the issue body as Markdown: the description, then a fenced JSON block
// with the full context.
export function issueBody(report: BugReport): string;
```

### 2. `src/components/shell/BugReportModal.tsx` + `.module.css`

- Mirrors `ExportModal`: fixed backdrop, `role="dialog"`, `aria-modal`, closes on
  backdrop click / Cancel / Escape.
- Reads live state at submit time via `useGameStore.getState()` (one-shot read, not
  a subscription — the modal must not re-render every tick) to assemble the
  `BugReportContext`. Browser/env fields come from `window`/`navigator`/`import.meta.env`.
- Calls `buildBugReport(...)`, then `POST /api/report-bug` with `{ title, body }`
  (or with the raw report — see API contract below).
- Local submit states: `idle | submitting | success | error`.
- CSS reuses the existing design tokens (`--bg-1`, `--gold`, `--mono`, `--s-*`, etc.).

### 3. `api/report-bug.ts` (Vercel serverless function)

- Accepts `POST` only (405 otherwise).
- Validates the body: requires a non-empty `description`/`body`; rejects oversized
  payloads (cap body length, e.g. 30 KB) to limit abuse.
- Reads `GITHUB_TOKEN` (required) and `GITHUB_REPO` (optional, defaults to
  `mitoufle/Artdle-web`) from `process.env`.
- Calls `POST https://api.github.com/repos/{repo}/issues` with the token, an
  `Accept: application/vnd.github+json` header, a `User-Agent`, and a JSON body
  `{ title, body, labels: ["bug", "in-game-report"] }`.
- On success returns `{ ok: true, url }` (the issue's `html_url`); on GitHub error
  returns `{ ok: false, error }` with an appropriate status. Never echoes the token.
- If `GITHUB_TOKEN` is missing, returns 500 with a clear message (so a
  misconfigured deploy is obvious).

### 4. `TopBar.tsx`

- Add a `useState<boolean>` for modal open/closed.
- Add the Bug button to the `meta` strip, styled like the existing mono
  micro-buttons (new `.bugBtn` class in `TopBar.module.css`).
- Render `<BugReportModal open={...} onClose={...} />`.

## API contract

**Request** — `POST /api/report-bug`, `Content-Type: application/json`:

```json
{ "title": "Bug report: ...", "body": "<markdown>" }
```

**Success** — `200`:

```json
{ "ok": true, "url": "https://github.com/mitoufle/Artdle-web/issues/123" }
```

**Failure** — `4xx/5xx`:

```json
{ "ok": false, "error": "human-readable reason" }
```

## Configuration / secrets

- **`GITHUB_TOKEN`** — a fine-grained Personal Access Token scoped to
  `mitoufle/Artdle-web` with **Issues: Read and write**. Set as a Vercel
  Production (and Preview) environment variable. Never exposed to the client.
- **`GITHUB_REPO`** — optional override; defaults to `mitoufle/Artdle-web`.

The user will add `GITHUB_TOKEN` via the Vercel dashboard (or `vercel env add`)
before the feature works in production.

## Routing note

`vercel.json` currently rewrites `/(.*) → /index.html`. Vercel resolves the
filesystem (including `/api/*` serverless functions) **before** applying
`rewrites`, so `/api/report-bug` is reached correctly and is not swallowed by the
SPA catch-all. No change to `vercel.json` is required, but we will verify this
against the deployed function after first deploy.

## Local development

Plain `vite` does **not** run `/api` functions, so the button cannot create an
issue on the local dev server. In dev the function call will fail and the modal
shows its error state — acceptable. To exercise the full flow locally, run
`vercel dev` (out of scope to wire up automatically). This limitation is noted, not
solved, per the "simplest" directive.

## Error handling

- **Empty description** → submit disabled (client) and rejected (server).
- **Network/function error** → modal error state, typed text preserved, retry allowed.
- **GitHub API error** (rate limit, bad token) → surfaced as a generic "couldn't
  submit" message to the user; the real reason is in the function logs.
- **Oversized payload** → server rejects with 413-style message.

## Testing

- `tests/core/bugReport.test.ts` — `buildBugReport`, `issueTitle` (truncation,
  multi-line description), `issueBody` (description + JSON context fence) with fixed
  inputs (TDD: tests precede implementation).
- `tests/components/shell/BugReportModal.test.tsx` — renders when open; submit
  disabled while description empty; calls a mocked `fetch` with the expected
  payload on submit; shows success and error states. The store read is mocked.
- Serverless function (`api/report-bug.ts`) is not unit-tested in Vitest (no DOM/
  store); it is small and verified manually against the deployed endpoint. Its
  pure formatting logic lives in `src/core/bugReport.ts`, which **is** tested.

## Out of scope

- Screenshots / file attachments.
- In-game list of past reports.
- Spam protection beyond a payload-size cap (no captcha, no rate limiter).
- Wiring `vercel dev` into the local workflow.

## File summary

| File | Change |
|---|---|
| `src/core/bugReport.ts` | New — pure builder + formatters |
| `tests/core/bugReport.test.ts` | New — unit tests |
| `src/components/shell/BugReportModal.tsx` | New — modal UI |
| `src/components/shell/BugReportModal.module.css` | New — styles |
| `tests/components/shell/BugReportModal.test.tsx` | New — component tests |
| `api/report-bug.ts` | New — Vercel serverless function |
| `src/components/shell/TopBar.tsx` | Edit — button + modal toggle |
| `src/components/shell/TopBar.module.css` | Edit — `.bugBtn` style |
