# Artdle — AI Image Generation Prompts

Exhaustive list of asset prompts to feed to an AI image generator (Midjourney, SDXL, DALL-E 3, etc.) to produce final art for the Artdle web port.

## Style anchor (paste at the start of every prompt)

```
Pixel art, [SUBJECT]. Dark mystical idle-RPG aesthetic.
Palette: deep indigo #14102a, warm gold #e6b667, mystic violet #9b6cd6,
fame yellow #ffd86a, paint-mastery teal #7adcd6.
Painterly atmosphere reminiscent of Studio Ghibli filtered through retro
RPG pixel art (Stardew Valley + Hollow Knight + Disco Elysium).
Transparent background, single isolated sprite, clean silhouette readable
at 50% scale, no text, no watermark, no UI chrome around the subject.
```

For an *illustrated* (non-pixel) variant, replace the first line with:
> `Hand-illustrated digital painting, [SUBJECT]. Soft painterly brushwork.`

Use the **same prompt body** otherwise — palette and tone stay constant across the whole game.

---

## A. Currencies & resources (32×32 sprites, transparent PNG)

These are the icons shown next to numbers in the top bar and across the UI.

1. **Gold coin** — A single round gold coin with a tiny paintbrush silhouette engraved on its face, soft warm glow around the edge. Slight diagonal angle showing the rim. 32×32. The most common currency.
2. **Inspiration orb** — A pulsing violet orb with wisps of mystical energy curling off its surface like incense smoke, faint white core glow. Looks like a tiny captured nebula. 32×32.
3. **Fame star** — A radiant five-pointed star in fame-yellow, hovering inside a soft golden halo, with three tiny floating particles around it. 32×32. Conveys prestige, hard-won.
4. **Paint Mastery swirl** — A teal/cyan swirl of liquid paint mid-stir, almost a yin-yang shape but with brushstroke texture, soft glow. 32×32. Conveys craft + experience.
5. **Workshop XP shard** — A small geometric crystal in warm gold, faceted and floating, slight rotation suggested by motion lines behind it. 32×32.

## B. Canvas painting stages (320×320 sprites, transparent PNG, framed)

These are the actual paintings shown on the canvas as the player upgrades the Size track. Each one is a complete tiny landscape painting on a wooden easel, increasing in detail and grandeur from sketch to mythic.

6. **Stage 0 — Sketch** — A blank stretched canvas with a single charcoal sketch of a horizon line and a small tree silhouette, faint pencil strokes still visible, an unfinished feel. Wooden easel underneath.
7. **Stage 1 — Apprentice** — A simple childish landscape painting: blue sky, green hill, sun, one tree. Limited 4-color palette. Wooden easel.
8. **Stage 2 — Journeyman** — A pleasant valley scene: rolling hills, a few trees, a winding path, soft cloud, basic depth. Wooden easel.
9. **Stage 3 — Adept** — A dawn landscape with a small village in the distance, a river, two birds in the sky, warm peach/gold light. Wooden easel.
10. **Stage 4 — Skilled** — A forest clearing with a deer drinking from a stream, dappled light through pines, atmospheric perspective. Wooden easel.
11. **Stage 5 — Masterpiece** — An ornate Romantic-era landscape: dramatic clouds, a castle on a cliff, lightning illuminating a stormy sea below. Gilded frame instead of plain easel.
12. **Stage 6 — Virtuoso** — An impressionist field of poppies under a low golden sun, loose brushstrokes, deep palette of reds + ochres + violets. Gilded frame.
13. **Stage 7 — Master** — A surrealist composition: a giant moon hanging behind a floating island carrying a single tree, two mystical birds in flight, twilight palette. Carved gold frame.
14. **Stage 8 — Grandmaster** — A baroque dreamscape with cascading waterfalls falling upward into clouds, temple ruins half-overgrown, two violet phoenixes. Ornate frame with carved leaves.
15. **Stage 9 — Legendary** — A cosmic vista: galaxies and nebulae forming the silhouette of a colossal painter holding a brush across the sky, painting more stars into existence. Frame inlaid with star-jewels.
16. **Stage 10 — Mythic** — Pure abstraction of color and light, a swirling vortex of all five game palette colors mixing into a singularity, the painting itself appearing to glow and shift. Frame is itself a ring of stars and constellations.
17. **Empty easel base** — Just the wooden easel, no canvas, three legs, slight perspective angle, warm wood tones. Used as a fallback frame during transitions.

## C. Canvas effects & overlays (transparent PNG)

18. **CRIT pulse burst** — A starburst of warm gold rays radiating outward from a central point, with the word "CRIT" in pixel-RPG font baked into the center. 64×64. Used as a one-shot animation frame on a critical-hit canvas.
19. **Combo flame badge** — A stylized 8-bit flame in warm orange-gold with the silhouette of a brush in the center of the flame. 32×32. Background asset for the "🔥 ×N" combo indicator.
20. **Floating gold text +XXg** — A fading upward gold-coin icon with a stylized "+" sign next to it. Used as the floating-gold sale-effect sprite. 24×24.
21. **Sale sparkle particle** — A tiny four-point sparkle in fame yellow with a soft glow, used in particle bursts when a canvas sells. 8×8.

## D. Inspiration tree (the left-hand idle scene)

22. **Tree — Stage 1: Sapling** — A small green sapling growing out of a mossy mound, two small leaves, faint violet glow at the base. 240×320 portrait sprite.
23. **Tree — Stage 2: Young** — A waist-high young tree with maybe ten leaves, slight twist in the trunk, fireflies of inspiration drifting around it. 240×320.
24. **Tree — Stage 3: Mature** — A full-canopy oak-like tree, leaves shimmering with violet undertone, light rays piercing through the canopy. 240×320.
25. **Tree — Stage 4: Mystical** — An ancient tree with bioluminescent veins glowing violet through the bark, floating leaves drifting upward instead of down, several inspiration orbs orbiting. 240×320.
26. **Tree — Stage 5: Cosmic** — The tree's canopy now contains a swirling galaxy, roots glowing fame-gold, the trunk made of marble + amethyst, surrounded by a soft starfield aura. 240×320.
27. **Tree background — sky panel** — A peaceful twilight sky with a low warm horizon and faint stars beginning to appear. Subtle parallax-friendly, 480×320, no foreground elements.
28. **Inspiration firefly particle** — A single small violet glowing dot with a soft halo, slight motion blur. 8×8, transparent. Used as drifting tree particles.

## E. Workshop (right-rail panel scene)

29. **Workshop interior backdrop** — Cozy artisan's workshop: a wooden workbench cluttered with paint tubes, brushes in mason jars, a small forge in the back warm-orange glowing, shelves with canvases and tools. Top-down ¾ perspective. 340×400.
30. **Workshop slot icons — brush** — A single hand-carved paintbrush with a wooden handle and dark bristles, slight brush-mark of red paint at the tip. 48×48.
31. **Workshop slot icons — palette** — A traditional wooden artist's palette with five splashes of paint matching the game palette (gold, violet, teal, yellow, indigo), thumb hole visible. 48×48.
32. **Workshop slot icons — easel** — A miniature wooden easel sprite, three-legged, slight perspective. 48×48.
33. **Item card frame — Common (gray)** — A rectangular card frame in worn iron-gray with simple corner studs, ready to hold an item icon. 200×280, 9-slice friendly.
34. **Item card frame — Magic (blue)** — Same shape as Common but with cool blue energy traced along the inner border, slight glow at corners. 200×280.
35. **Item card frame — Rare (gold)** — Warm gold border with engraved leaves at each corner, soft glow. 200×280.
36. **Item card frame — Epic (purple)** — Deep purple border with violet star-jewel insets at corners, mystic energy in the wood-grain texture. 200×280.
37. **Item card frame — Legendary (orange)** — Burning gold-orange frame with flame-licked corners, intense radial glow, the rarest and grandest. 200×280.
38. **Affix icon — `+sell_price%`** — A coin with an upward green arrow next to it. 24×24, transparent.
39. **Affix icon — `+speed%`** — A clock face with a forward-spinning arrow, slight motion blur on the second hand. 24×24.
40. **Affix icon — `+crit_chance%`** — A shattered diamond shape with a lightning bolt struck through it. 24×24.
41. **Affix icon — `+combo_chance%`** — A chain of three small flames linked together. 24×24.
42. **Affix icon — `+size%`** — Four directional arrows pointing outward from a central canvas square (up/down/left/right), conveying expansion. 24×24.

## F. Painter's Office (right-rail panel scene)

43. **Office interior backdrop** — A small clerical room with a row of three or four worker desks, each with a tiny easel and parchment, warm lamp light, framed certificates on the wall. Top-down ¾ perspective. 340×400.
44. **Worker portrait — Generalist** — A friendly painter in everyday clothes (apron over a tunic), brush in hand, neutral expression, brown hair, slight smile. Bust portrait, ¾ view. 96×96.
45. **Worker portrait — Goldsmith** — A painter wearing a richly gold-trimmed coat and a small gold pendant, smug confident expression, hair in a tight bun, holding a coin in one hand and a brush in the other. 96×96.
46. **Worker portrait — Speedrunner** — A wiry painter mid-stride with windswept hair, two brushes held in one hand, intense focused expression, motion lines behind them. 96×96.
47. **Worker class icon — Generalist** — A simple silhouette of a person with a paintbrush, balanced stance. 24×24.
48. **Worker class icon — Goldsmith** — A silhouette of a person with a coin floating above their hand. 24×24.
49. **Worker class icon — Speedrunner** — A silhouette of a person leaning forward in motion, motion-line tail behind. 24×24.
50. **Tier badge frame — Common to Legendary (5 variants)** — Small banner-shaped frames in tier colors (gray/blue/gold/purple/orange) sized to fit a 1-line text label like "LEGENDARY". 64×16 each.
51. **Hire icon** — A door silhouette with a soft warm light spilling out, "+" symbol in the doorway. 24×24.
52. **Reject icon** — A door silhouette with the door closed and an "✕" symbol in front. 24×24.
53. **Fire icon (worker dismissal)** — A small flame symbol over a door silhouette, conveying termination. 24×24.

## G. Constellation / skill tree (full-screen scene)

54. **Cosmos background** — A deep cosmic backdrop: nebulae in violet + indigo + faint teal, scattered stars of varying brightness, a few wispy galaxy arms in the distance. Subtle vignette to darken the edges. 1600×1600 (large, will be panned/zoomed).
55. **FAME hub centerpiece** — A central golden star at the heart of the constellation, larger than other stars, with a soft warm halo and three orbiting smaller fame-gold sparks. 96×96, transparent.
56. **Star node — Locked** — A small stone-gray spherical node with no glow, dim and cold. 32×32.
57. **Star node — Available (purchasable)** — A node ringed with a thin warm-gold halo, the inside slightly glowing as if waiting to ignite. Subtle pulse. 32×32.
58. **Star node — Owned (purchased)** — A bright warm-gold node with a steady glow, faint particle trails. 32×32.
59. **Star node — Maxed** — A very bright gold node with a multi-layered halo and several particles orbiting, conveying completion. 32×32.
60. **Major star node — Owned** — A larger version of the Owned node (×1.5 size, more layered halo), used for major skill-tree nodes. 48×48.
61. **Constellation edge — locked** — A thin dashed indigo line connecting two star points, faint. (May render as procedural SVG; only needed if you want a textured/painted line.) 4×4 tile.
62. **Constellation edge — owned** — A glowing warm-gold line connecting two star points. 4×4 tile.

## H. Room rail tab icons (32×32 sprites, transparent PNG)

These replace the current Lucide icons in the right-side vertical room rail.

63. **Workshop tab icon** — A small pixel-art hammer with a wooden handle and an iron head, balanced silhouette. 32×32.
64. **Painter's Office tab icon** — A small pixel-art icon of a person sitting at a desk with a quill or brush. 32×32.
65. **Painting School tab icon (future)** — A small pixel-art icon of an open book with a paintbrush laid across it. 32×32.
66. **Lab tab icon (future)** — A small pixel-art icon of a glowing laboratory flask with bubbling violet liquid inside. 32×32.
67. **Stats tab icon** — A small pixel-art icon of three vertical bars of increasing height (a bar chart), in warm gold. 32×32.

## I. Buttons & UI chrome

68. **Primary button — idle** — A rectangular button with soft gold border, deep-indigo fill, slight inner shadow, ready for a 1-line text label. 200×48, 9-slice friendly. Empty (no text) so the engine can label it.
69. **Primary button — hover** — Same shape as idle but the border is brighter and a subtle glow emanates outward. 200×48.
70. **Primary button — disabled** — Same shape but desaturated, dimmer border, conveys inactive state. 200×48.
71. **Secondary button — idle/hover/disabled (3 variants)** — Smaller, more subdued button with cool-violet border for less-prominent actions. 120×36 each.
72. **Modal/overlay backdrop** — A semi-transparent dark indigo rectangle with a slight edge vignette, used as the dim backdrop behind modals. 1920×1080.
73. **Modal panel frame** — A rectangular panel frame with carved gold corners, subtle inner shadow, ready to contain modal content. 480×360, 9-slice friendly.
74. **Tooltip background** — A small rectangular tooltip bubble with a slight diagonal pattern texture, indigo fill with cool-violet border. 200×80, 9-slice friendly.
75. **Section divider — horizontal** — A thin decorative horizontal divider with a small flourish in the center (e.g., a tiny brush or paint drop). 320×8.
76. **Section divider — vertical** — A thin decorative vertical divider with a small flourish. 8×320.

## J. Progress bars

77. **Canvas progress bar — fill texture** — A horizontal bar of liquid-paint texture in warm gold, with a slight wet shine, designed to be horizontally cropped to indicate fill percentage. 480×16, repeating left-to-right.
78. **Canvas progress bar — empty track** — The empty version of the same bar: dark indigo with a subtle wood-grain interior. 480×16.
79. **XP bar — fill texture** — A horizontal bar in mystic violet, with faint glow and a moving energy texture. 240×8.
80. **XP bar — empty track** — Darker violet/indigo empty version. 240×8.

## K. Backgrounds (route-level)

81. **Painting route background** — A cozy painter's atelier: warm wood floor, large window on the left letting in afternoon light, plants on the windowsill, a few canvases stacked against the back wall, soft warm shadows. Empty middle space (the engine will overlay the canvas, upgrades, and right rail). 1920×1080.
82. **Constellation route background** — A wide cosmic view that frames the constellation interactive area: nebula on the upper edges, scattered far stars, a faint suggestion of the Milky Way arching across, vignette toward the corners. Empty center (the constellation overlays). 1920×1080.
83. **Tree route background** — A peaceful meadow at twilight: rolling hills in distant blue, a setting sun on the horizon casting warm peach light, tall grasses in the foreground, the inspiration tree will overlay on the left half. 1920×1080.
84. **Ascension route background** — A dramatic mountaintop scene with two glowing portals at the summit, swirling clouds parting around them, a path winding up toward the gates. Mood: solemn, transformative. 1920×1080.

## L. Ascension scene

85. **Portal — idle frame** — A vertical stone gateway with violet mystical energy swirling within it, runes carved into the frame, faint particle drift. 320×480.
86. **Portal — active frame** — Same gateway but the energy is now intense and bright, particles streaming inward, the runes glowing. 320×480.
87. **Floating sky scene (post-ascend)** — A breathtaking sky vista as the player ascends: clouds parting to reveal the constellation, a gentle upward motion suggested by streaks. 1920×1080.
88. **Guiding spirit portrait** — A small ethereal violet figure resembling a paint-brush-shaped wisp with two glowing eyes, neutral kind expression, used as the narrator/mentor character. 96×96 portrait.
89. **Guiding spirit button — idle** — A small framed avatar of the spirit with a "click me" subtle glow. 80×80.
90. **Guiding spirit button — hover** — Brighter version with a small "speech bubble" tail starting to appear. 80×80.

## M. Cursor / pointer (optional)

91. **Default cursor** — A hand-painted small paintbrush angled at 45° as the cursor, with a tiny dot of warm gold paint at the tip indicating the click point. 32×32, transparent.
92. **Hover cursor** — Same brush but with the bristles slightly compressed (pressing) and a small glow at the tip. 32×32.
93. **Disabled cursor** — Brush with a small "✕" overlay at the tip. 32×32.

## N. Currencies — animated sprite sheets

If your generator supports sprite sheets / multi-frame, request these as 12-frame cycles (idle bobbing animation):

94. **Coin idle (12 frames)** — Same gold coin as #1 but with a subtle bob/rotation cycle: it slowly tilts on its vertical axis through 360°, showing the back at the midpoint (back is etched with the same brush silhouette mirrored). Output as 12-frame horizontal sprite sheet, each frame 32×32 (final image: 384×32).
95. **Inspiration orb idle (12 frames)** — Pulsing/breathing animation: orb expands and contracts slightly, particles swirl around it. 384×32 sprite sheet.
96. **Fame star idle (12 frames)** — Star slowly rotates in place with rays oscillating in length. 384×32 sprite sheet.

## O. Tilesets (optional, for any future tile-based scenes)

97. **Wooden floor tileset** — A 4×4 tileset of warm wooden floorboards with subtle variation (knots, scratches, gradient), suitable for the painter's atelier floor. Each tile 32×32; final sheet 128×128.
98. **Stone path tileset** — A 4×4 tileset of mossy stone tiles for the constellation/ascension scenes. 128×128.
99. **Sky/cloud tileset** — A 4×4 tileset of cloud and sky variations for parallax backgrounds. 128×128.

## P. Splash & meta art

100. **Game logo** — The word "ARTDLE" rendered in a hand-painted brush-stroke serif font in warm gold, with a small inspiration orb dotting one of the letters (e.g., the dot of the lowercase i, if styled lowercase). Below, a smaller subtitle in mono "an idle painter's tale". 800×400.
101. **Loading screen background** — The atelier scene at dawn, half-finished canvas on the easel, the player character (silhouette only) standing in front of it back-to-camera, suggesting "the painter is about to begin." 1920×1080. Used during initial save load / hydration.

---

## Tips for batching

- **Generate a style reference first.** Run prompts #1–5 (currencies) first as a small batch. If the style lands well, lock the seed/model and use it for the rest. If not, iterate the style anchor before doing the full set.
- **For sprite sheets (#94–99),** if your generator can't do animation, generate the static frame and pass to a separate tool (e.g., AnimatedDrawings) for the bob cycle.
- **Negative prompts** to add globally:
  > `no text, no watermark, no signature, no UI elements, no border, no frame, no white background`
- **Aspect-ratio hints** for non-square assets:
  > `aspect ratio 3:4 portrait` (workers), `aspect ratio 16:9 landscape` (backgrounds), `aspect ratio 1:1 square` (icons/sprites)
- **Consistency seed:** once a style is locked in, reuse the same generation seed across related sets (all currencies, all worker portraits) to keep the look coherent.

---

## What's NOT in this list

- **Audio** — out of scope per `CLAUDE.md` (deferred to v2.0+).
- **Procedural-only renders** — the constellation edges, hover glows, progress-bar fills can stay as CSS/SVG; only request art for them if you want hand-painted variants.
- **Lucide icons in dev tools** — `/dev/skill-designer` and similar dev surfaces don't need final art.
- **Font glyphs** — the project uses Google Fonts (Cinzel, JetBrains Mono); no custom font sheet needed unless you want a pixel font (like the existing `Tiny-Talk-All-Variations.png`) for canvas-side numbers.
