"""Extract 14 Option-2 (Buharli Hurda) 2D enemy portraits as transparent 160x160 RGBA PNGs.

Detects top header bar & bottom brown label pill dynamically per image (even when crisp cream text
sits inside the dark brown pill), strips border-connected parchment/shadow cleanly, removes any
stray pill/border fragments, feathers 1px perimeter, and centers into 160x160 RGBA PNGs.
"""

from collections import deque
import os
import numpy as np
from PIL import Image, ImageDraw

CONCEPT_DIR = "/Users/yasinozkan/.gemini/antigravity/brain/e1cf79ae-9857-4de3-a9bf-7018b27f5aa4"
OUT_UI = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/ui/oak"
VERIFY_OUT = os.path.join(CONCEPT_DIR, "scratch/verify_opt2_portraits.png")

ENEMIES = [
    "scout_bot",
    "swarm_saw",
    "shield_loader",
    "hover_drone",
    "mega_harvester",
    "turbo_hopper",
    "chomp_brute",
    "repair_drone",
    "crystal_golem",
    "cryo_colossus",
    "frost_warden",
    "ember_bomber",
    "tesla_strider",
    "magma_overlord",
]


def find_center_crop_bounds(src: Image.Image):
    """Find safe x0..x1 and y0..y1 inside center Option-2 panel excluding brown bars, borders & pill."""
    arr = np.array(src, dtype=np.int16)
    h, w, _ = arr.shape
    cx = w // 2  # ~632

    # 1) Top header bar + gold divider ends where center strip reaches clean cream parchment (~246,234,208)
    y_top = 42
    while y_top < 96:
        row_band = arr[y_top, cx - 140:cx + 140]
        is_cream = (row_band[:, 0] > 232) & (row_band[:, 1] > 218) & (row_band[:, 2] > 188)
        if is_cream.mean() > 0.92:
            break
        y_top += 1
    y_top = min(y_top + 4, 80)

    # 2) Bottom label pill ('2 · Buharli Hurda') sits centered in x=[480..780], near bottom ~45px.
    # Scan upward from height - 4 until we find a row where dark pill borders (r<100, g<75, b<45) disappear!
    pill_top = h - 4
    in_pill = False
    for y in range(h - 4, h - 75, -1):
        # Sample left/right flanks of the pill box (avoiding center text and avoiding feet outside x=[500..760] if narrow)
        band = arr[y, cx - 105:cx + 105]
        dark_pill = (band[:, 0] < 95) & (band[:, 1] < 72) & (band[:, 2] < 45)
        gold_rim = (band[:, 0] > 180) & (band[:, 1] > 130) & (band[:, 2] < 95) & ((band[:, 0] - band[:, 2]) > 95)
        frac = (dark_pill | gold_rim).mean()
        if frac > 0.35:
            in_pill = True
            pill_top = y
        elif in_pill and frac < 0.12:
            break

    y_bot = max(y_top + 120, pill_top - 3)
    return 430, y_top, 834, y_bot


def is_parchment_or_shadow(r: int, g: int, b: int, y_ratio: float = 0.5) -> bool:
    """True for cream parchment background or soft beige ground shadow (preserves cool white fur & outlines)."""
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    warm_diff = r - b
    rg_diff = abs(r - g)
    # Near bottom 22% of crop, allow slightly darker warm grey-beige drop shadows underneath feet
    min_lum = 152 if y_ratio > 0.78 else 180
    if lum < min_lum:
        return False
    return 18 <= warm_diff <= 68 and r > 170 and g > 152 and b > 115 and rg_diff <= 34


def remove_parchment_bg(crop: Image.Image) -> Image.Image:
    rgb = np.array(crop.convert("RGB"), dtype=np.int16)
    h, w, _ = rgb.shape
    bg = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)

    q = deque()
    for x in range(w):
        for y in (0, 1, h - 1, h - 2):
            if 0 <= y < h and not visited[y, x]:
                r, g, b = int(rgb[y, x, 0]), int(rgb[y, x, 1]), int(rgb[y, x, 2])
                if is_parchment_or_shadow(r, g, b, y / max(1, h)):
                    visited[y, x] = True
                    bg[y, x] = True
                    q.append((x, y))
    for y in range(h):
        for x in (0, 1, w - 1, w - 2):
            if 0 <= x < w and not visited[y, x]:
                r, g, b = int(rgb[y, x, 0]), int(rgb[y, x, 1]), int(rgb[y, x, 2])
                if is_parchment_or_shadow(r, g, b, y / max(1, h)):
                    visited[y, x] = True
                    bg[y, x] = True
                    q.append((x, y))

    while q:
        cx, cy = q.popleft()
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                visited[ny, nx] = True
                r, g, b = int(rgb[ny, nx, 0]), int(rgb[ny, nx, 1]), int(rgb[ny, nx, 2])
                if is_parchment_or_shadow(r, g, b, ny / max(1, h)):
                    bg[ny, nx] = True
                    q.append((nx, ny))

    # Clean enclosed warm cream parchment pockets (key loop holes, between legs) while keeping cool-white fur intact
    r_ch, g_ch, b_ch = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    pure_cream = (~bg) & (np.abs(r_ch - 246) <= 16) & (np.abs(g_ch - 234) <= 16) & (np.abs(b_ch - 208) <= 18)
    hole_vis = np.zeros((h, w), dtype=bool)
    for py in range(h):
        for px in range(w):
            if pure_cream[py, px] and not hole_vis[py, px]:
                comp = []
                hq = deque([(px, py)])
                hole_vis[py, px] = True
                while hq:
                    ux, uy = hq.popleft()
                    comp.append((ux, uy))
                    for nx, ny in ((ux - 1, uy), (ux + 1, uy), (ux, uy - 1), (ux, uy + 1)):
                        if 0 <= nx < w and 0 <= ny < h and not hole_vis[ny, nx] and not bg[ny, nx]:
                            rr, gg, bb = int(r_ch[ny, nx]), int(g_ch[ny, nx]), int(b_ch[ny, nx])
                            if is_parchment_or_shadow(rr, gg, bb, ny / max(1, h)) and (rr - bb) >= 22 and rr > 214:
                                hole_vis[ny, nx] = True
                                hq.append((nx, ny))
                if len(comp) >= 40:
                    for ux, uy in comp:
                        bg[uy, ux] = True

    # Keep ONLY largest connected foreground component (+ nearby smoke/sparks > 25px) so stray border specks vanish
    fg_mask = ~bg
    comp_vis = np.zeros((h, w), dtype=bool)
    comps = []
    for py in range(h):
        for px in range(w):
            if fg_mask[py, px] and not comp_vis[py, px]:
                pts = []
                cq = deque([(px, py)])
                comp_vis[py, px] = True
                while cq:
                    ux, uy = cq.popleft()
                    pts.append((ux, uy))
                    for nx, ny in ((ux - 1, uy), (ux + 1, uy), (ux, uy - 1), (ux, uy + 1)):
                        if 0 <= nx < w and 0 <= ny < h and fg_mask[ny, nx] and not comp_vis[ny, nx]:
                            comp_vis[ny, nx] = True
                            cq.append((nx, ny))
                comps.append(pts)
    if comps:
        comps.sort(key=len, reverse=True)
        keep_mask = np.zeros((h, w), dtype=bool)
        # Keep main character + floating steam puffs / sparks / arc fragments >= 80 pixels
        for idx, pts in enumerate(comps):
            if idx == 0 or len(pts) >= 80:
                for ux, uy in pts:
                    keep_mask[uy, ux] = True
        bg = ~keep_mask

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    padded = np.pad(bg, 1, mode="constant", constant_values=True)
    adj_bg = (
        padded[:-2, 1:-1] | padded[2:, 1:-1] | padded[1:-1, :-2] | padded[1:-1, 2:]
    ) & (~bg)
    lum = 0.299 * r_ch + 0.587 * g_ch + 0.114 * b_ch
    semi = adj_bg & (lum > 184) & ((r_ch - b_ch) >= 12)
    alpha[semi] = 96

    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    return Image.fromarray(rgba, mode="RGBA")


def main():
    os.makedirs(OUT_UI, exist_ok=True)
    cards = []
    for eid in ENEMIES:
        src = Image.open(os.path.join(CONCEPT_DIR, f"dusman_secenek_{eid}.jpg")).convert("RGB")
        x0, y0, x1, y1 = find_center_crop_bounds(src)
        crop = src.crop((x0, y0, x1, y1))
        fg = remove_parchment_bg(crop)
        bbox = fg.getbbox()
        if not bbox:
            raise RuntimeError(f"Empty cutout for {eid}")
        trimmed = fg.crop(bbox)
        tw, th = trimmed.size
        size = 160
        inner = 144
        scale = min(inner / tw, inner / th)
        nw, nh = max(1, int(round(tw * scale))), max(1, int(round(th * scale)))
        resized = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
        out_fp = os.path.join(OUT_UI, f"enemy_{eid}.png")
        out.save(out_fp)
        cards.append((eid, out))
        print(f"SAVED {out_fp} crop=({x0},{y0},{x1},{y1}) -> ({tw}x{th} -> {nw}x{nh})")

    cols, rows = 7, 2
    sheet = Image.new("RGB", (cols * 176, rows * 196), (48, 28, 12))
    draw = ImageDraw.Draw(sheet)
    for idx, (eid, img) in enumerate(cards):
        c, r = idx % cols, idx // cols
        px0, py0 = c * 176 + 8, r * 196 + 8
        draw.ellipse([px0, py0, px0 + 160, py0 + 160], fill=(82, 46, 20), outline=(255, 213, 100), width=3)
        sheet.paste(img, (px0, py0), img)
        draw.text((px0 + 8, py0 + 165), eid[:20], fill=(255, 232, 160))
    sheet.save(VERIFY_OUT)
    print("PORTRAIT VERIFY SHEET:", VERIFY_OUT)


if __name__ == "__main__":
    main()
