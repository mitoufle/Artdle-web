import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_BODY = 30_000;
const MAX_TITLE = 200;
const DEFAULT_REPO = "mitoufle/Artdle-web";

// --- Best-effort rate limiting ---------------------------------------------
// This is BEST-EFFORT, in-memory, per-instance state — NOT a hard guarantee.
// Vercel Fluid Compute reuses function instances, so module-level counters do
// survive across invocations on the same instance and meaningfully throttle a
// sustained flood from one source. But a cold start resets them, and each
// concurrent instance enforces its own copy. The durable fix is a shared store
// (Vercel KV / Upstash Redis) keyed by IP. Until abuse justifies that
// dependency, this raises the bar for trivial spam loops and — via the global
// ceiling — protects the GITHUB_TOKEN's REST quota even under a distributed
// flood that the per-IP window alone wouldn't catch.

/** Max reports per IP within PER_IP_WINDOW_MS. */
const PER_IP_LIMIT = 5;
const PER_IP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
/** Global ceiling across all IPs within GLOBAL_WINDOW_MS (token-quota guard). */
const GLOBAL_LIMIT = 60;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
/** Prune the IP map opportunistically once it grows past this many keys. */
const IP_MAP_MAX_KEYS = 5000;

const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

/** Drop timestamps at or before `now - windowMs` (list is append-ordered). */
function prune(times: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < times.length && times[i]! <= cutoff) i++;
  return i === 0 ? times : times.slice(i);
}

/** True if the request is within limits; records the hit when allowed. */
function rateLimitOk(ip: string, now: number): boolean {
  globalHits = prune(globalHits, now, GLOBAL_WINDOW_MS);
  if (globalHits.length >= GLOBAL_LIMIT) return false;

  const hits = prune(ipHits.get(ip) ?? [], now, PER_IP_WINDOW_MS);
  if (hits.length >= PER_IP_LIMIT) {
    ipHits.set(ip, hits);
    return false;
  }

  hits.push(now);
  ipHits.set(ip, hits);
  globalHits.push(now);

  // Keep the per-IP map from growing unbounded on a long-lived instance.
  if (ipHits.size > IP_MAP_MAX_KEYS) {
    for (const [k, v] of ipHits) {
      const p = prune(v, now, PER_IP_WINDOW_MS);
      if (p.length === 0) ipHits.delete(k);
      else ipHits.set(k, p);
    }
  }
  return true;
}

/** Best-effort client IP from Vercel's forwarding headers. */
function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  const first = raw?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "unknown";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  // Reject cross-origin browser calls. The in-game reporter is same-origin, so
  // its Origin host matches Host. Requests with no Origin header (e.g. curl)
  // fall through to the rate limiter. This blocks a malicious page from POSTing
  // through a logged-in visitor's browser.
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== req.headers.host) {
      res.status(403).json({ ok: false, error: "Cross-origin not allowed" });
      return;
    }
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: "Server not configured" });
    return;
  }

  // Count the attempt BEFORE validation so malformed-body probing is throttled too.
  if (!rateLimitOk(clientIp(req), Date.now())) {
    res.status(429).json({ ok: false, error: "Too many reports — try again later" });
    return;
  }

  const { title, body } = (req.body ?? {}) as { title?: unknown; body?: unknown };
  if (typeof title !== "string" || typeof body !== "string" || !title || !body) {
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
