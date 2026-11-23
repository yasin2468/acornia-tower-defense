#!/usr/bin/env python3
"""Generate App Store screenshots (1290x2796 RGB PNG) and App Preview videos (886x1920 H.264 MP4) for en-US & tr."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "store-assets" / "raw"
OUT_DIR = ROOT / "store-assets" / "ios"
ICON_PATH = ROOT / "public" / "icon-180.png"

# Measured exact inner bounds of #phone-shell inside the 875x1024 browser capture
PHONE_CROP = (171, 34, 703, 989)

AVENIR_TTC = "/System/Library/Fonts/Avenir Next.ttc"
TARGET_SIZE = (1290, 2796)
VIDEO_SIZE = (886, 1920)


def load_font(size: int, index: int = 8) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(AVENIR_TTC, size, index=index)


SLIDES = {
    "en-US": [
        {
            "raw": "en/01.png",
            "badge": "3D WOODLAND TOWER DEFENSE",
            "title": ["DEFEND THE", "GREAT OAK"],
            "sub": "Real-time 3D battles & hero tactics",
            "theme": "emerald",
            "show_icon": True,
            "video_caption": "Defend the Great Oak in real-time 3D",
        },
        {
            "raw": "en/02.png",
            "badge": "50-STAGE CAMPAIGN",
            "title": ["50 STAGES,", "13 BIOMES"],
            "sub": "Up to 12 build pads & boss sieges",
            "theme": "emerald",
            "show_icon": False,
            "video_caption": "Explore 50 stages across 13 woodland biomes",
        },
        {
            "raw": "en/03.png",
            "badge": "8 TOWERS · 16 EVOLUTIONS",
            "title": ["ELEMENTAL", "SYNERGY COMBOS"],
            "sub": "Branching Tier-3 woodland towers",
            "theme": "mahogany",
            "show_icon": False,
            "video_caption": "Upgrade 8 towers into 16 Tier-3 evolutions",
        },
        {
            "raw": "en/04.png",
            "badge": "4 PLAYABLE HEROES",
            "title": ["COMMAND", "YOUR HEROES"],
            "sub": "Active movement & battlefield ultimates",
            "theme": "emerald",
            "show_icon": False,
            "video_caption": "Command 4 heroes directly on the battlefield",
        },
        {
            "raw": "en/05.png",
            "badge": "10-NODE TALENT TREE",
            "title": ["DEEP TACTICAL", "UPGRADES"],
            "sub": "Lv.20 unit cards & Great Oak talents",
            "theme": "mahogany",
            "show_icon": False,
            "video_caption": "Unlock Great Oak talents & Lv.20 unit upgrades",
        },
        {
            "raw": "en/06.png",
            "badge": "OFFLINE-FIRST · ZERO ADS",
            "title": ["IRON, DAILY", "& ENDLESS MODES"],
            "sub": "No account wall · Play anywhere",
            "theme": "emerald",
            "show_icon": False,
            "video_caption": "Iron Mode, Daily Mutators & Endless — 100% Offline",
        },
    ],
    "tr": [
        {
            "raw": "tr/01.png",
            "badge": "3B ORMAN KULE SAVUNMASI",
            "title": ["ULU MEŞEYİ", "SAVUN"],
            "sub": "Gerçek zamanlı 3B savaş ve kahraman taktiği",
            "theme": "emerald",
            "show_icon": True,
            "video_caption": "Gerçek zamanlı 3B savaşta Ulu Meşeyi savun",
        },
        {
            "raw": "tr/02.png",
            "badge": "50 BÖLÜMLÜK SEFER",
            "title": ["50 BÖLÜM,", "13 BİYOM"],
            "sub": "12 kule yuvası ve dev boss kuşatmaları",
            "theme": "emerald",
            "show_icon": False,
            "video_caption": "13 farklı biyomda 50 el yapımı bölümü fethet",
        },
        {
            "raw": "tr/03.png",
            "badge": "8 KULE · 16 EVRİM",
            "title": ["ELEMENT", "SİNERJİ KOMBOSU"],
            "sub": "İki yönlü 3. kademe orman kuleleri",
            "theme": "mahogany",
            "show_icon": False,
            "video_caption": "8 kuleyi 16 farklı 3. kademe evrime taşı",
        },
        {
            "raw": "tr/04.png",
            "badge": "4 OYNANABİLİR KAHRAMAN",
            "title": ["KAHRAMANINI", "YÖNET"],
            "sub": "Patikada doğrudan hamle ve güçlü ultiler",
            "theme": "emerald",
            "show_icon": False,
            "video_caption": "4 kahramanı savaş alanında doğrudan yönlendir",
        },
        {
            "raw": "tr/05.png",
            "badge": "10 DÜĞÜMLÜ YETENEK AĞACI",
            "title": ["DERİN TAKTİK", "GELİŞİM SİSTEMİ"],
            "sub": "Sv.20 birim kartları ve Ulu Meşe kökleri",
            "theme": "mahogany",
            "show_icon": False,
            "video_caption": "Ulu Meşe yetenek ağacı ve Sv.20 yükseltmeler",
        },
        {
            "raw": "tr/06.png",
            "badge": "TAMAMEN ÇEVRİMDIŞI · REKLAMSIZ",
            "title": ["DEMİR, GÜNLÜK", "VE SONSUZ MOD"],
            "sub": "Hesap açmadan her yerde çevrimdışı oyna",
            "theme": "emerald",
            "show_icon": False,
            "video_caption": "Demir Mod, Günlük Mücadele ve Sonsuz Kuşatma",
        },
    ],
}

THEMES = {
    "emerald": {
        "top": (27, 51, 29),
        "bottom": (10, 20, 12),
        "glow": (122, 198, 86),
        "badge_bg": (38, 66, 36),
        "badge_border": (236, 189, 76),
        "badge_fg": (255, 224, 130),
        "sub_fg": (205, 232, 184),
    },
    "mahogany": {
        "top": (48, 25, 13),
        "bottom": (15, 8, 4),
        "glow": (228, 162, 54),
        "badge_bg": (58, 32, 16),
        "badge_border": (244, 196, 84),
        "badge_fg": (255, 228, 146),
        "sub_fg": (242, 209, 152),
    },
}


def make_gradient_bg(size: tuple[int, int], theme_id: str) -> Image.Image:
    w, h = size
    t = THEMES[theme_id]
    r1, g1, b1 = t["top"]
    r2, g2, b2 = t["bottom"]
    col = Image.new("RGB", (1, h))
    px = col.load()
    for y in range(h):
        k = y / (h - 1)
        # smooth ease
        k = k * 0.88 + 0.12 * (k * k)
        px[0, y] = (
            int(r1 + (r2 - r1) * k),
            int(g1 + (g2 - g1) * k),
            int(b1 + (b2 - b1) * k),
        )
    bg = col.resize((w, h), Image.Resampling.BILINEAR).convert("RGBA")

    # Soft radial ambient glow behind phone frame
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gr, gg, gb = t["glow"]
    gdraw.ellipse((w // 2 - 620, 740, w // 2 + 620, 2120), fill=(gr, gg, gb, 55))
    gdraw.ellipse((w // 2 - 420, 320, w // 2 + 420, 960), fill=(255, 210, 95, 24))
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    return Image.alpha_composite(bg, glow)


def round_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def render_screenshot(lang: str, idx: int, spec: dict) -> Path:
    W, H = TARGET_SIZE
    t = THEMES[spec["theme"]]
    canvas = make_gradient_bg(TARGET_SIZE, spec["theme"])
    draw = ImageDraw.Draw(canvas)

    badge_font = load_font(34, index=0)   # Avenir Next Bold
    title_font = load_font(96, index=8)   # Avenir Next Heavy
    sub_font = load_font(44, index=2)     # Avenir Next Demi Bold

    y_cursor = 112

    # Optional hero slide app icon + pill header
    if spec["show_icon"] and ICON_PATH.exists():
        icon = Image.open(ICON_PATH).convert("RGBA").resize((126, 126), Image.Resampling.LANCZOS)
        icon_mask = round_mask((126, 126), 28)
        icon.putalpha(icon_mask)

        badge_text = spec["badge"]
        bb = draw.textbbox((0, 0), badge_text, font=badge_font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        pill_w = tw + 68
        pill_h = 68
        total_w = 126 + 26 + pill_w
        start_x = (W - total_w) // 2

        canvas.paste(icon, (start_x, y_cursor - 10), icon)
        draw.rounded_rectangle(
            (start_x - 2, y_cursor - 12, start_x + 128, y_cursor + 118),
            radius=30,
            outline=t["badge_border"],
            width=4,
        )

        px0 = start_x + 126 + 26
        py0 = y_cursor + 18
        draw.rounded_rectangle(
            (px0, py0, px0 + pill_w, py0 + pill_h),
            radius=pill_h // 2,
            fill=t["badge_bg"],
            outline=t["badge_border"],
            width=3,
        )
        draw.text(
            (px0 + pill_w // 2, py0 + pill_h // 2 - 2),
            badge_text,
            font=badge_font,
            fill=t["badge_fg"],
            anchor="mm",
        )
        y_cursor += 156
    else:
        badge_text = spec["badge"]
        bb = draw.textbbox((0, 0), badge_text, font=badge_font)
        tw = bb[2] - bb[0]
        pill_w = tw + 72
        pill_h = 64
        px0 = (W - pill_w) // 2
        draw.rounded_rectangle(
            (px0, y_cursor, px0 + pill_w, y_cursor + pill_h),
            radius=pill_h // 2,
            fill=t["badge_bg"],
            outline=t["badge_border"],
            width=3,
        )
        draw.text(
            (W // 2, y_cursor + pill_h // 2 - 2),
            badge_text,
            font=badge_font,
            fill=t["badge_fg"],
            anchor="mm",
        )
        y_cursor += 110

    # Headline (2 lines)
    for line in spec["title"]:
        # Soft dark drop shadow
        draw.text((W // 2, y_cursor + 5), line, font=title_font, fill=(0, 0, 0, 150), anchor="ma")
        draw.text((W // 2, y_cursor), line, font=title_font, fill=(255, 250, 238, 255), anchor="ma")
        y_cursor += 110

    y_cursor += 12
    draw.text((W // 2, y_cursor), spec["sub"], font=sub_font, fill=t["sub_fg"] + (255,), anchor="ma")
    y_cursor += 96

    # Frame the tightly cropped #phone-shell inside a sleek iPhone bezel
    raw_im = Image.open(RAW_DIR / spec["raw"]).convert("RGB").crop(PHONE_CROP)
    screen_w = 1044
    screen_h = int(round(screen_w * (raw_im.height / raw_im.width)))
    max_screen_h = H - y_cursor - 96
    if screen_h > max_screen_h:
        screen_h = max_screen_h
        screen_w = int(round(screen_h * (raw_im.width / raw_im.height)))

    screen_im = raw_im.resize((screen_w, screen_h), Image.Resampling.LANCZOS).convert("RGBA")
    sx = (W - screen_w) // 2
    sy = y_cursor + (H - y_cursor - screen_h) // 2 - 12

    bezel_pad = 18
    bx0, by0 = sx - bezel_pad, sy - bezel_pad
    bx1, by1 = sx + screen_w + bezel_pad, sy + screen_h + bezel_pad

    # Shadow layer
    shadow = Image.new("RGBA", TARGET_SIZE, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((bx0, by0 + 26, bx1, by1 + 26), radius=74, fill=(0, 0, 0, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(42))
    canvas = Image.alpha_composite(canvas, shadow)
    draw = ImageDraw.Draw(canvas)

    # Metallic oak-titanium phone shell
    draw.rounded_rectangle(
        (bx0, by0, bx1, by1),
        radius=72,
        fill=(24, 19, 16, 255),
        outline=(188, 152, 92, 230),
        width=5,
    )
    draw.rounded_rectangle(
        (bx0 + 6, by0 + 6, bx1 - 6, by1 - 6),
        radius=66,
        outline=(55, 45, 38, 255),
        width=4,
    )

    smask = round_mask((screen_w, screen_h), 54)
    screen_im.putalpha(smask)
    canvas.paste(screen_im, (sx, sy), screen_im)

    out_dir = OUT_DIR / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{idx:02d}.png"
    # Apple requires RGB PNG without alpha channel
    canvas.convert("RGB").save(out_path, format="PNG", optimize=True)
    return out_path


def make_video_frame(raw_rel: str, caption: str, zoom: float = 1.0) -> Image.Image:
    """Create full-bleed 886x1920 pure in-app video keyframe (zero clipped HUD, blurred ambient extend, crisp caption bar)."""
    VW, VH = VIDEO_SIZE
    raw_im = Image.open(RAW_DIR / raw_rel).convert("RGB").crop(PHONE_CROP)

    # Full-bleed darkened ambient backdrop from the exact same live gameplay frame
    bg_scale = max(VW / raw_im.width, VH / raw_im.height)
    bw, bh = int(round(raw_im.width * bg_scale)), int(round(raw_im.height * bg_scale))
    bg_full = raw_im.resize((bw, bh), Image.Resampling.BILINEAR)
    bcx, bcy = (bw - VW) // 2, (bh - VH) // 2
    backdrop = bg_full.crop((bcx, bcy, bcx + VW, bcy + VH)).filter(ImageFilter.GaussianBlur(36))
    dark_tint = Image.new("RGBA", VIDEO_SIZE, (12, 16, 10, 155))
    canvas = Image.alpha_composite(backdrop.convert("RGBA"), dark_tint)

    # Full-width uncropped gameplay screen centered cleanly (886 x ~1590) -> 0 HUD clipping
    fg_w = VW
    fg_h = int(round(VW * (raw_im.height / raw_im.width)))
    fg = raw_im.resize((fg_w, fg_h), Image.Resampling.LANCZOS).convert("RGBA")
    fy = max(48, (VH - fg_h) // 2 - 42)
    canvas.paste(fg, (0, fy), fg)

    # Crisp bottom-safe gameplay callout pill sitting cleanly below/along the lower backdrop
    overlay = Image.new("RGBA", VIDEO_SIZE, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    cap_font = load_font(33, index=0)  # Avenir Next Bold
    bb = odraw.textbbox((0, 0), caption, font=cap_font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad_x, pad_y = 34, 18
    box_w = min(VW - 56, tw + pad_x * 2)
    box_h = th + pad_y * 2 + 8
    bx0 = (VW - box_w) // 2
    by0 = min(VH - box_h - 48, fy + fg_h + 24)
    odraw.rounded_rectangle(
        (bx0, by0, bx0 + box_w, by0 + box_h),
        radius=24,
        fill=(22, 14, 9, 232),
        outline=(236, 189, 76, 240),
        width=3,
    )
    odraw.text(
        (VW // 2, by0 + box_h // 2 - 2),
        caption,
        font=cap_font,
        fill=(255, 248, 230, 255),
        anchor="mm",
    )
    return Image.alpha_composite(canvas, overlay).convert("RGB")


def render_app_preview_video(lang: str, specs: list[dict]) -> Path:
    """Build Apple App Preview MP4 (886x1920, H.264 High@4.0 yuv420p, 30fps, AAC stereo 44.1kHz)."""
    out_dir = OUT_DIR / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir = ROOT / "store-assets" / "_tmp_video" / lang
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Order clips: start immediately with live combat (poster frame), map, tower evo, hero, talents, modes
    clip_paths: list[Path] = []
    # Upscale base frame slightly (974x2112) so zoompan / gentle push-in stays tack-sharp
    for i, spec in enumerate(specs, start=1):
        img = make_video_frame(spec["raw"], spec["video_caption"], zoom=1.0)
        p = tmp_dir / f"frame_{i:02d}.png"
        img.save(p, format="PNG")
        clip_paths.append(p)

    # 6 clips x 3.9s with 0.45s fade transitions -> 6*3.9 - 5*0.45 = 21.15 seconds (Apple requirement: 15-30s)
    clip_dur = 3.9
    fade_dur = 0.45
    fps = 30

    inputs: list[str] = []
    filter_parts: list[str] = []

    for i, p in enumerate(clip_paths):
        inputs.extend(["-i", str(p)])
        # Gentle smooth Ken Burns zoom from 1.00 -> 1.05 across clip duration (zoompan expands 1 image into `frames` frames)
        frames = int(round(clip_dur * fps))
        direction = f"1.0+0.05*on/{frames}" if i % 2 == 0 else f"1.05-0.05*on/{frames}"
        filter_parts.append(
            f"[{i}:v]scale=1064:2304,zoompan=z='{direction}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=886x1920:fps={fps},setpts=PTS-STARTPTS[v{i}]"
        )

    # Chain xfade transitions cleanly
    prev = "[v0]"
    offset = clip_dur - fade_dur
    for i in range(1, len(clip_paths)):
        out_lbl = f"[vx{i}]" if i < len(clip_paths) - 1 else "[vfinal]"
        trans = "smoothleft" if i % 2 == 1 else "fade"
        filter_parts.append(
            f"{prev}[v{i}]xfade=transition={trans}:duration={fade_dur}:offset={offset:.2f}{out_lbl}"
        )
        prev = out_lbl
        offset += clip_dur - fade_dur

    total_dur = len(clip_paths) * clip_dur - (len(clip_paths) - 1) * fade_dur
    # Add silent stereo 44.1kHz audio source (Apple App Preview requirement)
    filter_parts.append(f"aevalsrc=0:channel_layout=stereo:sample_rate=44100:d={total_dur:.2f}[afinal]")

    out_mp4 = out_dir / ("preview_en_886x1920.mp4" if lang == "en-US" else "preview_tr_886x1920.mp4")
    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        "[vfinal]",
        "-map",
        "[afinal]",
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-level:v",
        "4.0",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(fps),
        "-b:v",
        "8M",
        "-maxrate",
        "10M",
        "-bufsize",
        "16M",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        str(out_mp4),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stderr, file=sys.stderr)
        raise RuntimeError(f"ffmpeg failed for {lang}")
    return out_mp4


def main() -> None:
    for lang, specs in SLIDES.items():
        print(f"Building {lang} screenshots...")
        for i, spec in enumerate(specs, start=1):
            p = render_screenshot(lang, i, spec)
            print(f"  -> {p.relative_to(ROOT)}")
        print(f"Building {lang} App Preview video...")
        v = render_app_preview_video(lang, specs)
        print(f"  -> {v.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
