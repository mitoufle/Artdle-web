# Prompt for Claude Code

Paste the prompt below into Claude Code, in a session opened at the root of your Artdle project. Make sure the entire `design_handoff_artdle/` folder is present in the project so Claude Code can read the HTML mocks, the README, and the token files.

---

## The prompt

```
I'm building Artdle — a web-based idle/clicker game about an artist who paints, sells art, grows a metaphysical tree of inspiration, and ascends through a mystical portal to gain permanent fame.

I have a complete design handoff in `design_handoff_artdle/`. Before writing any code, please:

1. Read `design_handoff_artdle/README.md` end to end. It is the source of truth for layout, behavior, currencies, screens, and aesthetic direction.
2. Open `design_handoff_artdle/Artdle Hi-Fi Mockup.html` in your head — it's a single-document hi-fi prototype that contains all four screens (The Tree, Painting View, Ascension, Constellation). Treat it as the visual target.
3. Skim `design_handoff_artdle/Artdle Wireframes.html` if you want to understand the variants we evaluated; the hi-fi is what we're building.
4. Use `design_handoff_artdle/tokens.css` (or `tokens.json` if you prefer) as the canonical design tokens. Do not invent new colors or type sizes — every value you need is in those files.

Then propose an implementation plan, including:
- The framework you'll use (default to React + Vite + TypeScript + Zustand for state unless this repo already has a stack — in which case use what's here).
- Folder structure for routes, components, state, and assets.
- The order in which you'll build screens, matching the "Implementation order" section in the README.
- Where you will deviate from the mock and why (e.g. component-isation, accessibility fixes, routing).

Wait for me to approve the plan before generating files.

A few hard rules:

- The HTML mock is a **reference**, not source code. Recreate it in proper components — do not paste its CSS classes verbatim. Use the design tokens.
- The bottom currency bar and top nav are persistent across all routes. Currencies that don't apply to the current view should DIM (28% opacity, 0.4 saturation), not disappear.
- Canvas upgrades on the Painting View are ALWAYS visible in their own strip beneath the easel — they are NOT a peer to the Workshop/Office/School/Lab rooms. The room rail is its own thing.
- Three currencies, three colors, no exceptions: gold #e6b667, inspiration #9b6cd6, fame #ffd86a.
- Typography: Cinzel (uppercase, wide letter-spacing) for titles/nav/buttons; JetBrains Mono for numbers and meta; Inter for body. Press Start 2P / VT323 are reserved for inside pixel-art elements only.
- No emoji in production UI. The mock uses ⚒ 👤 📜 ⚗ 🖼 as placeholders — replace with proper icons (lucide-react or a custom set).
- Soft glows are used SPARINGLY — only on currency icons, the portal, active skill nodes, and prestige labels. Don't glow everything.
- The game ticks in real time. Persist state to localStorage. Game must survive tab refresh and resume cleanly.

Stack constraints (only enforce if the repo doesn't already have something — otherwise match the existing stack):
- React 18 + TypeScript
- Vite for dev / build
- Zustand for game state (simple, immer-friendly, minimal boilerplate)
- React Router for the four routes
- CSS Modules or vanilla CSS with the tokens (no Tailwind unless I ask) — keep styling close to what's in the mock
- Inline SVG for the tree, portal, and constellation — they are part of the design language, not assets to fetch

Deliverable for round 1: app shell + The Tree screen fully working (inspiration ticks, upgrades buyable, currencies update). Subsequent rounds will tackle Painting View, Ascension, Constellation in that order.

Start by reading the handoff and proposing the plan.
```

---

## Tips

- If your repo already has a frontend, **delete the "Stack constraints" block** from the prompt before pasting — Claude Code will then match what's there.
- After Claude Code finishes the app shell + Tree screen, give it a focused follow-up like:
  > "Round 2: build Painting View per `README.md` § Screen 2. Always-visible canvas upgrades strip, Workshop as the active room, room rail with 4 tabs. Stub Office/School/Lab content with `<RoomStub />`."
- The mock has working real-time animation hints (the painting fill, portal float/shimmer, mote drift, star twinkle). Reuse those values exactly — they're called out in `README.md` § Animations.
- If Claude Code asks about icons, point it at lucide-react or suggest building a small custom pixel-icon set under `src/icons/` matching the tree/canvas/portal motifs.
