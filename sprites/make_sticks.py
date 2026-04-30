"""Programmatic generator for the 4 mikado stick sprites.

Implements §4–§7 of `sprite_prompts.md`. PixelLab choked on 32x32 thin
shapes ("integer modulo by zero") and we hit the quota ceiling on retries,
so we hand-roll these. They're literally rectangles with a highlight stripe,
which is the kind of shape AI generators butcher anyway.
"""

from PIL import Image

OUT_DIR = "."
W, H = 8, 32

STICKS = {
    "stick-grey.png":   {"body": "#4a7a4a", "hl": "#9be39b", "bent": False},
    "stick-yellow.png": {"body": "#ffcc5c", "hl": "#fff0a0", "bent": False},
    "stick-green.png":  {"body": "#5cff5c", "hl": "#d4ffd4", "bent": False},
    "stick-red.png":    {"body": "#ff5c5c", "hl": "#ffaaaa", "bent": True},
}


def hex_to_rgba(h: str, a: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def render_stick(body_hex: str, hl_hex: str, bent: bool) -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    body = hex_to_rgba(body_hex)
    hl = hex_to_rgba(hl_hex)

    # Stick spans the full 32px height. 6px wide centered (1px transparent margin
    # each side) so the highlight reads cleanly. Highlight is 1px on the left
    # edge of the body, body fills the rest.
    margin_x = 1
    body_w = W - margin_x * 2  # 6
    for y in range(H):
        # If bent, kink the column 2px to the right between rows 14..18.
        x_offset = 2 if (bent and 14 <= y <= 18) else 0
        for i in range(body_w):
            x = margin_x + i + x_offset
            if 0 <= x < W:
                px[x, y] = hl if i == 0 else body

    return img


def main() -> None:
    for filename, spec in STICKS.items():
        img = render_stick(spec["body"], spec["hl"], spec["bent"])
        path = f"{OUT_DIR}/{filename}"
        img.save(path)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
