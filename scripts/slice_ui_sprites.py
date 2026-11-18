import os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

PORTRAITS_SRC = "/Users/yasinozkan/.gemini/antigravity/brain/e1cf79ae-9857-4de3-a9bf-7018b27f5aa4/ui_portraits_sheet_1794915618723.jpg"
ICONS_SRC = "/Users/yasinozkan/.gemini/antigravity/brain/e1cf79ae-9857-4de3-a9bf-7018b27f5aa4/ui_icons_sheet_1794915668290.jpg"
OUT_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/ui"


def flood_remove_bg(cell_img: Image.Image, tol: float = 28.0) -> Image.Image:
    """Remove exterior dark background using corner-seeded BFS so dark interior eyes/shadows stay opaque."""
    rgba = cell_img.convert("RGBA")
    arr = np.array(rgba, dtype=np.int16)
    h, w, _ = arr.shape

    # Sample corner pixels to estimate cell background RGB
    corners = np.array([arr[4, 4, :3], arr[4, w - 5, :3], arr[h - 5, 4, :3], arr[h - 5, w - 5, :3]])
    bg = np.median(corners, axis=0)

    rgb = arr[:, :, :3]
    dist = np.sqrt(np.sum((rgb - bg) ** 2, axis=2))

    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    # Seed perimeter
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            if dist[y, x] <= tol and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            if dist[y, x] <= tol and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                if dist[ny, nx] <= tol:
                    visited[ny, nx] = True
                    q.append((ny, nx))

    alpha = np.where(visited, 0, 255).astype(np.uint8)
    # Soften 1px fringe where pixels transition from bg to sprite
    alpha_img = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=0.6))
    # Preserve solid center while keeping clean semi-soft outer edge
    a_arr = np.array(alpha_img, dtype=np.uint8)
    a_arr[visited] = 0
    arr[:, :, 3] = a_arr
    return Image.fromarray(arr.astype(np.uint8), mode="RGBA")


def crop_and_fit(img: Image.Image, target_size: int = 160, pad: int = 8) -> Image.Image:
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    cw, ch = img.size
    inner = target_size - pad * 2
    scale = min(inner / max(1, cw), inner / max(1, ch))
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    canvas.paste(resized, ((target_size - nw) // 2, (target_size - nh) // 2), resized)
    return canvas


def extract_grid_item(sheet: Image.Image, col: int, row: int, cols: int = 3, rows: int = 3, margin: int = 10) -> Image.Image:
    sw, sh = sheet.size
    cw = sw / cols
    ch = sh / rows
    x0 = int(round(col * cw)) + margin
    y0 = int(round(row * ch)) + margin
    x1 = int(round((col + 1) * cw)) - margin
    y1 = int(round((row + 1) * ch)) - margin
    return sheet.crop((x0, y0, x1, y1))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    portraits_sheet = Image.open(PORTRAITS_SRC)
    icons_sheet = Image.open(ICONS_SRC)

    portrait_map = [
        (0, 0, "portrait_squirrel.png"),
        (1, 0, "portrait_beaver.png"),
        (2, 0, "portrait_owl.png"),
        (0, 1, "portrait_hedgehog.png"),
        (1, 1, "portrait_bear.png"),
        (2, 1, "icon_castle_shield.png"),
    ]

    for col, row, name in portrait_map:
        cell = extract_grid_item(portraits_sheet, col, row, 3, 3, margin=12)
        cut = flood_remove_bg(cell, tol=30.0)
        final = crop_and_fit(cut, 160, pad=6)
        final.save(os.path.join(OUT_DIR, name), "PNG")
        print(f"Saved {name}")

    icon_map = [
        (0, 0, "icon_acorn_coins.png"),
        (1, 0, "icon_gems.png"),
        (2, 0, "icon_skill_rain.png"),
        (0, 1, "icon_skill_magnet.png"),
        (1, 1, "icon_chest_free.png"),
        (2, 1, "icon_chest_epic.png"),
    ]

    for col, row, name in icon_map:
        cell = extract_grid_item(icons_sheet, col, row, 3, 3, margin=10)
        cut = flood_remove_bg(cell, tol=28.0)
        final = crop_and_fit(cut, 160, pad=8)
        final.save(os.path.join(OUT_DIR, name), "PNG")
        print(f"Saved {name}")


if __name__ == "__main__":
    main()
