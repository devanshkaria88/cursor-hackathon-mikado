# Mikado — Sprite Generation Prompts

12 sprites needed. Generate these tonight (Thursday evening) so they're sitting in `/sprites/` ready when the build starts at 5:50 PM Friday.

## Recommended generators

- **Recraft.ai** — best quality for pixel art with consistent palette, has a "pixel art" style preset
- **Aseprite** (paid app, ~£15) — if you want to hand-pixel any of these, it's the standard tool
- **PixelLab** (web) — quick AI pixel art
- **DALL-E 3 / GPT-4o image** — works but tends to anti-alias; need to post-process with a "downsample to 64x64 + nearest-neighbor upscale" step

## Universal style rules (include in every prompt)

> Style: 16-bit retro pixel art, limited 8-color palette, terminal-green theme. Background fully transparent (PNG alpha). Hard edges, no anti-aliasing, no gradients, no soft shadows. Pixel-perfect at native resolution. Strong silhouette readable at 1x scale.

> Palette (hex): #0a0e0a (background, but make transparent), #9be39b (primary green), #d4ffd4 (highlight green), #4a7a4a (shadow green), #5cff5c (good/paid green), #ff5c5c (bad/refused red), #ffcc5c (warning yellow). Use only these colors.

## Sprite list

### 1. `tower-stable.png` — 64×64

> 16-bit retro pixel art of a neat vertical bundle of mikado/pick-up sticks standing upright, viewed from a slight angle. About 8 sticks visible, each a thin vertical pixel rectangle in alternating shades of warm green (#9be39b, #d4ffd4). The sticks lean against each other forming a stable conical pile. Limited 8-color palette, transparent background, no anti-aliasing, hard pixel edges. 64x64 pixels native resolution.

### 2. `tower-shaking.png` — 64×64

> 16-bit retro pixel art of the same mikado stick bundle as before, but slightly disturbed — sticks are askew, some leaning at unnatural angles, with small motion lines (3-4 pixel diagonal dashes) on either side suggesting tremor. Same green palette (#9be39b, #d4ffd4, #4a7a4a). Transparent background, pixel-perfect, no anti-aliasing. 64x64 native.

### 3. `tower-fallen.png` — 64×64

> 16-bit retro pixel art of mikado/pick-up sticks scattered horizontally across the ground, no longer standing. About 8 sticks lying in a chaotic pile at different angles. Color sticks in muted greens (#4a7a4a, #9be39b) with two sticks in red (#ff5c5c) to indicate "the broken ones." Transparent background, hard pixel edges, no anti-aliasing. 64x64 native resolution.

### 4. `stick-grey.png` — 8×32

> 16-bit retro pixel art of a single mikado stick standing vertically. Thin pixel rectangle, dim grey colour (#4a7a4a body, #9be39b highlight stripe down the left edge). 8 pixels wide, 32 pixels tall, transparent background, pixel-perfect, no anti-aliasing.

### 5. `stick-yellow.png` — 8×32

> Same as stick-grey but body colour is mustard yellow (#ffcc5c) with a brighter yellow highlight (#fff0a0). Indicates "currently being processed." 8x32 pixels, transparent, no anti-aliasing.

### 6. `stick-green.png` — 8×32

> Same as stick-grey but body colour is bright lime green (#5cff5c) with a brighter highlight (#d4ffd4). Indicates "paid / approved." 8x32 pixels, transparent, no anti-aliasing.

### 7. `stick-red.png` — 8×32

> Same as stick-grey but body colour is blood red (#ff5c5c) with a brighter red highlight (#ffaaaa). The stick is slightly bent in the middle (one or two pixels offset) to suggest "broken / refused." 8x32 pixels, transparent, no anti-aliasing.

### 8. `invoice-card.png` — 96×64

> 16-bit retro pixel art of an invoice document. A piece of paper viewed straight-on with a folded top-right corner (origami fold). Three or four horizontal grey lines (#4a7a4a) representing text, with a thicker green line (#9be39b) at the top representing a header. A small dollar/pound sign in the bottom-right area. White-cream paper colour (#d4ffd4 fill). Transparent background, hard pixel edges, no anti-aliasing. 96x64 pixels native.

### 9. `bank-vault.png` — 48×48

> 16-bit retro pixel art of a vault door, square-shaped, with a circular dial in the center and four small rivets in the corners. Steel-grey body (#4a7a4a, #9be39b for highlights), a brighter green ring around the dial (#5cff5c). Transparent background, pixel-perfect, no anti-aliasing. 48x48 native resolution.

### 10. `cursor-icon.png` — 16×16

> 16-bit retro pixel art of an arrow cursor / mouse pointer, classic black-and-white style but recoloured: outline in #d4ffd4, fill in #9be39b. Standard cursor shape pointing to upper-left. 16x16 pixels, transparent background, pixel-perfect, no anti-aliasing.

### 11. `seal-paid.png` — 32×32

> 16-bit retro pixel art of a stamp/seal that says "PAID" in chunky uppercase pixel letters, slightly tilted (about 15 degrees counter-clockwise). Bright green ink (#5cff5c) with rough edges as if pressed unevenly. Transparent background, hard pixel edges, no anti-aliasing. 32x32 pixels native.

### 12. `seal-refused.png` — 32×32

> 16-bit retro pixel art of a stamp/seal that says "REFUSED" in chunky uppercase pixel letters, slightly tilted (about 15 degrees counter-clockwise). Blood-red ink (#ff5c5c) with rough edges as if pressed unevenly. Transparent background, hard pixel edges, no anti-aliasing. 32x32 pixels native.

## Quality check before saving

For each generated sprite:

1. **Open at 1x scale.** Is the silhouette still readable? If the shape blurs into a blob, regenerate.
2. **Open at 4x scale (nearest-neighbor).** Are the pixels crisp squares, or are they fuzzy? If fuzzy, your generator anti-aliased — post-process by downsampling to native res with nearest-neighbor and upscaling back.
3. **Check palette.** Open with a colour picker. Are there more than 8 colours? Snap to the spec palette using a tool like Aseprite's "Indexed mode" or pinetools.com's quantize tool.
4. **Save as PNG with transparency.** No JPGs. Verify alpha channel exists.

## Fallback (if you can't get good sprites in time)

You can ship the demo without any sprites by using **ASCII representations** of all of these. The retro aesthetic survives in pure ASCII:

- Tower stable: `║║║║║║║║`
- Tower shaking: `║║╲║║╱║║`
- Tower fallen: `═══════` (horizontal sticks scattered)
- Stick: `║` in the appropriate colour
- Invoice card: a `<pre>` block with `┌─────────┐` borders
- Verify check: `[✓]` / `[✗]`
- PAID stamp: `[ PAID ]` in green, rotated 15° via `transform: rotate()`
- REFUSED stamp: `[ REFUSED ]` in red, rotated 15°

The ASCII fallback is honestly punchy in its own right and might even be preferable on a projector. Don't blow an hour debugging a sprite when ASCII is one CSS line away.

## Time budget for sprite generation tonight

- 5 mins: write/refine prompts above
- 10 mins: generate first batch (towers + sticks)
- 10 mins: generate second batch (invoice, vault, cursor, seals)
- 5 mins: post-process (quantize palette, ensure transparency)
- 5 mins: drop into `/sprites/` and confirm filenames match the spec

**Total: ~35 min tonight.** If after 35 minutes you don't have all 12, ship what you have and use ASCII for the rest.
