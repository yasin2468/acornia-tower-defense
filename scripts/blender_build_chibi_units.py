"""Palamut Kalesi — Headless Blender 5.2 production pipeline for Chibi Animal Warriors.

Generates all 16 approved tower upgrade/branch .glb models (Squirrel, Beaver, Owl V4, Hedgehog x4 tiers/branches)
plus 3 rigged, animated Boz Pence bear hero class .glb models (Classic, Viking, Royal) in:
  /Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models/

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_chibi_units.py
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_chibi_units.py -- --verify
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_chibi_units.py -- tower_owl_t1 tower_owl_t2 tower_owl_chain tower_owl_blizzard
"""
import json
import math
import os
import posixpath
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from blender_custom_tower_bases import build_custom_tower_base  # noqa: E402

OUT_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models"
CC0 = "/tmp/palamut_cc0"
DERIVED = os.path.join(CC0, "_derived")
CHIBI_TEX = os.path.join(CC0, "_derived_chibi")
os.makedirs(DERIVED, exist_ok=True)
os.makedirs(CHIBI_TEX, exist_ok=True)

HEX = os.path.join(CC0, "kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf")
HEX_B = os.path.join(HEX, "buildings")
HEX_P = os.path.join(HEX, "decoration/props")
HEX_ATLAS = os.path.join(CC0, "kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Textures/hexagons_medieval.png")
ADV = os.path.join(CC0, "kaykit_adv/addons/kaykit_character_pack_adventures")
ADV_C = os.path.join(ADV, "Characters/gltf")
ADV_A = os.path.join(ADV, "Assets/gltf")
Q = os.path.join(CC0, "quaternius/public/glb")

ATLAS_PATH = os.path.join(CHIBI_TEX, "animal_chibi_atlas.png")

CREW_SCALE = 0.36
HERO_SCALE = 0.56

ATLAS_SWATCHES = [
    ("#8f2d14", "#f5853b"),  # 0: Squirrel vibrant red-orange fur
    ("#4a2314", "#a65c32"),  # 1: Chestnut brown fur
    ("#8c5619", "#f5b84d"),  # 2: Golden honey fur
    ("#bfa382", "#fff4e3"),  # 3: Soft cream/beige muzzle & belly
    ("#3d2213", "#8c5230"),  # 4: Chocolate beaver fur
    ("#261b15", "#664b3b"),  # 5: Dark walnut / nose-leather / bear snout
    ("#4d5866", "#bdc9d9"),  # 6: Silver-grey plumage/fur
    ("#634623", "#cfa05b"),  # 7: Tawny plumage/fur
    ("#b3c2cf", "#ffffff"),  # 8: Arctic white
    ("#221c26", "#5e4c5c"),  # 9: Dark slate-brown hedgehog quill base
    ("#c4b79e", "#fffcf2"),  # 10: Ivory teeth / fangs / quill tips
    ("#254666", "#70beff"),  # 11: Metallic frost-blue accent
    ("#161821", "#3e4559"),  # 12: Noble black bear charcoal fur
    ("#80181e", "#ed4a45"),  # 13: Crimson ranger scarf / beret
    ("#8c5b16", "#fad04b"),  # 14: Warm gold beak / crown / band
    ("#0d6e66", "#5ef5de"),  # 15: Emerald-cyan rune / headband
]

_IMG_CACHE = {}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def hex_lin(h):
    r, g, b = hex_rgb(h)
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def _load_pixels_img(path):
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    return px, w, h


def _save_pixels_img(px, w, h, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    name = os.path.basename(out_path)
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])
    out = bpy.data.images.new(name, w, h, alpha=True)
    out.pixels = px.ravel().tolist()
    out.filepath_raw = out_path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)


CC0_SOURCES = [
    (
        "kaykit_medieval_hex",
        "KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/main",
        [
            "addons/kaykit_medieval_hexagon_pack/Textures/hexagons_medieval.png",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/blue/building_tower_base_blue.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/red/building_tower_base_red.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/yellow/building_tower_base_yellow.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/green/building_tower_base_green.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/yellow/building_tower_catapult_yellow.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/neutral/projectile_catapult.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_blue.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_red.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_yellow.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_green.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/target.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/bucket_arrows.gltf",
            "addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/barrel.gltf",
        ],
    ),
    (
        "kaykit_adv",
        "KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main",
        [
            "addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb",
            "addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb",
            "addons/kaykit_character_pack_adventures/Characters/gltf/Barbarian.glb",
            "addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb",
            "addons/kaykit_character_pack_adventures/Assets/gltf/mage_texture.png",
            "addons/kaykit_character_pack_adventures/Assets/gltf/rogue_texture.png",
            "addons/kaykit_character_pack_adventures/Assets/gltf/barbarian_texture.png",
            "addons/kaykit_character_pack_adventures/Assets/gltf/knight_texture.png",
            "addons/kaykit_character_pack_adventures/Assets/gltf/quiver.gltf",
            "addons/kaykit_character_pack_adventures/Assets/gltf/crossbow_2handed.gltf",
        ],
    ),
    (
        "quaternius",
        "trebeljahr/quaternius-showcase/main",
        [
            "public/glb/rpg_items_pack/Crystal3.glb",
            "public/glb/rpg_items_pack/Crown.glb",
            "public/glb/modular_sci_fi_guns_pack/Sniper_1.glb",
            "public/glb/modular_sci_fi_guns_pack/Crossbow_2.glb",
            "public/glb/medieval_weapons_pack/Bow_Golden.glb",
            "public/glb/cyberpunk_pack/Turret_GunDouble.glb",
            "public/glb/platformer_game_pack/Cannon.glb",
            "public/glb/platformer_game_pack/Hazard_Saw.glb",
        ],
    ),
]


def _download_raw_file(repo_branch, rel_path, dest_dir):
    local_path = os.path.join(dest_dir, rel_path)
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return local_path
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    quoted = urllib.parse.quote(rel_path)
    url = f"https://raw.githubusercontent.com/{repo_branch}/{quoted}"
    headers = {"User-Agent": "PalamutKalesi-ChibiBuilder/1.0"}
    data = None
    ca_file = "/etc/ssl/cert.pem"
    try:
        ctx = ssl.create_default_context(cafile=ca_file) if os.path.exists(ca_file) else None
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
            data = resp.read()
    except Exception:
        data = subprocess.check_output(
            ["curl", "-fsSL", "--max-time", "45", "-A", headers["User-Agent"], url]
        )
    if not data:
        raise RuntimeError(f"Empty download from {url}")
    with open(local_path, "wb") as f:
        f.write(data)
    return local_path


def ensure_cc0_sources():
    """Ensure all required CC0 source models and referenced .bin/.png dependencies exist under /tmp/palamut_cc0."""
    for folder, repo_branch, rel_paths in CC0_SOURCES:
        dest_dir = os.path.join(CC0, folder)
        for rel_path in rel_paths:
            local_path = _download_raw_file(repo_branch, rel_path, dest_dir)
            if rel_path.lower().endswith(".gltf"):
                with open(local_path, "r", encoding="utf-8") as f:
                    gltf_json = json.load(f)
                base_dir = posixpath.dirname(rel_path)
                for sec in ("buffers", "images"):
                    for item in gltf_json.get(sec, []):
                        uri = item.get("uri")
                        if uri and not uri.startswith("data:"):
                            dep_rel = posixpath.normpath(posixpath.join(base_dir, uri))
                            _download_raw_file(repo_branch, dep_rel, dest_dir)


def ensure_warm_hex_atlas():
    out_path = os.path.join(DERIVED, "hexagons_medieval_warm.png")
    if os.path.exists(out_path):
        return out_path
    px, w, h = _load_pixels_img(HEX_ATLAS)
    cw, ch = w // 8, h // 4
    cells = {
        (0, 2): ("#ab926d", "#f4e7ce"),
        (0, 3): ("#725e4a", "#ac967c"),
        (3, 1): ("#ad3c28", "#f78b5e"),
    }
    for (row, col), (dark, light) in cells.items():
        y0 = h - (row + 1) * ch
        x0 = col * cw
        cell = px[y0:y0 + ch, x0:x0 + cw, :3]
        lum = cell @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
        lo, hi = float(lum.min()), float(lum.max())
        t = (lum - lo) / max(hi - lo, 1e-4)
        dk = np.array(hex_rgb(dark), dtype=np.float32)
        lt = np.array(hex_rgb(light), dtype=np.float32)
        px[y0:y0 + ch, x0:x0 + cw, :3] = dk[None, None, :] + t[..., None] * (lt - dk)[None, None, :]
    _save_pixels_img(px, w, h, out_path)
    return out_path


def ensure_animal_chibi_atlas():
    if os.path.exists(ATLAS_PATH):
        return ATLAS_PATH
    w, h = 512, 256
    cw = w // 16
    px = np.zeros((h, w, 4), dtype=np.float32)
    px[..., 3] = 1.0
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]  # Blender image bottom->top
    for idx, (dk_h, lt_h) in enumerate(ATLAS_SWATCHES):
        dk = np.array(hex_rgb(dk_h), dtype=np.float32)
        lt = np.array(hex_rgb(lt_h), dtype=np.float32)
        grad = dk[None, None, :] + t * (lt - dk)[None, None, :]
        px[:, idx * cw:(idx + 1) * cw, :3] = np.clip(grad, 0.0, 1.0)
    _save_pixels_img(px, w, h, ATLAS_PATH)
    return ATLAS_PATH


def ensure_kaykit_variant_tex(char_key, variant_name, paw_hex, hue_shift=0.0, sat_mult=1.0, val_mult=1.0,
                              armor_tint=None, armor_mix=0.0):
    out_path = os.path.join(CHIBI_TEX, f"{char_key}_{variant_name}.png")
    if os.path.exists(out_path):
        return out_path
    src_path = os.path.join(ADV_A, f"{char_key}_texture.png")
    px, w, h = _load_pixels_img(src_path)
    rgb = px[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    skin_mask = (r > 0.72) & (g > 0.50) & (g < 0.88) & (b > 0.35) & (b < 0.75) & ((r - b) > 0.12) & ((r - g) < 0.30)

    out_rgb = rgb.copy()
    if abs(hue_shift) > 1e-3 or abs(sat_mult - 1.0) > 1e-3 or abs(val_mult - 1.0) > 1e-3 or armor_mix > 0.0:
        flat = out_rgb.reshape(-1, 3)
        mx = flat.max(axis=1)
        mn = flat.min(axis=1)
        df = mx - mn
        sat = np.where(mx > 1e-4, df / np.maximum(mx, 1e-4), 0.0)
        hue = np.zeros_like(mx)
        nz = df > 1e-4
        hue = np.where(nz & (mx == flat[:, 0]), ((flat[:, 1] - flat[:, 2]) / np.maximum(df, 1e-5)) % 6.0, hue)
        hue = np.where(nz & (mx == flat[:, 1]), (flat[:, 2] - flat[:, 0]) / np.maximum(df, 1e-5) + 2.0, hue)
        hue = np.where(nz & (mx == flat[:, 2]), (flat[:, 0] - flat[:, 1]) / np.maximum(df, 1e-5) + 4.0, hue)
        hue = (hue / 6.0) % 1.0

        s_flat = skin_mask.reshape(-1)
        is_cloth = (~s_flat) & (sat > 0.16)
        new_h = np.where(is_cloth, (hue + hue_shift) % 1.0, hue)
        new_s = np.where(is_cloth, np.clip(sat * sat_mult, 0.0, 1.0), sat)
        new_v = np.where(is_cloth, np.clip(mx * val_mult, 0.0, 1.0), mx)

        h6 = new_h * 6.0
        i = np.floor(h6).astype(np.int32) % 6
        f = h6 - np.floor(h6)
        p = new_v * (1.0 - new_s)
        q = new_v * (1.0 - new_s * f)
        t_v = new_v * (1.0 - new_s * (1.0 - f))
        res = np.zeros_like(flat)
        m0 = i == 0; res[m0] = np.stack([new_v[m0], t_v[m0], p[m0]], axis=1)
        m1 = i == 1; res[m1] = np.stack([q[m1], new_v[m1], p[m1]], axis=1)
        m2 = i == 2; res[m2] = np.stack([p[m2], new_v[m2], t_v[m2]], axis=1)
        m3 = i == 3; res[m3] = np.stack([p[m3], q[m3], new_v[m3]], axis=1)
        m4 = i == 4; res[m4] = np.stack([t_v[m4], p[m4], new_v[m4]], axis=1)
        m5 = i == 5; res[m5] = np.stack([new_v[m5], p[m5], q[m5]], axis=1)

        if armor_tint and armor_mix > 0.0:
            at = np.array(hex_rgb(armor_tint), dtype=np.float32)[None, :]
            is_armor = (~s_flat) & (sat <= 0.22) & (mx > 0.25)
            res[is_armor] = res[is_armor] * (1.0 - armor_mix) + (at * (0.4 + 0.6 * mx[is_armor, None])) * armor_mix
        out_rgb = res.reshape(h, w, 3)

    paw = np.array(hex_rgb(paw_hex), dtype=np.float32)
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    paw_shaded = np.clip(paw[None, None, :] * (0.45 + 0.72 * lum[..., None]), 0.0, 1.0)
    out_rgb = np.where(skin_mask[..., None], paw_shaded, out_rgb)
    px[..., :3] = np.clip(out_rgb, 0.0, 1.0)
    _save_pixels_img(px, w, h, out_path)
    return out_path


# ---------------------------------------------------------------------------
# Blender Scene & Material Helpers
# ---------------------------------------------------------------------------

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _IMG_CACHE.clear()


def _load_img(path):
    img = _IMG_CACHE.get(path)
    try:
        valid = img is not None and img.name in bpy.data.images
    except ReferenceError:
        valid = False
    if not valid:
        img = bpy.data.images.load(path, check_existing=True)
        _IMG_CACHE[path] = img
    return img


def get_atlas_mat():
    mat = bpy.data.materials.get("AnimalChibiAtlasMat")
    if mat:
        return mat
    ensure_animal_chibi_atlas()
    mat = bpy.data.materials.new("AnimalChibiAtlasMat")
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = _load_img(ATLAS_PATH)
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.55
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.25
    return mat


def get_solid_mat(name, hex_color, roughness=0.5, metallic=0.0, emission=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hex_lin(hex_color)
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    if emission > 0.0:
        b.inputs["Emission Color"].default_value = hex_lin(hex_color)
        b.inputs["Emission Strength"].default_value = emission
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.35 if roughness < 0.2 else 0.25
    return mat


def map_atlas_uv(obj, col, z_axis=2, custom_minmax=None):
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv_layer = me.uv_layers.active.data
    u = (col + 0.5) / 16.0
    if custom_minmax is not None:
        zmin, zmax = custom_minmax
    else:
        zs = [v.co[z_axis] for v in me.vertices]
        zmin, zmax = (min(zs), max(zs)) if zs else (0.0, 1.0)
    dz = max(zmax - zmin, 1e-4)
    for poly in me.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            z = me.vertices[vi].co[z_axis]
            v = 0.08 + 0.84 * max(0.0, min(1.0, (z - zmin) / dz))
            uv_layer[li].uv = (u, v)
    me.materials.clear()
    me.materials.append(get_atlas_mat())
    me.update()


def make_empty(name, loc=(0, 0, 0), parent=None):
    emp = bpy.data.objects.new(name, None)
    emp.empty_display_type = "PLAIN_AXES"
    emp.empty_display_size = 0.16
    bpy.context.scene.collection.objects.link(emp)
    if parent is not None:
        emp.parent = parent
    emp.location = loc
    bpy.context.view_layer.update()
    return emp


def import_asset(path, strip=("icosphere",)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    added = [o for o in bpy.data.objects if o not in before]
    kept = []
    for o in added:
        low = o.name.lower()
        if o.type in ("LIGHT", "CAMERA") or any(s in low for s in strip):
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        kept.append(o)
    return kept


def roots_of(objs):
    s = set(objs)
    return [o for o in objs if o.parent is None or o.parent not in s]


def mesh_bounds(objs):
    bpy.context.view_layer.update()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    ok = False
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != "MESH" or not o.visible_get():
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
            mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
            ok = True
        ev.to_mesh_clear()
    return (mn, mx) if ok else (Vector((0, 0, 0)), Vector((0, 0, 0)))


def collect_meshes(root):
    out = []
    stack = [root]
    while stack:
        o = stack.pop()
        if o.type == "MESH":
            out.append(o)
        stack.extend(o.children)
    return out


def set_parent_keep(obj, parent):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = mw
    bpy.context.view_layer.update()


def finalize_ground(root):
    mn, _ = mesh_bounds(collect_meshes(root))
    root.location.z -= mn.z
    bpy.context.view_layer.update()


def retexture(objs, src_prefix, new_path):
    if not os.path.exists(new_path):
        return
    img = _load_img(new_path)
    seen = set()
    for o in objs:
        if o.type != "MESH":
            continue
        for m in o.data.materials:
            if not m or m in seen or not m.node_tree:
                continue
            seen.add(m)
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and n.image.name.lower().startswith(src_prefix.lower()):
                    n.image = img


def set_flat_color(objs, mat_names, hex_color, emission_hex=None, emission_strength=0.0,
                   roughness=None, metallic=None, force=False):
    for o in objs:
        if o.type != "MESH":
            continue
        for m in o.data.materials:
            if not m or not m.node_tree:
                continue
            if mat_names != "*" and m.name.split(".")[0] not in mat_names:
                continue
            b = m.node_tree.nodes.get("Principled BSDF")
            if not b:
                continue
            if b.inputs["Base Color"].is_linked:
                if not force:
                    continue
                for lk in list(b.inputs["Base Color"].links):
                    m.node_tree.links.remove(lk)
            b.inputs["Base Color"].default_value = hex_lin(hex_color)
            if roughness is not None:
                b.inputs["Roughness"].default_value = roughness
            if metallic is not None:
                b.inputs["Metallic"].default_value = metallic
            if emission_hex:
                b.inputs["Emission Color"].default_value = hex_lin(emission_hex)
                b.inputs["Emission Strength"].default_value = emission_strength


def place(path, parent=None, height=None, max_xy=None, width_x=None, scale=None, loc=(0, 0, 0),
          rot_deg=(0.0, 0.0, 0.0), rot_z=None, center=True, ground=True, name=None, drop_names=()):
    objs = import_asset(path)
    if drop_names:
        kept = []
        for o in objs:
            if any(d.lower() in o.name.lower() for d in drop_names):
                bpy.data.objects.remove(o, do_unlink=True)
            else:
                kept.append(o)
        objs = kept
    holder = make_empty(name or ("H_" + os.path.splitext(os.path.basename(path))[0]))
    for r in roots_of(objs):
        r.parent = holder
    rz = rot_z if rot_z is not None else rot_deg[2]
    holder.rotation_euler = (math.radians(rot_deg[0]), math.radians(rot_deg[1]), math.radians(rz))
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(objs)
    d = mx - mn
    s = 1.0
    if scale is not None:
        s = scale
    elif height is not None and d.z > 1e-5:
        s = height / d.z
    elif width_x is not None and d.x > 1e-5:
        s = width_x / d.x
    elif max_xy is not None and max(d.x, d.y) > 1e-5:
        s = max_xy / max(d.x, d.y)
    holder.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(objs)
    off = Vector((0, 0, 0))
    if center:
        off.x = -(mn.x + mx.x) * 0.5
        off.y = -(mn.y + mx.y) * 0.5
    if ground:
        off.z = -mn.z
    holder.location = Vector(loc) + off
    bpy.context.view_layer.update()
    if parent is not None:
        set_parent_keep(holder, parent)
    return holder, objs


# ---------------------------------------------------------------------------
# Organic Sculpted Chibi Part Generators (Metaball + Laplacian Smooth + Raycast)
# ---------------------------------------------------------------------------

def sculpt_metaball_mesh(name, elements, target_height=0.92, target_dims=None, target_center_xy=(0.0, -0.02),
                         bottom_z=1.24, swatch_col=0, resolution=0.036, smooth_iter=6):
    mb = bpy.data.metaballs.new(name + "_MB")
    mb.resolution = resolution
    mb_obj = bpy.data.objects.new(name + "_MBObj", mb)
    bpy.context.scene.collection.objects.link(mb_obj)

    for el in elements:
        e = mb.elements.new(type=el.get("type", "ELLIPSOID"))
        e.co = el["co"]
        e.radius = el.get("radius", 0.30)
        e.size_x = el.get("sx", 1.0)
        e.size_y = el.get("sy", 1.0)
        e.size_z = el.get("sz", 1.0)
        e.stiffness = el.get("stiffness", 2.0)
        if "rot" in el:
            e.rotation = Euler(tuple(math.radians(a) for a in el["rot"])).to_quaternion()

    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mb_obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    bpy.data.objects.remove(mb_obj, do_unlink=True)
    bpy.data.metaballs.remove(mb)

    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)

    if smooth_iter > 0:
        sm = obj.modifiers.new("Smooth", "LAPLACIANSMOOTH")
        sm.iterations = smooth_iter
        sm.lambda_factor = 0.45
        sm.use_volume_preserve = True
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
            bpy.ops.object.modifier_apply(modifier=sm.name)

    dec = obj.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = 0.45
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=dec.name)

    mn = Vector((min(v.co.x for v in me.vertices), min(v.co.y for v in me.vertices), min(v.co.z for v in me.vertices)))
    mx = Vector((max(v.co.x for v in me.vertices), max(v.co.y for v in me.vertices), max(v.co.z for v in me.vertices)))
    dx = max(mx.x - mn.x, 1e-4)
    dy = max(mx.y - mn.y, 1e-4)
    dz = max(mx.z - mn.z, 1e-4)
    if target_dims is not None:
        sc_x, sc_y, sc_z = target_dims[0] / dx, target_dims[1] / dy, target_dims[2] / dz
    else:
        sc_x = sc_y = sc_z = target_height / dz
    cx = (mn.x + mx.x) * 0.5
    cy = (mn.y + mx.y) * 0.5
    for v in me.vertices:
        v.co.x = (v.co.x - cx) * sc_x + target_center_xy[0]
        v.co.y = (v.co.y - cy) * sc_y + target_center_xy[1]
        v.co.z = (v.co.z - mn.z) * sc_z + bottom_z
    me.update()

    map_atlas_uv(obj, swatch_col)
    return obj


def raycast_front(target_obj, x, z, y_start=-2.0):
    bpy.context.view_layer.update()
    hit, loc, norm, _ = target_obj.ray_cast(Vector((x, y_start, z)), Vector((0.0, 1.0, 0.0)))
    return hit, loc, norm


def make_smooth_subdiv_prim(name, kind, loc, scale=(1, 1, 1), rot_deg=(0, 0, 0),
                            swatch_col=None, solid_mat=None, segs=16, radius=1.0, depth=2.0,
                            subdiv=1, parent=None):
    if kind == "SPHERE":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(8, segs // 2), radius=radius, location=(0, 0, 0))
    elif kind == "CONE":
        bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=radius, radius2=0.04 * radius, depth=depth, location=(0, 0, 0))
    elif kind == "CYL":
        bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=radius, depth=depth, location=(0, 0, 0))
    elif kind == "CUBE":
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if subdiv > 0:
        sub = obj.modifiers.new("Sub", "SUBSURF")
        sub.levels = subdiv
        sub.render_levels = subdiv
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
            bpy.ops.object.modifier_apply(modifier=sub.name)
    for p in obj.data.polygons:
        p.use_smooth = True
    if swatch_col is not None:
        map_atlas_uv(obj, swatch_col)
    elif solid_mat is not None:
        obj.data.materials.clear()
        obj.data.materials.append(solid_mat)
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    if parent is not None:
        obj.parent = parent
    return obj


def add_chibi_eyes(head_obj, parent, eye_x=0.24, eye_z=1.60, eye_rx=0.080, eye_rz=0.094,
                   iris_col_hex=None, brow_tilt=8.0, brow_col=5, angry_brow=True, eye_offset=0.006):
    eye_dark = get_solid_mat("EyeGlossDark", "#101218", roughness=0.06)
    catch_mat = get_solid_mat("EyeCatchlight", "#ffffff", roughness=0.05, emission=1.5)
    iris_mat = get_solid_mat(f"EyeIris_{iris_col_hex}", iris_col_hex, roughness=0.14, emission=0.28) if iris_col_hex else None

    for sx in (-1, 1):
        hit, loc, norm = raycast_front(head_obj, sx * eye_x, eye_z)
        if not hit:
            loc = Vector((sx * eye_x, -0.44, eye_z))
            norm = Vector((sx * 0.25, -0.95, 0.08)).normalized()
        quat = norm.to_track_quat("Z", "Y")
        rot_deg = tuple(math.degrees(a) for a in quat.to_euler())

        if iris_mat:
            iris_pos = loc + norm * eye_offset
            make_smooth_subdiv_prim(f"Iris_{sx}", "SPHERE", iris_pos,
                                    scale=(eye_rx * 1.32, eye_rz * 1.32, 0.032),
                                    rot_deg=rot_deg, solid_mat=iris_mat, segs=16, subdiv=0, parent=parent)

        eye_pos = loc + norm * (eye_offset + (0.012 if iris_mat else 0.0))
        make_smooth_subdiv_prim(f"Eye_{sx}", "SPHERE", eye_pos,
                                scale=(eye_rx, eye_rz, 0.034),
                                rot_deg=rot_deg, solid_mat=eye_dark, segs=16, subdiv=0, parent=parent)

        cl_off = quat @ Vector((-eye_rx * 0.34, eye_rz * 0.36, 0.030))
        make_smooth_subdiv_prim(f"Catchlight_{sx}", "SPHERE", eye_pos + cl_off,
                                scale=(eye_rx * 0.28, eye_rx * 0.28, 0.018),
                                rot_deg=rot_deg, solid_mat=catch_mat, segs=10, subdiv=0, parent=parent)

        bz = eye_z + eye_rz * 1.48
        bhit, bloc, bnorm = raycast_front(head_obj, sx * (eye_x - 0.01), bz)
        if bhit:
            bquat = bnorm.to_track_quat("Z", "Y")
            tilt = sx * brow_tilt if angry_brow else -sx * brow_tilt * 0.6
            be = bquat.to_euler()
            be.rotate_axis("Z", math.radians(tilt))
            bpos = bloc + bnorm * (eye_offset + 0.008)
            make_smooth_subdiv_prim(f"Brow_{sx}", "SPHERE", bpos,
                                    scale=(eye_rx * 1.45, 0.038, 0.036),
                                    rot_deg=tuple(math.degrees(a) for a in be),
                                    swatch_col=brow_col, segs=12, subdiv=0, parent=parent)


def make_headband_ring(name, center=(0.0, -0.02, 1.84), rx=0.52, ry=0.45, tube_r=0.055,
                       swatch_col=14, solid_mat=None, parent=None):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.0,
        minor_radius=tube_r / max(rx, 0.1),
        major_segments=32,
        minor_segments=12,
        location=(0, 0, 0),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (rx, ry, 1.15)
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in obj.data.polygons:
        p.use_smooth = True
    if solid_mat is not None:
        obj.data.materials.clear()
        obj.data.materials.append(solid_mat)
    else:
        map_atlas_uv(obj, swatch_col)
    obj.location = center
    if parent is not None:
        obj.parent = parent
    return obj


def make_bevel_tail(name, points_r, swatch_col, parent, twist_deg=(0, 0, 0), loc=(0, 0, 0)):
    cu = bpy.data.curves.new(name + "_Curv", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.14
    cu.bevel_resolution = 5
    cu.resolution_u = 8
    sp = cu.splines.new("NURBS")
    sp.points.add(len(points_r) - 1)
    for i, (px, py, pz, pr) in enumerate(points_r):
        sp.points[i].co = (px, py, pz, 1.0)
        sp.points[i].radius = pr
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(points_r))

    cu_obj = bpy.data.objects.new(name + "_CObj", cu)
    bpy.context.scene.collection.objects.link(cu_obj)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(cu_obj.evaluated_get(dg))
    bpy.data.objects.remove(cu_obj, do_unlink=True)
    bpy.data.curves.remove(cu)

    bm = bmesh.new()
    bm.from_mesh(me)
    bedges = [e for e in bm.edges if e.is_boundary]
    if bedges:
        try:
            bmesh.ops.holes_fill(bm, edges=bedges, sides=0)
        except Exception:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()

    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    map_atlas_uv(obj, swatch_col)
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(a) for a in twist_deg)
    obj.parent = parent
    return obj


# ---------------------------------------------------------------------------
# Species Chibi Head Builders (Unscaled 1.0 KayKit Space)
# Return (head_root, headgear_objs) so NativeHat* objects can be flagged/skinned cleanly.
# ---------------------------------------------------------------------------

def build_squirrel_head(fur_col=0, muzzle_col=3, cheek_col=0, headband_col=None, beret=False):
    hr = make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.44, "sx": 1.15, "sy": 0.96, "sz": 0.92},
        {"co": (-0.22, -0.18, 0.06), "radius": 0.28, "sx": 1.05, "sy": 0.92, "sz": 0.84},
        {"co": (0.22, -0.18, 0.06), "radius": 0.28, "sx": 1.05, "sy": 0.92, "sz": 0.84},
        {"co": (0.0, -0.34, 0.05), "radius": 0.18, "sx": 1.0, "sy": 1.05, "sz": 0.78},
        {"co": (0.0, 0.02, -0.06), "radius": 0.30, "sx": 0.95, "sy": 0.95, "sz": 0.65},
    ]
    head = sculpt_metaball_mesh("SqHead", elems, target_dims=(1.06, 0.92, 0.86), target_center_xy=(0.0, -0.03),
                                bottom_z=1.24, swatch_col=fur_col, resolution=0.036, smooth_iter=6)
    head.parent = hr

    for sx in (-1, 1):
        eh = make_empty(f"SqEar_{sx}", loc=(sx * 0.34, 0.02, 1.92), parent=hr)
        eh.rotation_euler = (math.radians(6), math.radians(sx * -18), math.radians(sx * -10))
        make_smooth_subdiv_prim("EarOuter", "CONE", (0, 0, 0.16), scale=(0.15, 0.09, 0.20),
                                swatch_col=fur_col, segs=18, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        make_smooth_subdiv_prim("EarInner", "CONE", (0, -0.03, 0.14), scale=(0.082, 0.048, 0.14),
                                swatch_col=muzzle_col, segs=16, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        make_smooth_subdiv_prim("EarTuft", "CONE", (0, 0, 0.32), scale=(0.048, 0.036, 0.08),
                                rot_deg=(-8, sx * 10, 0), swatch_col=cheek_col, segs=12, radius=1.0, depth=2.0, subdiv=0, parent=eh)

    hit, loc, _ = raycast_front(head, 0.0, 1.48)
    my = loc.y if hit else -0.46
    make_smooth_subdiv_prim("SqMuzzle", "SPHERE", (0.0, my + 0.05, 1.47),
                            scale=(0.34, 0.16, 0.16), swatch_col=muzzle_col, segs=18, subdiv=1, parent=hr)
    make_smooth_subdiv_prim("SqNose", "SPHERE", (0.0, my - 0.10, 1.53),
                            scale=(0.082, 0.062, 0.058), swatch_col=5, segs=14, subdiv=1, parent=hr)
    make_smooth_subdiv_prim("SqTooth", "CUBE", (0.0, my - 0.08, 1.37),
                            scale=(0.072, 0.038, 0.056), swatch_col=10, subdiv=2, parent=hr)

    add_chibi_eyes(head, hr, eye_x=0.25, eye_z=1.60, eye_rx=0.086, eye_rz=0.102, brow_col=1, brow_tilt=10.0)

    gear = []
    if headband_col is not None:
        gear.append(make_headband_ring("NativeHat_SqBand", center=(0.0, -0.03, 1.84), rx=0.50, ry=0.43,
                                       tube_r=0.052, swatch_col=headband_col, parent=hr))
    if beret:
        b = make_smooth_subdiv_prim("NativeHat_Beret", "SPHERE", (-0.06, -0.01, 2.02),
                                    scale=(0.48, 0.44, 0.15), rot_deg=(-8, -16, 0),
                                    swatch_col=13, segs=20, subdiv=1, parent=hr)
        bt = make_smooth_subdiv_prim("NativeHat_BeretTip", "CONE", (0, 0, 0.15), scale=(0.05, 0.05, 0.08),
                                     swatch_col=14, segs=10, radius=1.0, depth=2.0, subdiv=0, parent=b)
        gear.extend([b, bt])
    return hr, gear


def build_beaver_head(fur_col=4, muzzle_col=3, goggles=False, iron_band=False, headband_col=None):
    hr = make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.44, "sx": 1.16, "sy": 0.96, "sz": 0.88},
        {"co": (0.0, -0.22, 0.05), "radius": 0.35, "sx": 1.32, "sy": 0.88, "sz": 0.72},
        {"co": (0.0, -0.35, 0.04), "radius": 0.19, "sx": 1.20, "sy": 1.0, "sz": 0.78},
        {"co": (0.0, 0.02, -0.06), "radius": 0.30, "sx": 0.95, "sy": 0.95, "sz": 0.65},
    ]
    head = sculpt_metaball_mesh("BvHead", elems, target_dims=(1.10, 0.94, 0.84), target_center_xy=(0.0, -0.03),
                                bottom_z=1.24, swatch_col=fur_col, resolution=0.036, smooth_iter=6)
    head.parent = hr

    for sx in (-1, 1):
        eh = make_empty(f"BvEar_{sx}", loc=(sx * 0.48, 0.04, 1.82), parent=hr)
        make_smooth_subdiv_prim("Ear", "SPHERE", (0, 0, 0), scale=(0.13, 0.08, 0.14),
                                rot_deg=(0, sx * -20, 0), swatch_col=fur_col, segs=14, subdiv=1, parent=eh)
        make_smooth_subdiv_prim("EarIn", "SPHERE", (0, -0.04, 0), scale=(0.072, 0.045, 0.085),
                                swatch_col=muzzle_col, segs=12, subdiv=1, parent=eh)

    hit, loc, _ = raycast_front(head, 0.0, 1.48)
    my = loc.y if hit else -0.48
    for sx in (-1, 1):
        make_smooth_subdiv_prim(f"WhiskerPad_{sx}", "SPHERE", (sx * 0.14, my + 0.02, 1.47),
                                scale=(0.19, 0.14, 0.13), swatch_col=muzzle_col, segs=16, subdiv=1, parent=hr)
        make_smooth_subdiv_prim(f"BuckTooth_{sx}", "CUBE", (sx * 0.055, my - 0.11, 1.35),
                                scale=(0.085, 0.042, 0.11), rot_deg=(-8, 0, 0),
                                swatch_col=10, subdiv=2, parent=hr)
    make_smooth_subdiv_prim("BvNose", "SPHERE", (0.0, my - 0.11, 1.54),
                            scale=(0.115, 0.078, 0.072), swatch_col=5, segs=14, subdiv=1, parent=hr)

    add_chibi_eyes(head, hr, eye_x=0.26, eye_z=1.62, eye_rx=0.080, eye_rz=0.092, brow_col=5, brow_tilt=9.0)

    gear = []
    if headband_col is not None:
        gear.append(make_headband_ring("NativeHat_BvBand", center=(0.0, -0.03, 1.85), rx=0.51, ry=0.44,
                                       tube_r=0.050, swatch_col=headband_col, parent=hr))
    if goggles:
        gold = get_solid_mat("GoldMetalMat", "#f2bf42", roughness=0.28, metallic=0.72)
        glass = get_solid_mat("TealGlassMat", "#57f2e3", roughness=0.12, metallic=0.1, emission=0.45)
        strap = make_headband_ring("NativeHat_GoggleStrap", center=(0.0, -0.03, 1.86), rx=0.51, ry=0.44,
                                   tube_r=0.045, swatch_col=5, parent=hr)
        gear.append(strap)
        for sx in (-1, 1):
            gh = make_empty(f"NativeHat_Goggle_{sx}", loc=(sx * 0.23, -0.45, 1.88), parent=hr)
            gh.rotation_euler = (math.radians(-18), math.radians(sx * 12), 0)
            rim = make_smooth_subdiv_prim(f"NativeHat_Rim_{sx}", "CYL", (0, 0, 0), scale=(0.17, 0.17, 0.09),
                                          rot_deg=(90, 0, 0), solid_mat=gold, segs=18, radius=1.0, depth=1.0, parent=gh)
            lens = make_smooth_subdiv_prim(f"NativeHat_Lens_{sx}", "SPHERE", (0, -0.03, 0), scale=(0.135, 0.05, 0.135),
                                           solid_mat=glass, segs=16, parent=gh)
            gear.extend([gh, rim, lens])
    if iron_band:
        steel = get_solid_mat("DarkSteelMat", "#4f5b6b", roughness=0.35, metallic=0.78)
        gold = get_solid_mat("GoldMetalMat", "#f2bf42", roughness=0.28, metallic=0.72)
        band = make_headband_ring("NativeHat_IronBand", center=(0.0, -0.03, 1.87), rx=0.51, ry=0.44,
                                  tube_r=0.054, solid_mat=steel, parent=hr)
        stud = make_smooth_subdiv_prim("NativeHat_CenterStud", "SPHERE", (0.0, -0.46, 1.88),
                                       scale=(0.10, 0.05, 0.10), solid_mat=gold, segs=12, parent=hr)
        gear.extend([band, stud])
        for sx in (-1, 1):
            gear.append(make_smooth_subdiv_prim(f"NativeHat_Horn_{sx}", "CONE", (sx * 0.48, -0.06, 2.00),
                                                scale=(0.095, 0.095, 0.18), rot_deg=(0, sx * -38, 0),
                                                swatch_col=10, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=hr))
    return hr, gear


def build_hedgehog_head(face_col=3, back_col=9, quill_col=10, long_quills=False, visor=False):
    hr = make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, 0.0, 0.22), "radius": 0.45, "sx": 1.15, "sy": 0.98, "sz": 0.92},
        {"co": (0.0, -0.20, 0.08), "radius": 0.32, "sx": 1.20, "sy": 0.92, "sz": 0.78},
        {"co": (0.0, 0.02, -0.06), "radius": 0.30, "sx": 0.96, "sy": 0.96, "sz": 0.65},
    ]
    head = sculpt_metaball_mesh("HhHead", elems, target_dims=(1.04, 0.96, 0.84), target_center_xy=(0.0, -0.02),
                                bottom_z=1.24, swatch_col=face_col, resolution=0.036, smooth_iter=6)
    head.parent = hr

    hit, loc, _ = raycast_front(head, 0.0, 1.50)
    ny = loc.y if hit else -0.47
    make_smooth_subdiv_prim("HhMuzzle", "SPHERE", (0.0, ny - 0.02, 1.49),
                            scale=(0.24, 0.22, 0.15), rot_deg=(-8, 0, 0),
                            swatch_col=face_col, segs=16, subdiv=1, parent=hr)
    make_smooth_subdiv_prim("HhNose", "SPHERE", (0.0, ny - 0.20, 1.52),
                            scale=(0.088, 0.075, 0.072), swatch_col=5, segs=14, subdiv=1, parent=hr)
    for sx in (-1, 1):
        make_smooth_subdiv_prim(f"HhEar_{sx}", "SPHERE", (sx * 0.46, -0.02, 1.76),
                                scale=(0.095, 0.10, 0.12), rot_deg=(0, sx * -15, 0),
                                swatch_col=face_col, segs=12, subdiv=1, parent=hr)

    q_len = 0.31 if long_quills else 0.23
    q_rad = 0.088 if long_quills else 0.105
    rows = [
        (1.90, -0.06, 46, [-48, -24, 0, 24, 48]),
        (1.90, 0.12, 66, [-60, -36, -12, 12, 36, 60]),
        (1.74, 0.26, 88, [-62, -38, -14, 14, 38, 62]),
        (1.52, 0.32, 108, [-48, -22, 0, 22, 48]),
    ]
    for ri, (zb, yb, pitch, yaws) in enumerate(rows):
        for yw in yaws:
            rad = math.radians(yw)
            px = math.sin(rad) * 0.44
            py = yb + (1.0 - math.cos(rad)) * 0.10
            qcol = quill_col if (ri % 2 == 0 or long_quills) else back_col
            qh = make_empty(f"Quill_{ri}_{yw}", loc=(px, py, zb), parent=hr)
            qh.rotation_euler = (math.radians(-pitch), math.radians(yw * 0.42), math.radians(-yw * 0.55))
            make_smooth_subdiv_prim("QSpike", "CONE", (0, 0, q_len * 0.45),
                                    scale=(q_rad, q_rad, q_len),
                                    swatch_col=qcol, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=qh)

    add_chibi_eyes(head, hr, eye_x=0.23, eye_z=1.60, eye_rx=0.082, eye_rz=0.094, brow_col=9, brow_tilt=12.0)

    gear = []
    if visor:
        steel = get_solid_mat("KnightVisorSteel", "#7892a8", roughness=0.32, metallic=0.78)
        v = make_smooth_subdiv_prim("NativeHat_Visor", "CUBE", (0.0, -0.38, 1.86),
                                    scale=(0.98, 0.40, 0.14), rot_deg=(-22, 0, 0),
                                    solid_mat=steel, subdiv=2, parent=hr)
        gear.append(v)
    return hr, gear


def build_bear_head(fur_col=1, muzzle_col=3, fangs=True, viking_band=False, crown=False):
    hr = make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.46, "sx": 1.18, "sy": 0.98, "sz": 0.94},
        {"co": (0.0, -0.24, 0.08), "radius": 0.30, "sx": 1.24, "sy": 0.90, "sz": 0.76},
        {"co": (0.0, -0.36, 0.05), "radius": 0.20, "sx": 1.05, "sy": 1.05, "sz": 0.80},
        {"co": (0.0, 0.02, -0.06), "radius": 0.33, "sx": 1.0, "sy": 0.98, "sz": 0.65},
    ]
    head = sculpt_metaball_mesh("BearHead", elems, target_dims=(1.12, 0.96, 0.88), target_center_xy=(0.0, -0.04),
                                bottom_z=1.24, swatch_col=fur_col, resolution=0.036, smooth_iter=6)
    head.parent = hr

    for sx in (-1, 1):
        eh = make_empty(f"BearEar_{sx}", loc=(sx * 0.44, 0.04, 1.98), parent=hr)
        make_smooth_subdiv_prim("EarOut", "SPHERE", (0, 0, 0), scale=(0.18, 0.09, 0.18),
                                rot_deg=(0, sx * -15, 0), swatch_col=fur_col, segs=16, subdiv=1, parent=eh)
        make_smooth_subdiv_prim("EarIn", "SPHERE", (0, -0.048, 0), scale=(0.10, 0.052, 0.10),
                                rot_deg=(0, sx * -15, 0), swatch_col=muzzle_col, segs=12, subdiv=1, parent=eh)

    hit, loc, _ = raycast_front(head, 0.0, 1.50)
    my = loc.y if hit else -0.50
    make_smooth_subdiv_prim("BearMuzzle", "SPHERE", (0.0, my + 0.05, 1.50),
                            scale=(0.34, 0.19, 0.18), swatch_col=muzzle_col, segs=16, subdiv=1, parent=hr)
    make_smooth_subdiv_prim("BearNose", "SPHERE", (0.0, my - 0.125, 1.57),
                            scale=(0.12, 0.082, 0.080), swatch_col=5, segs=14, subdiv=1, parent=hr)
    if fangs:
        for sx in (-1, 1):
            make_smooth_subdiv_prim(f"Fang_{sx}", "CONE", (sx * 0.10, my - 0.08, 1.40),
                                    scale=(0.035, 0.035, 0.055), rot_deg=(-12, 0, 0),
                                    swatch_col=10, segs=10, radius=1.0, depth=2.0, subdiv=0, parent=hr)

    add_chibi_eyes(head, hr, eye_x=0.26, eye_z=1.65, eye_rx=0.078, eye_rz=0.090, brow_col=fur_col, brow_tilt=11.0)

    gear = []
    if viking_band:
        steel = get_solid_mat("VikingSteelMat", "#637285", roughness=0.35, metallic=0.75)
        gold = get_solid_mat("RoyalGoldMat", "#f5c542", roughness=0.26, metallic=0.78)
        gear.append(make_headband_ring("NativeHat_VikingBand", center=(0.0, -0.03, 1.89), rx=0.52, ry=0.45,
                                       tube_r=0.055, solid_mat=steel, parent=hr))
        gear.append(make_smooth_subdiv_prim("NativeHat_VikingBoss", "SPHERE", (0.0, -0.47, 1.90),
                                            scale=(0.105, 0.05, 0.105), solid_mat=gold, segs=12, parent=hr))
        for sx in (-1, 1):
            gear.append(make_smooth_subdiv_prim(f"NativeHat_VHorn_{sx}", "CONE", (sx * 0.50, -0.07, 2.04),
                                                scale=(0.10, 0.10, 0.22), rot_deg=(0, sx * -42, 0),
                                                swatch_col=10, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=hr))

    if crown:
        gold = get_solid_mat("RoyalGoldMat", "#f5c542", roughness=0.26, metallic=0.78)
        cr = make_empty("NativeHat_RoyalCrownRoot", loc=(0.0, -0.04, 2.08), parent=hr)
        gear.append(make_smooth_subdiv_prim("NativeHat_CrownBase", "CYL", (0, 0, 0.04), scale=(0.27, 0.27, 0.09),
                                            solid_mat=gold, segs=16, radius=1.0, depth=1.0, parent=cr))
        for i in range(6):
            a = i * math.pi / 3
            gear.append(make_smooth_subdiv_prim(f"NativeHat_Spike_{i}", "CONE",
                                                (math.cos(a) * 0.23, math.sin(a) * 0.23, 0.14),
                                                scale=(0.072, 0.072, 0.12), solid_mat=gold, segs=10,
                                                radius=1.0, depth=2.0, subdiv=0, parent=cr))
    return hr, gear


# ---------------------------------------------------------------------------
# Armature / Pose Helpers
# ---------------------------------------------------------------------------

def clear_nla(arm):
    if arm.animation_data:
        for tr in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(tr)


def set_action(arm, action_name):
    act = bpy.data.actions.get(action_name)
    if not act:
        raise KeyError(f"Action not found: {action_name}")
    arm.animation_data_create()
    clear_nla(arm)
    arm.animation_data.action = act
    try:
        if getattr(arm.animation_data, "action_slot", None) is None and len(act.slots):
            arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    return act


def bone_world(arm, bone_name):
    pb = arm.pose.bones[bone_name]
    m = arm.matrix_world @ pb.matrix
    loc, rot, _ = m.decompose()
    return Matrix.Translation(loc) @ rot.to_matrix().to_4x4()


def attach_to_bone(arm, bone_name, obj, world_mat):
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    bpy.context.view_layer.update()
    obj.matrix_world = world_mat
    bpy.context.view_layer.update()


def attach_squirrel_tail(parent, hips_pos, scale, swatch_col):
    pts = [
        (0.02, 0.12, 0.04, 0.65),
        (0.10, 0.26, 0.16, 0.95),
        (0.18, 0.36, 0.42, 1.25),
        (0.20, 0.30, 0.72, 1.40),
        (0.14, 0.18, 0.88, 1.00),
    ]
    scaled_pts = [(x * scale, y * scale, z * scale, r * scale * 2.0) for (x, y, z, r) in pts]
    return make_bevel_tail("SqFluffyTail", scaled_pts, swatch_col, parent, loc=hips_pos + Vector((0, 0.08 * scale, -0.02)))


def attach_beaver_tail(parent, hips_pos, scale, swatch_col=4):
    return make_smooth_subdiv_prim("BeaverPaddleTail", "SPHERE",
                                   hips_pos + Vector((0.0, 0.26 * scale, -0.10 * scale)),
                                   scale=(0.24 * scale, 0.36 * scale, 0.055 * scale),
                                   rot_deg=(-28, 0, 0), swatch_col=swatch_col, segs=16, subdiv=1, parent=parent)


def export_glb(name, has_armature=False):
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{name}.glb")
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_yup=True,
        export_apply=not has_armature,
        export_animations=has_armature,
        export_animation_mode="ACTIONS",
        export_optimize_animation_size=True,
        export_image_format="AUTO",
        export_extras=False,
        export_lights=False,
        export_cameras=False,
    )
    kb = os.path.getsize(out_path) / 1024.0
    print(f"EXPORTED {name}.glb ({kb:.1f} KB)")


# ---------------------------------------------------------------------------
# Live Tower Builder (CharacterGroup / WeaponGroup / HeadSocket / SpinPart)
# ---------------------------------------------------------------------------

def build_tower_crew_mounted(turret_head, char_file, keep_props, action, frame_offset, head_root,
                             deck_z, tex_path=None, offset=(0.0, 0.0), extra_hand_props=(),
                             extra_native_hat=None, tail_fn=None):
    objs = import_asset(os.path.join(ADV_C, char_file))
    arm = next(o for o in objs if o.type == "ARMATURE")
    holder = make_empty("WarriorHolder")
    for r in roots_of(objs):
        r.parent = holder
    holder.scale = (CREW_SCALE, CREW_SCALE, CREW_SCALE)

    base_name = char_file.replace("_Hooded.glb", "").replace(".glb", "")
    drop_set = {f"{base_name}_Head", f"{base_name}_Head_Hooded", f"{base_name}_Hat", f"{base_name}_Helmet"}
    meshes, props = [], []
    for o in objs:
        if o.type != "MESH":
            continue
        if o.parent_bone in ("handslot.r", "handslot.l"):
            if o.name in keep_props:
                props.append(o)
            else:
                bpy.data.objects.remove(o, do_unlink=True)
            continue
        if o.name in drop_set:
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        meshes.append(o)

    if tex_path:
        retexture(meshes + props, base_name.lower(), tex_path)

    clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.context.view_layer.update()
    rest_head_q = bone_world(arm, "head").to_quaternion()

    if action:
        act = set_action(arm, action)
        bpy.context.scene.frame_set(int(act.frame_range[0]) + frame_offset)
    bpy.context.view_layer.update()

    for path, bone, mult in extra_hand_props:
        pobjs = import_asset(path)
        ph = make_empty("PropHolder")
        for r in roots_of(pobjs):
            r.parent = ph
        bw = bone_world(arm, bone)
        ph.matrix_world = bw @ Matrix.Scale(CREW_SCALE * mult, 4)
        bpy.context.view_layer.update()
        for o in pobjs:
            if o.type == "MESH":
                props.append(o)
                set_parent_keep(o, None)
        bpy.data.objects.remove(ph, do_unlink=True)

    head_m = bone_world(arm, "head")
    hips_m = bone_world(arm, "hips")
    head_delta_q = head_m.to_quaternion() @ rest_head_q.inverted()

    dg = bpy.context.evaluated_depsgraph_get()
    allm = meshes + props
    for o in allm:
        mw = o.matrix_world.copy()
        if any(m.type == "ARMATURE" for m in o.modifiers):
            ev = o.evaluated_get(dg)
            new_me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
            for mod in list(o.modifiers):
                o.modifiers.remove(mod)
            o.data = new_me
        o.parent = None
        o.matrix_world = mw
    bpy.data.objects.remove(arm, do_unlink=True)
    bpy.data.objects.remove(holder, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for o in allm:
        o.select_set(True)
    bpy.context.view_layer.objects.active = allm[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    mn, mx = mesh_bounds(meshes)
    dz = deck_z - mn.z
    dx = offset[0] - (mn.x + mx.x) * 0.5
    dy = offset[1] - (mn.y + mx.y) * 0.5
    delta = Vector((dx, dy, dz))
    for o in allm:
        o.location += delta
    bpy.context.view_layer.update()

    char_group = make_empty("CharacterGroup", loc=(offset[0], offset[1], 0), parent=turret_head)
    weapon_group = make_empty("WeaponGroup", loc=(0, 0, 0), parent=turret_head)
    for o in meshes:
        set_parent_keep(o, char_group)
    for o in props:
        set_parent_keep(o, weapon_group)

    head_root.parent = char_group
    for c in list(head_root.children):
        c.location.z -= 1.228
    head_rot_m = head_delta_q.to_matrix().to_4x4()
    head_root.matrix_world = Matrix.Translation(head_m.translation + delta) @ head_rot_m @ Matrix.Scale(CREW_SCALE, 4)
    bpy.context.view_layer.update()

    # HeadSocket inside CharacterGroup so player hats from Kartlar tab fit onto the Chibi head
    sock = make_empty("HeadSocket", parent=char_group)
    sock_loc = head_m.translation + delta + head_rot_m @ Vector((0, -0.02 * CREW_SCALE, -0.04 * CREW_SCALE))
    sock.matrix_world = Matrix.Translation(sock_loc) @ head_rot_m @ Matrix.Scale(CREW_SCALE / HERO_SCALE, 4)
    bpy.context.view_layer.update()

    if extra_native_hat:
        hat_src, hat_z_local, hat_w, hat_rot, hat_tex = extra_native_hat
        h_world = Matrix.Translation(head_m.translation + delta) @ head_rot_m @ Matrix.Translation((0, -0.02 * CREW_SCALE, hat_z_local * CREW_SCALE))
        _, h_objs = place(os.path.join(ADV_C, hat_src), parent=char_group,
                          drop_names=("Body", "Arm", "Leg", "Cape", "Head", "1H_", "2H_", "Shield", "Mug", "Spellbook", "Knife", "Crossbow", "Throwable"),
                          width_x=hat_w * CREW_SCALE, loc=h_world.translation, rot_deg=hat_rot, ground=True)
        for ho in h_objs:
            ho.name = "NativeHat_" + ho.name
        if hat_tex:
            retexture(h_objs, hat_src.replace(".glb", "").lower(), hat_tex)

    if tail_fn:
        hips_local = (hips_m.translation + delta) - char_group.matrix_world.translation
        tail_fn(hips_local, CREW_SCALE, char_group)

    return char_group, weapon_group


# ---------------------------------------------------------------------------
# Owl V4 Builders (Spherical-Front Heart Face Mask + Feather Crests + Crystal Staff)
# ---------------------------------------------------------------------------

def _smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1.0 - h) + a * h - k * h * (1.0 - h)


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def paint_owl_head_tex(name, plumage_top_hex, plumage_bot_hex, rim_hex, face_top_hex, face_bot_hex,
                       crown_fleck_hex=None, snow_speckles=False):
    """Paint 1024x1024 spherical-front UV texture with smooth heart-shaped Owl facial disc."""
    out_path = os.path.join(CHIBI_TEX, f"owl_head_{name}.png")
    if os.path.exists(out_path):
        return out_path
    w, h = 1024, 1024
    vs = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    us = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]

    ptop = np.array(hex_rgb(plumage_top_hex), dtype=np.float32)[None, None, :]
    pbot = np.array(hex_rgb(plumage_bot_hex), dtype=np.float32)[None, None, :]
    rim_c = np.array(hex_rgb(rim_hex), dtype=np.float32)[None, None, :]
    ftop = np.array(hex_rgb(face_top_hex), dtype=np.float32)[None, None, :]
    fbot = np.array(hex_rgb(face_bot_hex), dtype=np.float32)[None, None, :]

    t_vert = np.clip((vs - 0.15) / 0.70, 0.0, 1.0)[..., None]
    rgb = pbot * (1.0 - t_vert) + ptop * t_vert

    nx = (us - 0.5) / 0.155
    ny = (vs - 0.45) / 0.215

    dL = np.hypot((nx + 0.56) * 0.94, (ny - 0.14) * 1.02) - 0.65
    dR = np.hypot((nx - 0.56) * 0.94, (ny - 0.14) * 1.02) - 0.65
    dC = np.hypot(nx * 1.24, (ny + 0.36) * 1.05) - 0.62
    d_heart = _smin(_smin(dL, dR, 0.14), dC, 0.24)

    rim_mask = (1.0 - _smoothstep(0.0, 0.22, np.abs(d_heart - 0.04))) * _smoothstep(-0.08, 0.06, d_heart)
    rgb = rgb * (1.0 - rim_mask[..., None] * 0.85) + rim_c * (rim_mask[..., None] * 0.85)

    face_mask = 1.0 - _smoothstep(-0.06, 0.04, d_heart)
    t_face = np.clip((ny + 0.6) / 1.2, 0.0, 1.0)[..., None]
    face_col = fbot * (1.0 - t_face) + ftop * t_face

    shadow_L = np.exp(-((nx + 0.50) ** 2 + (ny - 0.10) ** 2) / 0.18) * 0.08
    shadow_R = np.exp(-((nx - 0.50) ** 2 + (ny - 0.10) ** 2) / 0.18) * 0.08
    face_col = np.clip(face_col - (shadow_L + shadow_R)[..., None], 0.0, 1.0)
    rgb = rgb * (1.0 - face_mask[..., None]) + face_col * face_mask[..., None]

    if crown_fleck_hex:
        fl_c = np.array(hex_rgb(crown_fleck_hex), dtype=np.float32)[None, None, :]
        flecks = np.zeros((h, w), dtype=np.float32)
        for fx, fy, rx, ry in (
            (0.0, 0.90, 0.12, 0.06),
            (-0.24, 0.98, 0.11, 0.05),
            (0.24, 0.98, 0.11, 0.05),
            (-0.12, 1.12, 0.10, 0.05),
            (0.12, 1.12, 0.10, 0.05),
        ):
            d_f = np.hypot((nx - fx) / rx, (ny - fy) / ry)
            flecks = np.maximum(flecks, 1.0 - _smoothstep(0.55, 1.0, d_f))
        flecks *= _smoothstep(0.05, 0.20, d_heart)
        rgb = rgb * (1.0 - flecks[..., None] * 0.65) + fl_c * (flecks[..., None] * 0.65)

    if snow_speckles:
        sp_c = np.array(hex_rgb("#546b87"), dtype=np.float32)[None, None, :]
        phase_u = np.sin(us * np.pi * 24.0 + np.sin(vs * np.pi * 10.0) * 1.4)
        phase_v = np.sin(vs * np.pi * 18.0)
        bars = _smoothstep(0.58, 0.85, phase_u * phase_v)
        valid_zone = _smoothstep(0.16, 0.32, d_heart) * _smoothstep(0.28, 0.45, vs)
        rgb = rgb * (1.0 - (bars * valid_zone)[..., None] * 0.52) + sp_c * ((bars * valid_zone)[..., None] * 0.52)

    px = np.zeros((h, w, 4), dtype=np.float32)
    px[..., :3] = np.clip(rgb, 0.0, 1.0)
    px[..., 3] = 1.0
    _save_pixels_img(px, w, h, out_path)
    return out_path


def apply_spherical_front_uv(obj, tex_path, center=(0.0, -0.02, 1.67)):
    """Map spherical-front UVs onto sculpted Owl skull so u=0.5 faces -Y cleanly."""
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv_layer = me.uv_layers.active.data
    cx, cy, cz = center

    vert_uvs = []
    for v in me.vertices:
        dx, dy, dz = v.co.x - cx, v.co.y - cy, v.co.z - cz
        r = max(math.sqrt(dx * dx + dy * dy + dz * dz), 1e-5)
        theta = math.atan2(dx, -dy)
        phi = math.asin(max(-1.0, min(1.0, dz / r)))
        u = 0.5 + theta / (2.0 * math.pi)
        vv = 0.5 + phi / math.pi
        vert_uvs.append((u, vv))

    for poly in me.polygons:
        poly.use_smooth = True
        us_poly = [vert_uvs[me.loops[li].vertex_index][0] for li in poly.loop_indices]
        wrap = (max(us_poly) - min(us_poly)) > 0.5
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            u, vv = vert_uvs[vi]
            if wrap and u < 0.5:
                u += 1.0
            uv_layer[li].uv = (u, vv)

    mat = bpy.data.materials.new("OwlHeadPaintedMat_" + os.path.basename(tex_path))
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = _load_img(tex_path)
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.58
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.22
    me.materials.clear()
    me.materials.append(mat)
    me.update()


def make_owl_mage_tex(name, feather_paw_hex, robe_prim_hex, trim_gold_hex, cape_hex, robe_mix=0.65):
    """Recolor KayKit Mage texture cleanly for V4 Owls."""
    out_path = os.path.join(CHIBI_TEX, f"mage_{name}.png")
    if os.path.exists(out_path):
        return out_path
    src_path = os.path.join(ADV_A, "mage_texture.png")
    px, w, h = _load_pixels_img(src_path)
    rgb = px[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    skin_mask = (r > 0.72) & (g > 0.50) & (g < 0.88) & (b > 0.35) & (b < 0.75) & ((r - b) > 0.12) & ((r - g) < 0.30)
    mag_mask = (r > 0.42) & (g < 0.25) & (b > 0.22) & ((r - g) > 0.25)
    robe_mask = (b > r + 0.06) & (b > g + 0.05) & (~skin_mask) & (~mag_mask)
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

    out = rgb.copy()
    robe_c = np.array(hex_rgb(robe_prim_hex), dtype=np.float32)
    robe_shaded = np.clip(robe_c[None, None, :] * (0.42 + 0.95 * lum[..., None]), 0.0, 1.0)
    out = np.where(robe_mask[..., None], out * (1.0 - robe_mix) + robe_shaded * robe_mix, out)

    cape_c = np.array(hex_rgb(cape_hex), dtype=np.float32)
    cape_shaded = np.clip(cape_c[None, None, :] * (0.40 + 0.95 * lum[..., None]), 0.0, 1.0)
    out = np.where(mag_mask[..., None], cape_shaded, out)

    if trim_gold_hex:
        gold_c = np.array(hex_rgb(trim_gold_hex), dtype=np.float32)
        grey_trim = (~skin_mask) & (np.abs(r - g) < 0.08) & (np.abs(g - b) < 0.12) & (lum > 0.42)
        out = np.where(grey_trim[..., None], out * 0.3 + (gold_c[None, None, :] * (0.52 + 0.55 * lum[..., None])) * 0.7, out)

    paw = np.array(hex_rgb(feather_paw_hex), dtype=np.float32)
    paw_shaded = np.clip(paw[None, None, :] * (0.45 + 0.72 * lum[..., None]), 0.0, 1.0)
    out = np.where(skin_mask[..., None], paw_shaded, out)

    px[..., :3] = np.clip(out, 0.0, 1.0)
    _save_pixels_img(px, w, h, out_path)
    return out_path


def make_feather_leaf(name, length, width, thickness, swatch_hex, loc=(0, 0, 0), rot_deg=(0, 0, 0), parent=None):
    """Build a crisp tapered sculpted feather vane (flattened pointed teardrop)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=1.0, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    me = obj.data
    for v in me.vertices:
        z = v.co.z
        taper = max(0.08, 1.0 - max(0.0, z) * 0.85) * (1.0 - max(0.0, -z) * 0.35)
        arch = (1.0 - z * z) * 0.14
        v.co.x *= width * taper
        v.co.y = v.co.y * thickness * taper - arch * thickness
        v.co.z = (z + 0.65) * 0.5 * length
    me.update()
    for p in me.polygons:
        p.use_smooth = True

    mat = get_solid_mat(f"FeatherMat_{swatch_hex}", swatch_hex, roughness=0.52)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    if parent is not None:
        obj.parent = parent
    return obj


def build_owl_v4_head(head_tex, crest_dark_hex, crest_mid_hex, ruff_hex,
                      iris_hex="#f2aa24", beak_hex="#c9802b", crest_scale=1.0,
                      glasses=False, crown=False):
    hr = make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, 0.0, 0.16), "radius": 0.46, "sx": 1.20, "sy": 0.95, "sz": 0.95},
        {"co": (-0.22, -0.06, 0.02), "radius": 0.34, "sx": 1.05, "sy": 0.92, "sz": 0.86},
        {"co": (0.22, -0.06, 0.02), "radius": 0.34, "sx": 1.05, "sy": 0.92, "sz": 0.86},
        {"co": (0.0, 0.02, -0.08), "radius": 0.30, "sx": 0.98, "sy": 0.94, "sz": 0.65},
    ]
    head = sculpt_metaball_mesh("OwlV4Head", elems, target_dims=(1.12, 0.92, 0.86),
                                target_center_xy=(0.0, -0.02), bottom_z=1.24,
                                swatch_col=6, resolution=0.036, smooth_iter=6)
    head.parent = hr
    apply_spherical_front_uv(head, head_tex, center=(0.0, -0.02, 1.67))

    eye_dark = get_solid_mat("EyeGlossDark", "#0d0f15", roughness=0.05)
    catch_mat = get_solid_mat("EyeCatchlight", "#ffffff", roughness=0.05, emission=1.55)
    iris_mat = get_solid_mat(f"OwlSoftIris_{iris_hex}", iris_hex, roughness=0.16, emission=0.14)
    gold_mat = get_solid_mat("OwlGoldMetal", "#eab83c", roughness=0.24, metallic=0.82)

    eye_locs = []
    for sx in (-1, 1):
        ehit, eloc, enorm = raycast_front(head, sx * 0.21, 1.64)
        if not ehit:
            eloc = Vector((sx * 0.21, -0.44, 1.64))
            enorm = Vector((sx * 0.24, -0.96, 0.04)).normalized()
        quat = enorm.to_track_quat("Z", "Y")
        rot_deg = tuple(math.degrees(a) for a in quat.to_euler())
        eye_locs.append((sx, eloc, enorm, quat, rot_deg))

        make_smooth_subdiv_prim(f"OwlIris_{sx}", "SPHERE", eloc + enorm * 0.004,
                                scale=(0.104, 0.110, 0.026), rot_deg=rot_deg,
                                solid_mat=iris_mat, segs=20, subdiv=0, parent=hr)
        pup_pos = eloc + enorm * 0.015
        make_smooth_subdiv_prim(f"OwlPupil_{sx}", "SPHERE", pup_pos,
                                scale=(0.078, 0.086, 0.028), rot_deg=rot_deg,
                                solid_mat=eye_dark, segs=18, subdiv=0, parent=hr)
        cl_off = quat @ Vector((-0.028, 0.032, 0.024))
        make_smooth_subdiv_prim(f"CatchlightMain_{sx}", "SPHERE", pup_pos + cl_off,
                                scale=(0.025, 0.025, 0.014), rot_deg=rot_deg,
                                solid_mat=catch_mat, segs=10, subdiv=0, parent=hr)
        cl2_off = quat @ Vector((0.024, -0.026, 0.022))
        make_smooth_subdiv_prim(f"CatchlightSub_{sx}", "SPHERE", pup_pos + cl2_off,
                                scale=(0.012, 0.012, 0.010), rot_deg=rot_deg,
                                solid_mat=catch_mat, segs=8, subdiv=0, parent=hr)

        if glasses:
            bpy.ops.mesh.primitive_torus_add(
                major_radius=0.132, minor_radius=0.017,
                major_segments=32, minor_segments=12, location=(0, 0, 0),
            )
            ring = bpy.context.active_object
            ring.name = f"GlassFrame_{sx}"
            for p in ring.data.polygons:
                p.use_smooth = True
            ring.data.materials.clear()
            ring.data.materials.append(gold_mat)
            ring.location = eloc + enorm * 0.018
            ring.rotation_euler = tuple(math.radians(a) for a in rot_deg)
            ring.parent = hr

        bhit, bloc, bnorm = raycast_front(head, sx * 0.12, 1.78)
        b_start = bloc + bnorm * 0.015 if bhit else Vector((sx * 0.12, -0.39, 1.78))
        crest_root = make_empty(f"OwlCrest_{sx}", loc=(b_start.x, b_start.y + 0.03, b_start.z - 0.02), parent=hr)
        plumes = [
            (0.00, 0.00, 0.00, 0.42 * crest_scale, 0.088, 0.032, (-12, sx * 42, sx * -8), crest_dark_hex),
            (sx * 0.06, 0.02, -0.02, 0.35 * crest_scale, 0.080, 0.030, (-8, sx * 56, sx * -12), crest_mid_hex),
            (sx * 0.12, 0.05, -0.05, 0.27 * crest_scale, 0.070, 0.026, (-4, sx * 70, sx * -16), crest_dark_hex),
        ]
        for pi, (ox, oy, oz, ln, wd, th, rdeg, colh) in enumerate(plumes):
            make_feather_leaf(f"CrestFeather_{sx}_{pi}", ln, wd, th, colh,
                              loc=(ox, oy, oz), rot_deg=rdeg, parent=crest_root)

    if glasses and len(eye_locs) == 2:
        nhit, nloc, nnorm = raycast_front(head, 0.0, 1.655)
        bridge_pos = (nloc + nnorm * 0.018) if nhit else Vector((0.0, -0.465, 1.655))
        make_smooth_subdiv_prim("GlassBridge", "CYL", bridge_pos, scale=(0.013, 0.013, 0.18),
                                rot_deg=(0, 90, 0), solid_mat=gold_mat, segs=12, radius=1.0, depth=1.0, subdiv=0, parent=hr)

    beak_main = get_solid_mat(f"OwlBeakMat_{beak_hex}", beak_hex, roughness=0.38)
    beak_dark = get_solid_mat("OwlBeakLowerMat", "#6b3e1b", roughness=0.45)
    bhit, bloc, _ = raycast_front(head, 0.0, 1.56)
    by = bloc.y - 0.045 if bhit else -0.49
    make_smooth_subdiv_prim("OwlBeakUpper", "CONE", (0.0, by, 1.54),
                            scale=(0.076, 0.068, 0.115), rot_deg=(124, 0, 0),
                            solid_mat=beak_main, segs=16, radius=1.0, depth=2.0, subdiv=0, parent=hr)
    make_smooth_subdiv_prim("OwlBeakLower", "SPHERE", (0.0, by + 0.022, 1.50),
                            scale=(0.052, 0.045, 0.042), solid_mat=beak_dark, segs=12, subdiv=1, parent=hr)

    ruff_mat = get_solid_mat(f"OwlRuff_{ruff_hex}", ruff_hex, roughness=0.62)
    make_smooth_subdiv_prim("OwlChestRuffMain", "SPHERE", (0.0, -0.20, 1.24),
                            scale=(0.39, 0.26, 0.16), rot_deg=(14, 0, 0),
                            solid_mat=ruff_mat, segs=18, subdiv=1, parent=hr)
    for sx in (-1, 0, 1):
        sc_x = 0.16 if sx == 0 else 0.14
        sc_z = 0.14 if sx == 0 else 0.12
        make_smooth_subdiv_prim(f"OwlRuffTuft_{sx}", "SPHERE", (sx * 0.14, -0.34 + abs(sx) * 0.06, 1.15 + abs(sx) * 0.02),
                                scale=(sc_x, 0.09, sc_z), rot_deg=(24, 0, sx * -14),
                                solid_mat=ruff_mat, segs=16, subdiv=1, parent=hr)

    if crown:
        ch_cr, co_cr = place(os.path.join(Q, "rpg_items_pack/Crown.glb"), parent=hr, max_xy=0.46,
                             loc=(0.0, 0.02, 1.94), rot_deg=(-8, 0, 0), ground=True)
        ch_cr.name = "NativeHat_OwlCrown"
        for ob in co_cr:
            ob.name = "NativeHat_" + ob.name
        set_flat_color(co_cr, "*", "#f2c144", roughness=0.24, metallic=0.76)

    return hr


def attach_owl_wings(char_group, hips_world, scale, primary_hex, tip_hex):
    for sx in (-1, 1):
        wh = make_empty(f"OwlWing_{sx}", loc=hips_world + Vector((sx * 0.36 * scale, 0.15 * scale, 0.56 * scale)), parent=None)
        wh.rotation_euler = (math.radians(10), math.radians(sx * 18), math.radians(sx * 16))
        wmat1 = get_solid_mat(f"WingCol1_{primary_hex}", primary_hex, roughness=0.55)
        make_smooth_subdiv_prim("WingShoulder", "SPHERE", (sx * 0.06 * scale, 0, 0),
                                scale=(0.18 * scale, 0.085 * scale, 0.28 * scale),
                                solid_mat=wmat1, segs=16, subdiv=1, parent=wh)
        for fi, (ox, oz, ln, wd, colh) in enumerate((
            (0.14, -0.14, 0.42, 0.11, primary_hex),
            (0.08, -0.22, 0.38, 0.10, tip_hex),
            (-0.02, -0.26, 0.32, 0.09, primary_hex),
        )):
            make_feather_leaf(f"WingPlume_{sx}_{fi}", ln * scale, wd * scale, 0.040 * scale, colh,
                              loc=(sx * ox * scale, 0.02 * scale, oz * scale),
                              rot_deg=(180, sx * 12, 0), parent=wh)
        set_parent_keep(wh, char_group)


def attach_custom_crystal_staff(weapon_group, staff_verts_world, hand_world, crystal_hex, crystal_emi_hex, double_crystal=False):
    """Build sculpted wooden staff + gold claw mount + glowing crystal cleanly in WeaponGroup."""
    top_v = max(staff_verts_world, key=lambda v: v.z)
    bot_v = min(staff_verts_world, key=lambda v: v.z)
    axis = (top_v - bot_v)
    axis = axis.normalized() if axis.length > 0.2 else Vector((-0.18, -0.45, 0.87)).normalized()

    quat = axis.to_track_quat("Z", "Y")
    sh = make_empty("CustomCrystalStaff", loc=hand_world, parent=None)
    sh.rotation_euler = quat.to_euler()
    bpy.context.view_layer.update()

    wood_mat = get_solid_mat("StaffWoodMat", "#704224", roughness=0.68)
    gold_mat = get_solid_mat("StaffGoldMat", "#f2bf42", roughness=0.25, metallic=0.78)

    up_len = max(0.28, (top_v - hand_world).dot(axis) * 0.78)
    dn_len = max(0.16, (hand_world - bot_v).dot(axis) * 0.86)
    mid_z = (up_len - dn_len) * 0.5
    shaft_len = up_len + dn_len

    make_smooth_subdiv_prim("StaffShaft", "CYL", (0, 0, mid_z), scale=(0.021, 0.021, shaft_len),
                            solid_mat=wood_mat, segs=14, radius=1.0, depth=1.0, subdiv=0, parent=sh)
    make_smooth_subdiv_prim("StaffPommel", "SPHERE", (0, 0, -dn_len), scale=(0.030, 0.030, 0.038),
                            solid_mat=gold_mat, segs=14, subdiv=0, parent=sh)
    make_smooth_subdiv_prim("StaffCollar", "CYL", (0, 0, up_len), scale=(0.036, 0.036, 0.034),
                            solid_mat=gold_mat, segs=16, radius=1.0, depth=1.0, subdiv=0, parent=sh)
    for i in range(4):
        a = i * math.pi * 0.5 + math.pi * 0.25
        make_smooth_subdiv_prim(f"StaffProng_{i}", "CONE", (math.cos(a) * 0.036, math.sin(a) * 0.036, up_len + 0.042),
                                scale=(0.011, 0.011, 0.038), rot_deg=(math.sin(a) * 20, -math.cos(a) * 20, 0),
                                solid_mat=gold_mat, segs=8, radius=1.0, depth=2.0, subdiv=0, parent=sh)

    c_anchor = make_empty("CrystalTipAnchor", loc=(0.0, 0.0, up_len + 0.012), parent=sh)
    c_holder, co = place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), parent=None, height=0.17,
                         loc=(0, 0, 0), rot_deg=(0, 0, 20), center=True, ground=True)
    set_flat_color(co, "*", crystal_hex, emission_hex=crystal_emi_hex, emission_strength=1.55, roughness=0.12, force=True)
    c_holder.parent = c_anchor

    if double_crystal:
        for sx in (-1, 1):
            c2_anc = make_empty(f"CrystalSideAnchor_{sx}", loc=(sx * 0.048, 0.0, up_len + 0.020), parent=sh)
            c2_anc.rotation_euler = (0.0, math.radians(sx * 24), 0.0)
            c2, co2 = place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), parent=None, height=0.105,
                            loc=(0, 0, 0), rot_deg=(0, 0, 0), center=True, ground=True)
            set_flat_color(co2, "*", crystal_hex, emission_hex=crystal_emi_hex, emission_strength=1.65, roughness=0.12, force=True)
            c2.parent = c2_anc

    set_parent_keep(sh, weapon_group)
    return sh


def build_owl_v4_crew_mounted(turret_head, head_root, deck_z, tex_path, wing_cols, crystal_cols,
                              offset=(0.02, 0.04), action="Spellcasting", frame_offset=6,
                              back_hat=False, double_crystal=False, collar_brooch=None):
    objs = import_asset(os.path.join(ADV_C, "Mage.glb"))
    arm = next(o for o in objs if o.type == "ARMATURE")
    holder = make_empty("WarriorHolder")
    for r in roots_of(objs):
        r.parent = holder
    scale = CREW_SCALE
    holder.scale = (scale, scale, scale)

    meshes = []
    staff_obj = None
    for o in list(objs):
        if o.type != "MESH":
            continue
        if o.name == "2H_Staff":
            staff_obj = o
            continue
        if o.parent_bone in ("handslot.r", "handslot.l") or o.name in ("Mage_Head", "Mage_Hat"):
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        meshes.append(o)

    retexture(meshes, "mage", tex_path)

    clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.context.view_layer.update()
    rest_head_q = bone_world(arm, "head").to_quaternion()

    act = set_action(arm, action)
    bpy.context.scene.frame_set(int(act.frame_range[0]) + frame_offset)
    bpy.context.view_layer.update()

    head_m = bone_world(arm, "head")
    hips_m = bone_world(arm, "hips")
    hand_m = bone_world(arm, "handslot.r")
    head_delta_q = head_m.to_quaternion() @ rest_head_q.inverted()

    staff_verts = [staff_obj.matrix_world @ v.co for v in staff_obj.data.vertices] if staff_obj else []
    if staff_obj:
        bpy.data.objects.remove(staff_obj, do_unlink=True)

    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        mw = o.matrix_world.copy()
        if any(m.type == "ARMATURE" for m in o.modifiers):
            ev = o.evaluated_get(dg)
            new_me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
            for mod in list(o.modifiers):
                o.modifiers.remove(mod)
            o.data = new_me
        o.parent = None
        o.matrix_world = mw
    bpy.data.objects.remove(arm, do_unlink=True)
    bpy.data.objects.remove(holder, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    mn, mx = mesh_bounds(meshes)
    delta = Vector((offset[0] - (mn.x + mx.x) * 0.5, offset[1] - (mn.y + mx.y) * 0.5, deck_z - mn.z))
    for o in meshes:
        o.location += delta
    bpy.context.view_layer.update()

    char_group = make_empty("CharacterGroup", loc=(offset[0], offset[1], 0), parent=turret_head)
    weapon_group = make_empty("WeaponGroup", loc=(0, 0, 0), parent=turret_head)
    for o in meshes:
        set_parent_keep(o, char_group)

    head_root.parent = char_group
    for c in list(head_root.children):
        c.location.z -= 1.228
    head_rot_m = head_delta_q.to_matrix().to_4x4()
    head_root.matrix_world = Matrix.Translation(head_m.translation + delta) @ head_rot_m @ Matrix.Scale(scale, 4)
    bpy.context.view_layer.update()

    sock = make_empty("HeadSocket", parent=char_group)
    sock_loc = head_m.translation + delta + head_rot_m @ Vector((0, -0.02 * scale, -0.04 * scale))
    sock.matrix_world = Matrix.Translation(sock_loc) @ head_rot_m @ Matrix.Scale(scale / HERO_SCALE, 4)
    bpy.context.view_layer.update()

    if collar_brooch:
        gold = get_solid_mat("OwlGoldMetal", "#eab83c", roughness=0.24, metallic=0.82)
        gem = get_solid_mat(f"BroochGem_{collar_brooch}", collar_brooch, roughness=0.12, emission=0.85)
        bp = head_m.translation + delta + Vector((0.0, -0.17 * scale, -0.24 * scale))
        rim_o = make_smooth_subdiv_prim("CollarGoldRim", "SPHERE", bp, scale=(0.048, 0.025, 0.048),
                                        solid_mat=gold, segs=14, subdiv=0, parent=None)
        gem_o = make_smooth_subdiv_prim("CollarGem", "SPHERE", bp + Vector((0.0, -0.014, 0.0)), scale=(0.032, 0.022, 0.032),
                                        solid_mat=gem, segs=12, subdiv=0, parent=None)
        set_parent_keep(rim_o, char_group)
        set_parent_keep(gem_o, char_group)

    if back_hat:
        h_world = Matrix.Translation(head_m.translation + delta) @ head_rot_m @ Matrix.Translation((0, 0.10 * scale, 0.50 * scale))
        hh, h_objs = place(os.path.join(ADV_C, "Mage.glb"), parent=None,
                            drop_names=("Body", "Arm", "Leg", "Cape", "Head", "1H_", "2H_", "Shield", "Mug", "Spellbook", "Knife", "Crossbow", "Throwable"),
                            width_x=0.96 * scale, loc=h_world.translation, rot_deg=(-20, 6, 0), ground=True)
        hh.name = "NativeHat_BackHat"
        for ho in h_objs:
            ho.name = "NativeHat_" + ho.name
        retexture(h_objs, "mage", tex_path)
        set_parent_keep(hh, char_group)

    attach_owl_wings(char_group, hips_m.translation + delta, scale, wing_cols[0], wing_cols[1])

    staff_verts_shifted = [v + delta for v in staff_verts]
    attach_custom_crystal_staff(weapon_group, staff_verts_shifted, hand_m.translation + delta,
                                crystal_cols[0], crystal_cols[1], double_crystal=double_crystal)
    return char_group, weapon_group


def spin_orbit_crystals(turret_head, z, count, radius, color, emi, height=0.18):
    spin = make_empty("SpinPart", loc=(0, 0, z), parent=turret_head)
    c = spin.matrix_world.translation.copy()
    for i in range(count):
        a = i * math.pi * 2 / count
        hh, o = place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), parent=None, height=height,
                      loc=(c.x + math.cos(a) * radius, c.y + math.sin(a) * radius, c.z - height * 0.5),
                      rot_z=math.degrees(a))
        for ob in o:
            if ob.type == "MESH":
                ob.name = f"OrbitCrystal_glow_{i}"
        set_flat_color(o, "*", color, emission_hex=emi, emission_strength=1.8, roughness=0.16, force=True)
        set_parent_keep(hh, spin)
    return spin


def hex_building(color, name):
    return os.path.join(HEX_B, color, f"building_{name}_{color}.gltf")


def build_tower_glb(model_name):
    clear_scene()
    root = make_empty("TowerRoot")
    warm = ensure_warm_hex_atlas()

    # Parse spec
    if model_name.startswith("tower_squirrel_"):
        suf = model_name.replace("tower_squirrel_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("squirrel", suf, tier, root)

        turret_head = make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        if suf == "t1":
            tex = ensure_kaykit_variant_tex("rogue", "sq1_green", paw_hex="#e67e40", hue_shift=0.0, sat_mult=1.1)
            head, _ = build_squirrel_head(fur_col=0, muzzle_col=3, cheek_col=0)
            cg, _ = build_tower_crew_mounted(
                turret_head, "Rogue.glb", ("1H_Crossbow",), "1H_Ranged_Aiming", 6,
                head, deck_z, tex_path=tex, offset=(0.04, 0.04),
                tail_fn=lambda hp, sc, pr: attach_squirrel_tail(pr, hp, sc, 0),
            )
            place(os.path.join(ADV_A, "quiver.gltf"), parent=cg, height=0.32,
                  loc=(-0.10, 0.19, deck_z + 0.16), rot_deg=(-15, 14, 0), ground=False)
        elif suf == "t2":
            tex = ensure_kaykit_variant_tex("rogue", "sq1_green", paw_hex="#e67e40", hue_shift=0.0, sat_mult=1.1)
            head, _ = build_squirrel_head(fur_col=0, muzzle_col=3, cheek_col=0, headband_col=15)
            cg, _ = build_tower_crew_mounted(
                turret_head, "Rogue.glb", ("2H_Crossbow",), "2H_Ranged_Aiming", 6,
                head, deck_z, tex_path=tex, offset=(0.04, 0.04),
                tail_fn=lambda hp, sc, pr: attach_squirrel_tail(pr, hp, sc, 0),
            )
            place(os.path.join(ADV_A, "quiver.gltf"), parent=cg, height=0.34,
                  loc=(-0.10, 0.19, deck_z + 0.16), rot_deg=(-15, 14, 0), ground=False)
        elif suf == "sniper":
            tex = ensure_kaykit_variant_tex("rogue", "sq2_navy", paw_hex="#9c5432", hue_shift=0.16, sat_mult=0.85, val_mult=0.78)
            head, _ = build_squirrel_head(fur_col=1, muzzle_col=3, cheek_col=2, beret=True)
            _, wg = build_tower_crew_mounted(
                turret_head, "Rogue.glb", ("1H_Crossbow",), "1H_Ranged_Aiming", 4,
                head, deck_z, tex_path=tex, offset=(0.06, 0.04),
                tail_fn=lambda hp, sc, pr: attach_squirrel_tail(pr, hp, sc, 1),
            )
            hh, so = place(os.path.join(Q, "modular_sci_fi_guns_pack/Sniper_1.glb"),
                           max_xy=0.72, loc=(0.24, -0.22, deck_z + 0.22), rot_deg=(0, 0, -90))
            set_flat_color(so, ("Gold", "Orange", "Accent"), "#eba938", roughness=0.32, metallic=0.6)
            set_parent_keep(hh, wg)
        elif suf == "gatling":
            tex = ensure_kaykit_variant_tex("rogue", "sq3_crimson", paw_hex="#e6a64c", hue_shift=0.52, sat_mult=1.18, val_mult=1.05)
            head, _ = build_squirrel_head(fur_col=2, muzzle_col=3, cheek_col=0, headband_col=14)
            cg, wg = build_tower_crew_mounted(
                turret_head, "Rogue.glb", ("1H_Crossbow",), "1H_Ranged_Aiming", 2,
                head, deck_z, tex_path=tex, offset=(0.04, 0.04),
                tail_fn=lambda hp, sc, pr: attach_squirrel_tail(pr, hp, sc, 2),
            )
            bh, _ = place(os.path.join(Q, "medieval_weapons_pack/Bow_Golden.glb"), max_xy=0.42,
                          loc=(-0.24, -0.14, deck_z + 0.20), rot_deg=(12, -25, -90), ground=False)
            set_parent_keep(bh, wg)
            spin = make_empty("SpinPart", loc=(0.28, -0.16, 0.26), parent=turret_head)
            gh, go = place(os.path.join(Q, "cyberpunk_pack/Turret_GunDouble.glb"),
                           max_xy=0.46, loc=(spin.matrix_world.translation.x, spin.matrix_world.translation.y, deck_z + 0.02),
                           rot_z=0, drop_names=("Base",))
            set_flat_color(go, ("LightGrey", "Grey"), "#f0be4a", roughness=0.34, metallic=0.6)
            set_parent_keep(gh, wg)
            qh, _ = place(os.path.join(ADV_A, "quiver.gltf"), height=0.32,
                          loc=(spin.matrix_world.translation.x, spin.matrix_world.translation.y, spin.matrix_world.translation.z - 0.16),
                          ground=False)
            set_parent_keep(qh, spin)

    elif model_name.startswith("tower_beaver_"):
        suf = model_name.replace("tower_beaver_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("beaver", suf, tier, root)
        crew_offset = (0.04, 0.06)

        turret_head = make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        if suf == "t1":
            tex = ensure_kaykit_variant_tex("barbarian", "bv1_blue", paw_hex="#874f2d")
            head, _ = build_beaver_head(fur_col=4, muzzle_col=3)
            _, wg = build_tower_crew_mounted(
                turret_head, "Barbarian.glb", ("1H_Axe",), "Idle", 8,
                head, deck_z, tex_path=tex, offset=crew_offset,
                extra_native_hat=("Barbarian.glb", 0.16, 1.24, (0, 0, 0), tex),
                tail_fn=lambda hp, sc, pr: attach_beaver_tail(pr, hp, sc, 4),
            )
            ch, _ = place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.36,
                          loc=(0.30, -0.18, deck_z), rot_deg=(0, 0, -90))
            set_parent_keep(ch, wg)
        elif suf == "t2":
            tex = ensure_kaykit_variant_tex("barbarian", "bv1_blue", paw_hex="#874f2d")
            head, _ = build_beaver_head(fur_col=4, muzzle_col=3, headband_col=14)
            _, wg = build_tower_crew_mounted(
                turret_head, "Barbarian.glb", ("1H_Axe", "Barbarian_Round_Shield"), "Idle", 6,
                head, deck_z, tex_path=tex, offset=crew_offset,
                tail_fn=lambda hp, sc, pr: attach_beaver_tail(pr, hp, sc, 4),
            )
            ch, _ = place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.42,
                          loc=(0.28, -0.19, deck_z), rot_deg=(0, 0, -90))
            set_parent_keep(ch, wg)
        elif suf == "resin":
            tex = ensure_kaykit_variant_tex("barbarian", "bv2_amber", paw_hex="#b55d35", hue_shift=-0.42, sat_mult=1.25, val_mult=1.08)
            head, _ = build_beaver_head(fur_col=1, muzzle_col=3, goggles=True)
            _, wg = build_tower_crew_mounted(
                turret_head, "Barbarian.glb", ("1H_Axe",), "Idle", 6,
                head, deck_z, tex_path=tex, offset=(0.0, 0.04),
                tail_fn=lambda hp, sc, pr: attach_beaver_tail(pr, hp, sc, 1),
            )
            bh, bro = place(os.path.join(HEX_P, "barrel.gltf"), height=0.28, loc=(0.24, 0.16, deck_z))
            retexture(bro, "hexagons_medieval", warm)
            set_parent_keep(bh, turret_head)
            ch, _ = place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.38,
                          loc=(0.26, -0.20, deck_z), rot_deg=(0, 0, -90))
            set_parent_keep(ch, wg)
        elif suf == "mortar":
            tex = ensure_kaykit_variant_tex("barbarian", "bv3_crimson", paw_hex="#694b3b", hue_shift=-0.55, sat_mult=1.2, val_mult=0.92)
            head, _ = build_beaver_head(fur_col=5, muzzle_col=3, iron_band=True)
            _, wg = build_tower_crew_mounted(
                turret_head, "Barbarian.glb", ("2H_Axe",), "2H_Melee_Idle", 8,
                head, deck_z, tex_path=tex, offset=(0.06, 0.08),
                tail_fn=lambda hp, sc, pr: attach_beaver_tail(pr, hp, sc, 5),
            )
            ch, _ = place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.58,
                          loc=(0.0, -0.24, deck_z - 0.01), rot_deg=(0, 0, -90))
            set_parent_keep(ch, wg)

    elif model_name.startswith("tower_hedgehog_"):
        suf = model_name.replace("tower_hedgehog_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("hedgehog", suf, tier, root)

        turret_head = make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        if suf == "t1":
            tex = ensure_kaykit_variant_tex("knight", "hh1_steel", paw_hex="#dec4a2")
            head, _ = build_hedgehog_head(face_col=3, back_col=9, quill_col=10, long_quills=False)
            _, wg = build_tower_crew_mounted(
                turret_head, "Knight.glb", ("1H_Sword", "Spike_Shield"), "Idle", 4,
                head, deck_z, tex_path=tex, offset=(0.06, 0.05),
            )
            rh, ro = place(os.path.join(Q, "modular_sci_fi_guns_pack/Crossbow_2.glb"), max_xy=0.44,
                           loc=(-0.28, -0.20, deck_z + 0.14), rot_deg=(0, 0, -90))
            set_flat_color(ro, ("White", "Grey", "LightGrey", "Accent"), "#5ceaff",
                           emission_hex="#33dcff", emission_strength=0.9, roughness=0.35)
            set_parent_keep(rh, wg)
        elif suf == "t2":
            tex = ensure_kaykit_variant_tex("knight", "hh1_steel", paw_hex="#dec4a2")
            head, _ = build_hedgehog_head(face_col=3, back_col=9, quill_col=11, long_quills=False)
            _, wg = build_tower_crew_mounted(
                turret_head, "Knight.glb", ("Spike_Shield",), "2H_Ranged_Aiming", 6,
                head, deck_z, tex_path=tex, offset=(0.04, 0.05),
                extra_hand_props=((os.path.join(ADV_A, "crossbow_2handed.gltf"), "handslot.r", 1.05),),
            )
        elif suf == "rail":
            tex = ensure_kaykit_variant_tex("knight", "hh2_emerald", paw_hex="#c4b299", hue_shift=0.38, sat_mult=1.2,
                                            armor_tint="#49a87a", armor_mix=0.42)
            head, _ = build_hedgehog_head(face_col=3, back_col=11, quill_col=11, long_quills=False, visor=True)
            _, wg = build_tower_crew_mounted(
                turret_head, "Knight.glb", ("Spike_Shield",), "Blocking", 4,
                head, deck_z, tex_path=tex, offset=(0.06, 0.06),
            )
            rh, ro = place(os.path.join(Q, "modular_sci_fi_guns_pack/Crossbow_2.glb"), max_xy=0.66,
                           loc=(-0.20, -0.26, deck_z + 0.24), rot_deg=(0, 0, -90))
            for ob in ro:
                if ob.type == "MESH":
                    ob.name = "RailCrossbow_glow"
            set_flat_color(ro, ("White", "Grey", "LightGrey", "Accent"), "#5ceaff",
                           emission_hex="#33dcff", emission_strength=1.2, roughness=0.32)
            set_parent_keep(rh, wg)
        elif suf == "shred":
            tex = ensure_kaykit_variant_tex("knight", "hh3_gold", paw_hex="#c78c56", hue_shift=0.10, sat_mult=1.15,
                                            armor_tint="#ebbd4d", armor_mix=0.46)
            head, _ = build_hedgehog_head(face_col=1, back_col=9, quill_col=10, long_quills=True)
            _, wg = build_tower_crew_mounted(
                turret_head, "Knight.glb", ("2H_Sword",), "2H_Melee_Idle", 8,
                head, deck_z, tex_path=tex, offset=(0.06, 0.06),
            )
            spin = make_empty("SpinPart", loc=(0.0, -0.45, 0.34), parent=turret_head)
            c = spin.matrix_world.translation.copy()
            sh, so = place(os.path.join(Q, "platformer_game_pack/Hazard_Saw.glb"),
                           max_xy=0.46, loc=(0, 0, 0), rot_deg=(0, 0, 0), center=False, ground=False)
            mn_s, mx_s = mesh_bounds(so)
            sh.location = c - Vector(((mn_s.x + mx_s.x) * 0.5, (mn_s.y + mx_s.y) * 0.5, (mn_s.z + mx_s.z) * 0.5))
            bpy.context.view_layer.update()
            set_parent_keep(sh, spin)
            set_flat_color(so, "*", "#d8e4ef", roughness=0.25, metallic=0.82, force=True)

    elif model_name.startswith("tower_owl_"):
        suf = model_name.replace("tower_owl_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("owl", suf, tier, root)

        turret_head = make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        if suf == "t1":
            head_tex = paint_owl_head_tex(
                "sapphire", plumage_top_hex="#4ea8e8", plumage_bot_hex="#1c5fa3", rim_hex="#143a73",
                face_top_hex="#fffcf5", face_bot_hex="#e9f2fb", crown_fleck_hex="#8dd4ff",
            )
            mage_tex = make_owl_mage_tex("v4_sapphire", feather_paw_hex="#479ee0", robe_prim_hex="#1b6bb8",
                                         trim_gold_hex="#f2be38", cape_hex="#8f2978", robe_mix=0.78)
            head = build_owl_v4_head(
                head_tex, crest_dark_hex="#183f78", crest_mid_hex="#338cd4", ruff_hex="#f7f5ee",
                iris_hex="#f2b224", beak_hex="#c97d28", crest_scale=1.02, glasses=False, crown=False,
            )
            build_owl_v4_crew_mounted(
                turret_head, head, deck_z, mage_tex, wing_cols=("#2268b3", "#163b73"),
                crystal_cols=("#7ef2ff", "#24d4ff"), action="Spellcasting", frame_offset=4,
                collar_brooch=None,
            )
        elif suf == "t2":
            head_tex = paint_owl_head_tex(
                "sapphire", plumage_top_hex="#4ea8e8", plumage_bot_hex="#1c5fa3", rim_hex="#143a73",
                face_top_hex="#fffcf5", face_bot_hex="#e9f2fb", crown_fleck_hex="#8dd4ff",
            )
            mage_tex = make_owl_mage_tex("v4_sapphire", feather_paw_hex="#479ee0", robe_prim_hex="#1b6bb8",
                                         trim_gold_hex="#f2be38", cape_hex="#8f2978", robe_mix=0.78)
            head = build_owl_v4_head(
                head_tex, crest_dark_hex="#183f78", crest_mid_hex="#338cd4", ruff_hex="#f7f5ee",
                iris_hex="#f2b224", beak_hex="#c97d28", crest_scale=1.12, glasses=True, crown=False,
            )
            build_owl_v4_crew_mounted(
                turret_head, head, deck_z, mage_tex, wing_cols=("#2268b3", "#163b73"),
                crystal_cols=("#7ef2ff", "#24d4ff"), action="Spellcasting", frame_offset=6,
                collar_brooch="#45e6ff",
            )
            spin_orbit_crystals(turret_head, z=0.14, count=2, radius=0.64, color="#7ff0ff", emi="#33dcff", height=0.16)
        elif suf == "chain":
            head_tex = paint_owl_head_tex(
                "horned", plumage_top_hex="#b87639", plumage_bot_hex="#693c1b", rim_hex="#3d210f",
                face_top_hex="#fff7ea", face_bot_hex="#ebd6b8", crown_fleck_hex="#e6af65",
            )
            mage_tex = make_owl_mage_tex("v4_storm", feather_paw_hex="#a66832", robe_prim_hex="#1b396b",
                                         trim_gold_hex="#f2be38", cape_hex="#d48924", robe_mix=0.72)
            head = build_owl_v4_head(
                head_tex, crest_dark_hex="#3b2010", crest_mid_hex="#a8642d", ruff_hex="#fff2dc",
                iris_hex="#f5ab22", beak_hex="#e0a426", crest_scale=1.28, glasses=False, crown=True,
            )
            build_owl_v4_crew_mounted(
                turret_head, head, deck_z, mage_tex, wing_cols=("#8a5226", "#422412"),
                crystal_cols=("#ffe675", "#ffaa1c"), action="Spellcasting", frame_offset=10,
                collar_brooch="#ffd245",
            )
            spin_orbit_crystals(turret_head, z=0.14, count=3, radius=0.72, color="#ffe675", emi="#ffaa1c", height=0.19)
        elif suf == "blizzard":
            head_tex = paint_owl_head_tex(
                "snowy", plumage_top_hex="#f2f7fc", plumage_bot_hex="#d2e2f2", rim_hex="#4e6a8c",
                face_top_hex="#ffffff", face_bot_hex="#eef6fc", crown_fleck_hex=None, snow_speckles=True,
            )
            mage_tex = make_owl_mage_tex("v4_snowy", feather_paw_hex="#e6eff7", robe_prim_hex="#287da8",
                                         trim_gold_hex="#b5dcff", cape_hex="#58c2e3", robe_mix=0.76)
            head = build_owl_v4_head(
                head_tex, crest_dark_hex="#3b5370", crest_mid_hex="#a6bdd6", ruff_hex="#ffffff",
                iris_hex="#32dcff", beak_hex="#6e7f91", crest_scale=1.08, glasses=False, crown=False,
            )
            build_owl_v4_crew_mounted(
                turret_head, head, deck_z, mage_tex, wing_cols=("#eef5fc", "#597394"),
                crystal_cols=("#ccfaff", "#3de3ff"), action="Spellcasting", frame_offset=4,
                back_hat=True, double_crystal=True, collar_brooch="#8af2ff",
            )
            spin_orbit_crystals(turret_head, z=0.14, count=3, radius=0.72, color="#e8f8ff", emi="#5ce6ff", height=0.19)
        else:
            raise ValueError(f"Unknown owl variant: {model_name}")
    else:
        raise ValueError(f"Unknown tower model: {model_name}")

    finalize_ground(root)
    export_glb(model_name, has_armature=False)


# ---------------------------------------------------------------------------
# Rigged & Skinned Chibi Bear Hero Builder (head bone weight 1.0 + Actions)
# ---------------------------------------------------------------------------

def skin_meshes_to_bone(objs, arm, target_name, bone_name="head"):
    """Join static meshes into a single clean mesh weighted 100% to `bone_name`."""
    meshes = []
    stack = list(objs) if isinstance(objs, (list, tuple)) else [objs]
    while stack:
        o = stack.pop()
        if o.type == "MESH":
            meshes.append(o)
        stack.extend(o.children)
    if not meshes:
        return None

    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    if len(meshes) > 1:
        bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    joined = bpy.context.active_object
    joined.name = target_name

    vg = joined.vertex_groups.new(name=bone_name)
    vg.add([v.index for v in joined.data.vertices], 1.0, "REPLACE")
    joined.parent = arm
    joined.matrix_parent_inverse = arm.matrix_world.inverted()
    mod = joined.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return joined


def skin_meshes_to_head_bone(objs, arm, target_name):
    return skin_meshes_to_bone(objs, arm, target_name, bone_name="head")


def build_fox_head(fur_col=0, muzzle_col=3, emerald_col=15):
    hr = make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.41, "sx": 1.18, "sy": 0.92, "sz": 0.88},
        {"co": (-0.28, -0.10, 0.04), "radius": 0.25, "sx": 1.12, "sy": 0.85, "sz": 0.72},
        {"co": (0.28, -0.10, 0.04), "radius": 0.25, "sx": 1.12, "sy": 0.85, "sz": 0.72},
        {"co": (0.0, -0.34, 0.02), "radius": 0.22, "sx": 0.92, "sy": 1.32, "sz": 0.74},
    ]
    head = sculpt_metaball_mesh("FoxHead", elems, target_dims=(1.08, 1.00, 0.82), target_center_xy=(0.0, -0.06),
                                bottom_z=1.24, swatch_col=fur_col, resolution=0.036, smooth_iter=6)
    head.parent = hr

    for sx in (-1, 1):
        eh = make_empty(f"FoxEar_{sx}", loc=(sx * 0.34, 0.0, 1.92), parent=hr)
        eh.rotation_euler = (math.radians(8), math.radians(sx * -20), math.radians(sx * -8))
        make_smooth_subdiv_prim("FoxEarOut", "CONE", (0, 0, 0.19), scale=(0.16, 0.09, 0.25),
                                swatch_col=fur_col, segs=18, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        make_smooth_subdiv_prim("FoxEarIn", "CONE", (0, -0.032, 0.16), scale=(0.088, 0.048, 0.17),
                                swatch_col=muzzle_col, segs=16, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        make_smooth_subdiv_prim("FoxEarTip", "CONE", (0, 0, 0.36), scale=(0.075, 0.055, 0.095),
                                swatch_col=5, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=eh)

    hit, loc, _ = raycast_front(head, 0.0, 1.46)
    my = loc.y if hit else -0.54
    for sx in (-1, 1):
        make_smooth_subdiv_prim(f"FoxCheek_{sx}", "SPHERE", (sx * 0.28, my + 0.14, 1.44),
                                scale=(0.24, 0.14, 0.14), rot_deg=(0, 0, sx * 22),
                                swatch_col=muzzle_col, segs=14, subdiv=1, parent=hr)
    make_smooth_subdiv_prim("FoxMuzzle", "SPHERE", (0.0, my + 0.02, 1.44),
                            scale=(0.24, 0.22, 0.14), swatch_col=muzzle_col, segs=16, subdiv=1, parent=hr)
    make_smooth_subdiv_prim("FoxNose", "SPHERE", (0.0, my - 0.15, 1.49),
                            scale=(0.075, 0.058, 0.054), swatch_col=5, segs=14, subdiv=1, parent=hr)

    add_chibi_eyes(head, hr, eye_x=0.24, eye_z=1.59, eye_rx=0.084, eye_rz=0.098,
                   brow_col=fur_col, brow_tilt=8.0, iris_col_hex="#36d47d")

    gear = []
    gear.append(make_headband_ring("NativeHat_FoxBand", center=(0.0, -0.04, 1.85), rx=0.45, ry=0.39,
                                   tube_r=0.030, swatch_col=emerald_col, parent=hr))
    gear.append(make_smooth_subdiv_prim("NativeHat_FoxGem", "SPHERE", (0.0, -0.43, 1.86),
                                        scale=(0.068, 0.038, 0.075),
                                        solid_mat=get_solid_mat("FoxEmeraldMat", "#4ef2b0", roughness=0.18,
                                                                emission=1.1),
                                        segs=14, parent=hr))
    return hr, gear


def build_boar_head(fur_col=4, snout_col=3, tusk_col=10):
    hr = make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.20), "radius": 0.47, "sx": 1.22, "sy": 0.98, "sz": 0.92},
        {"co": (0.0, -0.26, 0.04), "radius": 0.30, "sx": 1.26, "sy": 0.95, "sz": 0.72},
        {"co": (0.0, -0.38, 0.02), "radius": 0.22, "sx": 1.12, "sy": 1.04, "sz": 0.68},
    ]
    head = sculpt_metaball_mesh("BoarHead", elems, target_dims=(1.16, 1.00, 0.88), target_center_xy=(0.0, -0.04),
                                bottom_z=1.24, swatch_col=fur_col, resolution=0.036, smooth_iter=6)
    head.parent = hr

    for sx in (-1, 1):
        eh = make_empty(f"BoarEar_{sx}", loc=(sx * 0.46, -0.02, 2.01), parent=hr)
        make_smooth_subdiv_prim("BoarEarOut", "SPHERE", (0, 0, 0), scale=(0.18, 0.085, 0.16),
                                rot_deg=(12, sx * -22, 0), swatch_col=fur_col, segs=14, subdiv=1, parent=eh)
        make_smooth_subdiv_prim("BoarEarIn", "SPHERE", (0, -0.042, 0), scale=(0.10, 0.048, 0.09),
                                rot_deg=(12, sx * -22, 0), swatch_col=snout_col, segs=12, subdiv=1, parent=eh)

    hit, loc, _ = raycast_front(head, 0.0, 1.46)
    my = loc.y if hit else -0.52
    make_smooth_subdiv_prim("BoarSnout", "CYL", (0.0, my - 0.06, 1.46),
                            scale=(0.25, 0.13, 0.19), rot_deg=(88, 0, 0),
                            swatch_col=snout_col, segs=20, radius=1.0, depth=1.0, parent=hr)
    for sx in (-1, 1):
        make_smooth_subdiv_prim(f"BoarNostril_{sx}", "SPHERE", (sx * 0.085, my - 0.135, 1.47),
                                scale=(0.045, 0.032, 0.055), swatch_col=5, segs=12, parent=hr)
        make_smooth_subdiv_prim(f"BoarTusk_{sx}", "CONE", (sx * 0.25, my - 0.08, 1.50),
                                scale=(0.058, 0.058, 0.155), rot_deg=(-28, sx * -28, 0),
                                swatch_col=tusk_col, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=hr)

    add_chibi_eyes(head, hr, eye_x=0.27, eye_z=1.64, eye_rx=0.076, eye_rz=0.088,
                   brow_col=fur_col, brow_tilt=13.0, angry_brow=True)

    gear = []
    bronze = get_solid_mat("BoarBronzeMat", "#b87a3d", roughness=0.34, metallic=0.68)
    gear.append(make_headband_ring("NativeHat_BoarBand", center=(0.0, -0.03, 1.89), rx=0.51, ry=0.43,
                                   tube_r=0.034, solid_mat=bronze, parent=hr))
    gear.append(make_smooth_subdiv_prim("NativeHat_BoarCrest", "SPHERE", (0.0, -0.47, 1.90),
                                        scale=(0.095, 0.042, 0.085), solid_mat=bronze, segs=12, parent=hr))
    return hr, gear


def build_hero_bear_variant(variant_name):
    clear_scene()
    if variant_name == "hero_bear":
        char_file = "Barbarian.glb"
        tex = ensure_kaykit_variant_tex("barbarian", "bear1_classic", paw_hex="#9c5b34")
        keep = {"1H_Axe", "Barbarian_Round_Shield"}
        head_spec = dict(fur_col=1, muzzle_col=3, fangs=True, viking_band=False, crown=False)
        keep_actions = ("Idle", "Walking_A", "Running_A", "1H_Melee_Attack_Chop", "Cheer", "Hit_A")
        default_action = "Idle"
    elif variant_name == "hero_bear_viking":
        char_file = "Barbarian.glb"
        tex = ensure_kaykit_variant_tex("barbarian", "bear2_viking", paw_hex="#694b3b", hue_shift=-0.50, sat_mult=1.22, val_mult=0.90)
        keep = {"2H_Axe"}
        head_spec = dict(fur_col=5, muzzle_col=3, fangs=True, viking_band=True, crown=False)
        keep_actions = ("2H_Melee_Idle", "Walking_A", "Running_A", "2H_Melee_Attack_Chop", "Cheer", "Hit_A")
        default_action = "2H_Melee_Idle"
    elif variant_name == "hero_bear_royal":
        char_file = "Knight.glb"
        tex = ensure_kaykit_variant_tex("knight", "bear3_royal", paw_hex="#3c4254", armor_tint="#dfe6f0", armor_mix=0.25)
        keep = {"1H_Sword", "Badge_Shield"}
        head_spec = dict(fur_col=12, muzzle_col=3, fangs=False, viking_band=False, crown=True)
        keep_actions = ("Idle", "Walking_A", "Running_A", "1H_Melee_Attack_Chop", "Cheer", "Hit_A")
        default_action = "Idle"
    else:
        raise ValueError(variant_name)

    objs = import_asset(os.path.join(ADV_C, char_file))
    arm = next(o for o in objs if o.type == "ARMATURE")
    base_name = char_file.replace(".glb", "")
    drop_head_names = {f"{base_name}_Head", f"{base_name}_Hat", f"{base_name}_Helmet"}

    body_meshes = []
    for o in list(objs):
        if o.type != "MESH":
            continue
        if o.parent_bone in ("handslot.r", "handslot.l") and o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        if o.name in drop_head_names:
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        body_meshes.append(o)

    retexture(body_meshes, base_name.lower(), tex)

    for act in list(bpy.data.actions):
        if act.name not in keep_actions:
            bpy.data.actions.remove(act)
        else:
            act.use_fake_user = True

    clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.context.view_layer.update()

    # Build Chibi Bear Head + Optional NativeHat in exact unscaled rest pose (1.0)
    head_root, gear_objs = build_bear_head(**head_spec)
    gear_set = set(gear_objs)
    head_mesh_objs = [o for o in collect_meshes(head_root) if o not in gear_set]
    hat_mesh_objs = [o for o in gear_objs if o.type == "MESH"]

    bear_head = skin_meshes_to_head_bone(head_mesh_objs, arm, "BearChibiHead")
    if hat_mesh_objs:
        skin_meshes_to_head_bone(hat_mesh_objs, arm, f"NativeHat_{variant_name}")

    # Remove construction empties from head_root
    for o in list(bpy.data.objects):
        if o.type == "EMPTY" and (o is head_root or o.name.startswith(("BearEar_", "NativeHat_RoyalCrownRoot"))):
            bpy.data.objects.remove(o, do_unlink=True)

    root = make_empty("HeroRoot")
    body = make_empty("Body", parent=root)
    holder = make_empty("HeroScale", parent=body)
    holder.scale = (HERO_SCALE, HERO_SCALE, HERO_SCALE)
    for r in roots_of([o for o in bpy.data.objects if o not in (body, root, holder)]):
        r.parent = holder
    bpy.context.view_layer.update()

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    mn, _ = mesh_bounds(all_meshes)
    holder.location.z -= mn.z
    bpy.context.view_layer.update()

    head_m = bone_world(arm, "head")
    sock = make_empty("HeadSocket")
    sock_mat = head_m @ Matrix.Translation((0.0, -0.02 * HERO_SCALE, -0.04 * HERO_SCALE)) @ Matrix.Scale(HERO_SCALE / 0.56, 4)
    attach_to_bone(arm, "head", sock, sock_mat)

    set_action(arm, default_action)
    bpy.context.scene.frame_set(int(bpy.data.actions[default_action].frame_range[0]))
    export_glb(variant_name, has_armature=True)


def build_hero_fox():
    clear_scene()
    char_file = "Mage.glb"
    tex = ensure_kaykit_variant_tex(
        "mage", "fox_alchemist", paw_hex="#e67e35", hue_shift=-0.26, sat_mult=1.22, val_mult=1.04
    )
    keep = {"1H_Wand"}
    keep_actions = ("Idle", "Walking_A", "Running_A", "Spellcasting", "Spellcast_Shoot", "Cheer", "Hit_A")
    default_action = "Idle"

    objs = import_asset(os.path.join(ADV_C, char_file))
    arm = next(o for o in objs if o.type == "ARMATURE")
    drop_head_names = {"Mage_Head", "Mage_Hat"}

    body_meshes = []
    for o in list(objs):
        if o.type != "MESH":
            continue
        if o.parent_bone in ("handslot.r", "handslot.l") and o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        if o.name in drop_head_names or o.name == "Icosphere":
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        body_meshes.append(o)

    retexture(body_meshes, "mage", tex)

    for act in list(bpy.data.actions):
        if act.name not in keep_actions:
            bpy.data.actions.remove(act)
        else:
            act.use_fake_user = True

    clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.context.view_layer.update()

    head_root, gear_objs = build_fox_head()
    gear_set = set(gear_objs)
    head_mesh_objs = [o for o in collect_meshes(head_root) if o not in gear_set]
    hat_mesh_objs = [o for o in gear_objs if o.type == "MESH"]

    skin_meshes_to_bone(head_mesh_objs, arm, "FoxChibiHead", "head")
    if hat_mesh_objs:
        skin_meshes_to_bone(hat_mesh_objs, arm, "NativeHat_hero_fox", "head")

    # Fluffy red-orange fox tail skinned to hips
    tail_holder = make_empty("FoxTailTmp")
    hips_m = bone_world(arm, "hips")
    hips_pos = hips_m.translation
    tail_obj = attach_squirrel_tail(tail_holder, hips_pos=hips_pos + Vector((0.0, 0.14, 0.02)), scale=0.92, swatch_col=0)
    tail_tip = make_smooth_subdiv_prim("FoxTailTip", "SPHERE",
                                       hips_pos + Vector((0.12, 0.30, 0.80)),
                                       scale=(0.14, 0.14, 0.18), swatch_col=3, segs=14, parent=tail_holder)
    skin_meshes_to_bone([tail_obj, tail_tip], arm, "FoxTailMesh", "hips")

    for o in list(bpy.data.objects):
        if o.type == "EMPTY" and (o is head_root or o is tail_holder or o.name.startswith("FoxEar_")):
            bpy.data.objects.remove(o, do_unlink=True)

    root = make_empty("HeroRoot")
    body = make_empty("Body", parent=root)
    holder = make_empty("HeroScale", parent=body)
    holder.scale = (HERO_SCALE * 0.94, HERO_SCALE * 0.94, HERO_SCALE * 0.94)
    for r in roots_of([o for o in bpy.data.objects if o not in (body, root, holder)]):
        r.parent = holder
    bpy.context.view_layer.update()

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    mn, _ = mesh_bounds(all_meshes)
    holder.location.z -= mn.z
    bpy.context.view_layer.update()

    head_m = bone_world(arm, "head")
    sock = make_empty("HeadSocket")
    sock_mat = head_m @ Matrix.Translation((0.0, -0.02 * HERO_SCALE, -0.03 * HERO_SCALE)) @ Matrix.Scale(HERO_SCALE / 0.56, 4)
    attach_to_bone(arm, "head", sock, sock_mat)

    set_action(arm, default_action)
    bpy.context.scene.frame_set(int(bpy.data.actions[default_action].frame_range[0]))
    export_glb("hero_fox", has_armature=True)


def build_hero_boar():
    clear_scene()
    char_file = "Knight.glb"
    tex = ensure_kaykit_variant_tex(
        "knight", "boar_guard", paw_hex="#73452d", hue_shift=-0.04, sat_mult=1.18,
        armor_tint="#b87a40", armor_mix=0.45
    )
    keep = {"1H_Sword", "Spike_Shield"}
    keep_actions = ("Idle", "Walking_A", "Running_A", "1H_Melee_Attack_Chop", "Cheer", "Hit_A")
    default_action = "Idle"

    objs = import_asset(os.path.join(ADV_C, char_file))
    arm = next(o for o in objs if o.type == "ARMATURE")
    drop_head_names = {"Knight_Head", "Knight_Helmet"}

    body_meshes = []
    for o in list(objs):
        if o.type != "MESH":
            continue
        if o.parent_bone in ("handslot.r", "handslot.l") and o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        if o.name in drop_head_names or o.name == "Icosphere":
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        body_meshes.append(o)

    retexture(body_meshes, "knight", tex)

    for act in list(bpy.data.actions):
        if act.name not in keep_actions:
            bpy.data.actions.remove(act)
        else:
            act.use_fake_user = True

    clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.context.view_layer.update()

    head_root, gear_objs = build_boar_head()
    gear_set = set(gear_objs)
    head_mesh_objs = [o for o in collect_meshes(head_root) if o not in gear_set]
    hat_mesh_objs = [o for o in gear_objs if o.type == "MESH"]

    skin_meshes_to_bone(head_mesh_objs, arm, "BoarChibiHead", "head")
    if hat_mesh_objs:
        skin_meshes_to_bone(hat_mesh_objs, arm, "NativeHat_hero_boar", "head")

    for o in list(bpy.data.objects):
        if o.type == "EMPTY" and (o is head_root or o.name.startswith("BoarEar_")):
            bpy.data.objects.remove(o, do_unlink=True)

    root = make_empty("HeroRoot")
    body = make_empty("Body", parent=root)
    holder = make_empty("HeroScale", parent=body)
    holder.scale = (HERO_SCALE * 1.05, HERO_SCALE * 1.05, HERO_SCALE * 1.05)
    for r in roots_of([o for o in bpy.data.objects if o not in (body, root, holder)]):
        r.parent = holder
    bpy.context.view_layer.update()

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    mn, _ = mesh_bounds(all_meshes)
    holder.location.z -= mn.z
    bpy.context.view_layer.update()

    head_m = bone_world(arm, "head")
    sock = make_empty("HeadSocket")
    sock_mat = head_m @ Matrix.Translation((0.0, -0.02 * HERO_SCALE, -0.03 * HERO_SCALE)) @ Matrix.Scale(HERO_SCALE / 0.56, 4)
    attach_to_bone(arm, "head", sock, sock_mat)

    set_action(arm, default_action)
    bpy.context.scene.frame_set(int(bpy.data.actions[default_action].frame_range[0]))
    export_glb("hero_boar", has_armature=True)


def render_hero_portraits():
    ensure_animal_chibi_atlas()
    ui_dir = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/ui"
    os.makedirs(ui_dir, exist_ok=True)
    specs = [
        ("hero_fox", "portrait_fox.png", (0.08, 0.22, 0.18), (0.28, 0.85, 0.62)),
        ("hero_boar", "portrait_boar.png", (0.22, 0.14, 0.10), (0.90, 0.64, 0.30)),
    ]
    for model_name, out_name, bg_dark, rim_col in specs:
        clear_scene()
        objs = import_asset(os.path.join(OUT_DIR, f"{model_name}.glb"))
        arms = [o for o in objs if o.type == "ARMATURE"]
        if arms and arms[0].animation_data and arms[0].animation_data.action:
            bpy.context.scene.frame_set(int(arms[0].animation_data.action.frame_range[0]) + 4)
        bpy.context.view_layer.update()
        mn, mx = mesh_bounds(objs)
        focus_z = mn.z + (mx.z - mn.z) * 0.62

        sc = bpy.context.scene
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.cycles.samples = 24
        sc.cycles.use_denoising = True
        sc.render.film_transparent = True
        sc.render.resolution_x = 256
        sc.render.resolution_y = 256
        sc.view_settings.view_transform = "AgX"

        world = bpy.data.worlds.new("W")
        sc.world = world
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[1].default_value = 0.85

        def add_area(lname, energy, rot_deg, loc, col=(1.0, 1.0, 1.0), size=2.4):
            ld = bpy.data.lights.new(lname, type="AREA")
            ld.energy = energy
            ld.size = size
            ld.color = col
            lo = bpy.data.objects.new(lname, ld)
            sc.collection.objects.link(lo)
            lo.location = loc
            lo.rotation_euler = tuple(math.radians(a) for a in rot_deg)

        add_area("Key", 260, (58, 0, -32), (1.8, -2.2, focus_z + 1.4), (1.0, 0.96, 0.88))
        add_area("Fill", 130, (66, 0, 48), (-2.0, -1.6, focus_z + 0.9), (0.82, 0.90, 1.0))
        add_area("Rim", 210, (108, 0, 148), (0.2, 2.3, focus_z + 1.1), rim_col)

        cd = bpy.data.cameras.new("Cam")
        cd.lens = 72
        cam = bpy.data.objects.new("Cam", cd)
        sc.collection.objects.link(cam)
        cam.location = (0.72, -2.15, focus_z + 0.42)
        cam.rotation_euler = (Vector((0.0, 0.0, focus_z)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.camera = cam

        raw_fp = os.path.join(CHIBI_TEX, f"_raw_{out_name}")
        sc.render.filepath = raw_fp
        bpy.ops.render.render(write_still=True)

        fg, w, h = _load_pixels_img(raw_fp)
        yy, xx = np.mgrid[0:h, 0:w]
        nx = (xx - (w - 1) * 0.5) / (w * 0.5)
        ny = (yy - (h - 1) * 0.5) / (h * 0.5)
        r = np.sqrt(nx * nx + ny * ny)
        # Circular dark medallion + warm gold bevel border
        bg_px = np.zeros((h, w, 4), dtype=np.float32)
        radial = np.clip(1.0 - r * 0.95, 0.0, 1.0)[..., None]
        bg_c = np.array(bg_dark, dtype=np.float32)[None, None, :] * (0.45 + 0.85 * radial)
        gold_c = np.array([0.96, 0.78, 0.28], dtype=np.float32)
        ring_dark = np.array([0.48, 0.30, 0.06], dtype=np.float32)
        inside = r <= 0.93
        inner_ring = (r > 0.87) & (r <= 0.93)
        outer_rim = (r > 0.93) & (r <= 0.98)
        bg_px[inside, :3] = bg_c[inside]
        bg_px[inside, 3] = 1.0
        bg_px[inner_ring, :3] = gold_c
        bg_px[inner_ring, 3] = 1.0
        bg_px[outer_rim, :3] = ring_dark
        bg_px[outer_rim, 3] = 1.0

        # Clip character inside the medallion circle
        alpha = np.where(r <= 0.88, fg[..., 3], 0.0)[..., None]
        out_px = bg_px.copy()
        out_px[..., :3] = fg[..., :3] * alpha + bg_px[..., :3] * (1.0 - alpha)
        out_px[..., 3] = np.maximum(bg_px[..., 3], np.squeeze(alpha, axis=-1))

        final_fp = os.path.join(ui_dir, out_name)
        _save_pixels_img(out_px, w, h, final_fp)
        print("PORTRAIT SAVED:", final_fp)


# ---------------------------------------------------------------------------
# Post-export verification contact sheet renderer (renders actual shipped .glbs!)
# ---------------------------------------------------------------------------

def render_live_verification_sheet(want=None):
    ensure_animal_chibi_atlas()
    verify_models = [
        ("tower_squirrel_t1", False),
        ("tower_squirrel_t2", False),
        ("tower_squirrel_sniper", False),
        ("tower_squirrel_gatling", False),
        ("tower_beaver_t1", False),
        ("tower_beaver_t2", False),
        ("tower_beaver_resin", False),
        ("tower_beaver_mortar", False),
        ("tower_owl_t1", False),
        ("tower_owl_t2", False),
        ("tower_owl_chain", False),
        ("tower_owl_blizzard", False),
        ("tower_hedgehog_t1", False),
        ("tower_hedgehog_t2", False),
        ("tower_hedgehog_rail", False),
        ("tower_hedgehog_shred", False),
        ("hero_bear", True),
        ("hero_bear_viking", True),
        ("hero_bear_royal", True),
        ("hero_fox", True),
        ("hero_boar", True),
    ]
    tmp_dir = os.path.join(CHIBI_TEX, "verify_thumbs")
    os.makedirs(tmp_dir, exist_ok=True)
    for name, is_hero in verify_models:
        if want and name not in want:
            continue
        clear_scene()
        objs = import_asset(os.path.join(OUT_DIR, f"{name}.glb"))
        if is_hero:
            arms = [o for o in objs if o.type == "ARMATURE"]
            if arms and arms[0].animation_data and arms[0].animation_data.action:
                bpy.context.scene.frame_set(int(arms[0].animation_data.action.frame_range[0]) + 4)
        bpy.context.view_layer.update()
        mn, mx = mesh_bounds(objs)
        focus_z = (mn.z + mx.z) * 0.55

        sc = bpy.context.scene
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.cycles.samples = 14
        sc.cycles.use_denoising = True
        sc.render.resolution_x = 320
        sc.render.resolution_y = 360
        sc.view_settings.view_transform = "AgX"
        world = bpy.data.worlds.new("W")
        sc.world = world
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[0].default_value = (0.12, 0.16, 0.22, 1.0)
        world.node_tree.nodes["Background"].inputs[1].default_value = 1.35

        def add_area(lname, energy, rot_deg, loc, size=3.0):
            ld = bpy.data.lights.new(lname, type="AREA")
            ld.energy = energy
            ld.size = size
            lo = bpy.data.objects.new(lname, ld)
            sc.collection.objects.link(lo)
            lo.location = loc
            lo.rotation_euler = tuple(math.radians(a) for a in rot_deg)

        add_area("Key", 240, (54, 0, -35), (2.2, -2.5, focus_z + 2.0))
        add_area("Fill", 120, (65, 0, 50), (-2.4, -1.9, focus_z + 1.2))
        add_area("Rim", 200, (110, 0, 150), (0.3, 2.7, focus_z + 1.4))

        cd = bpy.data.cameras.new("Cam")
        cd.lens = 65
        cam = bpy.data.objects.new("Cam", cd)
        sc.collection.objects.link(cam)
        dist = 3.2 if is_hero else 4.2
        cam.location = (dist * 0.45, -dist, focus_z + dist * 0.35)
        cam.rotation_euler = (Vector((0, 0, focus_z)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.camera = cam

        fp = os.path.join(tmp_dir, f"{name}.png")
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        print("VERIFIED THUMB:", fp)


ALL_TOWER_NAMES = [
    "tower_squirrel_t1", "tower_squirrel_t2", "tower_squirrel_sniper", "tower_squirrel_gatling",
    "tower_beaver_t1", "tower_beaver_t2", "tower_beaver_resin", "tower_beaver_mortar",
    "tower_owl_t1", "tower_owl_t2", "tower_owl_chain", "tower_owl_blizzard",
    "tower_hedgehog_t1", "tower_hedgehog_t2", "tower_hedgehog_rail", "tower_hedgehog_shred",
]
ALL_HERO_NAMES = ["hero_bear", "hero_bear_viking", "hero_bear_royal", "hero_fox", "hero_boar"]


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    verify = "--verify" in args
    portraits = "--portraits" in args
    want = {a for a in args if not a.startswith("--")}

    ensure_cc0_sources()
    ensure_warm_hex_atlas()
    ensure_animal_chibi_atlas()

    for tn in ALL_TOWER_NAMES:
        if not want or tn in want:
            build_tower_glb(tn)
    for hn in ALL_HERO_NAMES:
        if not want or hn in want:
            if hn == "hero_fox":
                build_hero_fox()
            elif hn == "hero_boar":
                build_hero_boar()
            else:
                build_hero_bear_variant(hn)

    if portraits:
        render_hero_portraits()

    if verify:
        render_live_verification_sheet(want=want or None)


if __name__ == "__main__":
    main()
