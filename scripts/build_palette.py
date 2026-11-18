import os
import random
from PIL import Image, ImageDraw

OUT_PATH = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models/palamut_palette.png"

# 8x8 palette swatches (row-major from top-left, 128x128 per swatch)
# Each swatch defines (name, top_highlight_rgb, mid_rgb, bottom_ao_rgb)
SWATCHES = [
    # Row 0: Stone, Earth & Roads
    ("stone_cream", (245, 240, 224), (218, 211, 193), (166, 159, 143)),
    ("stone_slate", (166, 178, 190), (132, 145, 158), (88, 99, 112)),
    ("stone_moss", (152, 166, 140), (120, 134, 108), (78, 92, 70)),
    ("canyon_terracotta", (224, 148, 98), (192, 114, 68), (134, 72, 42)),
    ("canyon_ochre", (232, 179, 114), (198, 142, 82), (142, 92, 48)),
    ("earth_soil", (156, 122, 84), (124, 92, 60), (80, 56, 36)),
    ("cobble_warm", (238, 224, 198), (214, 198, 170), (168, 150, 124)),
    ("moss_dark", (94, 142, 82), (68, 112, 62), (42, 74, 42)),
    # Row 1: Wood & Foliage
    ("oak_bark", (148, 102, 66), (118, 76, 48), (74, 46, 28)),
    ("timber_warm", (196, 144, 92), (164, 114, 68), (116, 76, 42)),
    ("plank_light", (222, 180, 128), (190, 146, 98), (142, 104, 66)),
    ("foliage_sun", (128, 192, 96), (92, 156, 74), (56, 108, 52)),
    ("foliage_deep", (86, 148, 76), (62, 118, 60), (38, 82, 44)),
    ("pine_emerald", (72, 136, 94), (52, 106, 74), (34, 72, 52)),
    ("shingle_red", (232, 110, 78), (204, 82, 54), (148, 52, 34)),
    ("shingle_blue", (102, 158, 210), (74, 126, 178), (48, 86, 130)),
    # Row 2: Metals & Guilds
    ("gold_bright", (255, 226, 112), (242, 186, 60), (182, 124, 24)),
    ("brass_warm", (226, 182, 92), (192, 144, 62), (134, 92, 34)),
    ("steel_light", (206, 218, 230), (164, 178, 192), (112, 126, 140)),
    ("iron_dark", (112, 124, 138), (80, 92, 106), (48, 58, 70)),
    ("copper_rust", (212, 132, 86), (174, 96, 56), (118, 58, 32)),
    ("hazard_yellow", (248, 204, 74), (222, 166, 40), (162, 112, 22)),
    ("emerald_cloth", (106, 184, 94), (78, 148, 70), (48, 102, 46)),
    ("royal_purple", (152, 118, 212), (114, 82, 174), (72, 48, 120)),
    # Row 3: Critter Coats & Skin
    ("squirrel_fur", (240, 142, 74), (212, 110, 48), (154, 70, 28)),
    ("squirrel_cream", (252, 236, 206), (236, 212, 174), (194, 166, 128)),
    ("beaver_fur", (166, 110, 70), (134, 82, 50), (88, 50, 30)),
    ("beaver_tail", (106, 74, 52), (82, 54, 38), (52, 34, 24)),
    ("owl_blue", (134, 182, 224), (102, 148, 194), (66, 104, 148)),
    ("owl_white", (246, 250, 255), (222, 232, 242), (180, 196, 212)),
    ("hedgehog_tan", (222, 190, 148), (194, 158, 118), (146, 114, 82)),
    ("hedgehog_quill", (114, 132, 92), (86, 104, 68), (54, 68, 44)),
    # Row 4: Bear Hero, Neutrals & Glows
    ("bear_umber", (168, 112, 74), (136, 86, 54), (92, 54, 32)),
    ("bear_snout", (244, 218, 186), (222, 188, 152), (178, 142, 108)),
    ("white_pure", (255, 255, 255), (236, 240, 244), (200, 206, 214)),
    ("noir_pupil", (52, 60, 72), (30, 36, 44), (16, 20, 26)),
    ("amber_glow", (255, 224, 128), (255, 174, 62), (218, 112, 24)),
    ("cyan_crystal", (152, 246, 255), (72, 214, 244), (28, 148, 188)),
    ("flame_visor", (255, 132, 108), (242, 74, 64), (176, 36, 34)),
    ("resin_amber", (246, 178, 72), (216, 134, 38), (156, 84, 18)),
]


def lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    size = 1024
    cell = size // 8  # 128
    img = Image.new("RGB", (size, size), (120, 120, 120))
    draw = ImageDraw.Draw(img)
    rng = random.Random(20261117)

    for idx, (_name, top_c, mid_c, bot_c) in enumerate(SWATCHES):
        row = idx // 8
        col = idx % 8
        x0 = col * cell
        y0 = row * cell
        for dy in range(cell):
            t = dy / max(1, cell - 1)
            if t < 0.5:
                u = t * 2.0
                c = tuple(lerp(top_c[k], mid_c[k], u) for k in range(3))
            else:
                u = (t - 0.5) * 2.0
                c = tuple(lerp(mid_c[k], bot_c[k], u) for k in range(3))
            draw.line([(x0, y0 + dy), (x0 + cell - 1, y0 + dy)], fill=c)

        # Subtle painterly micro-variation inside padded interior
        px = img.load()
        for yy in range(y0 + 8, y0 + cell - 8):
            for xx in range(x0 + 8, x0 + cell - 8):
                jit = rng.randint(-3, 3)
                r, g, b = px[xx, yy]
                px[xx, yy] = (
                    max(0, min(255, r + jit)),
                    max(0, min(255, g + jit)),
                    max(0, min(255, b + jit)),
                )

    img.save(OUT_PATH, "PNG")
    print(f"Saved palette texture to {OUT_PATH}")


if __name__ == "__main__":
    main()
