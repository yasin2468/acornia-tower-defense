"""Palamut Kalesi — headless Blender 5.2 asset pipeline.

Builds all 35 runtime .glb models in public/models/ exclusively from real, artist-sculpted,
UV-textured CC0 meshes (KayKit Medieval Hexagon / Adventurers / Halloween / Dungeon / Restaurant,
Quaternius Nature / RPG / Mech / Cyberpunk / Medieval Village / Sci-Fi Guns / Platformer,
AliceCassie Pirate). Zero primitive placeholder geometry is generated: the only objects this
script creates itself are empties (sockets / pivots) and palette-tinted copies of the packs'
own UV textures.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_assets.py [-- name1 name2 ...]

Conventions (Blender Z-up, exported with export_yup=True):
  * Blender -Y == three.js +Z == "forward" for towers, crews, hero and enemies.
  * Every model is grounded (min Z == 0 -> three.js minY == 0) and centred on X/Y.
  * Rigged armatures are never transform_apply'd; they are scaled through a parent empty.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

OUT_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models"
CC0 = "/tmp/palamut_cc0"
DERIVED = os.path.join(CC0, "_derived")

HEX = os.path.join(CC0, "kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf")
HEX_B = os.path.join(HEX, "buildings")
HEX_N = os.path.join(HEX, "decoration/nature")
HEX_P = os.path.join(HEX, "decoration/props")
HEX_ATLAS = os.path.join(CC0, "kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Textures/hexagons_medieval.png")
ADV = os.path.join(CC0, "kaykit_adv/addons/kaykit_character_pack_adventures")
ADV_C = os.path.join(ADV, "Characters/gltf")
ADV_A = os.path.join(ADV, "Assets/gltf")
HAL = os.path.join(CC0, "kaykit_hal/addons/kaykit_halloween_bits/Assets/gltf")
HAL_TEX = os.path.join(HAL, "halloweenbits_texture.png")
DUN = os.path.join(CC0, "kaykit_dungeon/addons/kaykit_dungeon_remastered/Assets/gltf")
Q = os.path.join(CC0, "quaternius/public/glb")
PP = os.path.join(CC0, "polypizza")

CREW_SCALE = 0.34   # KayKit adventurer -> tower crew (~0.74 m tall)
HERO_SCALE = 0.56   # KayKit adventurer -> hero (~1.34 m tall)


# ---------------------------------------------------------------------------
# Scene helpers
# ---------------------------------------------------------------------------

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def hex_lin(h):
    r, g, b = hex_rgb(h)
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def make_empty(name, loc=(0, 0, 0), parent=None):
    emp = bpy.data.objects.new(name, None)
    emp.empty_display_type = "PLAIN_AXES"
    emp.empty_display_size = 0.2
    bpy.context.scene.collection.objects.link(emp)
    if parent is not None:
        emp.parent = parent
    emp.location = loc
    bpy.context.view_layer.update()
    return emp


def import_asset(path, strip=("icosphere",)):
    """Import a glTF/GLB, drop bone-shape icospheres / lights / cameras, return new objects."""
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
    if not ok:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    return mn, mx


def set_parent_keep(obj, parent):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = mw
    bpy.context.view_layer.update()


def place(path, parent=None, height=None, max_xy=None, width_x=None, scale=None, loc=(0, 0, 0),
          rot_deg=(0.0, 0.0, 0.0), rot_z=None, center=True, ground=True, name=None, drop_names=()):
    """Import an asset under a fresh holder empty, scale it, centre on X/Y and ground its base at loc.z."""
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


def collect_meshes(root):
    out = []
    stack = [root]
    while stack:
        o = stack.pop()
        if o.type == "MESH":
            out.append(o)
        stack.extend(o.children)
    return out


def finalize_ground(root):
    """Shift the whole model so min Z == 0 exactly (keeps X/Y pivot)."""
    mn, _ = mesh_bounds(collect_meshes(root))
    root.location.z -= mn.z
    bpy.context.view_layer.update()


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
# Palette-tinted copies of the packs' own UV textures (UVs untouched)
# ---------------------------------------------------------------------------

_IMG_CACHE = {}


def _load_img_cached(path):
    img = _IMG_CACHE.get(path)
    try:
        valid = img is not None and img.name in bpy.data.images
    except ReferenceError:
        valid = False
    if not valid:
        img = bpy.data.images.load(path, check_existing=True)
        _IMG_CACHE[path] = img
    return img


def _load_pixels(path):
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    return img, px, w, h


def _save_pixels(px, w, h, out_path):
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


def atlas_variant(variant):
    """KayKit hexagon atlas is an 8x4 grid of vertical gradients; recolour selected swatches."""
    out_path = os.path.join(DERIVED, f"hexagons_medieval_{variant}.png")
    if os.path.exists(out_path):
        return out_path
    _, px, w, h = _load_pixels(HEX_ATLAS)
    cw, ch = w // 8, h // 4
    if variant == "warm":
        cells = {
            (0, 2): ("#ab926d", "#f4e7ce"),  # castle stone -> sunlit cream sandstone
            (0, 3): ("#725e4a", "#ac967c"),  # dark stone trims -> warm taupe
            (3, 1): ("#ad3c28", "#f78b5e"),  # red roofs/flags -> warm coral terracotta
        }
    elif variant == "canyon":
        cells = {
            (0, 2): ("#7c3a20", "#e28b52"),  # rock -> terracotta canyon
            (2, 2): ("#7c3a20", "#e28b52"),
            (0, 3): ("#5e2c1a", "#b05a34"),
            (2, 4): ("#6e9a3c", "#b6d26a"),  # grass caps -> sunlit moss
        }
    else:
        raise ValueError(variant)
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
    _save_pixels(px, w, h, out_path)
    return out_path


def halloween_lantern_emission_map():
    """Emission mask where only the amber glass cell (row=3, col=2) of halloweenbits_texture glows."""
    out_path = os.path.join(DERIVED, "halloweenbits_lantern_emi.png")
    if os.path.exists(out_path):
        return out_path
    _, px, w, h = _load_pixels(HAL_TEX)
    cw, ch = w // 8, h // 4
    emi = np.zeros((h, w, 4), dtype=np.float32)
    emi[..., 3] = 1.0
    y0, x0 = 0, 2 * cw  # row=3 (bottom row in image coords = y in 0..ch)
    emi[y0:y0 + ch, x0:x0 + cw, :3] = px[y0:y0 + ch, x0:x0 + cw, :3]
    _save_pixels(emi, w, h, out_path)
    return out_path


def retexture(objs, src_prefix, new_path):
    """Swap a pack texture for its tinted copy on every material of objs (UV mapping preserved)."""
    img = _load_img_cached(new_path)
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


def tinted_texture(src_img_name_or_path, out_name, primary_hex, accent_hex, dark_hex="#1b1d24",
                   prim_strength=0.88, accent_strength=0.92, value_boost=1.08):
    """Luminance-preserving recolour of a texture: neutral/teal/green panels -> primary, orange panels -> accent."""
    out_path = os.path.join(DERIVED, out_name)
    if os.path.exists(out_path):
        return out_path
    if os.path.exists(src_img_name_or_path):
        _, px, w, h = _load_pixels(src_img_name_or_path)
    else:
        img = bpy.data.images[src_img_name_or_path]
        w, h = img.size
        px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    rgb = px[..., :3]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.zeros_like(mx)
    d = np.maximum(mx - mn, 1e-5)
    hue = np.where(mx == r, ((g - b) / d) % 6, hue)
    hue = np.where(mx == g, (b - r) / d + 2, hue)
    hue = np.where(mx == b, (r - g) / d + 4, hue)
    hue = hue * 60.0
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    is_orange = (sat > 0.35) & (hue > 12) & (hue < 52)
    is_rust = (sat > 0.35) & (hue <= 12) | ((sat > 0.5) & (hue > 52) & (hue < 70) & (lum < 0.35))

    def colorize(l, tint_hex):
        t = np.array(hex_rgb(tint_hex), dtype=np.float32)
        l2 = np.clip(l * value_boost, 0, 1)[..., None]
        low = t[None, None, :] * (l2 * 2.0)
        high = t[None, None, :] + (1 - t[None, None, :]) * ((l2 - 0.5) * 2.0) * 0.55
        return np.where(l2 < 0.5, low, high)

    prim = colorize(lum, primary_hex)
    acc = colorize(lum, accent_hex)
    dark = np.array(hex_rgb(dark_hex), dtype=np.float32)[None, None, :] * np.clip(lum * 2.2, 0, 1)[..., None]
    w_prim = np.where(lum < 0.16, 0.25, prim_strength)[..., None]
    out = rgb * (1 - w_prim) + prim * w_prim
    out = np.where(is_orange[..., None], rgb * (1 - accent_strength) + acc * accent_strength, out)
    out = np.where(is_rust[..., None], rgb * 0.6 + dark * 0.4, out)
    out = np.where((lum < 0.16)[..., None], rgb * 0.5 + dark * 0.5, out)
    px[..., :3] = np.clip(out, 0, 1)
    _save_pixels(px, w, h, out_path)
    return out_path


def set_flat_color(objs, mat_names, hex_color, emission_hex=None, emission_strength=0.0,
                   roughness=None, metallic=None, force=False):
    """For untextured flat-shaded CC0 materials (or force-replacing missing textures)."""
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


def set_emissive_tint(objs, hex_color, strength=0.16):
    """Add a subtle constant emissive tint (without emissiveMap so Three.js white hit-flash stays pure white)."""
    seen = set()
    for o in objs:
        if o.type != "MESH":
            continue
        for m in o.data.materials:
            if not m or m in seen or not m.node_tree:
                continue
            seen.add(m)
            b = m.node_tree.nodes.get("Principled BSDF")
            if not b:
                continue
            for lk in list(b.inputs["Emission Color"].links):
                m.node_tree.links.remove(lk)
            b.inputs["Emission Color"].default_value = hex_lin(hex_color)
            b.inputs["Emission Strength"].default_value = strength


# ---------------------------------------------------------------------------
# KayKit adventurer crews: pose-bake rigged characters into static sculpted meshes
# ---------------------------------------------------------------------------

def clear_nla(arm):
    if arm.animation_data:
        for tr in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(tr)


def set_action(arm, action_name):
    act = bpy.data.actions.get(action_name)
    if act is None:
        raise KeyError(f"action {action_name} not found; have {[a.name for a in bpy.data.actions][:12]}")
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
    """Parent obj directly to an armature bone while preserving its world transform."""
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    bpy.context.view_layer.update()
    obj.matrix_world = world_mat
    bpy.context.view_layer.update()


def import_character(char_file, scale, keep_props=(), drop_props=(), extra_hand_props=(), action=None,
                     frame_offset=0, native_hat=None):
    """Import a KayKit character, scale via holder (no transform_apply on the armature) and pose it."""
    objs = import_asset(os.path.join(ADV_C, char_file))
    arm = next(o for o in objs if o.type == "ARMATURE")
    holder = make_empty("CharHolder")
    for r in roots_of(objs):
        r.parent = holder
    holder.scale = (scale, scale, scale)
    meshes, props, hat = [], [], None
    for o in objs:
        if o.type != "MESH":
            continue
        if o.parent_bone in ("handslot.r", "handslot.l"):
            if o.name in keep_props:
                props.append(o)
            else:
                bpy.data.objects.remove(o, do_unlink=True)
            continue
        if o.name in drop_props:
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        if native_hat and o.name == native_hat:
            hat = o
            continue
        meshes.append(o)
    clear_nla(arm)
    if action:
        act = set_action(arm, action)
        f0 = int(act.frame_range[0])
        bpy.context.scene.frame_set(f0 + frame_offset)
    else:
        for pb in arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    for path, bone, mult in extra_hand_props:
        pobjs = import_asset(path)
        ph = make_empty("PropHolder")
        for r in roots_of(pobjs):
            r.parent = ph
        bw = bone_world(arm, bone)
        ph.matrix_world = bw @ Matrix.Scale(scale * mult, 4)
        bpy.context.view_layer.update()
        for o in pobjs:
            if o.type == "MESH":
                props.append(o)
                set_parent_keep(o, None)
        bpy.data.objects.remove(ph, do_unlink=True)
    return {"holder": holder, "arm": arm, "meshes": meshes, "props": props, "hat": hat}


def bake_static(char):
    """Freeze the current pose into plain meshes (armature modifier evaluated) and delete the rig."""
    arm = char["arm"]
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    allm = char["meshes"] + char["props"] + ([char["hat"]] if char["hat"] else [])
    for o in allm:
        mw = o.matrix_world.copy()
        if any(m.type == "ARMATURE" for m in o.modifiers):
            ev = o.evaluated_get(dg)
            new_me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
            for m in list(o.modifiers):
                o.modifiers.remove(m)
            o.data = new_me
        o.parent = None
        o.matrix_world = mw
    head_m = bone_world(arm, "head")
    bpy.data.objects.remove(arm, do_unlink=True)
    bpy.data.objects.remove(char["holder"], do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in allm:
        o.select_set(True)
    bpy.context.view_layer.objects.active = allm[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    char["head_matrix"] = head_m
    return char


# ---------------------------------------------------------------------------
# ENVIRONMENT
# ---------------------------------------------------------------------------

def hex_building(color, name):
    return os.path.join(HEX_B, color, f"building_{name}_{color}.gltf")


def build_env_castle():
    clear_scene()
    root = make_empty("CastleRoot")
    warm = atlas_variant("warm")
    parts = []
    # Sculpted KayKit keep (coral roofs + sunlit sandstone walls)
    _, o = place(hex_building("red", "castle"), parent=root, height=3.65, loc=(0, 0.45, 0))
    parts += o
    # Curtain wall with central arched gate facing -Y (three.js +Z, toward enemy path)
    _, o = place(os.path.join(HEX_B, "neutral", "wall_straight_gate.gltf"), parent=root, width_x=1.80, loc=(0, -0.72, 0))
    parts += o
    for sx in (-1, 1):
        _, o = place(os.path.join(HEX_B, "neutral", "wall_straight.gltf"), parent=root, width_x=1.22, loc=(sx * 1.48, -0.72, 0))
        parts += o
        _, o = place(hex_building("red", "tower_A"), parent=root, height=2.65, loc=(sx * 2.25, -0.58, 0))
        parts += o
        _, o = place(os.path.join(HEX_P, "flag_red.gltf"), parent=root, height=0.88, loc=(sx * 0.86, -0.82, 0.95))
        parts += o
    retexture(parts, "hexagons_medieval", warm)
    # Courtyard treasure chests, barrels, coin piles cleanly flanking the gate
    for sx, rot in ((-1.38, 25), (1.38, -25)):
        place(os.path.join(DUN, "chest_gold.glb"), parent=root, height=0.42, loc=(sx, -1.32, 0), rot_z=rot)
    for sx in (-2.02, 2.02):
        _, o = place(os.path.join(HEX_P, "barrel.gltf"), parent=root, height=0.36, loc=(sx, -1.38, 0))
        retexture(o, "hexagons_medieval", warm)
    place(os.path.join(Q, "modular_dungeon_1/Coin_Pile.glb"), parent=root, max_xy=0.42, loc=(-0.92, -1.42, 0))
    place(os.path.join(Q, "modular_dungeon_1/Coin_Pile.glb"), parent=root, max_xy=0.38, loc=(0.92, -1.42, 0), rot_z=70)
    # Sculpted Great Oak canopy framing BEHIND and BESIDE the keep (never obscuring the keep roof)
    for sx, sy, sc, rot in ((-2.35, 1.50, 2.75, 25), (2.35, 1.50, 2.75, 140), (0.0, 1.95, 3.15, 70)):
        _, to = place(os.path.join(Q, "nature_pack/CommonTree_4.glb"), parent=root, height=sc, loc=(sx, sy, 0), rot_z=rot)
        set_flat_color(to, ("Green", "Leaves", "Leaf", "Material.001"), "#58a450", roughness=0.86)
    finalize_ground(root)
    export_glb("env_castle")


def build_env_cliff_segment():
    clear_scene()
    root = make_empty("CliffRoot")
    canyon = atlas_variant("canyon")
    allo = []
    _, o = place(os.path.join(HEX_N, "mountain_B.gltf"), parent=root, max_xy=2.3, loc=(0, 0, 0))
    allo += o
    _, o = place(os.path.join(HEX_N, "rock_single_C.gltf"), parent=root, max_xy=0.8, loc=(0.85, -0.75, 0), rot_z=40)
    allo += o
    _, o = place(os.path.join(HEX_N, "rock_single_E.gltf"), parent=root, max_xy=0.6, loc=(-0.9, -0.7, 0), rot_z=-30)
    allo += o
    retexture(allo, "hexagons_medieval", canyon)
    finalize_ground(root)
    export_glb("env_cliff_segment")


def build_env_crystal():
    clear_scene()
    root = make_empty("CrystalRoot")
    h, rock = place(os.path.join(Q, "nature_pack/Rock_Moss_2.glb"), parent=root, max_xy=0.78, loc=(0, 0, 0))
    set_flat_color(rock, "*", "#5f6f7d", roughness=0.9)
    h.scale.z *= 0.45
    bpy.context.view_layer.update()
    _, mx = mesh_bounds(rock)
    top = mx.z * 0.75
    specs = [
        ("rpg_items_pack/Crystal3.glb", 1.15, (0.0, 0.0), 0, (6, -4), "#a46cf0", "#8a4dff", 1.6),
        ("rpg_items_pack/Crystal3.glb", 0.78, (-0.22, 0.1), 40, (18, 20), "#7ff0ff", "#33dcff", 1.8),
        ("rpg_items_pack/Crystal3.glb", 0.70, (0.24, -0.06), -30, (-16, -18), "#b07af5", "#8a4dff", 1.5),
        ("rpg_items_pack/Crystal3.glb", 0.52, (0.06, 0.22), 90, (22, -10), "#7ff0ff", "#33dcff", 1.8),
    ]
    for path, ht, (x, y), rz, (rx, ry), col, emi, es in specs:
        hh, o = place(os.path.join(Q, path), parent=root, height=ht, loc=(x, y, top * 0.55),
                      rot_deg=(rx, ry, rz))
        for ob in o:
            if ob.type == "MESH":
                ob.name = "Crystal_glow"
        set_flat_color(o, "*", col, emission_hex=emi, emission_strength=es, roughness=0.22, metallic=0.05)
    finalize_ground(root)
    export_glb("env_crystal")


def build_env_tree_oak():
    clear_scene()
    root = make_empty("OakTreeRoot")
    _, o = place(os.path.join(Q, "nature_pack/CommonTree_4.glb"), parent=root, height=2.55)
    set_flat_color(o, ("Green", "Leaves", "Leaf", "Material.001"), "#5aa650", roughness=0.86)
    finalize_ground(root)
    export_glb("env_tree_oak")


def build_env_tree_pine():
    clear_scene()
    root = make_empty("PineTreeRoot")
    _, o = place(os.path.join(Q, "nature_pack/PineTree_1.glb"), parent=root, height=2.55)
    set_flat_color(o, ("Green", "Leaves", "Leaf", "Pine", "Material.001"), "#3f844b", roughness=0.88)
    finalize_ground(root)
    export_glb("env_tree_pine")


def build_env_lantern():
    clear_scene()
    root = make_empty("LanternRoot")
    h, o = place(os.path.join(HAL, "post_lantern.gltf"), parent=root, height=1.6, center=False)
    mn, mx = mesh_bounds(o)
    h.location.x -= (mn.x + mx.x) * 0.5
    h.location.y -= (mx.y - (mx.x - mn.x) * 0.5)
    bpy.context.view_layer.update()
    # Plug emission-only mask for the yellow lantern glass swatch so only the glass glows warm amber
    emi_img = _load_img_cached(halloween_lantern_emission_map())
    for ob in o:
        if ob.type == "MESH" and "lantern" in ob.name.lower():
            for m in ob.data.materials:
                if m and m.node_tree:
                    b = m.node_tree.nodes.get("Principled BSDF")
                    if b:
                        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
                        tex.image = emi_img
                        m.node_tree.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
                        b.inputs["Emission Strength"].default_value = 2.8
    mn, mx = mesh_bounds(o)
    make_empty("LanternLight", loc=(0, mn.y + 0.14, mn.z + (mx.z - mn.z) * 0.62), parent=root)
    finalize_ground(root)
    export_glb("env_lantern")


def build_env_fence():
    clear_scene()
    root = make_empty("FenceRoot")
    # Open rustic 2-rail wooden fence along X (matches target road edge aesthetic)
    _, o = place(os.path.join(Q, "medieval_village_pack/Fence.glb"), parent=root, width_x=1.42)
    set_flat_color(o, "*", "#a3602d", roughness=0.82, metallic=0.02)
    finalize_ground(root)
    export_glb("env_fence")


def build_env_slot_pad():
    clear_scene()
    root = make_empty("SlotPadRoot")
    # Tidy circular stone collar (outer radius <= 0.68 m, diameter ~1.34 m) so slot_5 clears road curbstones
    cobbles = ["Rock_1", "Rock_4", "Rock_5"]
    h, bed = place(os.path.join(Q, "nature_pack/Rock_6.glb"), parent=root, max_xy=1.04, loc=(0, 0, 0))
    h.scale.z *= 0.035
    set_flat_color(bed, "*", "#465361", roughness=0.95)
    for i in range(10):
        a = (i / 10.0) * math.pi * 2.0
        r = 0.55
        name = cobbles[i % len(cobbles)]
        hh, o = place(os.path.join(Q, f"nature_pack/{name}.glb"), parent=root, max_xy=0.23,
                      loc=(math.cos(a) * r, math.sin(a) * r, 0), rot_z=math.degrees(a) + 90)
        hh.scale.z *= 0.26
        set_flat_color(o, "*", "#e5d6ba" if i % 2 == 0 else "#d2c2a2", roughness=0.9)
    bpy.context.view_layer.update()
    finalize_ground(root)
    export_glb("env_slot_pad")


def build_env_stump():
    clear_scene()
    root = make_empty("StumpRoot")
    place(os.path.join(Q, "nature_pack/TreeStump_Moss.glb"), parent=root, max_xy=1.18)
    finalize_ground(root)
    export_glb("env_stump")


# ---------------------------------------------------------------------------
# TOWERS — KayKit hex towers + posed KayKit adventurers + sculpted weapons
# ---------------------------------------------------------------------------

TOWER_COLOR = {"squirrel": "red", "beaver": "yellow", "owl": "blue", "hedgehog": "green"}

CREW = {
    # tower: (character, keep_props, extra_props, action, frame, native_hat)
    "squirrel_1": ("Rogue.glb", ("1H_Crossbow",), (), "1H_Ranged_Aiming", 6, None),
    "squirrel_2": ("Rogue_Hooded.glb", ("2H_Crossbow",), (), "2H_Ranged_Aiming", 6, None),
    "squirrel_sniper": ("Rogue_Hooded.glb", (), (), "2H_Ranged_Aiming", 6, None),
    "squirrel_gatling": ("Rogue_Hooded.glb", (), (), "1H_Ranged_Aiming", 4, None),
    "beaver_1": ("Barbarian.glb", ("2H_Axe",), (), "2H_Melee_Idle", 8, "Barbarian_Hat"),
    "beaver_2": ("Barbarian.glb", ("1H_Axe", "Barbarian_Round_Shield"), (), "Idle", 8, "Barbarian_Hat"),
    "beaver_mortar": ("Barbarian.glb", (), (), "Idle", 8, "Barbarian_Hat"),
    "beaver_resin": ("Barbarian.glb", ("1H_Axe",), (), "Idle", 8, "Barbarian_Hat"),
    "owl_1": ("Mage.glb", ("1H_Wand", "Spellbook"), (), "Idle", 10, "Mage_Hat"),
    "owl_2": ("Mage.glb", ("2H_Staff",), (), "2H_Melee_Idle", 10, "Mage_Hat"),
    "owl_3": ("Mage.glb", ("2H_Staff",), (), "Spellcasting", 6, "Mage_Hat"),
    "hedgehog_1": ("Knight.glb", (), (("crossbow_2handed.gltf", "handslot.r", 1.0),), "2H_Ranged_Aiming", 6, "Knight_Helmet"),
    "hedgehog_2": ("Knight.glb", (), (("crossbow_2handed.gltf", "handslot.r", 1.15),), "2H_Ranged_Aiming", 6, "Knight_Helmet"),
    "hedgehog_pierce": ("Knight.glb", (), (), "2H_Ranged_Aiming", 6, "Knight_Helmet"),
    "hedgehog_shred": ("Knight.glb", ("1H_Sword", "Spike_Shield"), (), "Blocking", 4, "Knight_Helmet"),
}


def crew_key(tower_id, tier, branch):
    if tower_id == "squirrel":
        return {1: "squirrel_1", 2: "squirrel_2"}.get(tier, branch)
    if tower_id == "beaver":
        if tier == 1:
            return "beaver_1"
        if tier == 2:
            return "beaver_2"
        return branch if branch == "beaver_resin" else "beaver_mortar"
    if tower_id == "owl":
        return {1: "owl_1", 2: "owl_2"}.get(tier, "owl_3")
    return {1: "hedgehog_1", 2: "hedgehog_2"}.get(tier, branch)


def build_crew(turret_head, key, deck_z, offset=(0.0, 0.0)):
    char_file, keep, extra, action, frame, native_hat = CREW[key]
    extra_full = [(os.path.join(ADV_A, p), b, m) for p, b, m in extra]
    ch = import_character(char_file, CREW_SCALE, keep_props=keep, extra_hand_props=extra_full,
                          action=action, frame_offset=frame, native_hat=native_hat)
    bake_static(ch)
    body = ch["meshes"]
    mn, mx = mesh_bounds(body)
    dz = deck_z - mn.z
    dx = offset[0] - (mn.x + mx.x) * 0.5
    dy = offset[1] - (mn.y + mx.y) * 0.5
    for o in body + ch["props"] + ([ch["hat"]] if ch["hat"] else []):
        o.location += Vector((dx, dy, dz))
    bpy.context.view_layer.update()
    char_group = make_empty("CharacterGroup", loc=(offset[0], offset[1], 0), parent=turret_head)
    weapon_group = make_empty("WeaponGroup", loc=(0, 0, 0), parent=turret_head)
    for o in body:
        set_parent_keep(o, char_group)
    for o in ch["props"]:
        set_parent_keep(o, weapon_group)
    if ch["hat"]:
        ch["hat"].name = "NativeHat_" + ch["hat"].name
        set_parent_keep(ch["hat"], char_group)
    head_m = ch["head_matrix"].copy()
    head_m.translation += Vector((dx, dy, dz))
    sock = make_empty("HeadSocket", parent=char_group)
    sock.matrix_world = head_m @ Matrix.Scale(CREW_SCALE / HERO_SCALE, 4)
    bpy.context.view_layer.update()
    return char_group, weapon_group


def spin_orbit(turret_head, z, count, radius, color, emi, crystal="rpg_items_pack/Crystal3.glb", height=0.28):
    spin = make_empty("SpinPart", loc=(0, 0, z), parent=turret_head)
    c = spin.matrix_world.translation.copy()
    for i in range(count):
        a = i * math.pi * 2 / count
        hh, o = place(os.path.join(Q, crystal), parent=None, height=height,
                      loc=(c.x + math.cos(a) * radius, c.y + math.sin(a) * radius, c.z - height * 0.5),
                      rot_z=math.degrees(a))
        for ob in o:
            if ob.type == "MESH":
                ob.name = f"OrbitCrystal_glow_{i}"
        set_flat_color(o, "*", color, emission_hex=emi, emission_strength=1.8, roughness=0.2)
        set_parent_keep(hh, spin)
    return spin


def build_tower_asset(tower_id, suffix, tier, branch):
    clear_scene()
    root = make_empty("TowerRoot")
    color = TOWER_COLOR[tower_id]
    warm = atlas_variant("warm")
    struct = []

    # ----- sculpted KayKit tower masonry; fits inside 1.45m slot pad & scales cleanly by tier -----
    if tower_id == "beaver" and (tier == 2 or branch == "beaver_resin"):
        ht = 1.72 if tier == 2 else 1.94
        _, o = place(hex_building(color, "tower_catapult"), parent=root, height=ht)
        struct += o
        mn, mx = mesh_bounds(o)
        deck_z = (mx.z - mn.z) * (1.5 / 1.964)
        crew_offset = (0.24, 0.14)
    else:
        ht = {1: 1.24, 2: 1.46, 3: 1.66}[tier]
        _, o = place(hex_building(color, "tower_base"), parent=root, height=ht)
        struct += o
        mn, mx = mesh_bounds(o)
        deck_z = mx.z - (mx.z - mn.z) * 0.085
        crew_offset = (0.0, 0.08) if tier == 3 and branch in ("beaver_stun", "squirrel_gatling") else (0.0, 0.0)
    retexture(struct, "hexagons_medieval", warm)

    # ----- tier dressing: guild flags & sculpted ground/parapet props -----
    if tier >= 2:
        _, o = place(os.path.join(HEX_P, f"flag_{color}.gltf"), parent=root, height=0.58 + 0.12 * (tier - 2),
                     loc=(-0.38, 0.30, deck_z - 0.02))
        retexture(o, "hexagons_medieval", warm)
    if tier == 3:
        _, o = place(os.path.join(HEX_P, f"flag_{color}.gltf"), parent=root, height=0.70,
                     loc=(0.38, 0.30, deck_z - 0.02), rot_z=180)
        retexture(o, "hexagons_medieval", warm)
        if branch == "squirrel_sniper":
            _, o = place(os.path.join(HEX_P, "target.gltf"), parent=root, height=0.44, loc=(0.60, 0.35, 0), rot_z=-30)
            retexture(o, "hexagons_medieval", warm)
        if branch == "squirrel_gatling":
            _, o = place(os.path.join(HEX_P, "bucket_arrows.gltf"), parent=root, height=0.36, loc=(0.56, -0.34, 0))
            retexture(o, "hexagons_medieval", warm)
        if branch == "beaver_resin":
            for k, (bx, by) in enumerate(((-0.56, -0.34), (0.56, -0.34))):
                _, o = place(os.path.join(HEX_P, "barrel.gltf"), parent=root, height=0.36, loc=(bx, by, 0))
                retexture(o, "hexagons_medieval", warm)
            _, go = place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), parent=root, height=0.28,
                          loc=(0.0, 0.25, deck_z + 0.32), rot_deg=(45, 0, 0))
            set_flat_color(go, "*", "#ffb038", emission_hex="#ff8c1a", emission_strength=1.2)
        if branch == "beaver_stun":
            _, o = place(os.path.join(HEX_B, "neutral", "projectile_catapult.gltf"), parent=root, max_xy=0.32, loc=(-0.54, -0.38, 0))
            retexture(o, "hexagons_medieval", warm)

    # ----- turret head (yaw pivot, -Y == three.js +Z forward) -----
    turret_head = make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
    key = crew_key(tower_id, tier, branch)
    _, weapon_group = build_crew(turret_head, key, deck_z, offset=crew_offset)

    if branch == "squirrel_sniper":
        hh, o = place(os.path.join(Q, "modular_sci_fi_guns_pack/Sniper_1.glb"),
                      max_xy=0.95, loc=(0.06, -0.34, deck_z + 0.34), rot_z=-90)
        set_flat_color(o, ("Gold", "Orange", "Accent"), "#eba938", roughness=0.35, metallic=0.55)
        set_parent_keep(hh, weapon_group)

    if branch == "squirrel_gatling":
        hh, o = place(os.path.join(Q, "cyberpunk_pack/Turret_GunDouble.glb"),
                      max_xy=0.72, loc=(0.0, -0.26, deck_z - 0.02), rot_z=0,
                      drop_names=("Base",))
        set_flat_color(o, ("LightGrey", "Grey"), "#d6a442", roughness=0.4, metallic=0.5)
        set_parent_keep(hh, weapon_group)
        spin = make_empty("SpinPart", loc=(0, 0.28, 0.45), parent=turret_head)
        hh2, _ = place(os.path.join(ADV_A, "quiver.gltf"), height=0.34,
                       loc=(spin.matrix_world.translation.x, spin.matrix_world.translation.y, spin.matrix_world.translation.z - 0.17))
        set_parent_keep(hh2, spin)

    if branch == "beaver_stun":
        hh, o = place(os.path.join(Q, "platformer_game_pack/Cannon.glb"),
                      max_xy=0.82, loc=(0.0, -0.18, deck_z - 0.02), rot_z=-90)
        set_parent_keep(hh, weapon_group)

    if tower_id == "owl":
        cnt = 4 if tier == 3 else (3 if tier == 2 else 2)
        if branch == "owl_glacier":
            spin_orbit(turret_head, 0.52, cnt, 0.56, "#e8f8ff", "#6ae6ff")
        else:
            spin_orbit(turret_head, 0.52, cnt, 0.52 if tier < 3 else 0.58, "#7ff0ff", "#33dcff")

    if branch == "hedgehog_pierce":
        hh, o = place(os.path.join(Q, "modular_sci_fi_guns_pack/Crossbow_2.glb"),
                      max_xy=0.86, loc=(0.04, -0.34, deck_z + 0.34), rot_z=-90)
        for ob in o:
            if ob.type == "MESH":
                ob.name = "RailCrossbow_glow"
        set_flat_color(o, ("White", "Grey", "LightGrey", "Accent"), "#5ceaff",
                       emission_hex="#33dcff", emission_strength=1.2)
        set_parent_keep(hh, weapon_group)

    if branch == "hedgehog_shred":
        spin = make_empty("SpinPart", loc=(0, -0.36, 0.54), parent=turret_head)
        c = spin.matrix_world.translation.copy()
        hh, o = place(os.path.join(Q, "platformer_game_pack/Hazard_Saw.glb"),
                      max_xy=0.68, loc=(0, 0, 0), rot_deg=(90, 0, 0), center=False, ground=False)
        mn, mx = mesh_bounds(o)
        hh.location = c - Vector(((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, (mn.z + mx.z) * 0.5))
        bpy.context.view_layer.update()
        set_parent_keep(hh, spin)
        set_flat_color(o, "*", "#d4e0eb", roughness=0.28, metallic=0.8)

    finalize_ground(root)
    export_glb(f"tower_{tower_id}_{suffix}")


def build_all_towers():
    configs = [
        ("squirrel", "t1", 1, None), ("squirrel", "t2", 2, None),
        ("squirrel", "sniper", 3, "squirrel_sniper"), ("squirrel", "gatling", 3, "squirrel_gatling"),
        ("beaver", "t1", 1, None), ("beaver", "t2", 2, None),
        ("beaver", "mortar", 3, "beaver_stun"), ("beaver", "resin", 3, "beaver_resin"),
        ("owl", "t1", 1, None), ("owl", "t2", 2, None),
        ("owl", "chain", 3, "owl_chain"), ("owl", "blizzard", 3, "owl_glacier"),
        ("hedgehog", "t1", 1, None), ("hedgehog", "t2", 2, None),
        ("hedgehog", "rail", 3, "hedgehog_pierce"), ("hedgehog", "shred", 3, "hedgehog_shred"),
    ]
    for tid, suf, tier, br in configs:
        if WANT and f"tower_{tid}_{suf}" not in WANT:
            continue
        build_tower_asset(tid, suf, tier, br)


# ---------------------------------------------------------------------------
# HERO — rigged KayKit Barbarian ("Boz Pence") with Idle / Walk / Attack clips
# ---------------------------------------------------------------------------

HERO_ACTIONS = ("Idle", "Walking_A", "Running_A", "1H_Melee_Attack_Chop", "Cheer", "Hit_A")


def build_hero_bear():
    clear_scene()
    objs = import_asset(os.path.join(ADV_C, "Barbarian.glb"))
    arm = next(o for o in objs if o.type == "ARMATURE")
    clear_nla(arm)
    keep = {"1H_Axe", "Barbarian_Round_Shield"}
    for o in list(objs):
        if o.type == "MESH" and o.parent_bone in ("handslot.r", "handslot.l") and o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in bpy.data.objects:
        if o.name == "Barbarian_Hat":
            o.name = "NativeHat_Barbarian"
    for act in list(bpy.data.actions):
        if act.name not in HERO_ACTIONS:
            bpy.data.actions.remove(act)
        else:
            act.use_fake_user = True
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    if arm.animation_data:
        arm.animation_data.action = None
    root = make_empty("HeroRoot")
    body = make_empty("Body", parent=root)
    holder = make_empty("HeroScale", parent=body)
    holder.scale = (HERO_SCALE, HERO_SCALE, HERO_SCALE)
    for r in roots_of([o for o in bpy.data.objects if o not in (body, root, holder)]):
        r.parent = holder
    bpy.context.view_layer.update()
    mn, _ = mesh_bounds([o for o in bpy.data.objects if o.type == "MESH"])
    holder.location.z -= mn.z
    bpy.context.view_layer.update()
    head_m = bone_world(arm, "head")
    sock = make_empty("HeadSocket")
    attach_to_bone(arm, "head", sock, head_m)
    set_action(arm, "Idle")
    export_glb("hero_bear", has_armature=True)


# ---------------------------------------------------------------------------
# HATS — sculpted CC0 headwear in hero head-bone space
# ---------------------------------------------------------------------------

def reference_head():
    """Hero-scale Barbarian rest head: (head bone matrix, min, max) in world."""
    objs = import_asset(os.path.join(ADV_C, "Barbarian.glb"))
    arm = next(o for o in objs if o.type == "ARMATURE")
    holder = make_empty("RefH")
    for r in roots_of(objs):
        r.parent = holder
    holder.scale = (HERO_SCALE,) * 3
    clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    head = next(o for o in objs if o.name == "Barbarian_Head")
    mn, mx = mesh_bounds([head])
    hm = bone_world(arm, "head")
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(holder, do_unlink=True)
    return hm, mn, mx


def _hat_parts_to_head_space(parts_objs, hm, out_name):
    meshes = [ob for ob in parts_objs if ob.type == "MESH"]
    root = make_empty("HatRoot")
    for ob in meshes:
        mw = ob.matrix_world.copy()
        ob.parent = None
        ob.matrix_world = hm.inverted() @ mw
    bpy.context.view_layer.update()
    for ob in list(bpy.data.objects):
        if ob.type == "EMPTY" and ob is not root:
            bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for ob in meshes:
        set_parent_keep(ob, root)
        ob.name = f"Hat_{out_name}_{ob.name}"
    export_glb(out_name)


def hat_from_character(char_file, hat_mesh_name, out_name):
    clear_scene()
    objs = import_asset(os.path.join(ADV_C, char_file))
    arm = next(o for o in objs if o.type == "ARMATURE")
    holder = make_empty("H")
    for r in roots_of(objs):
        r.parent = holder
    holder.scale = (HERO_SCALE,) * 3
    clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    head_m = bone_world(arm, "head")
    hat = next(o for o in objs if o.name == hat_mesh_name)
    mw = hat.matrix_world.copy()
    for o in objs:
        if o is not hat:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(holder, do_unlink=True)
    hat.parent = None
    hat.matrix_world = head_m.inverted() @ mw
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    hat.select_set(True)
    bpy.context.view_layer.objects.active = hat
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    root = make_empty("HatRoot")
    set_parent_keep(hat, root)
    hat.name = "Hat_" + out_name
    export_glb(out_name)


def hat_pirate():
    """AliceCassie 'Pirate' (CC0): sculpted tricorn hat scaled cleanly over the brow."""
    clear_scene()
    hm, hmn, hmx = reference_head()
    objs = import_asset(os.path.join(PP, "Pirate_AC.glb"))
    hat = next(o for o in objs if o.type == "MESH" and o.name.startswith("Hat"))
    for o in objs:
        if o is not hat and o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    holder = make_empty("PH")
    set_parent_keep(hat, holder)
    mn, mx = mesh_bounds([hat])
    head_w = hmx.x - hmn.x
    s = head_w * 1.56 / max(mx.x - mn.x, 1e-4)
    holder.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds([hat])
    holder.location += Vector(((hmn.x + hmx.x) * 0.5 - (mn.x + mx.x) * 0.5,
                               (hmn.y + hmx.y) * 0.5 - (mn.y + mx.y) * 0.5,
                               hmx.z - (mx.z - mn.z) * 0.50 - mn.z))
    bpy.context.view_layer.update()
    set_flat_color([hat], ("Purple",), "#283047", roughness=0.72)
    set_flat_color([hat], ("Gold",), "#f2b83e", roughness=0.34, metallic=0.6)
    _hat_parts_to_head_space([hat], hm, "hat_pirate")


def hat_chef():
    """Chef toque from sculpted CC0 parts: inverted KayKit bowl headband (no handles) + KayKit cloud puff."""
    clear_scene()
    hm, hmn, hmx = reference_head()
    head_w = hmx.x - hmn.x
    cx, cy = (hmn.x + hmx.x) * 0.5, (hmn.y + hmx.y) * 0.5
    band_h, band_o = place(os.path.join(PP, "bowl.gltf"), width_x=head_w * 0.90,
                           loc=(cx, cy, 0), rot_deg=(180, 0, 0))
    band_h.scale.z *= 1.15
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(band_o)
    band_h.location.z += hmx.z - (mx.z - mn.z) * 0.52 - mn.z
    bpy.context.view_layer.update()
    _, mx = mesh_bounds(band_o)
    set_flat_color(band_o, "*", "#f6f3ec", roughness=0.86, metallic=0.0, force=True)
    puff_h, puff_o = place(os.path.join(HEX_N, "cloud_small.gltf"), max_xy=head_w * 0.96, loc=(cx, cy, mx.z - 0.04))
    puff_h.scale.z *= 0.72
    bpy.context.view_layer.update()
    _hat_parts_to_head_space(band_o + puff_o, hm, "hat_chef")


def hat_viking():
    """Open-face Viking nasal spangenhelm (Quaternius Helmet2 + ivory horn crests, CC0)."""
    clear_scene()
    hm, hmn, hmx = reference_head()
    head_w = hmx.x - hmn.x
    cx, cy = (hmn.x + hmx.x) * 0.5, (hmn.y + hmx.y) * 0.5
    h, o = place(os.path.join(Q, "single_knight_pack/Helmet2.glb"), width_x=head_w * 1.12, loc=(cx, cy, 0))
    mn, mx = mesh_bounds(o)
    helm_base_z = hmx.z - (mx.z - mn.z) * 0.72
    h.location.z += helm_base_z - mn.z
    bpy.context.view_layer.update()
    set_flat_color(o, "*", "#6e7d8f", roughness=0.45, metallic=0.65)
    parts = list(o)
    for sx in (-1, 1):
        hh, ho = place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), height=head_w * 0.42,
                       loc=(cx + sx * head_w * 0.54, cy, helm_base_z + (mx.z - mn.z) * 0.58),
                       rot_deg=(0, sx * -52, 0), center=False, ground=False)
        set_flat_color(ho, "*", "#f2ead8", roughness=0.5, metallic=0.05)
        parts.extend(ho)
    _hat_parts_to_head_space(parts, hm, "hat_viking")


def build_hats():
    if not WANT or "hat_wizard" in WANT:
        hat_from_character("Mage.glb", "Mage_Hat", "hat_wizard")
    if not WANT or "hat_viking" in WANT:
        hat_viking()
    if not WANT or "hat_pirate" in WANT:
        hat_pirate()
    if not WANT or "hat_chef" in WANT:
        hat_chef()


# ---------------------------------------------------------------------------
# ENEMIES — rigged & animated CC0 robots, high-contrast colors + bone-mounted props
# ---------------------------------------------------------------------------

def prune_actions_keep(keep_keywords=("idle", "walk", "run", "death", "dead")):
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    for arm in arms:
        clear_nla(arm)
        for pb in arm.pose.bones:
            pb.custom_shape = None
    for act in list(bpy.data.actions):
        low = act.name.lower().split("|")[-1]
        if low not in keep_keywords:
            bpy.data.actions.remove(act)
        else:
            act.use_fake_user = True
    for arm in arms:
        walk = next((a for a in bpy.data.actions if a.name.lower().split("|")[-1] == "walk"), None)
        if walk:
            set_action(arm, walk.name)


ENEMY_TINTS = {
    # name: (src, height, z_lift, primary, accent, emission)
    "enemy_scout_bot": ("mech_pack/Leela.glb", 1.12, 0.0, "#e6352e", "#ffb626", 0.14),
    "enemy_swarm_saw": ("mech_pack/Mike.glb", 0.96, 0.0, "#5fe62c", "#1d2b16", 0.14),
    "enemy_shield_loader": ("mech_pack/George.glb", 1.38, 0.0, "#274cd4", "#ffc83d", 0.14),
    "enemy_mega_harvester": ("mech_pack/Stan.glb", 2.35, 0.0, "#342a3b", "#ff3030", 0.16),
}


def build_rigged_mech(name):
    src, height, z_lift, prim, acc, emi = ENEMY_TINTS[name]
    clear_scene()
    root = make_empty("EnemyRoot")
    objs = import_asset(os.path.join(Q, src))
    prune_actions_keep()
    arm = next(o for o in objs if o.type == "ARMATURE")
    meshes = [o for o in objs if o.type == "MESH"]
    for o in meshes:
        for m in o.data.materials:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    src_name = n.image.name
                    tinted = tinted_texture(src_name, f"{name}_tex.png", prim, acc,
                                            dark_hex="#141018" if name != "enemy_mega_harvester" else "#0f0c14",
                                            prim_strength=0.90 if name != "enemy_mega_harvester" else 0.94,
                                            value_boost=1.18)
                    retexture([o], src_name, tinted)
    set_emissive_tint(meshes, prim if name != "enemy_mega_harvester" else "#4a121b", strength=emi)
    holder = make_empty("MechScale")
    for r in roots_of(objs):
        r.parent = holder
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    s = height / max(mx.z - mn.z, 1e-4)
    holder.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    holder.location = (-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, z_lift - mn.z)
    holder.parent = root
    bpy.context.view_layer.update()

    if name == "enemy_scout_bot":
        # Gold wind-up / scout crest mounted on Chest bone
        hh, o = place(os.path.join(Q, "rpg_items_pack/Crown.glb"), max_xy=0.34,
                      loc=(0, 0.24, 0.68), rot_deg=(-90, 0, 0), center=False, ground=False)
        mn2, mx2 = mesh_bounds(o)
        hh.location += Vector((-(mn2.x + mx2.x) * 0.5, 0.28 - mn2.y, 0.68 - (mn2.z + mx2.z) * 0.5))
        bpy.context.view_layer.update()
        set_flat_color(o, "*", "#ffc13b", emission_hex="#ff9914", emission_strength=0.35, roughness=0.3, metallic=0.6)
        attach_to_bone(arm, "Chest", hh, hh.matrix_world.copy())

    if name == "enemy_swarm_saw":
        spin = make_empty("SpinPart", loc=(0, -0.38, 0.44))
        hh, o = place(os.path.join(Q, "platformer_game_pack/Hazard_Saw.glb"), max_xy=0.58,
                      rot_z=90, center=False, ground=False)
        mn2, mx2 = mesh_bounds(o)
        hh.location = spin.location - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5))
        bpy.context.view_layer.update()
        set_parent_keep(hh, spin)
        set_flat_color(o, "*", "#d8e4ec", emission_hex="#9cff5a", emission_strength=0.30, roughness=0.3, metallic=0.8)
        attach_to_bone(arm, "Chest", spin, spin.matrix_world.copy())

    if name == "enemy_shield_loader":
        grp = make_empty("ShieldGroup", loc=(0, -0.44, 0.66))
        hh, o = place(os.path.join(ADV_A, "shield_badge_color.gltf"), height=0.80, rot_z=0, center=False, ground=False)
        mn2, mx2 = mesh_bounds(o)
        hh.location = grp.location - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5))
        bpy.context.view_layer.update()
        set_parent_keep(hh, grp)
        attach_to_bone(arm, "Chest", grp, grp.matrix_world.copy())

    if name == "enemy_mega_harvester":
        for bone, sx in (("PalmI.L", -1), ("PalmI.R", 1)):
            bm = bone_world(arm, bone)
            hh, o = place(os.path.join(ADV_A, "axe_2handed.gltf"), height=1.28, center=False, ground=False)
            hh.matrix_world = bm @ Matrix.Rotation(math.radians(-90), 4, "X") @ Matrix.Scale(hh.scale.x, 4)
            bpy.context.view_layer.update()
            attach_to_bone(arm, bone, hh, hh.matrix_world.copy())

    export_glb(name, has_armature=True)


def build_hover_drone():
    clear_scene()
    root = make_empty("EnemyRoot")
    objs = import_asset(os.path.join(Q, "cyberpunk_pack/Enemy_Flying_Gun.glb"))
    prune_actions_keep(("idle", "walk", "run", "dead", "death", "attack"))
    arm = next(o for o in objs if o.type == "ARMATURE")
    set_flat_color(objs, ("Main", "Material"), "#8e2bd6", roughness=0.55, metallic=0.2)
    set_flat_color(objs, ("Main2",), "#3a1f5c", roughness=0.6)
    set_flat_color(objs, ("Edge",), "#ff5ad9", emission_hex="#ff3ad0", emission_strength=1.2)
    set_flat_color(objs, ("Material.003", "Grey", "LightGrey"), "#20162e")
    meshes = [o for o in objs if o.type == "MESH"]
    for o in meshes:
        for m in o.data.materials:
            if m and m.name in ("Material", "Eye"):
                b = m.node_tree.nodes.get("Principled BSDF")
                b.inputs["Base Color"].default_value = hex_lin("#ff2bd0")
                b.inputs["Emission Color"].default_value = hex_lin("#ff2bd0")
                b.inputs["Emission Strength"].default_value = 3.0
    holder = make_empty("DroneScale")
    for r in roots_of(objs):
        r.parent = holder
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    s = 0.96 / max(mx.z - mn.z, 1e-4)
    holder.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    holder.location = (-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, 1.24 - mn.z)
    holder.parent = root
    bpy.context.view_layer.update()

    # Add spinning top rotor made from crossed sculpted blades attached directly to EnemyRoot
    # (bypasses CharacterArmature's 100x FBX scale; moves with EnemyRoot bobbing in Three.js)
    mn, mx = mesh_bounds(meshes)
    spin = make_empty("SpinPart", loc=((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, mx.z - 0.14), parent=root)
    c = spin.matrix_world.translation.copy()
    for rz in (0, 90):
        hh, bo = place(os.path.join(Q, "rpg_items_pack/Arrow_Golden.glb"), max_xy=0.72,
                       loc=(0, 0, 0), rot_deg=(0, 90, rz), center=False, ground=False)
        mn2, mx2 = mesh_bounds(bo)
        hh.location = c - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5))
        bpy.context.view_layer.update()
        set_flat_color(bo, "*", "#ffb84d", emission_hex="#ff75d8", emission_strength=0.45, roughness=0.35, metallic=0.6)
        blade_meshes = [ob for ob in bo if ob.type == "MESH"]
        for ob in blade_meshes:
            mw = ob.matrix_world.copy()
            ob.parent = None
            ob.matrix_world = mw
        bpy.ops.object.select_all(action="DESELECT")
        for ob in blade_meshes:
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        for ob in blade_meshes:
            set_parent_keep(ob, spin)
        for ob in [ob for ob in bo if ob.type == "EMPTY"] + [hh]:
            if ob.name in bpy.data.objects:
                bpy.data.objects.remove(ob, do_unlink=True)
    export_glb("enemy_hover_drone", has_armature=True)


def build_cyberpunk_enemy(name, src_glb, height, z_lift, mat_colors, prefer_action="walk", max_width=None):
    """Helper for rigged Quaternius cyberpunk_pack enemies (`Enemy_2Legs`, `Enemy_Large`, `Enemy_Flying`)."""
    clear_scene()
    root = make_empty("EnemyRoot")
    objs = import_asset(os.path.join(Q, src_glb))
    prune_actions_keep(("idle", "walk", "run", "dead", "death", "attack"))
    arm = next(o for o in objs if o.type == "ARMATURE")
    pref = next((a for a in bpy.data.actions if a.name.lower().split("|")[-1] == prefer_action), None)
    if pref:
        set_action(arm, pref.name)
    bpy.context.scene.frame_set(0)
    for mat_names, kwargs in mat_colors:
        set_flat_color(objs, mat_names, **kwargs)
    meshes = [o for o in objs if o.type == "MESH"]
    set_emissive_tint(meshes, kwargs_tint(mat_colors), strength=0.14)
    holder = make_empty("MobScale")
    for r in roots_of(objs):
        r.parent = holder
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    s = height / max(mx.z - mn.z, 1e-4)
    if max_width is not None and (mx.x - mn.x) > 1e-4:
        s = min(s, max_width / (mx.x - mn.x))
    holder.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    holder.location = (-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, z_lift - mn.z)
    holder.parent = root
    bpy.context.view_layer.update()
    return root, arm, meshes


def kwargs_tint(mat_colors):
    for _, kw in mat_colors:
        if "hex_color" in kw and not kw.get("emission_hex"):
            return kw["hex_color"]
    return "#334455"


def attach_static_prop_to_root(root, prop_path, loc, height=None, max_xy=None, rot_deg=(0, 0, 0),
                               color_hex=None, emission_hex=None, emission_strength=0.35, roughness=0.4, metallic=0.3):
    hh, o = place(prop_path, height=height, max_xy=max_xy, loc=(0, 0, 0), rot_deg=rot_deg, center=False, ground=False)
    mn2, mx2 = mesh_bounds(o)
    hh.location = Vector(loc) - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5))
    bpy.context.view_layer.update()
    if color_hex:
        set_flat_color(o, "*", color_hex, emission_hex=emission_hex, emission_strength=emission_strength,
                       roughness=roughness, metallic=metallic, force=True)
    for ob in [x for x in o if x.type == "MESH"]:
        mw = ob.matrix_world.copy()
        ob.parent = None
        ob.matrix_world = mw
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        set_parent_keep(ob, root)
    for ob in [x for x in o if x.type == "EMPTY"] + [hh]:
        if ob.name in bpy.data.objects:
            bpy.data.objects.remove(ob, do_unlink=True)
    return o


def attach_static_prop_to_bone(arm, bone_name, prop_path, loc, height=None, max_xy=None, rot_deg=(0, 0, 0),
                               color_hex=None, emission_hex=None, emission_strength=0.35, roughness=0.4, metallic=0.3):
    hh, o = place(prop_path, height=height, max_xy=max_xy, loc=(0, 0, 0), rot_deg=rot_deg, center=False, ground=False)
    mn2, mx2 = mesh_bounds(o)
    hh.location = Vector(loc) - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5))
    bpy.context.view_layer.update()
    if color_hex:
        set_flat_color(o, "*", color_hex, emission_hex=emission_hex, emission_strength=emission_strength,
                       roughness=roughness, metallic=metallic, force=True)
    attach_to_bone(arm, bone_name, hh, hh.matrix_world.copy())
    return hh, o


def build_turbo_hopper():
    root, _arm, meshes = build_cyberpunk_enemy(
        "enemy_turbo_hopper",
        "cyberpunk_pack/Enemy_2Legs.glb",
        height=0.88,
        z_lift=0.0,
        max_width=0.96,
        mat_colors=[
            (("Main",), dict(hex_color="#ff7b1c", roughness=0.52, metallic=0.18)),
            (("Main2",), dict(hex_color="#2d3448", roughness=0.62, metallic=0.25)),
            (("Dark",), dict(hex_color="#181c26", roughness=0.72, metallic=0.2)),
            (("Edge",), dict(hex_color="#4be8ff", emission_hex="#33dcff", emission_strength=0.9, roughness=0.35)),
            (("Eye",), dict(hex_color="#6cf5ff", emission_hex="#4be8ff", emission_strength=1.4, roughness=0.25)),
        ],
        prefer_action="run",
    )
    mn, mx = mesh_bounds(meshes)
    cy = (mn.y + mx.y) * 0.5 + 0.14
    cz = mx.z - 0.02
    for sx in (-1, 1):
        attach_static_prop_to_root(
            root, os.path.join(Q, "rpg_items_pack/Crystal3.glb"),
            loc=(sx * 0.16, cy, cz),
            height=0.28, rot_deg=(-45, sx * -20, 0),
            color_hex="#4be8ff", emission_hex="#2cd4ff", emission_strength=0.85, roughness=0.28, metallic=0.2,
        )
    export_glb("enemy_turbo_hopper", has_armature=True)


def build_chomp_brute():
    clear_scene()
    root = make_empty("EnemyRoot")
    objs = import_asset(os.path.join(Q, "platformer_game_pack/Enemy.glb"))
    prune_actions_keep(("idle", "walk", "run", "death", "dead", "bite_front", "jump"))
    arm = next(o for o in objs if o.type == "ARMATURE")
    walk = next((a for a in bpy.data.actions if a.name.lower().split("|")[-1] == "walk"), None)
    if walk:
        set_action(arm, walk.name)
    set_flat_color(objs, ("Main",), "#c93b2b", roughness=0.62, metallic=0.05)
    set_flat_color(objs, ("Main_Dark",), "#4a1714", roughness=0.68, metallic=0.05)
    set_flat_color(objs, ("Horns", "Teeth"), "#f5ead0", roughness=0.45, metallic=0.02)
    set_flat_color(objs, ("Tongue",), "#f26b8a", roughness=0.55)
    set_flat_color(objs, ("Eyes",), "#ffdf4d", emission_hex="#ffae19", emission_strength=0.9, roughness=0.25)
    meshes = [o for o in objs if o.type == "MESH"]
    set_emissive_tint(meshes, "#42120d", strength=0.14)
    holder = make_empty("MobScale")
    for r in roots_of(objs):
        r.parent = holder
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    s = 1.05 / max(mx.z - mn.z, 1e-4)
    holder.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    holder.location = (-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, -mn.z)
    holder.parent = root
    bpy.context.view_layer.update()
    # Dorsal saw crest spinning cleanly above top of skull
    mn, mx = mesh_bounds(meshes)
    spin = make_empty("SpinPart", loc=((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5 + 0.08, mx.z - 0.02), parent=root)
    hh, o = place(os.path.join(Q, "platformer_game_pack/Hazard_Saw.glb"), max_xy=0.50,
                  loc=(0, 0, 0), rot_deg=(0, 90, 0), center=False, ground=False)
    mn2, mx2 = mesh_bounds(o)
    hh.location = spin.matrix_world.translation.copy() - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5))
    bpy.context.view_layer.update()
    set_flat_color(o, "*", "#e0e7ef", emission_hex="#ff6b3d", emission_strength=0.28, roughness=0.28, metallic=0.8, force=True)
    for ob in [x for x in o if x.type == "MESH"]:
        mw = ob.matrix_world.copy()
        ob.parent = None
        ob.matrix_world = mw
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        set_parent_keep(ob, spin)
    for ob in [x for x in o if x.type == "EMPTY"] + [hh]:
        if ob.name in bpy.data.objects:
            bpy.data.objects.remove(ob, do_unlink=True)
    export_glb("enemy_chomp_brute", has_armature=True)


def build_repair_drone():
    root, arm, meshes = build_cyberpunk_enemy(
        "enemy_repair_drone",
        "cyberpunk_pack/Enemy_Flying.glb",
        height=0.92,
        z_lift=1.26,
        mat_colors=[
            (("Main", "Material"), dict(hex_color="#1dd198", roughness=0.48, metallic=0.15)),
            (("Main2",), dict(hex_color="#edfbf5", roughness=0.55, metallic=0.1)),
            (("Edge",), dict(hex_color="#6effc8", emission_hex="#29ffac", emission_strength=1.1, roughness=0.3)),
            (("Material.001", "Material.002", "Material.003", "Material.004"), dict(hex_color="#163b32", roughness=0.6)),
        ],
        prefer_action="walk",
    )
    mn, mx = mesh_bounds(meshes)
    spin = make_empty("SpinPart", loc=((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, (mn.z + mx.z) * 0.5), parent=root)
    c = spin.matrix_world.translation.copy()
    for i in range(3):
        ang = i * (2 * math.pi / 3)
        hh, o = place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), height=0.30,
                      loc=(0, 0, 0), rot_deg=(0, 0, math.degrees(ang)), center=False, ground=False)
        mn2, mx2 = mesh_bounds(o)
        hh.location = Vector((c.x + math.cos(ang) * 0.58, c.y + math.sin(ang) * 0.58, c.z - 0.1)) - Vector(
            ((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5)
        )
        bpy.context.view_layer.update()
        set_flat_color(o, "*", "#6effc8", emission_hex="#1fe69b", emission_strength=0.9, roughness=0.25, force=True)
        for ob in [x for x in o if x.type == "MESH"]:
            mw = ob.matrix_world.copy()
            ob.parent = None
            ob.matrix_world = mw
            bpy.ops.object.select_all(action="DESELECT")
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            set_parent_keep(ob, spin)
        for ob in [x for x in o if x.type == "EMPTY"] + [hh]:
            if ob.name in bpy.data.objects:
                bpy.data.objects.remove(ob, do_unlink=True)
    export_glb("enemy_repair_drone", has_armature=True)


def build_crystal_golem():
    root, _arm, meshes = build_cyberpunk_enemy(
        "enemy_crystal_golem",
        "cyberpunk_pack/Enemy_Large.glb",
        height=1.18,
        z_lift=0.0,
        max_width=1.18,
        mat_colors=[
            (("Main",), dict(hex_color="#5842c4", roughness=0.65, metallic=0.18)),
            (("Main2",), dict(hex_color="#2a2159", roughness=0.72, metallic=0.2)),
            (("Dark",), dict(hex_color="#171230", roughness=0.8)),
            (("Edge",), dict(hex_color="#57dcff", emission_hex="#3bc9ff", emission_strength=0.9, roughness=0.3)),
            (("Eye",), dict(hex_color="#8ef2ff", emission_hex="#57dcff", emission_strength=1.4, roughness=0.2)),
        ],
        prefer_action="walk",
    )
    mn, mx = mesh_bounds(meshes)
    cz = mx.z - 0.04
    for sx in (-1, 1):
        attach_static_prop_to_root(
            root, os.path.join(Q, "rpg_items_pack/Crystal3.glb"),
            loc=(sx * 0.30, (mn.y + mx.y) * 0.5 + 0.06, cz),
            height=0.46, rot_deg=(-14, sx * 24, sx * 12),
            color_hex="#57dcff", emission_hex="#2eb8ff", emission_strength=0.85, roughness=0.22,
        )
    export_glb("enemy_crystal_golem", has_armature=True)


def build_cryo_colossus():
    clear_scene()
    root = make_empty("EnemyRoot")
    objs = import_asset(os.path.join(Q, "mech_pack/Stan.glb"))
    prune_actions_keep()
    arm = next(o for o in objs if o.type == "ARMATURE")
    meshes = [o for o in objs if o.type == "MESH"]
    for o in meshes:
        for m in o.data.materials:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    src_name = n.image.name
                    tinted = tinted_texture(
                        src_name, "enemy_cryo_colossus_tex.png", "#3b78bd", "#9fe8ff",
                        dark_hex="#132238", prim_strength=0.92, value_boost=1.22,
                    )
                    retexture([o], src_name, tinted)
    set_emissive_tint(meshes, "#1e4b7a", strength=0.18)
    holder = make_empty("MechScale")
    for r in roots_of(objs):
        r.parent = holder
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    s = 2.55 / max(mx.z - mn.z, 1e-4)
    holder.scale = (s, s, s)
    bpy.context.view_layer.update()
    mn, mx = mesh_bounds(meshes)
    holder.location = (-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, -mn.z)
    holder.parent = root
    bpy.context.view_layer.update()

    # Frost spiked shield in left hand + icy greatsword in right hand + crystal crown
    bm_r = bone_world(arm, "PalmI.R")
    hh_sw, _ = place(os.path.join(ADV_A, "sword_2handed_color.gltf"), height=1.35, center=False, ground=False)
    hh_sw.matrix_world = bm_r @ Matrix.Rotation(math.radians(-90), 4, "X") @ Matrix.Scale(hh_sw.scale.x, 4)
    bpy.context.view_layer.update()
    attach_to_bone(arm, "PalmI.R", hh_sw, hh_sw.matrix_world.copy())

    bm_l = bone_world(arm, "PalmI.L")
    hh_sh, _ = place(os.path.join(ADV_A, "shield_spikes_color.gltf"), height=1.05, center=False, ground=False)
    hh_sh.matrix_world = bm_l @ Matrix.Rotation(math.radians(-90), 4, "X") @ Matrix.Scale(hh_sh.scale.x, 4)
    bpy.context.view_layer.update()
    attach_to_bone(arm, "PalmI.L", hh_sh, hh_sh.matrix_world.copy())

    mn, mx = mesh_bounds(meshes)
    attach_static_prop_to_bone(
        arm, "Head", os.path.join(Q, "rpg_items_pack/Crystal3.glb"),
        loc=(0, (mn.y + mx.y) * 0.5, mx.z + 0.08),
        height=0.58, rot_deg=(0, 0, 0),
        color_hex="#9fe8ff", emission_hex="#4bd6ff", emission_strength=0.9, roughness=0.2,
    )
    export_glb("enemy_cryo_colossus", has_armature=True)


def build_all_enemies():
    for n in ("enemy_scout_bot", "enemy_swarm_saw", "enemy_shield_loader", "enemy_mega_harvester"):
        if not WANT or n in WANT:
            build_rigged_mech(n)
    if not WANT or "enemy_hover_drone" in WANT:
        build_hover_drone()
    if not WANT or "enemy_turbo_hopper" in WANT:
        build_turbo_hopper()
    if not WANT or "enemy_chomp_brute" in WANT:
        build_chomp_brute()
    if not WANT or "enemy_repair_drone" in WANT:
        build_repair_drone()
    if not WANT or "enemy_crystal_golem" in WANT:
        build_crystal_golem()
    if not WANT or "enemy_cryo_colossus" in WANT:
        build_cryo_colossus()


# ---------------------------------------------------------------------------

WANT = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else set()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(DERIVED, exist_ok=True)
    env = [
        ("env_castle", build_env_castle), ("env_cliff_segment", build_env_cliff_segment),
        ("env_crystal", build_env_crystal), ("env_tree_oak", build_env_tree_oak),
        ("env_tree_pine", build_env_tree_pine), ("env_lantern", build_env_lantern),
        ("env_fence", build_env_fence), ("env_slot_pad", build_env_slot_pad), ("env_stump", build_env_stump),
    ]
    for n, fn in env:
        if not WANT or n in WANT:
            fn()
    build_all_towers()
    if not WANT or "hero_bear" in WANT:
        build_hero_bear()
    if not WANT or any(w.startswith("hat_") for w in WANT):
        build_hats()
    build_all_enemies()
    print("PALAMUT CC0 ASSET BUILD COMPLETE")


if __name__ == "__main__":
    main()
