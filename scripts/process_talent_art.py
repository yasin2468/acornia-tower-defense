"""Process talent tree painted background and 10 skill medallions into public/ui/oak/."""

import glob
import os
from PIL import Image, ImageOps

from process_unit_and_acc_art import OAK_DIR, flood_remove_white_bg, trim_and_fit

BRAIN_DIR = "/Users/yasinozkan/.gemini/antigravity/brain/e1cf79ae-9857-4de3-a9bf-7018b27f5aa4"

SHEET_NAMES = [
    "talent_tower_power.png",
    "talent_hero_soul.png",
    "talent_forest_magic.png",
    "talent_start_economy.png",
    "talent_siege_ordnance.png",
    "talent_pack_warden.png",
    "talent_frost_alchemy.png",
    "talent_war_logistics.png",
    "talent_apex_warlord.png",
]


def latest(pattern: str) -> str:
    hits = sorted(glob.glob(os.path.join(BRAIN_DIR, pattern)), key=os.path.getmtime, reverse=True)
    if not hits:
        raise FileNotFoundError(f"Missing generated asset matching {pattern}")
    return hits[0]


def pad_white(img: Image.Image, pad: int = 8) -> Image.Image:
    w, h = img.size
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (255, 255, 255, 255))
    canvas.paste(img.convert("RGBA"), (pad, pad))
    return canvas


def verify_corners_transparent(img: Image.Image, label: str) -> None:
    w, h = img.size
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if img.getpixel((x, y))[3] != 0:
            raise AssertionError(f"{label} corner ({x},{y}) is not transparent")


def main() -> None:
    os.makedirs(OAK_DIR, exist_ok=True)

    bg_src = latest("great_oak_skill_tree_bg_*.jpg")
    bg_img = ImageOps.fit(
        Image.open(bg_src).convert("RGB"),
        (512, 576),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.48),
    )
    bg_out = os.path.join(OAK_DIR, "talent_tree_bg.jpg")
    bg_img.save(bg_out, "JPEG", quality=86, optimize=True)
    print(f"BG OK: {bg_out} ({bg_img.size}, {os.path.getsize(bg_out)} B)")

    sheet_src = latest("palamut_skill_medallions_3x3_*.jpg")
    sheet = Image.open(sheet_src).convert("RGBA")
    sw, sh = sheet.size
    cw = sw / 3.0
    ch = sh / 3.0

    for idx, fname in enumerate(SHEET_NAMES):
        col = idx % 3
        row = idx // 3
        cell = sheet.crop((int(round(col * cw)), int(round(row * ch)), int(round((col + 1) * cw)), int(round((row + 1) * ch))))
        rgba = flood_remove_white_bg(pad_white(cell, 8), threshold=235, feather_lo=208)
        out = trim_and_fit(rgba, 128, pad_px=3)
        verify_corners_transparent(out, fname)
        out_path = os.path.join(OAK_DIR, fname)
        out.save(out_path, "PNG", optimize=True)
        print(f"TALENT OK: {out_path} ({out.size}, {os.path.getsize(out_path)} B)")

    aegis_src = latest("great_oak_aegis_medallion_*.jpg")
    aegis_img = Image.open(aegis_src)
    aegis_rgba = flood_remove_white_bg(pad_white(aegis_img, 8), threshold=236, feather_lo=210)
    aegis_out = trim_and_fit(aegis_rgba, 128, pad_px=3)
    verify_corners_transparent(aegis_out, "talent_world_tree_aegis.png")
    aegis_path = os.path.join(OAK_DIR, "talent_world_tree_aegis.png")
    aegis_out.save(aegis_path, "PNG", optimize=True)
    print(f"TALENT OK: {aegis_path} ({aegis_out.size}, {os.path.getsize(aegis_path)} B)")


if __name__ == "__main__":
    main()
