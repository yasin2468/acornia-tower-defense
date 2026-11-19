"""Process generated 2D painted portraits & 3x3 accessory icon sheets into crisp transparent RGBA PNGs.

- Portraits -> 160x160 RGBA PNGs in public/ui/ (exact same outer transparency, crisp border, and size as portrait_bear.png)
- Accessory Icons -> 128x128 RGBA PNGs in public/ui/oak/acc_<category>_<id>.png
"""

from collections import deque
import glob
import os
import sys
from PIL import Image

BRAIN_DIR = "/Users/yasinozkan/.gemini/antigravity/brain/e1cf79ae-9857-4de3-a9bf-7018b27f5aa4"
UI_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/ui"
OAK_DIR = os.path.join(UI_DIR, "oak")


def find_latest(pattern: str) -> str:
    matches = sorted(glob.glob(os.path.join(BRAIN_DIR, pattern)), key=os.path.getmtime, reverse=True)
    if not matches:
        raise FileNotFoundError(f"No match for {pattern} in {BRAIN_DIR}")
    return matches[0]


def flood_remove_white_bg(img: Image.Image, threshold: int = 236, feather_lo: int = 216) -> Image.Image:
    """Flood-fill exterior near-white pixels from image borders so interior highlights remain intact."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]
    q = deque()

    def is_bg(r: int, g: int, b: int) -> bool:
        return r >= threshold and g >= threshold and b >= threshold and max(r, g, b) - min(r, g, b) <= 22

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x]:
                r, g, b, _ = px[x, y]
                if is_bg(r, g, b):
                    visited[y][x] = True
                    q.append((x, y))

    while q:
        cx, cy = q.popleft()
        px[cx, cy] = (0, 0, 0, 0)
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, _ = px[nx, ny]
                if is_bg(r, g, b):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    # Soften 1px anti-aliased edge bordering transparent pixels
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            has_trans_nbr = any(px[nx, ny][3] == 0 for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
            if has_trans_nbr:
                lum = (r + g + b) / 3.0
                if lum >= feather_lo and max(r, g, b) - min(r, g, b) <= 28:
                    ratio = max(0.0, min(1.0, (threshold - lum) / max(1.0, threshold - feather_lo)))
                    new_a = int(round(a * ratio))
                    px[x, y] = (r, g, b, new_a)

    return rgba


def trim_and_fit(rgba: Image.Image, target_size: int, pad_px: int = 2) -> Image.Image:
    bbox = rgba.getbbox()
    if not bbox:
        return Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    crop = rgba.crop(bbox)
    cw, ch = crop.size
    max_dim = target_size - pad_px * 2
    scale = min(max_dim / max(1, cw), max_dim / max(1, ch))
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    ox = (target_size - nw) // 2
    oy = (target_size - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def process_portrait(src_path: str, out_name: str, size: int = 160) -> None:
    img = Image.open(src_path)
    rgba = flood_remove_white_bg(img, threshold=236, feather_lo=210)
    out = trim_and_fit(rgba, size, pad_px=2)
    out_path = os.path.join(UI_DIR, out_name)
    out.save(out_path, "PNG", optimize=True)
    print(f"PORTRAIT OK: {out_path} ({out.size}, {os.path.getsize(out_path)} B)")


def process_3x3_sheet(src_path: str, out_names: list[str], icon_size: int = 128) -> None:
    os.makedirs(OAK_DIR, exist_ok=True)
    sheet = Image.open(src_path).convert("RGBA")
    sw, sh = sheet.size
    cell_w = sw / 3.0
    cell_h = sh / 3.0
    for idx, fname in enumerate(out_names):
        col = idx % 3
        row = idx // 3
        x0 = int(round(col * cell_w))
        y0 = int(round(row * cell_h))
        x1 = int(round((col + 1) * cell_w))
        y1 = int(round((row + 1) * cell_h))
        cell = sheet.crop((x0, y0, x1, y1))
        rgba = flood_remove_white_bg(cell, threshold=235, feather_lo=208)
        out = trim_and_fit(rgba, icon_size, pad_px=6)
        out_path = os.path.join(OAK_DIR, fname)
        out.save(out_path, "PNG", optimize=True)
        print(f"ICON OK: {out_path} ({out.size}, {os.path.getsize(out_path)} B)")


def main() -> None:
    portrait_specs = [
        ("kizil_kuyruk_*.jpg", "portrait_fox.png"),
        ("kaya_dis_*.jpg", "portrait_boar.png"),
        ("gumus_kurt_*.jpg", "portrait_wolf.png"),
        ("porsuk_*.jpg", "portrait_badger.png"),
        ("*falcon*.jpg", "portrait_falcon.png"),
        ("kaplumbaga_*.jpg", "portrait_tortoise.png"),
        ("vasak_*.jpg", "portrait_lynx.png"),
    ]
    for pat, out_name in portrait_specs:
        src = find_latest(pat)
        process_portrait(src, out_name, size=160)

    hats_sheet = find_latest("accessory_icons_3x3_sheet_*.jpg")
    process_3x3_sheet(
        hats_sheet,
        [
            "acc_hat_none.png",
            "acc_hat_pirate.png",
            "acc_hat_chef.png",
            "acc_hat_wizard.png",
            "acc_hat_viking.png",
            "acc_hat_crown.png",
            "acc_hat_goggles.png",
            "acc_hat_antlers.png",
            "acc_hat_samurai.png",
        ],
    )

    ab_sheet = find_latest("*aura*banner*.jpg")
    process_3x3_sheet(
        ab_sheet,
        [
            "acc_aura_emerald_leaf.png",
            "acc_aura_solar_ember.png",
            "acc_aura_frost_crystal.png",
            "acc_aura_arcane_star.png",
            "acc_banner_oak_crest.png",
            "acc_banner_iron_ward.png",
            "acc_banner_storm_feather.png",
            "acc_banner_crimson_flame.png",
            "acc_aura_none.png",
        ],
    )
    # Reuse the clean brass seal as acc_banner_none.png too
    src_none = os.path.join(OAK_DIR, "acc_aura_none.png")
    dst_none = os.path.join(OAK_DIR, "acc_banner_none.png")
    Image.open(src_none).save(dst_none, "PNG", optimize=True)
    print(f"ICON OK: {dst_none}")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as exc:
        print(f"WAIT: {exc}", file=sys.stderr)
        sys.exit(2)
