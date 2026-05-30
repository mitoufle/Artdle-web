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
