"""Palamut Kalesi — Headless Blender 5.2 builder for Active Skill 3D GLBs and Chapter V Enemy GLBs.

Builds:
  6 Active Skill 3D models in public/models/:
    - skill_pinecone_meteor.glb
    - skill_acorn_magnet.glb
    - skill_golden_acorn.glb
    - skill_royal_banner.glb
    - skill_alchemy_flask.glb
    - skill_earth_spike.glb
  4 New Enemy 3D models in public/models/ (existing 10 enemy_*.glb are left untouched):
    - enemy_frost_warden.glb
    - enemy_ember_bomber.glb
    - enemy_tesla_strider.glb
    - enemy_magma_overlord.glb

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_skills_and_foundry.py
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

OUT_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models"
CC0 = "/tmp/palamut_cc0"
DERIVED = os.path.join(CC0, "_derived_foundry")
HEX = os.path.join(CC0, "kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf")
HEX_P = os.path.join(HEX, "decoration/props")
Q = os.path.join(CC0, "quaternius/public/glb")

os.makedirs(DERIVED, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

_IMG_CACHE = {}


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


def make_mat(name, hex_color, roughness=0.65, metallic=0.1, emission_hex=None, emission_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hex_lin(hex_color)
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    if emission_hex:
        b.inputs["Emission Color"].default_value = hex_lin(emission_hex)
        b.inputs["Emission Strength"].default_value = emission_strength
    return m


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


def mesh_obj_from_bm(name, bm, mat, parent=None, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if mat is not None:
        obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    return obj


def roots_of(objs):
    s = set(objs)
    return [o for o in objs if o.parent is None or o.parent not in s]


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


def collect_meshes(root):
    out = []
    stack = [root]
    while stack:
        o = stack.pop()
        if o.type == "MESH":
            out.append(o)
        stack.extend(o.children)
    return out


def place(path, parent=None, height=None, max_xy=None, width_x=None, scale=None, loc=(0, 0, 0),
          rot_deg=(0.0, 0.0, 0.0), rot_z=None, center=True, ground=True, name=None):
    objs = import_asset(path)
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


def set_emissive_tint(objs, hex_color, strength=0.14):
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


def _save_pixels(px, w, h, out_path):
    name = os.path.basename(out_path)
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])
    out = bpy.data.images.new(name, w, h, alpha=True)
    out.pixels = px.ravel().tolist()
    out.filepath_raw = out_path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)


def tinted_packed_texture(img, out_name, primary_hex, accent_hex, dark_hex="#181b22",
                          prim_strength=0.90, accent_strength=0.92, value_boost=1.12):
    out_path = os.path.join(DERIVED, out_name)
    if os.path.exists(out_path):
        return out_path
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    rgb = px[..., :3]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.maximum(mx - mn, 1e-5)
    hue = np.zeros_like(mx)
    hue = np.where(mx == r, ((g - b) / d) % 6, hue)
    hue = np.where(mx == g, (b - r) / d + 2, hue)
    hue = np.where(mx == b, (r - g) / d + 4, hue)
    hue = hue * 60.0
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    is_accent = (sat > 0.30) & (hue < 65)

    def colorize(l, tint_hex):
        t = np.array(hex_rgb(tint_hex), dtype=np.float32)
        l2 = np.clip(l * value_boost, 0, 1)[..., None]
        low = t[None, None, :] * (l2 * 2.0)
        high = t[None, None, :] + (1 - t[None, None, :]) * ((l2 - 0.5) * 2.0) * 0.55
        return np.where(l2 < 0.5, low, high)

    prim = colorize(lum, primary_hex)
    acc = colorize(lum, accent_hex)
    dark = np.array(hex_rgb(dark_hex), dtype=np.float32)[None, None, :] * np.clip(lum * 2.1, 0, 1)[..., None]
    w_prim = np.where(lum < 0.16, 0.3, prim_strength)[..., None]
    out = rgb * (1 - w_prim) + prim * w_prim
    out = np.where(is_accent[..., None], rgb * (1 - accent_strength) + acc * accent_strength, out)
    out = np.where((lum < 0.15)[..., None], rgb * 0.45 + dark * 0.55, out)
    px[..., :3] = np.clip(out, 0, 1)
    _save_pixels(px, w, h, out_path)
    return out_path


def clear_nla(arm):
    if arm.animation_data:
        for tr in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(tr)


def set_action(arm, action_name):
    act = bpy.data.actions.get(action_name)
    if act is None:
        return None
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


def attach_prop_to_root(root, prop_path, loc, height=None, max_xy=None, rot_deg=(0, 0, 0),
                        color_hex=None, emission_hex=None, emission_strength=0.35, roughness=0.4, metallic=0.3):
    hh, o = place(prop_path, height=height, max_xy=max_xy, loc=(0, 0, 0), rot_deg=rot_deg, center=False, ground=False)
    mn2, mx2 = mesh_bounds(o)
    hh.location = Vector(loc) - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mn2.z) * 0.0 + (mn2.z + mx2.z) * 0.5))
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


def export_glb(name, has_armature=False):
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
# SKILL 3D MODELS (6 models)
# ---------------------------------------------------------------------------

def build_skill_pinecone_meteor():
    """Blazing pinecone meteor: forward tip toward Blender -Y (= three.js +Z)."""
    clear_scene()
    root = make_empty("SkillRoot")

    mat_bark = make_mat("ConeBark", "#63361a", roughness=0.72, metallic=0.06, emission_hex="#401204", emission_strength=0.18)
    mat_core = make_mat("MagmaCore", "#ff6d1f", roughness=0.35, metallic=0.05, emission_hex="#ff8c24", emission_strength=1.9)
    mat_tip = make_mat("CharredTip", "#ffe178", roughness=0.30, metallic=0.1, emission_hex="#ffbf36", emission_strength=2.2)

    # Inner glowing magma core (tapered ovoid oriented along Y axis)
    bm_c = bmesh.new()
    bmesh.ops.create_icosphere(bm_c, subdivisions=2, radius=0.22)
    bmesh.ops.scale(bm_c, vec=(0.76, 1.55, 0.76), verts=bm_c.verts)
    mesh_obj_from_bm("MagmaCore", bm_c, mat_core, parent=root, smooth=True)

    # Tiered overlapping pinecone scales flaring backward (+Y) while pointing nose to -Y
    tiers = [
        # (y_center, ring_radius, count, scale_size, tilt_deg)
        (-0.26, 0.085, 5, 0.14, 34),
        (-0.12, 0.145, 7, 0.17, 42),
        (0.03, 0.175, 8, 0.185, 48),
        (0.18, 0.160, 7, 0.175, 52),
        (0.32, 0.125, 6, 0.155, 58),
    ]
    for ti, (yc, rad, cnt, sz, tilt) in enumerate(tiers):
        for i in range(cnt):
            ang = (i + (0.5 if ti % 2 else 0.0)) * (2 * math.pi / cnt)
            bm = bmesh.new()
            bmesh.ops.create_cone(
                bm,
                cap_ends=True,
                cap_tris=False,
                segments=5,
                radius1=sz * 0.45,
                radius2=0.015,
                depth=sz * 1.15,
            )
            bmesh.ops.scale(bm, vec=(1.2, 0.45, 1.0), verts=bm.verts)
            scale_obj = mesh_obj_from_bm(f"Scale_{ti}_{i}", bm, mat_bark, parent=root)
            cx = math.cos(ang) * rad
            cz = math.sin(ang) * rad
            scale_obj.location = (cx, yc, cz)
            # Rotate radial outward & swept back toward +Y
            rot_around_y = ang - math.pi / 2
            scale_obj.rotation_euler = Euler((math.radians(-tilt), 0.0, 0.0), "XYZ")
            m_orbit = Euler((0.0, rot_around_y, 0.0), "XYZ").to_matrix().to_4x4()
            scale_obj.rotation_euler = (m_orbit @ Euler((math.radians(90 - tilt), 0.0, 0.0), "XYZ").to_matrix().to_4x4()).to_euler()

    # Flaming aerodynamic tail fin cone trailing toward +Y
    bm_t = bmesh.new()
    bmesh.ops.create_cone(bm_t, cap_ends=True, cap_tris=False, segments=8, radius1=0.14, radius2=0.01, depth=0.45)
    bmesh.ops.rotate(bm_t, verts=bm_t.verts, matrix=Matrix.Rotation(math.radians(-90), 3, "X"))
    bmesh.ops.translate(bm_t, verts=bm_t.verts, vec=(0, 0.44, 0))
    mesh_obj_from_bm("FlameTail", bm_t, mat_tip, parent=root, smooth=True)

    export_glb("skill_pinecone_meteor", has_armature=False)


def build_skill_acorn_magnet():
    """Horseshoe Oak & Crimson Magnet Totem with silver pole caps & glowing cyan core."""
    clear_scene()
    root = make_empty("SkillRoot")

    mat_red = make_mat("MagnetCrimson", "#d9342b", roughness=0.42, metallic=0.22, emission_hex="#400a08", emission_strength=0.15)
    mat_steel = make_mat("MagnetSteel", "#dce7f2", roughness=0.26, metallic=0.82, emission_hex="#6cf2ff", emission_strength=0.25)
    mat_gold = make_mat("MagnetGold", "#ffd14a", roughness=0.28, metallic=0.72, emission_hex="#ffaa1a", emission_strength=0.3)
    mat_cyan = make_mat("MagnetFlux", "#4cf5ff", roughness=0.22, metallic=0.1, emission_hex="#42eeff", emission_strength=2.2)

    # Sculpt beveled horseshoe sweep (in X-Z plane, inverted U so poles point down or up:
    # let poles point UP-forward at an iconic angle!)
    def make_beveled_sweep(points, rx, ry, mat, name):
        bm = bmesh.new()
        rings = []
        n_prof = 8
        for idx, pt in enumerate(points):
            if idx == 0:
                tang = (points[1] - points[0]).normalized()
            elif idx == len(points) - 1:
                tang = (points[-1] - points[-2]).normalized()
            else:
                tang = (points[idx + 1] - points[idx - 1]).normalized()
            nrm = Vector((0, 1, 0))
            binrm = tang.cross(nrm).normalized()
            ring = []
            for j in range(n_prof):
                a = j * (2 * math.pi / n_prof) + math.pi / 8
                # Slightly squircle cross-section
                px = math.cos(a)
                py = math.sin(a)
                sx = math.copysign(abs(px) ** 0.7, px) * rx
                sy = math.copysign(abs(py) ** 0.7, py) * ry
                v = bm.verts.new(pt + binrm * sx + nrm * sy)
                ring.append(v)
            rings.append(ring)
        for r0, r1 in zip(rings[:-1], rings[1:]):
            for j in range(n_prof):
                nj = (j + 1) % n_prof
                bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
        return mesh_obj_from_bm(name, bm, mat, parent=root, smooth=True)

    arch_pts = []
    # Left leg -> semi-circular top arch -> right leg (U opening faces DOWN z=0)
    arch_pts.append(Vector((-0.34, 0, 0.24)))
    arch_pts.append(Vector((-0.34, 0, 0.56)))
    for i in range(13):
        t = math.pi - (i / 12.0) * math.pi
        arch_pts.append(Vector((math.cos(t) * 0.34, 0, 0.62 + math.sin(t) * 0.38)))
    arch_pts.append(Vector((0.34, 0, 0.56)))
    arch_pts.append(Vector((0.34, 0, 0.24)))
    make_beveled_sweep(arch_pts, 0.115, 0.115, mat_red, "MagnetArch")

    # Silver pole caps at bottom of both legs
    for sx, side in ((-1, "L"), (1, "R")):
        cap_pts = [Vector((sx * 0.34, 0, 0.0)), Vector((sx * 0.34, 0, 0.24))]
        make_beveled_sweep(cap_pts, 0.125, 0.125, mat_steel, f"PoleCap_{side}")
        # Gold collar ring at junction
        bm_g = bmesh.new()
        bmesh.ops.create_cone(bm_g, cap_ends=True, segments=12, radius1=0.14, radius2=0.14, depth=0.055)
        bmesh.ops.translate(bm_g, verts=bm_g.verts, vec=(sx * 0.34, 0, 0.25))
        mesh_obj_from_bm(f"Collar_{side}", bm_g, mat_gold, parent=root)

    # Central glowing cyan induction ring & miniature golden jewel on crown
    bm_flux = bmesh.new()
    n_seg = 16
    r_maj, r_min = 0.22, 0.032
    tor_rings = []
    for i in range(n_seg):
        a = i * 2 * math.pi / n_seg
        center = Vector((math.cos(a) * r_maj, 0, 0.22 + math.sin(a) * 0.12))
        tang = Vector((-math.sin(a) * r_maj, 0, math.cos(a) * 0.12)).normalized()
        nrm = Vector((0, 1, 0))
        binrm = tang.cross(nrm).normalized()
        ring = []
        for j in range(6):
            b = j * 2 * math.pi / 6
            ring.append(bm_flux.verts.new(center + binrm * (math.cos(b) * r_min) + nrm * (math.sin(b) * r_min)))
        tor_rings.append(ring)
    for i in range(n_seg):
        r0, r1 = tor_rings[i], tor_rings[(i + 1) % n_seg]
        for j in range(6):
            nj = (j + 1) % 6
            bm_flux.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
    mesh_obj_from_bm("FluxHalo", bm_flux, mat_cyan, parent=root, smooth=True)

    bm_gem = bmesh.new()
    bmesh.ops.create_icosphere(bm_gem, subdivisions=2, radius=0.105)
    bmesh.ops.scale(bm_gem, vec=(1.0, 0.72, 1.25), verts=bm_gem.verts)
    bmesh.ops.translate(bm_gem, verts=bm_gem.verts, vec=(0, 0, 1.07))
    mesh_obj_from_bm("CrownAcorn", bm_gem, mat_gold, parent=root, smooth=True)

    export_glb("skill_acorn_magnet", has_armature=False)


def build_skill_golden_acorn():
    """Plump golden acorn loot projectile."""
    clear_scene()
    root = make_empty("SkillRoot")

    mat_gold = make_mat("GoldenNut", "#ffd24a", roughness=0.22, metallic=0.72, emission_hex="#ffaa1a", emission_strength=0.45)
    mat_cap = make_mat("OakCupule", "#6e3b1b", roughness=0.76, metallic=0.05)
    mat_stem = make_mat("AcornStem", "#45240e", roughness=0.82, metallic=0.02)

    bm_nut = bmesh.new()
    bmesh.ops.create_uvsphere(bm_nut, u_segments=14, v_segments=10, radius=0.15)
    for v in bm_nut.verts:
        if v.co.z < 0:
            v.co.x *= 0.85
            v.co.y *= 0.85
            v.co.z *= 1.35
    bmesh.ops.translate(bm_nut, verts=bm_nut.verts, vec=(0, 0, 0.205))
    mesh_obj_from_bm("Nut", bm_nut, mat_gold, parent=root, smooth=True)

    bm_cap = bmesh.new()
    bmesh.ops.create_cone(bm_cap, cap_ends=True, cap_tris=False, segments=14, radius1=0.172, radius2=0.11, depth=0.11)
    bmesh.ops.translate(bm_cap, verts=bm_cap.verts, vec=(0, 0, 0.30))
    mesh_obj_from_bm("Cupule", bm_cap, mat_cap, parent=root, smooth=True)

    bm_st = bmesh.new()
    bmesh.ops.create_cone(bm_st, cap_ends=True, cap_tris=False, segments=8, radius1=0.028, radius2=0.02, depth=0.09)
    bmesh.ops.rotate(bm_st, verts=bm_st.verts, matrix=Matrix.Rotation(math.radians(14), 3, "X"))
    bmesh.ops.translate(bm_st, verts=bm_st.verts, vec=(0, 0.015, 0.39))
    mesh_obj_from_bm("Stem", bm_st, mat_stem, parent=root)

    export_glb("skill_golden_acorn", has_armature=False)


def build_skill_royal_banner():
    """Royal Oak Paladin Banner: stone rune base + gilded lance + fluttering sculpted royal pennant."""
    clear_scene()
    root = make_empty("SkillRoot")

    mat_stone = make_mat("RuneBase", "#78808f", roughness=0.78, metallic=0.1)
    mat_gold = make_mat("RoyalGold", "#ffd14a", roughness=0.28, metallic=0.78, emission_hex="#ffb429", emission_strength=0.45)
    mat_wood = make_mat("LanceShaft", "#5c3419", roughness=0.68, metallic=0.05)
    mat_cloth = make_mat("RoyalCloth", "#2258b8", roughness=0.62, metallic=0.04, emission_hex="#143a80", emission_strength=0.14)
    mat_rune = make_mat("RoyalGlow", "#ffe47a", roughness=0.25, metallic=0.1, emission_hex="#ffd040", emission_strength=1.6)

    # Carved rune base disc (centered at 0,0,0)
    bm_b = bmesh.new()
    bmesh.ops.create_cone(bm_b, cap_ends=True, cap_tris=False, segments=8, radius1=0.38, radius2=0.30, depth=0.14)
    bmesh.ops.translate(bm_b, verts=bm_b.verts, vec=(0, 0, 0.07))
    mesh_obj_from_bm("RunePedestal", bm_b, mat_stone, parent=root)

    bm_r = bmesh.new()
    bmesh.ops.create_cone(bm_r, cap_ends=True, cap_tris=False, segments=16, radius1=0.33, radius2=0.33, depth=0.03)
    bmesh.ops.translate(bm_r, verts=bm_r.verts, vec=(0, 0, 0.145))
    mesh_obj_from_bm("GoldHaloRing", bm_r, mat_rune, parent=root)

    # Tall oak & brass lance shaft + crossbar
    bm_s = bmesh.new()
    bmesh.ops.create_cone(bm_s, cap_ends=True, cap_tris=False, segments=10, radius1=0.045, radius2=0.038, depth=1.82)
    bmesh.ops.translate(bm_s, verts=bm_s.verts, vec=(0, 0, 1.03))
    mesh_obj_from_bm("LanceShaft", bm_s, mat_wood, parent=root)

    bm_x = bmesh.new()
    bmesh.ops.create_cone(bm_x, cap_ends=True, cap_tris=False, segments=8, radius1=0.03, radius2=0.03, depth=0.76)
    bmesh.ops.rotate(bm_x, verts=bm_x.verts, matrix=Matrix.Rotation(math.radians(90), 3, "X"))
    bmesh.ops.translate(bm_x, verts=bm_x.verts, vec=(0, 0.34, 1.76))
    mesh_obj_from_bm("BannerCrossbar", bm_x, mat_gold, parent=root)

    # Fluttering sculpted royal cloth pennant extending smoothly from mast toward +Y (behind)
    bm_f = bmesh.new()
    rows, cols = 6, 8
    grid = []
    for c in range(cols):
        u = c / (cols - 1)
        wave_x = math.sin(u * math.pi * 1.8) * 0.075 * u
        y = 0.03 + u * 0.88
        row_v = []
        for r in range(rows):
            v = r / (rows - 1)
            # Taper bottom edge into heraldic swallowtail V
            z_top = 1.74 - u * 0.08
            z_bot = 1.02 + u * 0.12 - (0.14 * (1 - abs(u - 0.8)))
            z = z_top * (1 - v) + z_bot * v
            row_v.append(bm_f.verts.new((wave_x, y, z)))
        grid.append(row_v)
    for c in range(cols - 1):
        for r in range(rows - 1):
            bm_f.faces.new((grid[c][r], grid[c + 1][r], grid[c + 1][r + 1], grid[c][r + 1]))
    bmesh.ops.solidify(bm_f, geom=bm_f.faces[:], thickness=0.024)
    mesh_obj_from_bm("RoyalPennant", bm_f, mat_cloth, parent=root, smooth=True)

    # Golden acorn shield medallion on pennant front/back
    bm_m = bmesh.new()
    bmesh.ops.create_icosphere(bm_m, subdivisions=2, radius=0.13)
    bmesh.ops.scale(bm_m, vec=(0.35, 1.0, 1.25), verts=bm_m.verts)
    bmesh.ops.translate(bm_m, verts=bm_m.verts, vec=(0.04, 0.42, 1.40))
    mesh_obj_from_bm("AcornEmblem", bm_m, mat_gold, parent=root, smooth=True)

    # Gilded spear tip crown on top of flagpole
    bm_tip = bmesh.new()
    bmesh.ops.create_cone(bm_tip, cap_ends=True, cap_tris=False, segments=6, radius1=0.085, radius2=0.006, depth=0.28)
    bmesh.ops.translate(bm_tip, verts=bm_tip.verts, vec=(0.0, 0.0, 2.02))
    mesh_obj_from_bm("SpearFinial", bm_tip, mat_gold, parent=root)

    export_glb("skill_royal_banner", has_armature=False)


def build_skill_alchemy_flask():
    """Emerald Alchemist Potion Flask for Fox Storm ultimate."""
    clear_scene()
    root = make_empty("SkillRoot")

    mat_liq = make_mat("EmeraldPotion", "#2ef28d", roughness=0.16, metallic=0.05, emission_hex="#35ff9c", emission_strength=1.55)
    mat_brass = make_mat("FlaskBrass", "#dba83b", roughness=0.32, metallic=0.76, emission_hex="#9c6a12", emission_strength=0.12)
    mat_cork = make_mat("FlaskCork", "#a87444", roughness=0.86, metallic=0.0)

    # Faceted glowing bulb flask body
    bm_b = bmesh.new()
    bmesh.ops.create_icosphere(bm_b, subdivisions=2, radius=0.19)
    bmesh.ops.scale(bm_b, vec=(1.05, 1.05, 0.92), verts=bm_b.verts)
    bmesh.ops.translate(bm_b, verts=bm_b.verts, vec=(0, 0, 0.175))
    mesh_obj_from_bm("PotionBody", bm_b, mat_liq, parent=root, smooth=True)

    # Brass equatorial & shoulder armor bands + neck collar
    for zc, r1, r2, dp in ((0.175, 0.205, 0.205, 0.045), (0.34, 0.11, 0.085, 0.085), (0.395, 0.095, 0.095, 0.032)):
        bm_k = bmesh.new()
        bmesh.ops.create_cone(bm_k, cap_ends=True, cap_tris=False, segments=12, radius1=r1, radius2=r2, depth=dp)
        bmesh.ops.translate(bm_k, verts=bm_k.verts, vec=(0, 0, zc))
        mesh_obj_from_bm("BrassCollar", bm_k, mat_brass, parent=root)

    # Cork stopper
    bm_ck = bmesh.new()
    bmesh.ops.create_cone(bm_ck, cap_ends=True, cap_tris=False, segments=10, radius1=0.058, radius2=0.072, depth=0.09)
    bmesh.ops.translate(bm_ck, verts=bm_ck.verts, vec=(0, 0, 0.44))
    mesh_obj_from_bm("CorkStopper", bm_ck, mat_cork, parent=root)

    export_glb("skill_alchemy_flask", has_armature=False)


def build_skill_earth_spike():
    """Seismic Basalt & Amber Vein Spire Cluster anchored cleanly at z=0."""
    clear_scene()
    root = make_empty("SkillRoot")

    mat_rock = make_mat("BasaltStone", "#464d59", roughness=0.84, metallic=0.08)
    mat_vein = make_mat("AmberVein", "#ffaa2e", roughness=0.30, metallic=0.1, emission_hex="#ff941f", emission_strength=1.55)

    specs = [
        # (x, y, height, r_base, tilt_x, tilt_y, sides, mat)
        (0.0, 0.0, 1.25, 0.22, 6, -5, 6, mat_rock),
        (-0.18, 0.12, 0.78, 0.14, 18, 16, 5, mat_rock),
        (0.19, -0.10, 0.68, 0.13, -15, -18, 5, mat_rock),
        (0.05, 0.14, 0.56, 0.09, 10, 14, 5, mat_vein),
    ]
    for idx, (px, py, h, rb, tx, ty, sides, mat) in enumerate(specs):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides, radius1=rb, radius2=0.025, depth=h)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, h * 0.45))
        obj = mesh_obj_from_bm(f"RockSpike_{idx}", bm, mat, parent=root)
        obj.location = (px, py, -0.02)
        obj.rotation_euler = (math.radians(tx), math.radians(ty), idx * 0.9)

    export_glb("skill_earth_spike", has_armature=False)


# ---------------------------------------------------------------------------
# 4 NEW ENEMY RIGGED MODELS (built atop cached base rigs; old 10 untouched)
# ---------------------------------------------------------------------------

def clean_reimported_actions():
    """Keep clean walk/run/idle/death/attack action clips after reimporting existing GLB."""
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    for arm in arms:
        clear_nla(arm)
        for pb in arm.pose.bones:
            pb.custom_shape = None
    for act in list(bpy.data.actions):
        act.use_fake_user = True
    for arm in arms:
        walk = next((a for a in bpy.data.actions if "walk" in a.name.lower()), None)
        if walk:
            set_action(arm, walk.name)


def recolor_packed_images(meshes, name_tag, prim_hex, acc_hex, dark_hex, emi_hex, emi_strength=0.14):
    for o in meshes:
        for m in o.data.materials:
            if not m or not m.node_tree:
                continue
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    tinted = tinted_packed_texture(n.image, f"{name_tag}_{m.name}.png", prim_hex, acc_hex, dark_hex=dark_hex)
                    n.image = _load_img_cached(tinted)
    set_emissive_tint(meshes, emi_hex, strength=emi_strength)


def build_enemy_frost_warden():
    clear_scene()
    objs = import_asset(os.path.join(OUT_DIR, "enemy_shield_loader.glb"))
    clean_reimported_actions()
    arm = next(o for o in objs if o.type == "ARMATURE")
    meshes = [o for o in objs if o.type == "MESH"]
    # Recolor chassis & shield into Glacier Navy & Frost Cyan
    recolor_packed_images(meshes, "frost_warden", "#2f5d8f", "#9ef0ff", "#101e30", "#1e5e8f", emi_strength=0.18)

    # Add glowing shoulder ice crystal spires onto Chest bone
    chest_m = bone_world(arm, "Chest")
    for sx in (-1, 1):
        hh, o = place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), height=0.42, loc=(0, 0, 0), rot_deg=(-12, sx * 22, 0), center=False, ground=False)
        mn2, mx2 = mesh_bounds(o)
        target = chest_m.translation + Vector((sx * 0.28, 0.05, 0.28))
        hh.location = target - Vector(((mn2.x + mx2.x) * 0.5, (mn2.y + mx2.y) * 0.5, (mn2.z + mx2.z) * 0.5))
        bpy.context.view_layer.update()
        set_flat_color(o, "*", "#9bf0ff", emission_hex="#3bd8ff", emission_strength=0.95, roughness=0.22, metallic=0.1, force=True)
        attach_to_bone(arm, "Chest", hh, hh.matrix_world.copy())

    export_glb("enemy_frost_warden", has_armature=True)


def build_enemy_ember_bomber():
    clear_scene()
    objs = import_asset(os.path.join(OUT_DIR, "enemy_turbo_hopper.glb"))
    clean_reimported_actions()
    arm = next(o for o in objs if o.type == "ARMATURE")
    for o in list(objs):
        if o.type == "MESH" and "crystal" in o.name.lower():
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    set_flat_color(meshes, ("Main",), "#292226", roughness=0.68, metallic=0.25)
    set_flat_color(meshes, ("Main2",), "#8f2718", roughness=0.58, metallic=0.2)
    set_flat_color(meshes, ("Dark",), "#141013", roughness=0.78, metallic=0.15)
    set_flat_color(meshes, ("Edge",), "#ff9c2a", emission_hex="#ff7b1c", emission_strength=1.25, roughness=0.3)
    set_flat_color(meshes, ("Eye",), "#ffe66b", emission_hex="#ffae19", emission_strength=1.8, roughness=0.2)
    set_emissive_tint(meshes, "#3d1208", strength=0.16)

    bpy.context.scene.frame_set(0)
    mn, mx = mesh_bounds(meshes)
    root = next((o for o in bpy.data.objects if o.parent is None), make_empty("EnemyRoot"))
    root.location.x -= (mn.x + mx.x) * 0.5
    root.location.y -= (mn.y + mx.y) * 0.5
    root.location.z -= mn.z
    bpy.context.view_layer.update()

    # Mount sculpted glowing magma barrel prominently onto dorsal chassis
    mn, mx = mesh_bounds(meshes)
    body_bone = next((b.name for b in arm.pose.bones if "chest" in b.name.lower() or "torso" in b.name.lower() or "body" in b.name.lower()), arm.pose.bones[0].name)
    mat_keg = make_mat("MagmaKeg", "#d93b18", roughness=0.42, metallic=0.22, emission_hex="#ff8c24", emission_strength=0.95)
    mat_band = make_mat("KegBand", "#262326", roughness=0.4, metallic=0.75)
    keg_holder = make_empty("KegHolder", loc=(0, (mn.y + mx.y) * 0.5 + 0.14, mx.z + 0.12))
    bm_k = bmesh.new()
    bmesh.ops.create_cone(bm_k, cap_ends=True, cap_tris=False, segments=12, radius1=0.19, radius2=0.17, depth=0.36)
    mesh_obj_from_bm("MagmaKeg", bm_k, mat_keg, parent=keg_holder, smooth=True)
    for zb in (-0.11, 0.11):
        bm_rb = bmesh.new()
        bmesh.ops.create_cone(bm_rb, cap_ends=True, cap_tris=False, segments=12, radius1=0.205, radius2=0.205, depth=0.04)
        bmesh.ops.translate(bm_rb, verts=bm_rb.verts, vec=(0, 0, zb))
        mesh_obj_from_bm("KegBand", bm_rb, mat_band, parent=keg_holder)
    keg_holder.rotation_euler = (math.radians(18), 0, 0)
    bpy.context.view_layer.update()
    attach_to_bone(arm, body_bone, keg_holder, keg_holder.matrix_world.copy())

    export_glb("enemy_ember_bomber", has_armature=True)


def build_enemy_tesla_strider():
    clear_scene()
    objs = import_asset(os.path.join(OUT_DIR, "enemy_crystal_golem.glb"))
    clean_reimported_actions()
    for o in list(objs):
        if o.type == "MESH" and "crystal" in o.name.lower():
            bpy.data.objects.remove(o, do_unlink=True)
    root = next((o for o in bpy.data.objects if o.parent is None), make_empty("EnemyRoot"))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    set_flat_color(meshes, ("Main",), "#b86b35", roughness=0.44, metallic=0.52)
    set_flat_color(meshes, ("Main2",), "#283945", roughness=0.58, metallic=0.35)
    set_flat_color(meshes, ("Dark",), "#161d24", roughness=0.72, metallic=0.25)
    set_flat_color(meshes, ("Edge",), "#46f2ff", emission_hex="#24e3ff", emission_strength=1.35, roughness=0.25)
    set_flat_color(meshes, ("Eye",), "#8affff", emission_hex="#46f2ff", emission_strength=1.8, roughness=0.2)
    set_emissive_tint(meshes, "#153d47", strength=0.14)

    bpy.context.scene.frame_set(0)
    mn, mx = mesh_bounds(meshes)
    root.location.x -= (mn.x + mx.x) * 0.5
    root.location.y -= (mn.y + mx.y) * 0.5
    root.location.z -= mn.z
    bpy.context.view_layer.update()

    mn, mx = mesh_bounds(meshes)
    spin = make_empty("SpinPart", loc=((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, mx.z - 0.14), parent=root)
    mat_coil = make_mat("TeslaCoil", "#46f2ff", roughness=0.22, metallic=0.25, emission_hex="#2be6ff", emission_strength=1.7)
    mat_brass = make_mat("TeslaBrass", "#e6b44c", roughness=0.32, metallic=0.75)

    for i in range(3):
        ang = i * (2 * math.pi / 3)
        bm_s = bmesh.new()
        bmesh.ops.create_cone(bm_s, cap_ends=True, cap_tris=False, segments=6, radius1=0.055, radius2=0.015, depth=0.34)
        bmesh.ops.translate(bm_s, verts=bm_s.verts, vec=(math.cos(ang) * 0.24, math.sin(ang) * 0.24, 0.14))
        mesh_obj_from_bm(f"CoilSpire_{i}", bm_s, mat_coil, parent=spin)

    bm_hub = bmesh.new()
    bmesh.ops.create_cone(bm_hub, cap_ends=True, cap_tris=False, segments=12, radius1=0.16, radius2=0.16, depth=0.07)
    mesh_obj_from_bm("TeslaHub", bm_hub, mat_brass, parent=spin)

    export_glb("enemy_tesla_strider", has_armature=True)


def build_enemy_magma_overlord():
    clear_scene()
    objs = import_asset(os.path.join(OUT_DIR, "enemy_mega_harvester.glb"))
    clean_reimported_actions()
    arm = next(o for o in objs if o.type == "ARMATURE")
    meshes = [o for o in objs if o.type == "MESH"]

    for o in meshes:
        if "axe" in o.name.lower():
            set_flat_color([o], "*", "#ff5e14", emission_hex="#ff9924", emission_strength=1.35, roughness=0.3, metallic=0.45, force=True)
        else:
            recolor_packed_images([o], "magma_overlord", "#852216", "#ffae26", "#140a0a", "#52140a", emi_strength=0.24)

    # Compact forge crown oriented upright on top of Head
    head_m = bone_world(arm, "Head")
    mn, mx = mesh_bounds([o for o in meshes if "axe" not in o.name.lower()])
    mat_crown = make_mat("ForgeCrown", "#ffc138", roughness=0.28, metallic=0.72, emission_hex="#ff6a18", emission_strength=0.95)
    crown_h = make_empty("CrownHolder", loc=(0, (mn.y + mx.y) * 0.5, mx.z - 0.04))
    bm_ring = bmesh.new()
    bmesh.ops.create_cone(bm_ring, cap_ends=True, cap_tris=False, segments=8, radius1=0.28, radius2=0.32, depth=0.10)
    mesh_obj_from_bm("CrownBand", bm_ring, mat_crown, parent=crown_h)
    for i in range(4):
        ang = i * (math.pi / 2) + math.pi / 4
        bm_sp = bmesh.new()
        bmesh.ops.create_cone(bm_sp, cap_ends=True, cap_tris=False, segments=4, radius1=0.075, radius2=0.01, depth=0.24)
        bmesh.ops.translate(bm_sp, verts=bm_sp.verts, vec=(math.cos(ang) * 0.25, math.sin(ang) * 0.25, 0.14))
        mesh_obj_from_bm(f"CrownHorn_{i}", bm_sp, mat_crown, parent=crown_h)
    bpy.context.view_layer.update()
    attach_to_bone(arm, "Head", crown_h, crown_h.matrix_world.copy())

    root = next((o for o in bpy.data.objects if o.parent is None), make_empty("EnemyRoot"))
    root.scale = (1.12, 1.12, 1.12)
    bpy.context.view_layer.update()

    export_glb("enemy_magma_overlord", has_armature=True)


def main():
    build_skill_pinecone_meteor()
    build_skill_acorn_magnet()
    build_skill_golden_acorn()
    build_skill_royal_banner()
    build_skill_alchemy_flask()
    build_skill_earth_spike()
    build_enemy_frost_warden()
    build_enemy_ember_bomber()
    build_enemy_tesla_strider()
    build_enemy_magma_overlord()
    print("SKILLS & FOUNDRY ASSETS COMPLETE")


if __name__ == "__main__":
    main()
