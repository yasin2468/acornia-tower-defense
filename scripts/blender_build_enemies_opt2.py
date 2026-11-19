"""Palamut Kalesi — Headless Blender 5.2 production builder for Option 2 (Buharli Hurda) enemies.

Builds all 14 rigged, animated (Walk + Attack) .glb enemy models in:
  /Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models/enemy_<id>.glb

Conventions (Blender Z-up, exported with export_yup=True):
  * Forward (+Z in Three.js) == -Y in Blender (faces, eyes, visors, shields, claws, drills point to -Y).
  * Up (+Y in Three.js) == +Z in Blender.
  * Ground units rest cleanly at min Z == 0.000; flying units hover at min Z == 1.180.
  * Materials use AssetLoader.normalizeMaterial() compatible names:
      HurdaMetal (metallic >= 0.35), HurdaMatte (roughness >= 0.62), Glow* / Glass* (emissive accents).
  * Continuous rotating parts are weighted to SpinBone_{Fast,Med,Slow}_* bones whose bone +Y axis
    (head -> tail) equals the exact spin axis; NO keyframes are baked onto SpinBone_* bones so
    ModelFactory.ts spins them cleanly around local Y via bone.rotateY(dt * speed).

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_enemies_opt2.py
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_enemies_opt2.py -- scout_bot chomp_brute
"""

import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

OUT_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models"
CACHE_DIR = "/tmp/palamut_cc0/_derived_enemies"
ATLAS_PATH = os.path.join(CACHE_DIR, "steampunk_hurda_atlas.png")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# 24 vertical gradient swatches (dark bottom shade -> vibrant mid -> bright top highlight)
HURDA_SWATCHES = [
    ("#54210c", "#b8602e"),  # 0: Riveted copper boiler
    ("#4d320d", "#bf8c38"),  # 1: Antiqued bronze-brass gold
    ("#21140c", "#614228"),  # 2: Dark smoked bronze
    ("#20262e", "#8794a3"),  # 3: Riveted gunmetal steel
    ("#10244d", "#3366b8"),  # 4: Cobalt slate armor blue
    ("#2b160a", "#6e4222"),  # 5: Dark oak barrel / limb wood
    ("#421e0d", "#944e28"),  # 6: Stitched saddle leather
    ("#474518", "#9e963d"),  # 7: Olive-brass beetle chitin
    ("#3b1e3d", "#875785"),  # 8: Plum-violet metallic dome
    ("#947e5e", "#eddcc2"),  # 9: Cream canvas sailcloth
    ("#211119", "#542e3d"),  # 10: Plum cast-iron boss hull
    ("#47100f", "#a62b24"),  # 11: Crimson lacquer chest wood
    ("#215e48", "#6ac99b"),  # 12: Mint verdigris patina
    ("#0d1f24", "#244f54"),  # 13: Deep petrol diver suit
    ("#b8c8d9", "#ffffff"),  # 14: Nordic snow-white fur
    ("#1a2838", "#456382"),  # 15: Arctic slate blue fabric/plate
    ("#354c61", "#85adc9"),  # 16: Frosted steel helmet/shield
    ("#354216", "#879c42"),  # 17: Goblin olive green skin
    ("#87704d", "#f0e1c2"),  # 18: Ivory fang / twine rope
    ("#14100f", "#3d332e"),  # 19: Sooty blast-furnace iron
    ("#101116", "#292c36"),  # 20: Dark coal rubber / trousers / hoop
    ("#636c78", "#c8d4de"),  # 21: Silver steel canister / blade
    ("#734010", "#d98c32"),  # 22: Warm amber gold buckle / trim
    ("#1c1b21", "#4a4652"),  # 23: Dark chimney ash iron
]


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def hex_lin(h: str):
    r, g, b = hex_rgb(h)
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def ensure_hurda_atlas():
    if os.path.exists(ATLAS_PATH):
        return ATLAS_PATH
    cols = len(HURDA_SWATCHES)
    cw, h = 32, 256
    w = cols * cw
    px = np.zeros((h, w, 4), dtype=np.float32)
    px[..., 3] = 1.0
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    for idx, (dk_h, lt_h) in enumerate(HURDA_SWATCHES):
        dk = np.array(hex_rgb(dk_h), dtype=np.float32)
        lt = np.array(hex_rgb(lt_h), dtype=np.float32)
        grad = dk[None, None, :] + (t ** 0.85) * (lt - dk)[None, None, :]
        px[:, idx * cw:(idx + 1) * cw, :3] = np.clip(grad, 0.0, 1.0)
    name = os.path.basename(ATLAS_PATH)
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels = px.ravel().tolist()
    img.filepath_raw = ATLAS_PATH
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return ATLAS_PATH


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def get_atlas_mat(metallic=True):
    mat_name = "HurdaMetalMat" if metallic else "HurdaMatteMat"
    mat = bpy.data.materials.get(mat_name)
    if mat:
        return mat
    ensure_hurda_atlas()
    img = bpy.data.images.load(ATLAS_PATH, check_existing=True)
    mat = bpy.data.materials.new(mat_name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = 0.62 if metallic else 0.05
    bsdf.inputs["Roughness"].default_value = 0.34 if metallic else 0.68
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.45 if metallic else 0.25
    return mat


def get_glow_mat(kind: str):
    specs = {
        "GlowAmberEye": ("#ffca38", "#ff9612", 2.0, 0.14, 0.08),
        "GlowForgeOrange": ("#ff731a", "#ff4a08", 2.2, 0.16, 0.06),
        "GlowRubyGlass": ("#ff338c", "#eb1e75", 1.95, 0.10, 0.12),
        "GlowCyanTech": ("#70f7ff", "#26dfff", 2.0, 0.12, 0.08),
        "GlowEmeraldFlask": ("#1fd462", "#0eb848", 1.55, 0.12, 0.05),
        "GlowCrystalViolet": ("#a65eff", "#7d2eff", 1.7, 0.16, 0.08),
        "GlowIceCrystal": ("#9eefff", "#4fd0ff", 1.35, 0.15, 0.08),
        "MatEyeDark": ("#151113", None, 0.0, 0.24, 0.15),
    }
    mat = bpy.data.materials.get(kind)
    if mat:
        return mat
    base_h, emi_h, emi_s, rough, metal = specs[kind]
    mat = bpy.data.materials.new(kind)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_lin(base_h)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emi_h:
        bsdf.inputs["Emission Color"].default_value = hex_lin(emi_h)
        bsdf.inputs["Emission Strength"].default_value = emi_s
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.65
    return mat


def apply_atlas_uvs(obj, col_idx: int, axis: str = "z", solid: bool = False):
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    n_cols = len(HURDA_SWATCHES)
    u = (col_idx + 0.5) / n_cols
    ax = {"x": 0, "y": 1, "z": 2}.get(axis, 2)
    coords = [v.co[ax] for v in me.vertices]
    lo, hi = (min(coords), max(coords)) if coords else (0.0, 1.0)
    span = max(hi - lo, 1e-4)
    for poly in me.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            if solid:
                v = 0.52
            else:
                v = 0.08 + 0.84 * max(0.0, min(1.0, (me.vertices[vi].co[ax] - lo) / span))
            uv[li].uv = (u, v)
    me.update()


def set_flat_uvs(obj):
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            uv[li].uv = (0.5, 0.5)
    me.update()


# ---------------------------------------------------------------------------
# Sculptural BMesh Primitive & Detail Builders
# ---------------------------------------------------------------------------

def bm_to_obj(name: str, bm, smooth: bool = True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def make_lathe(profile_rz, segs: int = 20, cap_bot: bool = True, cap_top: bool = True):
    """Create surface of revolution around Z from [(r, z), ...] ordered bottom->top."""
    bm = bmesh.new()
    rings = []
    for r, z in profile_rz:
        if r <= 1e-4:
            rings.append([bm.verts.new((0.0, 0.0, z))])
            continue
        ring = []
        for i in range(segs):
            a = i * (2.0 * math.pi / segs)
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)

    for r0, r1 in zip(rings[:-1], rings[1:]):
        if len(r0) == 1 and len(r1) == segs:
            c = r0[0]
            for i in range(segs):
                bm.faces.new((c, r1[i], r1[(i + 1) % segs]))
        elif len(r0) == segs and len(r1) == 1:
            c = r1[0]
            for i in range(segs):
                bm.faces.new((r0[i], r0[(i + 1) % segs], c))
        elif len(r0) == segs and len(r1) == segs:
            for i in range(segs):
                ni = (i + 1) % segs
                bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))

    if cap_bot and len(rings[0]) == segs:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and len(rings[-1]) == segs:
        bm.faces.new(rings[-1])
    return bm


def make_box_bevel(sx: float, sy: float, sz: float, bevel: float = 0.018):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if bevel > 0 and min(sx, sy, sz) > bevel * 2.5:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES")
    return bm


def make_tube(pts, radii, segs: int = 10, cap_ends: bool = True):
    """Sweep circle along list of 3D points with per-point radius (scalar or list)."""
    bm = bmesh.new()
    if isinstance(radii, (int, float)):
        radii = [float(radii)] * len(pts)
    vecs = [Vector(p) for p in pts]
    rings = []
    prev_n = Vector((0, 0, 1))
    for i, p in enumerate(vecs):
        if i == 0:
            t = (vecs[1] - vecs[0]).normalized()
        elif i == len(vecs) - 1:
            t = (vecs[-1] - vecs[-2]).normalized()
        else:
            t = (vecs[i + 1] - vecs[i - 1]).normalized()
        if t.length < 1e-5:
            t = Vector((0, 0, 1))
        up = Vector((0, 1, 0)) if abs(t.dot(Vector((0, 1, 0)))) < 0.92 else Vector((1, 0, 0))
        n = t.cross(up).normalized()
        if i > 0 and n.dot(prev_n) < 0:
            n = -n
        prev_n = n
        b = t.cross(n).normalized()
        rad = radii[i]
        ring = []
        for j in range(segs):
            a = j * (2.0 * math.pi / segs)
            ring.append(bm.verts.new(p + n * (math.cos(a) * rad) + b * (math.sin(a) * rad)))
        rings.append(ring)
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for j in range(segs):
            nj = (j + 1) % segs
            bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
    if cap_ends:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def make_coil_spring(p0, p1, r_coil=0.045, r_wire=0.012, turns=4.5, steps_per_turn=12):
    p0 = Vector(p0)
    p1 = Vector(p1)
    axis = p1 - p0
    L = axis.length
    t = axis.normalized()
    ref = Vector((0, 1, 0)) if abs(t.dot(Vector((0, 1, 0)))) < 0.9 else Vector((1, 0, 0))
    n = t.cross(ref).normalized()
    b = t.cross(n).normalized()
    total = max(12, int(turns * steps_per_turn))
    pts = []
    for i in range(total + 1):
        u = i / total
        ang = u * turns * 2.0 * math.pi
        pts.append(p0 + t * (u * L) + (n * math.cos(ang) + b * math.sin(ang)) * r_coil)
    return make_tube(pts, r_wire, segs=6, cap_ends=True)


def make_gear_wheel(r_out=0.22, r_root=0.17, r_hub=0.06, thick=0.045, teeth=10, spokes=4, axis="x"):
    """Mechanical spoked cogwheel lying in YZ (axis='x'), XZ (axis='y'), or XY (axis='z')."""
    bm = bmesh.new()
    # Outer ring
    n_seg = teeth * 4
    r_in_ring = r_root - (r_out - r_root) * 0.85
    rings_front = []
    rings_back = []
    for i in range(n_seg):
        a = i * (2.0 * math.pi / n_seg)
        v_o = bm.verts.new((math.cos(a) * r_root, math.sin(a) * r_root, thick * 0.5))
        v_i = bm.verts.new((math.cos(a) * r_in_ring, math.sin(a) * r_in_ring, thick * 0.5))
        rings_front.append((v_o, v_i))
        w_o = bm.verts.new((math.cos(a) * r_root, math.sin(a) * r_root, -thick * 0.5))
        w_i = bm.verts.new((math.cos(a) * r_in_ring, math.sin(a) * r_in_ring, -thick * 0.5))
        rings_back.append((w_o, w_i))
    for i in range(n_seg):
        ni = (i + 1) % n_seg
        f0o, f0i = rings_front[i]; f1o, f1i = rings_front[ni]
        b0o, b0i = rings_back[i]; b1o, b1i = rings_back[ni]
        bm.faces.new((f0i, f0o, f1o, f1i))
        bm.faces.new((b0o, b0i, b1i, b1o))
        bm.faces.new((f0o, b0o, b1o, f1o))
        bm.faces.new((b0i, f0i, f1i, b1i))

    # Teeth
    for t in range(teeth):
        a = t * (2.0 * math.pi / teeth)
        w0 = math.pi / teeth * 0.42
        w1 = math.pi / teeth * 0.28
        pts = [
            (r_root * 0.96, a - w0),
            (r_out, a - w1),
            (r_out, a + w1),
            (r_root * 0.96, a + w0),
        ]
        top_v = [bm.verts.new((math.cos(ang) * rr, math.sin(ang) * rr, thick * 0.46)) for rr, ang in pts]
        bot_v = [bm.verts.new((math.cos(ang) * rr, math.sin(ang) * rr, -thick * 0.46)) for rr, ang in pts]
        bm.faces.new(top_v)
        bm.faces.new(list(reversed(bot_v)))
        for k in range(4):
            nk = (k + 1) % 4
            bm.faces.new((top_v[k], bot_v[k], bot_v[nk], top_v[nk]))

    # Center hub + spokes
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=r_hub, radius2=r_hub, depth=thick * 1.3)
    if spokes > 0:
        for s in range(spokes):
            a = s * (2.0 * math.pi / spokes)
            m_sp = Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((r_in_ring * 0.5, 0, 0))
            bmesh.ops.create_cube(bm, size=1.0, matrix=m_sp @ Matrix.Diagonal((r_in_ring * 1.02, r_hub * 0.45, thick * 0.65, 1)))

    if axis == "x":
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    elif axis == "y":
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.radians(90), 3, "X"))
    return bm


def make_circular_saw(r_out=0.28, r_root=0.21, thick=0.025, teeth=14, axis="x"):
    bm = bmesh.new()
    # Core disc
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=teeth * 2, radius1=r_root * 1.02, radius2=r_root * 1.02, depth=thick)
    # Central axle flange
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=r_root * 0.34, radius2=r_root * 0.34, depth=thick * 1.9)
    # Hooked asymmetric teeth
    for t in range(teeth):
        a = t * (2.0 * math.pi / teeth)
        da = 2.0 * math.pi / teeth
        pts = [
            (r_root * 0.94, a - da * 0.30),
            (r_out, a + da * 0.24),
            (r_root * 0.94, a + da * 0.42),
        ]
        tv = [bm.verts.new((math.cos(ang) * rr, math.sin(ang) * rr, thick * 0.48)) for rr, ang in pts]
        bv = [bm.verts.new((math.cos(ang) * rr, math.sin(ang) * rr, -thick * 0.48)) for rr, ang in pts]
        bm.faces.new(tv)
        bm.faces.new(list(reversed(bv)))
        for k in range(3):
            nk = (k + 1) % 3
            bm.faces.new((tv[k], bv[k], bv[nk], tv[nk]))
    if axis == "x":
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    elif axis == "y":
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.radians(90), 3, "X"))
    return bm


def make_propeller(n_blades=4, r_blade=0.40, blade_w=0.11, twist_deg=18):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.065)
    for i in range(n_blades):
        a = i * (2.0 * math.pi / n_blades)
        m = (
            Matrix.Rotation(a, 4, "Z")
            @ Matrix.Translation((r_blade * 0.56, 0, 0))
            @ Matrix.Rotation(math.radians(twist_deg), 4, "X")
        )
        bm_b = bmesh.new()
        bmesh.ops.create_cube(bm_b, size=1.0)
        bmesh.ops.scale(bm_b, vec=(r_blade, blade_w, 0.016), verts=bm_b.verts)
        # Taper tip slightly
        for v in bm_b.verts:
            if v.co.x < -r_blade * 0.25:
                v.co.y *= 0.62
        bmesh.ops.bevel(bm_b, geom=list(bm_b.edges), offset=0.008, segments=1, affect="EDGES")
        bmesh.ops.transform(bm_b, matrix=m, verts=bm_b.verts)
        me_tmp = bpy.data.meshes.new("_tmp_p")
        bm_b.to_mesh(me_tmp)
        bm_b.free()
        bm.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    return bm


def make_spiral_drill(length=0.50, r_base=0.14, turns=3.0):
    """3D helical-fluted mining drill cone pointing along -Y."""
    bm = bmesh.new()
    rings = []
    steps = 28
    segs = 12
    for i in range(steps + 1):
        u = i / steps
        y = -u * length
        r_base_u = r_base * max(0.03, (1.0 - u) ** 0.78)
        twist = u * turns * 2.0 * math.pi
        ring = []
        for j in range(segs):
            a = j * (2.0 * math.pi / segs)
            flute = 1.0 + 0.24 * math.sin(2.0 * (a - twist)) * (1.0 - u * 0.4)
            rr = r_base_u * flute
            ring.append(bm.verts.new((math.cos(a) * rr, y, math.sin(a) * rr)))
        rings.append(ring)
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for j in range(segs):
            nj = (j + 1) % segs
            bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return bm


def make_shield_plate(w=0.52, h=0.68, depth=0.075, pointed=True, notch_top=False):
    """Beveled heater/knight shield whose front face points toward Blender -Y."""
    bm = bmesh.new()
    half_w = w * 0.5
    top_y = h * 0.46
    bot_y = -h * 0.54
    outline = []
    if notch_top:
        outline.extend([
            (-half_w * 0.92, top_y),
            (-half_w * 0.22, top_y * 0.96),
            (0.0, top_y * 0.80),
            (half_w * 0.22, top_y * 0.96),
            (half_w * 0.92, top_y),
        ])
    else:
        outline.extend([
            (-half_w * 0.88, top_y * 0.92),
            (-half_w * 0.42, top_y),
            (0.0, top_y * 1.03),
            (half_w * 0.42, top_y),
            (half_w * 0.88, top_y * 0.92),
        ])
    outline.extend([
        (half_w, h * 0.14),
        (half_w * (0.86 if pointed else 0.92), -h * 0.22),
        (half_w * 0.46, -h * 0.42 if pointed else -h * 0.48),
        (0.0, bot_y),
        (-half_w * 0.46, -h * 0.42 if pointed else -h * 0.48),
        (-half_w * (0.86 if pointed else 0.92), -h * 0.22),
        (-half_w, h * 0.14),
    ])
    n = len(outline)
    fv = [bm.verts.new((px, -depth * 0.5 - (1.0 - abs(px / max(half_w, 1e-4))) * 0.025, pz)) for px, pz in outline]
    bv = [bm.verts.new((px, depth * 0.5, pz)) for px, pz in outline]
    bm.faces.new(fv)
    bm.faces.new(list(reversed(bv)))
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new((fv[i], bv[i], bv[ni], fv[ni]))
    return bm


def make_cleaver_blade(length=0.58, width=0.22, thick=0.04, glow_edge=False):
    """Notched brutal butcher cleaver blade pointing toward -Y / -Z handle down."""
    bm = bmesh.new()
    # Silhouette in YZ plane (Y forward toward -Y, Z up spine -> sharp edge downward -Z)
    # Wait: in hand, grip along Z/Y -> blade extends forward (-Y), spine top (+Z), sharp edge (-Z)
    if not glow_edge:
        prof = [
            (0.0, 0.06),
            (-length * 0.86, 0.10),
            (-length * 0.96, 0.02),
            (-length * 1.0, -width * 0.55),
            (-length * 0.62, -width * 0.72),
            (-length * 0.54, -width * 0.50),  # chip notch!
            (-length * 0.46, -width * 0.70),
            (-length * 0.06, -width * 0.62),
        ]
    else:
        prof = [
            (-length * 0.96, 0.02),
            (-length * 1.03, -width * 0.58),
            (-length * 0.62, -width * 0.78),
            (-length * 0.54, -width * 0.54),
            (-length * 0.46, -width * 0.76),
            (-length * 0.05, -width * 0.68),
            (-length * 0.08, -width * 0.50),
            (-length * 0.92, -width * 0.44),
        ]
    n = len(prof)
    t_edge = thick * 0.25 if glow_edge else thick * 0.5
    lv = [bm.verts.new((-t_edge if pz < -width * 0.35 else -thick * 0.5, py, pz)) for py, pz in prof]
    rv = [bm.verts.new((t_edge if pz < -width * 0.35 else thick * 0.5, py, pz)) for py, pz in prof]
    bm.faces.new(lv)
    bm.faces.new(list(reversed(rv)))
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new((lv[i], rv[i], rv[ni], lv[ni]))
    return bm


def make_crystal_prism(height=0.30, rad=0.065, sides=6):
    bm = bmesh.new()
    rings = []
    pts = [(rad * 0.85, 0.0), (rad, height * 0.58), (rad * 0.72, height * 0.76), (0.0, height)]
    for rr, zz in pts:
        if rr <= 1e-4:
            rings.append([bm.verts.new((0, 0, zz))])
        else:
            ring = []
            for i in range(sides):
                a = i * (2.0 * math.pi / sides)
                ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, zz)))
            rings.append(ring)
    for r0, r1 in zip(rings[:-1], rings[1:]):
        if len(r1) == 1:
            for i in range(sides):
                bm.faces.new((r0[i], r0[(i + 1) % sides], r1[0]))
        else:
            for i in range(sides):
                ni = (i + 1) % sides
                bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
    bm.faces.new(list(reversed(rings[0])))
    return bm


# ---------------------------------------------------------------------------
# EnemyBuilder: Bone-Aware Modular Assembly, Auto-Scale/Ground, Unified Skinned Export
# ---------------------------------------------------------------------------

class EnemyBuilder:
    def __init__(self, enemy_id: str, target_height: float, is_flying: bool = False, min_z: float = 0.0):
        clear_scene()
        ensure_hurda_atlas()
        self.enemy_id = enemy_id
        self.target_height = target_height
        self.is_flying = is_flying
        self.target_min_z = min_z if not is_flying else 1.18

        self.arm_data = bpy.data.armatures.new(f"{enemy_id}_Armature")
        self.arm = bpy.data.objects.new(f"{enemy_id}_Armature", self.arm_data)
        bpy.context.scene.collection.objects.link(self.arm)
        self.bones_spec = []   # (name, head, tail, parent_name)
        self.parts = []        # list of (obj, bone_name, mat_key)

    def add_bone(self, name: str, head, tail, parent: str = None):
        self.bones_spec.append((name, Vector(head), Vector(tail), parent))

    def _register(self, obj, bone: str, mat_key: str, loc=(0, 0, 0), rot_deg=(0, 0, 0), scale=(1, 1, 1)):
        m = (
            Matrix.Translation(Vector(loc))
            @ Euler(tuple(math.radians(a) for a in rot_deg), "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        )
        me = obj.data
        for v in me.vertices:
            v.co = m @ v.co
        me.update()
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = (0.0, 0.0, 0.0)
        obj.scale = (1.0, 1.0, 1.0)
        self.parts.append((obj, bone, mat_key))
        return obj

    def add_bm(self, name: str, bm, bone: str, col: int = None, metal: bool = True, glow: str = None,
               loc=(0, 0, 0), rot_deg=(0, 0, 0), scale=(1, 1, 1), uv_axis="z", solid=False, smooth=True):
        obj = bm_to_obj(name, bm, smooth=smooth)
        if glow is not None:
            set_flat_uvs(obj)
            mat_key = glow
        else:
            apply_atlas_uvs(obj, col, axis=uv_axis, solid=solid)
            mat_key = "HurdaMetalMat" if metal else "HurdaMatteMat"
        return self._register(obj, bone, mat_key, loc=loc, rot_deg=rot_deg, scale=scale)

    def add_prim(self, name: str, kind: str, bone: str, col: int = None, metal: bool = True, glow: str = None,
                 loc=(0, 0, 0), rot_deg=(0, 0, 0), scale=(1, 1, 1), segs: int = 16, r1: float = 0.5, r2: float = 0.5,
                 depth: float = 1.0, bevel: float = 0.0, uv_axis="z", solid=False, smooth=True):
        bm = bmesh.new()
        if kind == "CYL":
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
        elif kind == "SPHERE":
            bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(8, segs // 2), radius=r1)
        elif kind == "ICOSPHERE":
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r1)
        elif kind == "CUBE":
            return self.add_bm(name, make_box_bevel(1.0, 1.0, 1.0, bevel=bevel), bone, col=col, metal=metal, glow=glow,
                               loc=loc, rot_deg=rot_deg, scale=scale, uv_axis=uv_axis, solid=solid, smooth=smooth)
        elif kind == "TORUS":
            # Build torus in XY plane with major=r1, minor=r2
            rings = []
            u_n, v_n = segs, 8
            for i in range(u_n):
                a = i * (2.0 * math.pi / u_n)
                ca, sa = math.cos(a), math.sin(a)
                ring = []
                for j in range(v_n):
                    b = j * (2.0 * math.pi / v_n)
                    rr = r1 + math.cos(b) * r2
                    ring.append(bm.verts.new((ca * rr, sa * rr, math.sin(b) * r2)))
                rings.append(ring)
            for i in range(u_n):
                r_a, r_b = rings[i], rings[(i + 1) % u_n]
                for j in range(v_n):
                    nj = (j + 1) % v_n
                    bm.faces.new((r_a[j], r_a[nj], r_b[nj], r_b[j]))
        return self.add_bm(name, bm, bone, col=col, metal=metal, glow=glow,
                           loc=loc, rot_deg=rot_deg, scale=scale, uv_axis=uv_axis, solid=solid, smooth=smooth)

    def add_rivets_ring(self, prefix: str, center, radius: float, count: int, bone: str,
                        col: int = 1, rivet_r: float = 0.016, axis: str = "z", angle_range=(0.0, 360.0)):
        cx, cy, cz = center
        a0, a1 = math.radians(angle_range[0]), math.radians(angle_range[1])
        full = abs(angle_range[1] - angle_range[0]) >= 359.0
        for i in range(count):
            t = i / count if full else (i / max(1, count - 1))
            a = a0 + t * (a1 - a0)
            ca, sa = math.cos(a), math.sin(a)
            if axis == "z":
                loc = (cx + ca * radius, cy + sa * radius, cz)
            elif axis == "y":
                loc = (cx + ca * radius, cy, cz + sa * radius)
            else:
                loc = (cx, cy + ca * radius, cz + sa * radius)
            self.add_prim(f"{prefix}_r{i}", "SPHERE", bone, col=col, metal=True,
                          loc=loc, scale=(rivet_r * 2.0,) * 3, r1=0.5, segs=8, solid=True)

    def add_metaball(self, name: str, elements, bone: str, col: int, metal: bool = False,
                     smooth_iter: int = 5, res: float = 0.025, loc=(0, 0, 0), rot_deg=(0, 0, 0), scale=(1, 1, 1)):
        mb = bpy.data.metaballs.new(name + "_MB")
        mb.resolution = res
        mb_obj = bpy.data.objects.new(name + "_MBO", mb)
        bpy.context.scene.collection.objects.link(mb_obj)
        for el in elements:
            e = mb.elements.new(type="ELLIPSOID")
            e.co = el["co"]
            e.radius = el.get("r", 0.14)
            e.size_x = el.get("sx", 1.0)
            e.size_y = el.get("sy", 1.0)
            e.size_z = el.get("sz", 1.0)
            e.stiffness = el.get("stiff", 2.0)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        ev = mb_obj.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev)
        bpy.data.objects.remove(mb_obj, do_unlink=True)
        bpy.data.metaballs.remove(mb)
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if smooth_iter > 0:
            sm = obj.modifiers.new("Sm", "LAPLACIANSMOOTH")
            sm.iterations = smooth_iter
            sm.lambda_factor = 0.4
            sm.use_volume_preserve = True
            bpy.ops.object.modifier_apply(modifier=sm.name)
        dec = obj.modifiers.new("Dec", "DECIMATE")
        dec.ratio = 0.42
        bpy.ops.object.modifier_apply(modifier=dec.name)
        apply_atlas_uvs(obj, col, axis="z")
        return self._register(obj, bone, "HurdaMetalMat" if metal else "HurdaMatteMat",
                              loc=loc, rot_deg=rot_deg, scale=scale)

    def finalize_and_skin(self):
        # 1) Create bones in Edit Mode
        bpy.context.view_layer.objects.active = self.arm
        bpy.ops.object.mode_set(mode="EDIT")
        created = {}
        for name, head, tail, parent in self.bones_spec:
            eb = self.arm_data.edit_bones.new(name)
            eb.head = head
            eb.tail = tail if (tail - head).length > 1e-4 else head + Vector((0, 0, 0.18))
            created[name] = eb
        for name, _, _, parent in self.bones_spec:
            if parent and parent in created:
                created[name].parent = created[parent]
        bpy.ops.object.mode_set(mode="OBJECT")

        # 2) Compute union bounds of all raw meshes so we can scale + ground BOTH meshes & bones uniformly
        mn = Vector((1e9, 1e9, 1e9))
        mx = Vector((-1e9, -1e9, -1e9))
        for obj, _, _ in self.parts:
            for v in obj.data.vertices:
                w = obj.matrix_world @ v.co
                mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
                mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
        h_raw = max(mx.z - mn.z, 1e-4)
        sc = self.target_height / h_raw
        cx = (mn.x + mx.x) * 0.5
        cy = (mn.y + mx.y) * 0.5
        z0 = mn.z
        shift = Vector((0.0, 0.0, self.target_min_z))

        def xform_pt(p: Vector) -> Vector:
            return (p - Vector((cx, cy, z0))) * sc + shift

        for obj, _, _ in self.parts:
            me = obj.data
            for v in me.vertices:
                v.co = xform_pt(v.co)
            me.update()

        bpy.context.view_layer.objects.active = self.arm
        bpy.ops.object.mode_set(mode="EDIT")
        for eb in self.arm_data.edit_bones:
            eb.head = xform_pt(eb.head)
            eb.tail = xform_pt(eb.tail)
        bpy.ops.object.mode_set(mode="OBJECT")

        # 3) Group by material key, weight each part to its bone, join into 1 SkinnedMesh per material
        by_mat = {}
        for obj, bone_name, mat_key in self.parts:
            vg = obj.vertex_groups.new(name=bone_name)
            vg.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
            by_mat.setdefault(mat_key, []).append(obj)

        for mat_key, group_objs in by_mat.items():
            mat = get_atlas_mat(metallic=(mat_key == "HurdaMetalMat")) if mat_key.startswith("Hurda") else get_glow_mat(mat_key)
            for o in group_objs:
                o.data.materials.clear()
                o.data.materials.append(mat)
            bpy.ops.object.select_all(action="DESELECT")
            for o in group_objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = group_objs[0]
            if len(group_objs) > 1:
                bpy.ops.object.join()
            joined = bpy.context.active_object
            joined.name = f"{self.enemy_id}_{mat_key}"
            joined.parent = self.arm
            joined.matrix_parent_inverse = self.arm.matrix_world.inverted()
            mod = joined.modifiers.new("Armature", "ARMATURE")
            mod.object = self.arm

    def bake_animations(self, walk_fn, attack_fn):
        self.arm.animation_data_create()
        for pb in self.arm.pose.bones:
            pb.rotation_mode = "XYZ"

        def record_action(name: str, frames, fn):
            act = bpy.data.actions.new(name)
            act.use_fake_user = True
            self.arm.animation_data.action = act
            try:
                if getattr(self.arm.animation_data, "action_slot", None) is None and len(act.slots):
                    self.arm.animation_data.action_slot = act.slots[0]
            except Exception:
                pass
            for f in frames:
                for pb in self.arm.pose.bones:
                    pb.location = (0, 0, 0)
                    pb.rotation_euler = (0, 0, 0)
                fn(self.arm.pose.bones, f)
                for bone_name, _, _, _ in self.bones_spec:
                    if bone_name.startswith("SpinBone_"):
                        continue  # NEVER keyframe SpinBone_* so Three.js drives continuous rotation cleanly!
                    pb = self.arm.pose.bones[bone_name]
                    pb.keyframe_insert("location", frame=f)
                    pb.keyframe_insert("rotation_euler", frame=f)
            return act

        walk_act = record_action("Walk", [1, 7, 13, 19, 25], walk_fn)
        record_action("Attack", [1, 6, 11, 16, 21], attack_fn)
        self.arm.animation_data.action = walk_act
        bpy.context.scene.frame_set(1)

    def export(self):
        out_path = os.path.join(OUT_DIR, f"{self.enemy_id}.glb")
        for o in list(bpy.data.objects):
            if o.type in ("LIGHT", "CAMERA"):
                bpy.data.objects.remove(o, do_unlink=True)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format="GLB",
            export_yup=True,
            export_apply=False,
            export_animations=True,
            export_animation_mode="ACTIONS",
            export_optimize_animation_size=True,
            export_image_format="AUTO",
            export_extras=False,
            export_lights=False,
            export_cameras=False,
        )
        kb = os.path.getsize(out_path) / 1024.0
        print(f"EXPORTED {self.enemy_id}.glb ({kb:.1f} KB)")


# ---------------------------------------------------------------------------
# Standard Biped / Multi-Leg / Flyer Walk & Attack Keyframe Presets
# ---------------------------------------------------------------------------

def biped_walk(bones, f, stride=0.45, bob=0.045, sway=0.06, arm_swing=0.42):
    ph = (f - 1) / 24.0 * 2.0 * math.pi
    s = math.sin(ph)
    c = abs(math.cos(ph))
    if "Body" in bones:
        bones["Body"].location.z = c * bob
        bones["Body"].rotation_euler = (0.04, s * sway, -s * sway * 0.5)
    if "Head" in bones:
        bones["Head"].rotation_euler = (-0.03, -s * sway * 0.4, s * sway * 0.6)
    if "LegL" in bones:
        bones["LegL"].rotation_euler.x = s * stride
    if "LegR" in bones:
        bones["LegR"].rotation_euler.x = -s * stride
    if "ArmL" in bones:
        bones["ArmL"].rotation_euler.x = -s * arm_swing
    if "ArmR" in bones:
        bones["ArmR"].rotation_euler.x = s * arm_swing


def biped_attack(bones, f, strike_left=False, both_arms=False):
    # frames 1, 6, 11, 16, 21
    t_map = {1: 0.0, 6: -0.65, 11: 1.05, 16: 0.35, 21: 0.0}
    pose = t_map.get(f, 0.0)
    if "Body" in bones:
        bones["Body"].rotation_euler.x = pose * 0.25
        bones["Body"].location.y = -max(0.0, pose) * 0.08
    if "ArmR" in bones:
        if both_arms or not strike_left:
            bones["ArmR"].rotation_euler.x = pose * 1.15
    if "ArmL" in bones:
        if both_arms or strike_left:
            bones["ArmL"].rotation_euler.x = pose * (0.45 if not both_arms else 1.15)
        else:
            bones["ArmL"].rotation_euler.x = -0.25 if pose > 0 else 0.0  # shield brace


def insect_walk(legs_l, legs_r, stride=0.42, lift=0.18, bob=0.025):
    def fn(bones, f):
        ph = (f - 1) / 24.0 * 2.0 * math.pi
        if "Body" in bones:
            bones["Body"].location.z = abs(math.sin(ph)) * bob
            bones["Body"].rotation_euler.y = math.sin(ph) * 0.05
        # Alternating tripod gait
        for idx, nm in enumerate(legs_l):
            s = math.sin(ph + (math.pi if idx % 2 else 0.0))
            bones[nm].rotation_euler = (max(0.0, math.cos(ph + (math.pi if idx % 2 else 0.0))) * lift, 0.0, s * stride)
        for idx, nm in enumerate(legs_r):
            s = math.sin(ph + (0.0 if idx % 2 else math.pi))
            bones[nm].rotation_euler = (-max(0.0, math.cos(ph + (0.0 if idx % 2 else math.pi))) * lift, 0.0, -s * stride)
    return fn


def add_leg_biped(b: EnemyBuilder, side: str, bone: str, hip_x: float, hip_z: float,
                  thigh_col: int, knee_col: int, shin_col: int, foot_col: int,
                  thigh_metal=True, shin_metal=True, fur_cuff=False, leg_scale: float = 1.0):
    ls = leg_scale
    b.add_prim(f"{side}_Thigh", "CYL", bone, col=thigh_col, metal=thigh_metal,
               loc=(hip_x, 0.0, hip_z * 0.72), scale=(1, 1, 1), r1=0.075 * ls, r2=0.068 * ls, depth=hip_z * 0.42)
    b.add_prim(f"{side}_Knee", "SPHERE", bone, col=knee_col, metal=True,
               loc=(hip_x, -0.05 * ls, hip_z * 0.50), r1=0.075 * ls, scale=(1.0, 0.9, 1.0))
    b.add_prim(f"{side}_Shin", "CYL", bone, col=shin_col, metal=shin_metal,
               loc=(hip_x, 0.0, hip_z * 0.30), r1=0.072 * ls, r2=0.064 * ls, depth=hip_z * 0.38)
    if fur_cuff:
        for k in range(8):
            a = k * (2 * math.pi / 8)
            b.add_prim(f"{side}_BootFur{k}", "SPHERE", bone, col=14, metal=False,
                       loc=(hip_x + math.cos(a) * 0.082 * ls, math.sin(a) * 0.082 * ls, hip_z * 0.38), r1=0.048 * ls, segs=10)
    b.add_bm(f"{side}_Boot", make_box_bevel(0.16 * ls, 0.23 * ls, hip_z * 0.22, bevel=0.024 * ls), bone,
             col=foot_col, metal=True, loc=(hip_x, -0.035 * ls, hip_z * 0.11))


# ---------------------------------------------------------------------------
# 1. scout_bot — Copper Boiler Barrel + Amber Monocle + Leather Pauldrons + Back Gear
# ---------------------------------------------------------------------------

def build_scout_bot():
    b = EnemyBuilder("enemy_scout_bot", target_height=1.16)
    b.add_bone("Body", (0, 0, 0.42), (0, 0, 0.96))
    b.add_bone("Head", (0, 0, 0.96), (0, 0, 1.15), parent="Body")  # chimney/gear cap bob
    b.add_bone("ArmR", (-0.31, 0, 0.78), (-0.31, 0, 0.48), parent="Body")
    b.add_bone("ArmL", (0.31, 0, 0.78), (0.31, 0, 0.48), parent="Body")
    b.add_bone("LegR", (-0.15, 0, 0.42), (-0.15, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.15, 0, 0.42), (0.15, 0, 0.0), parent="Body")
    b.add_bone("SpinBone_Slow_BackGear", (-0.18, 0.25, 0.88), (-0.18, 0.45, 0.88), parent="Body")

    # Copper barrel chest hull
    prof = [
        (0.0, 0.36), (0.18, 0.36), (0.24, 0.48), (0.275, 0.68),
        (0.255, 0.88), (0.215, 0.98), (0.195, 1.00), (0.0, 1.00),
    ]
    b.add_bm("BoilerBarrel", make_lathe(prof, segs=22), "Body", col=0, metal=True)
    # 3 riveted iron barrel bands + vertical seam strip
    for z_h, r_h in ((0.46, 0.245), (0.68, 0.280), (0.91, 0.238)):
        b.add_prim(f"Band_{z_h:.2f}", "CYL", "Body", col=3, metal=True, loc=(0, 0, z_h), r1=r_h, r2=r_h, depth=0.045, segs=22)
        b.add_rivets_ring(f"BandRiv_{z_h:.2f}", (0, 0, z_h), r_h + 0.008, 12, "Body", col=3, rivet_r=0.013)
    b.add_bm("FrontSeam", make_box_bevel(0.045, 0.04, 0.56, 0.006), "Body", col=2, metal=True, loc=(-0.03, -0.255, 0.69))

    # Top lid brass smokestack chimney angled slightly toward right (-X)
    b.add_prim("ChimneyPipe", "CYL", "Body", col=1, metal=True, loc=(-0.06, 0.02, 1.06), rot_deg=(0, -8, 0), r1=0.046, r2=0.042, depth=0.19)
    b.add_prim("ChimneyLip", "CYL", "Body", col=1, metal=True, loc=(-0.072, 0.02, 1.15), rot_deg=(0, -8, 0), r1=0.044, r2=0.068, depth=0.04)
    b.add_prim("ChimneyHole", "CYL", "Body", col=19, metal=False, loc=(-0.074, 0.02, 1.16), rot_deg=(0, -8, 0), r1=0.040, r2=0.040, depth=0.03)

    # Front-left (+X, -Y) glowing amber monocle lens + pipe loop
    b.add_prim("MonocleRim", "CYL", "Body", col=1, metal=True, loc=(0.085, -0.245, 0.80), rot_deg=(90, 0, -14), r1=0.095, r2=0.088, depth=0.07)
    b.add_prim("MonocleGlow", "SPHERE", "Body", glow="GlowAmberEye", loc=(0.092, -0.268, 0.80), scale=(0.068, 0.04, 0.068), r1=1.0)
    b.add_bm("MonoclePipe", make_tube([(0.06, -0.24, 0.72), (-0.04, -0.27, 0.64), (-0.18, -0.22, 0.62), (-0.25, -0.05, 0.64)], 0.015),
             "Body", col=1, metal=True)

    # Lower copper crotch pelvis dome
    b.add_prim("Pelvis", "SPHERE", "Body", col=0, metal=True, loc=(0, 0, 0.36), scale=(0.20, 0.16, 0.12), r1=1.0)

    # Back gear wheel spinning around +Y
    b.add_bm("BackGear", make_gear_wheel(r_out=0.22, r_root=0.17, r_hub=0.055, thick=0.05, teeth=10, spokes=5, axis="y"),
             "SpinBone_Slow_BackGear", col=1, metal=True, loc=(-0.18, 0.26, 0.88), uv_axis="x")

    # Leather stitched pauldrons + steel elbow pipes + leather bracers + brass claws
    for sx, bone, arm_n in ((-1, "ArmR", "ArmR"), (1, "ArmL", "ArmL")):
        b.add_bm(f"{arm_n}_Pauldron", make_box_bevel(0.18, 0.22, 0.14, 0.038), bone, col=6, metal=False,
                 loc=(sx * 0.29, 0.0, 0.78), rot_deg=(0, sx * -20, 0))
        b.add_rivets_ring(f"{arm_n}_St", (sx * 0.29, 0.0, 0.72), 0.10, 6, bone, col=18, rivet_r=0.011, axis="z")
        b.add_bm(f"{arm_n}_Elbow", make_tube([(sx * 0.29, 0.0, 0.74), (sx * 0.34, 0.02, 0.58), (sx * 0.35, -0.04, 0.45)], 0.036),
                 bone, col=3, metal=True)
        b.add_prim(f"{arm_n}_Bracer", "CYL", bone, col=6, metal=False, loc=(sx * 0.35, -0.05, 0.44),
                   rot_deg=(12, sx * -10, 0), r1=0.078, r2=0.062, depth=0.18)
        b.add_bm(f"{arm_n}_Hand", make_box_bevel(0.095, 0.095, 0.10, 0.022), bone, col=1, metal=True,
                 loc=(sx * 0.355, -0.07, 0.31))

    # Iron legs + copper kneecaps
    add_leg_biped(b, "R", "LegR", -0.145, 0.35, thigh_col=3, knee_col=0, shin_col=3, foot_col=3)
    add_leg_biped(b, "L", "LegL", 0.145, 0.35, thigh_col=3, knee_col=0, shin_col=3, foot_col=3)

    b.finalize_and_skin()
    b.bake_animations(biped_walk, lambda bs, f: biped_attack(bs, f, strike_left=False))
    b.export()


# ---------------------------------------------------------------------------
# 2. swarm_saw — Olive-Brass Mechanical Beetle + Copper Breastplate + Saw + 4 Gears + 6 Legs
# ---------------------------------------------------------------------------

def build_swarm_saw():
    b = EnemyBuilder("enemy_swarm_saw", target_height=0.84)
    b.add_bone("Body", (0, 0, 0.34), (0, 0, 0.68))
    b.add_bone("SpinBone_Fast_Saw", (0, 0.04, 0.56), (0.20, 0.04, 0.56), parent="Body")
    b.add_bone("SpinBone_Med_GearL1", (0.28, 0.08, 0.38), (0.48, 0.08, 0.38), parent="Body")
    b.add_bone("SpinBone_Med_GearL2", (0.27, -0.09, 0.28), (0.47, -0.09, 0.28), parent="Body")
    b.add_bone("SpinBone_Med_GearR1", (-0.28, 0.08, 0.38), (-0.48, 0.08, 0.38), parent="Body")
    b.add_bone("SpinBone_Med_GearR2", (-0.27, -0.09, 0.28), (-0.47, -0.09, 0.28), parent="Body")

    legs_l, legs_r = [], []
    leg_ys = (-0.20, 0.0, 0.20)
    for idx, ly in enumerate(leg_ys):
        ln = f"LegL{idx+1}"; rn = f"LegR{idx+1}"
        b.add_bone(ln, (0.20, ly, 0.25), (0.36, ly, 0.0), parent="Body")
        b.add_bone(rn, (-0.20, ly, 0.25), (-0.36, ly, 0.0), parent="Body")
        legs_l.append(ln); legs_r.append(rn)

    # Olive-brass beetle carapace dome (elongated along Y)
    b.add_prim("Carapace", "SPHERE", "Body", col=7, metal=True, loc=(0, 0.06, 0.34), scale=(0.28, 0.40, 0.25), r1=1.0, segs=22)
    # Dark belly underplate
    b.add_prim("UnderBelly", "CYL", "Body", col=2, metal=True, loc=(0, 0.02, 0.20), scale=(0.24, 0.34, 0.12), r1=1.0, r2=0.85, segs=18)
    # Copper riveted front collar armor over shoulders
    b.add_prim("CopperCollar", "SPHERE", "Body", col=0, metal=True, loc=(0, -0.18, 0.33), scale=(0.26, 0.18, 0.21), r1=1.0, segs=20)
    b.add_rivets_ring("CollarRiv", (0, -0.15, 0.44), 0.19, 8, "Body", col=1, rivet_r=0.013, axis="z", angle_range=(-75, 75))
    # Head capsule + twin amber eyes + curved pincer mandibles
    b.add_prim("HeadDome", "SPHERE", "Body", col=7, metal=True, loc=(0, -0.34, 0.25), scale=(0.17, 0.16, 0.13), r1=1.0)
    for sx in (-1, 1):
        b.add_prim(f"EyeRim_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.10, -0.42, 0.27),
                   rot_deg=(82, 0, sx * -24), r1=0.048, r2=0.044, depth=0.04)
        b.add_prim(f"Eye_{sx}", "SPHERE", "Body", glow="GlowAmberEye", loc=(sx * 0.105, -0.44, 0.27), r1=0.035)
        b.add_bm(f"Mandible_{sx}", make_tube([(sx * 0.065, -0.45, 0.18), (sx * 0.095, -0.56, 0.16), (sx * 0.035, -0.63, 0.18)],
                                            [0.028, 0.020, 0.008], segs=8), "Body", col=1, metal=True)

    # Dorsal saw slot housing + spinning brass buzzsaw along X axis
    b.add_bm("SawSlotHousing", make_box_bevel(0.11, 0.46, 0.16, 0.02), "Body", col=2, metal=True, loc=(0, 0.04, 0.50))
    b.add_bm("DorsalSaw", make_circular_saw(r_out=0.29, r_root=0.22, thick=0.034, teeth=14, axis="x"),
             "SpinBone_Fast_Saw", col=1, metal=True, loc=(0, 0.04, 0.56))

    # Left & Right external cogwheels (bigger rear + smaller front)
    for sx, side in ((1, "L"), (-1, "R")):
        b.add_bm(f"GearBig_{side}", make_gear_wheel(r_out=0.145, r_root=0.112, r_hub=0.036, thick=0.032, teeth=9, spokes=4, axis="x"),
                 f"SpinBone_Med_Gear{side}1", col=1, metal=True, loc=(sx * 0.28, 0.08, 0.38))
        b.add_bm(f"GearSm_{side}", make_gear_wheel(r_out=0.095, r_root=0.072, r_hub=0.025, thick=0.028, teeth=7, spokes=0, axis="x"),
                 f"SpinBone_Med_Gear{side}2", col=1, metal=True, loc=(sx * 0.27, -0.09, 0.28))

    # 6 spiky curved insect legs resting cleanly at z=0
    for idx, ly in enumerate(leg_ys):
        yaw = (0.35 - idx * 0.38)
        for sx, bone in ((1, legs_l[idx]), (-1, legs_r[idx])):
            p0 = (sx * 0.21, ly, 0.25)
            p1 = (sx * 0.34, ly - yaw * 0.14, 0.30)
            p2 = (sx * 0.38, ly - yaw * 0.26, 0.14)
            p3 = (sx * 0.34, ly - yaw * 0.30, 0.0)
            b.add_bm(f"LegMesh_{bone}", make_tube([p0, p1, p2, p3], [0.030, 0.024, 0.018, 0.008], segs=8), bone, col=1, metal=True)

    b.finalize_and_skin()
    b.bake_animations(
        insect_walk(legs_l, legs_r),
        lambda bs, f: bs["Body"].__setattr__("rotation_euler", (-0.28 if f == 11 else 0.0, 0, 0)),
    )
    b.export()


# ---------------------------------------------------------------------------
# 3. shield_loader — Cobalt-Blue Brass Boiler Knight + Wood Limbs + Slit Furnace + Twin Chimneys + Tower Shield
# ---------------------------------------------------------------------------

def build_shield_loader():
    b = EnemyBuilder("enemy_shield_loader", target_height=1.32)
    b.add_bone("Body", (0, 0, 0.44), (0, 0, 1.00))
    b.add_bone("Head", (0, 0, 1.00), (0, 0, 1.28), parent="Body")
    b.add_bone("ArmR", (-0.36, 0, 0.88), (-0.36, 0, 0.50), parent="Body")
    b.add_bone("ArmL", (0.36, 0, 0.88), (0.36, 0, 0.50), parent="Body")
    b.add_bone("LegR", (-0.17, 0, 0.44), (-0.17, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.17, 0, 0.44), (0.17, 0, 0.0), parent="Body")

    # Cobalt torso barrel armor + brass belt/neck trim + glowing 3-slit belly furnace
    prof = [(0.0, 0.40), (0.24, 0.42), (0.30, 0.64), (0.29, 0.90), (0.22, 1.00), (0.0, 1.00)]
    b.add_bm("TorsoBlue", make_lathe(prof, segs=22), "Body", col=4, metal=True)
    b.add_prim("CollarRim", "TORUS", "Body", col=1, metal=True, loc=(0, 0, 0.97), r1=0.22, r2=0.036, segs=20)
    b.add_rivets_ring("CollarRiv", (0, 0, 0.97), 0.25, 10, "Body", col=1, rivet_r=0.014)
    b.add_prim("BeltRim", "CYL", "Body", col=1, metal=True, loc=(0, 0, 0.45), r1=0.275, r2=0.265, depth=0.065, segs=20)
    # 3-slit furnace belly plate
    b.add_bm("FurnaceFrame", make_box_bevel(0.24, 0.12, 0.20, 0.018), "Body", col=1, metal=True, loc=(0, -0.255, 0.62))
    for kx in (-0.055, 0.0, 0.055):
        b.add_bm(f"BellySlit_{kx:.2f}", make_box_bevel(0.032, 0.05, 0.13, 0.005), "Body", glow="GlowForgeOrange",
                 loc=(kx, -0.295, 0.62))

    # Flat-topped cobalt cylindrical helmet with glowing orange visor slit + rivets
    b.add_bm("HelmDome", make_lathe([(0, 0.96), (0.19, 0.98), (0.19, 1.24), (0.16, 1.29), (0, 1.29)], segs=20),
             "Head", col=4, metal=True)
    b.add_prim("HelmBand", "CYL", "Head", col=1, metal=True, loc=(0, 0, 1.01), r1=0.202, r2=0.202, depth=0.045, segs=20)
    b.add_prim("HelmTopRing", "CYL", "Head", col=1, metal=True, loc=(0, 0, 1.26), r1=0.178, r2=0.172, depth=0.035, segs=20)
    b.add_rivets_ring("HelmRiv", (0, 0, 1.24), 0.185, 8, "Head", col=1, rivet_r=0.012)
    b.add_bm("VisorFrame", make_box_bevel(0.23, 0.10, 0.085, 0.014), "Head", col=1, metal=True, loc=(0, -0.155, 1.13))
    b.add_bm("VisorGlow", make_box_bevel(0.18, 0.06, 0.050, 0.008), "Head", glow="GlowForgeOrange", loc=(0, -0.182, 1.13))

    # Twin perforated brass smokestacks behind shoulders
    for sx in (-1, 1):
        b.add_prim(f"Stack_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.16, 0.21, 1.22),
                   rot_deg=(10, sx * 8, 0), r1=0.055, r2=0.048, depth=0.34)
        b.add_prim(f"StackRim_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.18, 0.24, 1.38),
                   rot_deg=(10, sx * 8, 0), r1=0.052, r2=0.072, depth=0.045)
        b.add_prim(f"StackHole_{sx}", "CYL", "Body", col=19, metal=False, loc=(sx * 0.18, 0.24, 1.39),
                   rot_deg=(10, sx * 8, 0), r1=0.042, r2=0.042, depth=0.03)

    # Pauldrons (blue + brass rim), WOODEN upper arms, cobalt/brass gauntlets
    for sx, bone in ((-1, "ArmR"), (1, "ArmL")):
        b.add_bm(f"Pauldron_{bone}", make_box_bevel(0.21, 0.24, 0.15, 0.045), bone, col=4, metal=True,
                 loc=(sx * 0.34, 0.0, 0.89), rot_deg=(0, sx * -18, 0))
        b.add_bm(f"PauldRim_{bone}", make_box_bevel(0.22, 0.25, 0.04, 0.01), bone, col=1, metal=True,
                 loc=(sx * 0.34, 0.0, 0.84), rot_deg=(0, sx * -18, 0))
        b.add_prim(f"WoodUpperArm_{bone}", "CYL", bone, col=5, metal=False, loc=(sx * 0.35, -0.02, 0.72), r1=0.068, r2=0.064, depth=0.18)
        b.add_prim(f"Gauntlet_{bone}", "CYL", bone, col=4, metal=True, loc=(sx * 0.355, -0.08, 0.54), rot_deg=(20, 0, 0), r1=0.095, r2=0.080, depth=0.20)
        b.add_prim(f"GauntCuff_{bone}", "CYL", bone, col=1, metal=True, loc=(sx * 0.355, -0.04, 0.62), rot_deg=(20, 0, 0), r1=0.102, r2=0.102, depth=0.04)
        b.add_bm(f"Fist_{bone}", make_box_bevel(0.11, 0.11, 0.11, 0.025), bone, col=4, metal=True, loc=(sx * 0.355, -0.14, 0.43))

    # Giant cobalt & brass knight shield mounted on LEFT arm (+X) facing -Y
    sh_loc = (0.42, -0.28, 0.56)
    sh_rot = (8, 0, 26)
    b.add_bm("ShieldBrassRim", make_shield_plate(w=0.60, h=0.76, depth=0.065, pointed=True), "ArmL", col=1, metal=True,
             loc=sh_loc, rot_deg=sh_rot)
    b.add_bm("ShieldBlueFace", make_shield_plate(w=0.50, h=0.66, depth=0.082, pointed=True), "ArmL", col=4, metal=True,
             loc=sh_loc, rot_deg=sh_rot)
    b.add_bm("ShieldBadge", make_box_bevel(0.20, 0.11, 0.22, 0.018), "ArmL", col=1, metal=True,
             loc=(0.45, -0.32, 0.57), rot_deg=sh_rot)
    for kx in (-0.048, 0.0, 0.048):
        dx = math.cos(math.radians(26)) * kx
        dy = -math.sin(math.radians(26)) * kx
        b.add_bm(f"ShieldSlit_{kx:.2f}", make_box_bevel(0.026, 0.04, 0.14, 0.005), "ArmL", glow="GlowForgeOrange",
                 loc=(0.47 + dx, -0.35 + dy, 0.57), rot_deg=sh_rot)

    # Wooden thighs + heavy cobalt & brass armored boots
    add_leg_biped(b, "R", "LegR", -0.155, 0.40, thigh_col=5, knee_col=1, shin_col=4, foot_col=1, thigh_metal=False, shin_metal=True)
    add_leg_biped(b, "L", "LegL", 0.155, 0.40, thigh_col=5, knee_col=1, shin_col=4, foot_col=1, thigh_metal=False, shin_metal=True)

    b.finalize_and_skin()
    b.bake_animations(
        lambda bs, f: biped_walk(bs, f, stride=0.36, bob=0.035, arm_swing=0.25),
        lambda bs, f: biped_attack(bs, f, strike_left=False),
    )
    b.export()


# ---------------------------------------------------------------------------
# 4. hover_drone — Flying Plum/Wood Sphere + Ruby Telescope Lens + Canvas Rotor + Lantern
# ---------------------------------------------------------------------------

def build_hover_drone():
    b = EnemyBuilder("enemy_hover_drone", target_height=0.86, is_flying=True)
    b.add_bone("Body", (0, 0, 1.54), (0, 0, 1.84))
    b.add_bone("Lantern", (0, 0, 1.28), (0, 0, 1.18), parent="Body")
    b.add_bone("SpinBone_Fast_Rotor", (0, 0, 1.88), (0, 0, 2.08), parent="Body")
    b.add_bone("SpinBone_Slow_GearL", (0.24, 0.02, 1.54), (0.44, 0.02, 1.54), parent="Body")
    b.add_bone("SpinBone_Slow_GearR", (-0.24, 0.02, 1.54), (-0.44, 0.02, 1.54), parent="Body")

    # Upper plum sphere + lower oak wood sphere + brass equator/vertical bands
    prof_top = [(0, 1.54), (0.27, 1.54), (0.26, 1.65), (0.20, 1.75), (0.11, 1.80), (0, 1.81)]
    prof_bot = [(0, 1.29), (0.12, 1.31), (0.21, 1.37), (0.26, 1.45), (0.27, 1.54), (0, 1.54)]
    b.add_bm("UpperPlumDome", make_lathe(prof_top, segs=22), "Body", col=8, metal=True)
    b.add_bm("LowerWoodHull", make_lathe(prof_bot, segs=22), "Body", col=5, metal=False)
    b.add_prim("EquatorBand", "TORUS", "Body", col=1, metal=True, loc=(0, 0, 1.54), r1=0.272, r2=0.028, segs=22)
    b.add_prim("VertArchBand", "TORUS", "Body", col=1, metal=True, loc=(0, 0, 1.55), rot_deg=(0, 90, 0), r1=0.270, r2=0.025, segs=22)

    # Front (-Y) brass telescope lens barrel + dark bezel + inset glowing ruby lens
    b.add_prim("LensHousing", "CYL", "Body", col=1, metal=True, loc=(0, -0.25, 1.54), rot_deg=(90, 0, 0), r1=0.145, r2=0.115, depth=0.14)
    b.add_prim("LensHoodRing", "TORUS", "Body", col=1, metal=True, loc=(0, -0.355, 1.54), rot_deg=(90, 0, 0), r1=0.125, r2=0.028, segs=22)
    b.add_prim("LensDarkBack", "CYL", "Body", glow="MatEyeDark", loc=(0, -0.335, 1.54), rot_deg=(90, 0, 0), r1=0.105, r2=0.105, depth=0.04, segs=20)
    b.add_prim("RubyGlass", "SPHERE", "Body", glow="GlowRubyGlass", loc=(0, -0.348, 1.54), scale=(0.088, 0.036, 0.088), r1=1.0)

    # Left & Right side brass clockwork gears inset on flanks
    for sx, bone in ((1, "SpinBone_Slow_GearL"), (-1, "SpinBone_Slow_GearR")):
        b.add_prim(f"GearRecess_{sx}", "CYL", "Body", col=2, metal=True, loc=(sx * 0.25, 0.02, 1.54), rot_deg=(0, 90, 0), r1=0.125, r2=0.125, depth=0.04)
        b.add_bm(f"SideGear_{sx}", make_gear_wheel(r_out=0.115, r_root=0.088, r_hub=0.032, thick=0.036, teeth=8, spokes=4, axis="x"),
                 bone, col=1, metal=True, loc=(sx * 0.275, 0.02, 1.54))

    # Hanging bottom warm amber lantern
    b.add_prim("LanternNeck", "CYL", "Lantern", col=1, metal=True, loc=(0, 0, 1.27), r1=0.024, r2=0.036, depth=0.06)
    b.add_prim("LanternCap", "CYL", "Lantern", col=1, metal=True, loc=(0, 0, 1.22), r1=0.065, r2=0.035, depth=0.04)
    b.add_prim("LanternBulb", "SPHERE", "Lantern", glow="GlowAmberEye", loc=(0, 0, 1.18), scale=(0.052, 0.052, 0.062), r1=1.0)
    b.add_prim("LanternBase", "CYL", "Lantern", col=1, metal=True, loc=(0, 0, 1.135), r1=0.045, r2=0.020, depth=0.03)

    # Top brass spire + 4 stitched cream canvas blades
    b.add_prim("RotorMast", "CYL", "Body", col=1, metal=True, loc=(0, 0, 1.84), r1=0.06, r2=0.035, depth=0.12)
    b.add_bm("CanvasRotor", make_propeller(n_blades=4, r_blade=0.38, blade_w=0.105, twist_deg=18),
             "SpinBone_Fast_Rotor", col=9, metal=False, loc=(0, 0, 1.91))
    b.add_prim("RotorCap", "SPHERE", "SpinBone_Fast_Rotor", col=1, metal=True, loc=(0, 0, 1.925), r1=0.045)

    b.finalize_and_skin()

    def walk(bones, f):
        ph = (f - 1) / 24.0 * 2.0 * math.pi
        bones["Body"].rotation_euler = (0.08, math.sin(ph) * 0.06, math.cos(ph) * 0.04)
        bones["Lantern"].rotation_euler.x = -0.10 + math.sin(ph) * 0.14

    def atk(bones, f):
        t_map = {1: 0.0, 6: -0.16, 11: 0.24, 16: 0.08, 21: 0.0}
        bones["Body"].rotation_euler.x = t_map.get(f, 0.0)

    b.bake_animations(walk, atk)
    b.export()


# ---------------------------------------------------------------------------
# 5. mega_harvester (BOSS) — Dark Plum Iron + Brass Trims + 2 Chimneys + Spiked Pauldrons + Dual Wrist Buzzsaws
# ---------------------------------------------------------------------------

def build_mega_harvester():
    b = EnemyBuilder("enemy_mega_harvester", target_height=2.28)
    b.add_bone("Body", (0, 0, 0.72), (0, 0, 1.72))
    b.add_bone("Head", (0, 0, 1.72), (0, 0, 2.08), parent="Body")
    b.add_bone("ArmR", (-0.64, 0, 1.56), (-0.66, 0, 0.90), parent="Body")
    b.add_bone("ArmL", (0.64, 0, 1.56), (0.66, 0, 0.90), parent="Body")
    b.add_bone("LegR", (-0.28, 0, 0.72), (-0.28, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.28, 0, 0.72), (0.28, 0, 0.0), parent="Body")
    b.add_bone("SpinBone_Fast_SawR", (-0.70, -0.34, 0.74), (-0.50, -0.34, 0.74), parent="ArmR")
    b.add_bone("SpinBone_Fast_SawL", (0.70, -0.34, 0.74), (0.90, -0.34, 0.74), parent="ArmL")

    # Giant barrel plum iron chest + thick brass shoulder collar + glowing belly porthole
    prof = [(0, 0.68), (0.38, 0.70), (0.50, 1.05), (0.52, 1.48), (0.42, 1.74), (0, 1.74)]
    b.add_bm("BossChest", make_lathe(prof, segs=24), "Body", col=10, metal=True)
    b.add_prim("CollarBrass", "TORUS", "Body", col=1, metal=True, loc=(0, 0, 1.66), r1=0.40, r2=0.055, segs=22)
    b.add_prim("WaistBrass", "CYL", "Body", col=1, metal=True, loc=(0, 0, 0.74), r1=0.41, r2=0.44, depth=0.10, segs=22)
    b.add_prim("PelvisDome", "SPHERE", "Body", col=10, metal=True, loc=(0, 0, 0.65), scale=(0.35, 0.28, 0.18), r1=1.0)
    b.add_rivets_ring("ChestRiv", (0, 0, 1.44), 0.515, 16, "Body", col=1, rivet_r=0.022)

    # Round glowing belly boiler hatch + brass waist pipes
    b.add_prim("BellyRing", "CYL", "Body", col=1, metal=True, loc=(0, -0.46, 1.04), rot_deg=(90, 0, 0), r1=0.22, r2=0.20, depth=0.14, segs=20)
    b.add_prim("BellyBackGlow", "SPHERE", "Body", glow="GlowForgeOrange", loc=(0, -0.49, 1.04), scale=(0.16, 0.06, 0.16), r1=1.0)
    for kx in (-0.06, 0.0, 0.06):
        b.add_bm(f"BellyGrill_{kx:.2f}", make_box_bevel(0.024, 0.06, 0.22, 0.004), "Body", col=1, metal=True, loc=(kx, -0.52, 1.04))
    for sx in (-1, 1):
        b.add_bm(f"WaistPipe_{sx}", make_tube([(sx * 0.21, -0.46, 1.02), (sx * 0.42, -0.35, 0.96), (sx * 0.49, 0.0, 0.94)], 0.038),
                 "Body", col=1, metal=True)

    # Domed ribbed knight furnace helm with twin red eyes & vertical barred mouth
    b.add_bm("HelmHull", make_lathe([(0, 1.66), (0.23, 1.68), (0.24, 1.94), (0.18, 2.08), (0, 2.12)], segs=20),
             "Head", col=10, metal=True)
    b.add_bm("HelmStripe", make_box_bevel(0.08, 0.46, 0.44, 0.014), "Head", col=1, metal=True, loc=(0, 0, 1.90))
    for sx in (-1, 1):
        b.add_prim(f"EyeSock_{sx}", "CYL", "Head", col=1, metal=True, loc=(sx * 0.095, -0.21, 1.92), rot_deg=(90, 0, sx * -14), r1=0.048, r2=0.048, depth=0.04)
        b.add_prim(f"EyeGlow_{sx}", "SPHERE", "Head", glow="GlowForgeOrange", loc=(sx * 0.098, -0.228, 1.92), r1=0.036)
    b.add_bm("MuzzleGuard", make_box_bevel(0.24, 0.14, 0.14, 0.024), "Head", col=1, metal=True, loc=(0, -0.18, 1.76))
    for kx in (-0.075, -0.025, 0.025, 0.075):
        b.add_bm(f"MuzSlit_{kx:.2f}", make_box_bevel(0.020, 0.04, 0.095, 0.003), "Head", col=19, metal=False, loc=(kx, -0.24, 1.76))

    # 2 giant dark-iron & brass chimneys on back
    for sx in (-1, 1):
        b.add_prim(f"Chim_{sx}", "CYL", "Body", col=23, metal=True, loc=(sx * 0.30, 0.25, 2.00),
                   rot_deg=(14, sx * 12, 0), r1=0.085, r2=0.115, depth=0.52)
        b.add_prim(f"ChimRing_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.27, 0.20, 1.80),
                   rot_deg=(14, sx * 12, 0), r1=0.105, r2=0.105, depth=0.06)

    # Spiked brass-trimmed pauldrons + plum arms + spinning wrist buzzsaws
    for sx, bone, sbone in ((-1, "ArmR", "SpinBone_Fast_SawR"), (1, "ArmL", "SpinBone_Fast_SawL")):
        b.add_bm(f"Pauld_{bone}", make_box_bevel(0.38, 0.42, 0.30, 0.07), bone, col=10, metal=True,
                 loc=(sx * 0.58, 0.0, 1.56), rot_deg=(0, sx * -22, 0))
        b.add_bm(f"PauldRim_{bone}", make_box_bevel(0.40, 0.44, 0.06, 0.015), bone, col=1, metal=True,
                 loc=(sx * 0.58, 0.0, 1.44), rot_deg=(0, sx * -22, 0))
        b.add_prim(f"Spike_{bone}", "CYL", bone, col=1, metal=True, loc=(sx * 0.62, 0.0, 1.78),
                   rot_deg=(0, sx * -15, 0), r1=0.065, r2=0.008, depth=0.22)
        b.add_prim(f"Bicep_{bone}", "CYL", bone, col=10, metal=True, loc=(sx * 0.65, -0.02, 1.24), r1=0.125, r2=0.115, depth=0.34)
        b.add_prim(f"Cuff_{bone}", "CYL", bone, col=1, metal=True, loc=(sx * 0.67, -0.09, 1.02), rot_deg=(28, 0, 0), r1=0.155, r2=0.155, depth=0.08)
        b.add_bm(f"SawFork_{bone}", make_box_bevel(0.16, 0.28, 0.22, 0.03), bone, col=10, metal=True,
                 loc=(sx * 0.68, -0.22, 0.85), rot_deg=(20, 0, 0))
        b.add_bm(f"Saw_{bone}", make_circular_saw(r_out=0.42, r_root=0.31, thick=0.046, teeth=14, axis="x"),
                 sbone, col=21, metal=True, loc=(sx * 0.72, -0.34, 0.74))

    add_leg_biped(b, "R", "LegR", -0.29, 0.66, thigh_col=10, knee_col=1, shin_col=10, foot_col=1, leg_scale=1.82)
    add_leg_biped(b, "L", "LegL", 0.29, 0.66, thigh_col=10, knee_col=1, shin_col=10, foot_col=1, leg_scale=1.82)

    b.finalize_and_skin()
    b.bake_animations(
        lambda bs, f: biped_walk(bs, f, stride=0.32, bob=0.04, arm_swing=0.28),
        lambda bs, f: biped_attack(bs, f, both_arms=True),
    )
    b.export()


# ---------------------------------------------------------------------------
# 6. turbo_hopper — Copper Grasshopper + Cyan Pilot Goggles + 3 Cyan Tubes + Helical Spring Hind Legs
# ---------------------------------------------------------------------------

def build_turbo_hopper():
    b = EnemyBuilder("enemy_turbo_hopper", target_height=0.94)
    b.add_bone("Body", (0, 0, 0.34), (0, -0.18, 0.56))
    b.add_bone("Head", (0, -0.22, 0.44), (0, -0.44, 0.54), parent="Body")
    b.add_bone("LegL_Back", (0.16, 0.12, 0.42), (0.20, 0.22, 0.0), parent="Body")
    b.add_bone("LegR_Back", (-0.16, 0.12, 0.42), (-0.20, 0.22, 0.0), parent="Body")
    b.add_bone("LegL_Mid", (0.14, -0.02, 0.32), (0.22, 0.0, 0.0), parent="Body")
    b.add_bone("LegR_Mid", (-0.14, -0.02, 0.32), (-0.22, 0.0, 0.0), parent="Body")
    b.add_bone("LegL_Front", (0.13, -0.18, 0.34), (0.18, -0.26, 0.0), parent="Body")
    b.add_bone("LegR_Front", (-0.13, -0.18, 0.34), (-0.18, -0.26, 0.0), parent="Body")

    # Segmented copper thorax + tapering abdomen + bronze folded wing sheaths
    b.add_prim("Thorax", "SPHERE", "Body", col=0, metal=True, loc=(0, -0.04, 0.42), scale=(0.20, 0.28, 0.18), r1=1.0)
    for k in range(3):
        b.add_prim(f"Abd_{k}", "SPHERE", "Body", col=0, metal=True, loc=(0, 0.18 + k * 0.11, 0.36 - k * 0.04),
                   rot_deg=(-14, 0, 0), scale=(0.17 - k * 0.03, 0.14, 0.14 - k * 0.025), r1=1.0)
    for sx in (-1, 1):
        b.add_prim(f"Wing_{sx}", "SPHERE", "Body", col=2, metal=True, loc=(sx * 0.14, 0.18, 0.43),
                   rot_deg=(-16, sx * 10, sx * 14), scale=(0.06, 0.30, 0.08), r1=1.0)

    # Head + inset dark eyes + 2 long swept antennae + pilot leather-brass CYAN GOGGLES
    b.add_prim("HopHead", "SPHERE", "Head", col=0, metal=True, loc=(0, -0.32, 0.44), scale=(0.16, 0.15, 0.15), r1=1.0)
    b.add_prim("ChinPlates", "SPHERE", "Head", col=1, metal=True, loc=(0, -0.38, 0.34), scale=(0.09, 0.10, 0.07), r1=1.0)
    b.add_prim("GoggleCap", "SPHERE", "Head", col=6, metal=False, loc=(0, -0.29, 0.52), scale=(0.155, 0.145, 0.09), r1=1.0)
    for sx in (-1, 1):
        b.add_prim(f"Eye_{sx}", "SPHERE", "Head", glow="MatEyeDark", loc=(sx * 0.11, -0.38, 0.42), scale=(0.045, 0.06, 0.055), r1=1.0)
        b.add_prim(f"GogRim_{sx}", "CYL", "Head", col=1, metal=True, loc=(sx * 0.08, -0.40, 0.54), rot_deg=(72, 0, sx * -18), r1=0.058, r2=0.058, depth=0.045)
        b.add_prim(f"GogGlow_{sx}", "SPHERE", "Head", glow="GlowCyanTech", loc=(sx * 0.085, -0.415, 0.545), scale=(0.042, 0.025, 0.042), r1=1.0)
        b.add_bm(f"Ant_{sx}", make_tube([(sx * 0.06, -0.34, 0.56), (sx * 0.08, -0.38, 0.72), (sx * 0.09, -0.45, 0.84)], [0.015, 0.010, 0.005], segs=6),
                 "Head", col=1, metal=True)

    # 3 fan-splayed silver-steel canisters with glowing cyan window strips + 3 brass hoses on back
    can_specs = [(-0.18, 0.12, 0.70, (-34, -26, 0)), (0.0, 0.08, 0.74, (-30, 0, 0)), (0.18, 0.12, 0.70, (-34, 26, 0))]
    for idx, (cx, cy, cz, rot) in enumerate(can_specs):
        b.add_prim(f"Canister_{idx}", "CYL", "Body", col=21, metal=True, loc=(cx, cy, cz), rot_deg=rot, r1=0.056, r2=0.056, depth=0.28)
        m_c = Matrix.Translation((cx, cy, cz)) @ Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix().to_4x4()
        b.add_prim(f"CanCapT_{idx}", "CYL", "Body", col=13, metal=True, loc=(m_c @ Vector((0, 0, 0.12))), rot_deg=rot, r1=0.064, r2=0.064, depth=0.05)
        b.add_prim(f"CanCapB_{idx}", "CYL", "Body", col=13, metal=True, loc=(m_c @ Vector((0, 0, -0.12))), rot_deg=rot, r1=0.064, r2=0.064, depth=0.05)
        b.add_prim(f"CanGlow_{idx}", "CYL", "Body", glow="GlowCyanTech", loc=(m_c @ Vector((0, 0, 0.0))), rot_deg=rot, r1=0.060, r2=0.060, depth=0.14)
        b.add_bm(f"Hose_{idx}", make_tube([(cx * 0.5, -0.02, 0.50), (cx * 0.85, 0.03, 0.54), (cx, cy - 0.02, cz - 0.10)], 0.016, segs=6),
                 "Body", col=1, metal=True)

    # Giant jumping hind legs with true 3D helical brass coil spring
    for sx, bone in ((1, "LegL_Back"), (-1, "LegR_Back")):
        b.add_bm(f"H_Femur_{sx}", make_tube([(sx * 0.16, 0.12, 0.42), (sx * 0.24, 0.20, 0.52), (sx * 0.25, 0.26, 0.34)], [0.055, 0.048, 0.036], segs=8),
                 bone, col=0, metal=True)
        b.add_bm(f"H_Spring_{sx}", make_coil_spring((sx * 0.24, 0.25, 0.34), (sx * 0.21, 0.19, 0.10), r_coil=0.032, r_wire=0.009, turns=5.0),
                 bone, col=1, metal=True)
        b.add_prim(f"H_Foot_{sx}", "SPHERE", bone, col=1, metal=True, loc=(sx * 0.20, 0.16, 0.04), scale=(0.045, 0.085, 0.04), r1=1.0)

    # 4 mid + front legs (front pair with vertical coil springs too)
    for sx, bone in ((1, "LegL_Mid"), (-1, "LegR_Mid")):
        b.add_bm(f"M_Leg_{sx}", make_tube([(sx * 0.14, -0.02, 0.32), (sx * 0.24, 0.0, 0.24), (sx * 0.22, 0.0, 0.04)], [0.030, 0.024, 0.018]),
                 bone, col=0, metal=True)
        b.add_prim(f"M_Foot_{sx}", "SPHERE", bone, col=1, metal=True, loc=(sx * 0.22, -0.02, 0.035), scale=(0.04, 0.06, 0.035), r1=1.0)
    for sx, bone in ((1, "LegL_Front"), (-1, "LegR_Front")):
        b.add_bm(f"F_Upper_{sx}", make_tube([(sx * 0.13, -0.18, 0.34), (sx * 0.19, -0.24, 0.25)], [0.030, 0.024]), bone, col=0, metal=True)
        b.add_bm(f"F_Spring_{sx}", make_coil_spring((sx * 0.19, -0.24, 0.25), (sx * 0.18, -0.26, 0.06), r_coil=0.024, r_wire=0.007, turns=4.5),
                 bone, col=1, metal=True)
        b.add_prim(f"F_Foot_{sx}", "SPHERE", bone, col=1, metal=True, loc=(sx * 0.18, -0.27, 0.035), scale=(0.04, 0.06, 0.035), r1=1.0)

    b.finalize_and_skin()

    def walk(bones, f):
        ph = (f - 1) / 24.0 * 2.0 * math.pi
        hop = max(0.0, math.sin(ph))
        bones["Body"].location.z = hop * 0.12
        bones["Body"].rotation_euler.x = -hop * 0.18
        for k in ("LegL_Back", "LegR_Back"):
            bones[k].rotation_euler.x = hop * 0.38
        bones["LegL_Front"].rotation_euler.x = math.sin(ph) * 0.35
        bones["LegR_Front"].rotation_euler.x = -math.sin(ph) * 0.35

    def atk(bones, f):
        t_map = {1: 0.0, 6: -0.25, 11: 0.38, 16: 0.12, 21: 0.0}
        bones["Body"].rotation_euler.x = t_map.get(f, 0.0)
        bones["Body"].location.y = -max(0.0, t_map.get(f, 0.0)) * 0.16

    b.bake_animations(walk, atk)
    b.export()


# ---------------------------------------------------------------------------
# 7. chomp_brute — Crimson & Brass Treasure Chest Mimic + Teeth + Lid Boiler Cap + Giant Left Wind-Up Key
# ---------------------------------------------------------------------------

def build_chomp_brute():
    b = EnemyBuilder("enemy_chomp_brute", target_height=1.06)
    b.add_bone("Body", (0, 0, 0.22), (0, 0, 0.56))
    b.add_bone("UpperJaw", (0, 0.28, 0.50), (0, -0.20, 0.66), parent="Body")
    b.add_bone("SpinBone_Med_WindKey", (0.34, 0.02, 0.34), (0.54, 0.02, 0.34), parent="Body")
    for fn, (fx, fy) in (("LegFL", (0.20, -0.20)), ("LegFR", (-0.20, -0.20)), ("LegBL", (0.20, 0.20)), ("LegBR", (-0.20, 0.20))):
        b.add_bone(fn, (fx, fy, 0.14), (fx, fy, 0.0), parent="Body")

    # Lower chest box (crimson planks + brass corners/bands + dark maw interior)
    b.add_bm("BotWoodBox", make_box_bevel(0.56, 0.54, 0.36, 0.022), "Body", col=11, metal=False, loc=(0, 0, 0.32))
    b.add_bm("MawVoid", make_box_bevel(0.46, 0.44, 0.16, 0.01), "Body", glow="MatEyeDark", loc=(0, -0.02, 0.46))
    b.add_bm("BotRimBand", make_box_bevel(0.60, 0.58, 0.075, 0.014), "Body", col=1, metal=True, loc=(0, 0, 0.48))
    b.add_bm("BotBaseBand", make_box_bevel(0.60, 0.58, 0.065, 0.014), "Body", col=1, metal=True, loc=(0, 0, 0.16))
    for sx in (-0.19, 0.19):
        b.add_bm(f"BotStrap_{sx:.2f}", make_box_bevel(0.075, 0.59, 0.38, 0.01), "Body", col=1, metal=True, loc=(sx, 0, 0.32))
    b.add_bm("KeyLockPlate", make_box_bevel(0.10, 0.05, 0.13, 0.012), "Body", col=1, metal=True, loc=(0, -0.29, 0.44))

    # Lower jaw golden/ivory shark teeth lining front & sides
    for px in (-0.20, -0.12, -0.04, 0.04, 0.12, 0.20):
        b.add_prim(f"LoToothF_{px:.2f}", "CYL", "Body", col=18, metal=False, loc=(px, -0.25, 0.54), r1=0.036, r2=0.005, depth=0.11, segs=4)
    for py in (-0.16, -0.06, 0.05):
        for sx in (-1, 1):
            b.add_prim(f"LoToothS_{sx}_{py:.2f}", "CYL", "Body", col=18, metal=False, loc=(sx * 0.26, py, 0.54), r1=0.034, r2=0.005, depth=0.10, segs=4)

    # 4 short dark bronze chest legs resting at z=0
    for fn, (fx, fy) in (("LegFL", (0.22, -0.21)), ("LegFR", (-0.22, -0.21)), ("LegBL", (0.22, 0.21)), ("LegBR", (-0.22, 0.21))):
        b.add_bm(f"{fn}_Foot", make_box_bevel(0.12, 0.12, 0.16, 0.025), fn, col=2, metal=True, loc=(fx, fy, 0.08))

    # Hinged curved upper chest lid tilted open (24 deg around rear X hinge)
    hinge = Vector((0, 0.28, 0.50))
    tilt_m = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(-24.0), 4, "X") @ Matrix.Translation(-hinge)

    def add_lid_part(bm_part, col_id, metal_flag, l_loc=(0, 0, 0), l_rot=(0, 0, 0), name="LidP"):
        # First bake part's local loc/rot, then apply exact world hinge tilt around X!
        m_part = tilt_m @ Matrix.Translation(Vector(l_loc)) @ Euler(tuple(math.radians(a) for a in l_rot), "XYZ").to_matrix().to_4x4()
        for v in bm_part.verts:
            v.co = m_part @ v.co
        b.add_bm(name, bm_part, "UpperJaw", col=col_id, metal=metal_flag)

    def make_half_arch(width_x: float, radius_yz: float, segs: int = 16):
        """Vaulted chest arch extending [-width_x/2..+width_x/2] in X, curved semi-cylinder up +Z."""
        bm = bmesh.new()
        r0, r1 = [], []
        hx = width_x * 0.5
        for i in range(segs + 1):
            ang = i * math.pi / segs  # 0 (front -Y) -> pi (back +Y)
            py = -math.cos(ang) * radius_yz
            pz = math.sin(ang) * radius_yz
            r0.append(bm.verts.new((-hx, py, pz)))
            r1.append(bm.verts.new((hx, py, pz)))
        # Bottom center points for solid half-cylinder caps
        for i in range(segs):
            bm.faces.new((r0[i], r0[i + 1], r1[i + 1], r1[i]))
        bm.faces.new(list(reversed(r0)))  # left end cap
        bm.faces.new(r1)  # right end cap
        # Flat underside along Z=0
        c_front = bm.verts.new((-hx, -radius_yz, 0.0))
        c_back = bm.verts.new((hx, -radius_yz, 0.0))
        # Use existing corner verts for flat underside closure
        bm.faces.new((r0[0], r1[0], r1[-1], r0[-1]))
        bm.verts.remove(c_front)
        bm.verts.remove(c_back)
        return bm

    add_lid_part(make_half_arch(0.56, 0.27, segs=16), 11, False, l_loc=(0, 0.0, 0.52), name="TopLidWood")
    add_lid_part(make_box_bevel(0.60, 0.58, 0.065, 0.014), 1, True, l_loc=(0, 0.0, 0.52), name="TopLidBrassRim")
    for sx in (-0.19, 0.19):
        add_lid_part(make_half_arch(0.075, 0.288, segs=16), 1, True, l_loc=(sx, 0.0, 0.52), name=f"TopStrap_{sx:.2f}")

    # Upper teeth pointing downward from open lid front edge
    for px in (-0.20, -0.12, -0.04, 0.04, 0.12, 0.20):
        bm_t = bmesh.new()
        bmesh.ops.create_cone(bm_t, cap_ends=True, segments=4, radius1=0.036, radius2=0.005, depth=0.11)
        add_lid_part(bm_t, 18, False, l_loc=(px, -0.25, 0.45), l_rot=(180, 0, 0), name=f"UpTooth_{px:.2f}")

    # Small hinged brass boiler kettle cap popping slightly open on crown of lid
    add_lid_part(make_lathe([(0, 0), (0.12, 0), (0.12, 0.06), (0, 0.06)], segs=16), 2, True, l_loc=(0.04, 0.04, 0.77), name="KettleCollar")
    add_lid_part(make_lathe([(0, 0), (0.15, 0.02), (0.12, 0.12), (0.05, 0.16), (0, 0.17)], segs=16), 1, True,
                 l_loc=(0.06, 0.08, 0.84), l_rot=(18, -14, 0), name="KettleCapTop")

    # Giant wind-up key on LEFT (+X) side spinning on SpinBone_Med_WindKey
    b.add_prim("KeyRosette", "CYL", "Body", col=1, metal=True, loc=(0.30, 0.02, 0.34), rot_deg=(0, 90, 0), r1=0.14, r2=0.12, depth=0.06)
    b.add_prim("KeyShaft", "CYL", "SpinBone_Med_WindKey", col=1, metal=True, loc=(0.41, 0.02, 0.34), rot_deg=(0, 90, 0), r1=0.042, r2=0.042, depth=0.18)
    for sz in (-0.095, 0.095):
        b.add_prim(f"KeyRing_{sz}", "TORUS", "SpinBone_Med_WindKey", col=1, metal=True,
                   loc=(0.56, 0.02, 0.34 + sz), rot_deg=(90, 0, 0), r1=0.085, r2=0.024, segs=16)

    b.finalize_and_skin()

    def walk(bones, f):
        ph = (f - 1) / 24.0 * 2.0 * math.pi
        c = abs(math.cos(ph))
        bones["Body"].location.z = c * 0.06
        bones["Body"].rotation_euler.y = math.sin(ph) * 0.08
        bones["UpperJaw"].rotation_euler.x = -0.14 + math.sin(ph * 2.0) * 0.16
        bones["LegFL"].rotation_euler.x = math.sin(ph) * 0.35
        bones["LegBR"].rotation_euler.x = math.sin(ph) * 0.35
        bones["LegFR"].rotation_euler.x = -math.sin(ph) * 0.35
        bones["LegBL"].rotation_euler.x = -math.sin(ph) * 0.35

    def atk(bones, f):
        ang = {1: 0.0, 6: -0.52, 11: 0.32, 16: -0.10, 21: 0.0}.get(f, 0.0)
        bones["UpperJaw"].rotation_euler.x = ang
        bones["Body"].rotation_euler.x = 0.22 if f == 11 else 0.0

    b.bake_animations(walk, atk)
    b.export()


# ---------------------------------------------------------------------------
# 8. repair_drone — Flying Copper & Verdigris Alchemist Tank + 3 Corked Emerald Flasks + 3-Blade Copper Propeller
# ---------------------------------------------------------------------------

def build_repair_drone():
    b = EnemyBuilder("enemy_repair_drone", target_height=0.86, is_flying=True)
    b.add_bone("Body", (0, 0, 1.48), (0, 0, 1.84))
    b.add_bone("SpinBone_Fast_Prop", (0, 0, 1.88), (0, 0, 2.08), parent="Body")

    # Central glowing emerald alchemy tank
    b.add_prim("CoreGlass", "CYL", "Body", glow="GlowEmeraldFlask", loc=(0, 0, 1.50), r1=0.175, r2=0.175, depth=0.34, segs=20)
    # Bubble relief globes inside/on tank wall
    for bx, by, bz, br in ((0.06, -0.14, 1.46, 0.032), (-0.08, -0.12, 1.56, 0.025), (0.02, -0.13, 1.61, 0.020)):
        b.add_prim(f"Bubble_{bz}", "SPHERE", "Body", glow="GlowEmeraldFlask", loc=(bx, by, bz), r1=br, segs=10)

    # Top & bottom mint-verdigris domes + riveted copper bands + 4 sturdy outer copper cage struts
    b.add_bm("TopPatinaDome", make_lathe([(0.19, 1.66), (0.16, 1.75), (0.08, 1.79), (0, 1.80)], segs=20), "Body", col=12, metal=True)
    b.add_bm("BotPatinaDome", make_lathe([(0, 1.24), (0.12, 1.26), (0.19, 1.32), (0.19, 1.35)], segs=20), "Body", col=12, metal=True)
    for z_ring in (1.35, 1.50, 1.66):
        b.add_prim(f"CopBand_{z_ring:.2f}", "CYL", "Body", col=0, metal=True, loc=(0, 0, z_ring), r1=0.212 if z_ring != 1.50 else 0.196, r2=0.212 if z_ring != 1.50 else 0.196, depth=0.045 if z_ring != 1.50 else 0.026, segs=20)
        if z_ring != 1.50:
            b.add_rivets_ring(f"CopRiv_{z_ring:.2f}", (0, 0, z_ring), 0.215, 10, "Body", col=1, rivet_r=0.011)
    for k in range(4):
        a = k * (math.pi * 0.5) + math.pi * 0.25
        px, py = math.cos(a) * 0.205, math.sin(a) * 0.205
        b.add_bm(f"CageStrut_{k}", make_box_bevel(0.042, 0.042, 0.34, 0.008), "Body", col=0, metal=True, loc=(px, py, 1.50))

    # 3 exterior corked round glass potion vials held by copper bracket clamps
    for idx, deg in enumerate((-35, 195, 75)):
        a = math.radians(deg)
        vx, vy = math.cos(a) * 0.245, math.sin(a) * 0.245
        vz = 1.44 + (idx % 2) * 0.05
        b.add_prim(f"FlaskBulb_{idx}", "SPHERE", "Body", glow="GlowEmeraldFlask", loc=(vx, vy, vz), scale=(0.068, 0.068, 0.078), r1=1.0, segs=14)
        b.add_prim(f"FlaskNeck_{idx}", "CYL", "Body", glow="GlowCyanTech", loc=(vx, vy, vz + 0.085), r1=0.026, r2=0.034, depth=0.04, segs=10)
        b.add_prim(f"FlaskCork_{idx}", "CYL", "Body", col=6, metal=False, loc=(vx, vy, vz + 0.115), r1=0.022, r2=0.027, depth=0.036, segs=10)
        b.add_prim(f"FlaskStrap_{idx}", "CYL", "Body", col=0, metal=True, loc=(vx, vy, vz + 0.01), r1=0.074, r2=0.074, depth=0.026, segs=14)
        b.add_bm(f"FlaskArm_{idx}", make_tube([(math.cos(a) * 0.19, math.sin(a) * 0.19, vz), (vx, vy, vz)], 0.018, segs=6), "Body", col=0, metal=True)

    # Top copper shaft & 3 wide curved copper propeller blades
    b.add_prim("PropShaft", "CYL", "Body", col=0, metal=True, loc=(0, 0, 1.83), r1=0.042, r2=0.032, depth=0.10)
    b.add_bm("CopperProp", make_propeller(n_blades=3, r_blade=0.35, blade_w=0.125, twist_deg=22),
             "SpinBone_Fast_Prop", col=0, metal=True, loc=(0, 0, 1.90))
    b.add_prim("PropSpinner", "SPHERE", "SpinBone_Fast_Prop", col=1, metal=True, loc=(0, 0, 1.915), r1=0.045)

    b.finalize_and_skin()

    def walk(bones, f):
        ph = (f - 1) / 24.0 * 2.0 * math.pi
        bones["Body"].location.z = math.sin(ph) * 0.04
        bones["Body"].rotation_euler = (0.04, math.sin(ph) * 0.06, 0.0)

    def atk(bones, f):
        bones["Body"].location.z = 0.08 if f == 11 else 0.0

    b.bake_animations(walk, atk)
    b.export()


# ---------------------------------------------------------------------------
# 9. crystal_golem — Vintage Brass Diver Armor + Glowing Blue Porthole + Violet/Cyan Quartz Backpack + Giant Right Drill
# ---------------------------------------------------------------------------

def build_crystal_golem():
    b = EnemyBuilder("enemy_crystal_golem", target_height=1.32)
    b.add_bone("Body", (0, 0, 0.44), (0, 0, 0.96))
    b.add_bone("Head", (0, 0, 0.96), (0, 0, 1.28), parent="Body")
    b.add_bone("ArmR", (-0.36, 0, 0.86), (-0.38, -0.18, 0.50), parent="Body")
    b.add_bone("ArmL", (0.36, 0, 0.86), (0.38, 0, 0.48), parent="Body")
    b.add_bone("LegR", (-0.16, 0, 0.44), (-0.16, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.16, 0, 0.44), (0.16, 0, 0.0), parent="Body")
    # Spiral drill points forward-down (-Y slightly down Z)
    b.add_bone("SpinBone_Fast_Drill", (-0.42, -0.22, 0.46), (-0.42, -0.42, 0.42), parent="ArmR")

    # Petrol-teal inner suit + brass chest breastplate & wide diver belt + hoses
    b.add_prim("SuitTorso", "CYL", "Body", col=13, metal=False, loc=(0, 0, 0.68), r1=0.25, r2=0.28, depth=0.52)
    b.add_bm("BrassBreast", make_lathe([(0, 0.54), (0.28, 0.56), (0.30, 0.88), (0.24, 0.98), (0, 0.98)], segs=20),
             "Body", col=1, metal=True)
    b.add_bm("DiverBelt", make_box_bevel(0.56, 0.50, 0.11, 0.02), "Body", col=6, metal=False, loc=(0, 0, 0.52))
    b.add_bm("BeltBuckle", make_box_bevel(0.14, 0.08, 0.12, 0.015), "Body", col=1, metal=True, loc=(0, -0.24, 0.52))

    # Spherical brass diver helmet + cross-barred glowing blue porthole + hoses + left shoulder lamp
    b.add_prim("HelmBrass", "SPHERE", "Head", col=1, metal=True, loc=(0, -0.02, 1.12), r1=0.215, segs=22)
    b.add_prim("HelmCollar", "TORUS", "Head", col=1, metal=True, loc=(0, -0.01, 0.96), r1=0.23, r2=0.036)
    b.add_rivets_ring("HelmColRiv", (0, -0.01, 0.96), 0.26, 10, "Head", col=1, rivet_r=0.014)
    b.add_prim("PortholeRim", "CYL", "Head", col=1, metal=True, loc=(0, -0.20, 1.12), rot_deg=(90, 0, 0), r1=0.135, r2=0.125, depth=0.08)
    b.add_prim("PortholeGlass", "SPHERE", "Head", glow="GlowCyanTech", loc=(0, -0.225, 1.12), scale=(0.105, 0.04, 0.105), r1=1.0)
    # Brass crosshair grill on porthole
    b.add_bm("PortholeBarH", make_box_bevel(0.22, 0.03, 0.020, 0.004), "Head", col=1, metal=True, loc=(0, -0.255, 1.12))
    b.add_bm("PortholeBarV", make_box_bevel(0.020, 0.03, 0.22, 0.004), "Head", col=1, metal=True, loc=(0, -0.255, 1.12))
    for sx in (-1, 1):
        b.add_bm(f"BreathHose_{sx}", make_tube([(sx * 0.16, -0.14, 1.02), (sx * 0.22, -0.22, 0.90), (sx * 0.14, -0.24, 0.78)],
                                               0.024, segs=8), "Body", col=20, metal=False)
    # Shoulder cyan lamp on left (+X) shoulder
    b.add_prim("ShLampRim", "CYL", "Body", col=1, metal=True, loc=(0.24, -0.14, 0.98), rot_deg=(70, 0, 20), r1=0.052, r2=0.044, depth=0.06)
    b.add_prim("ShLampGlow", "SPHERE", "Body", glow="GlowCyanTech", loc=(0.25, -0.16, 0.99), r1=0.036)

    # Backpack mining basket filled with glowing violet & cyan quartz crystal spires
    b.add_bm("PackBasket", make_box_bevel(0.38, 0.22, 0.30, 0.018), "Body", col=5, metal=False, loc=(0, 0.26, 0.88))
    b.add_bm("PackRim", make_box_bevel(0.41, 0.25, 0.05, 0.01), "Body", col=1, metal=True, loc=(0, 0.26, 1.02))
    crystals = [
        ((-0.11, 0.24, 1.00), (14, -18, 0), 0.32, "GlowCrystalViolet"),
        ((0.0, 0.27, 1.02), (18, 4, 12), 0.38, "GlowCyanTech"),
        ((0.12, 0.24, 1.00), (14, 22, -10), 0.30, "GlowCrystalViolet"),
        ((-0.05, 0.31, 1.00), (26, -8, 0), 0.26, "GlowCyanTech"),
        ((0.07, 0.30, 1.00), (24, 12, 0), 0.28, "GlowCrystalViolet"),
    ]
    for idx, (cloc, crot, ch, cglow) in enumerate(crystals):
        b.add_bm(f"PackCry_{idx}", make_crystal_prism(height=ch, rad=0.065), "Body", glow=cglow, loc=cloc, rot_deg=crot)

    # Left arm (+X): petrol sleeve + heavy brass gauntlet
    b.add_bm("Pauld_ArmL", make_box_bevel(0.18, 0.22, 0.16, 0.04), "ArmL", col=1, metal=True, loc=(0.33, 0.0, 0.86), rot_deg=(0, -18, 0))
    b.add_prim("Sleeve_ArmL", "CYL", "ArmL", col=13, metal=False, loc=(0.36, -0.02, 0.70), r1=0.075, r2=0.070, depth=0.18)
    b.add_prim("Cuff_ArmL", "CYL", "ArmL", col=1, metal=True, loc=(0.37, -0.05, 0.56), rot_deg=(18, 0, 0), r1=0.095, r2=0.085, depth=0.18)
    b.add_bm("Fist_ArmL", make_box_bevel(0.12, 0.12, 0.12, 0.03), "ArmL", col=1, metal=True, loc=(0.37, -0.08, 0.44))

    # Right arm (-X): giant conical spiral rock-drill mounted forward-down!
    b.add_bm("Pauld_ArmR", make_box_bevel(0.18, 0.22, 0.16, 0.04), "ArmR", col=1, metal=True, loc=(-0.33, 0.0, 0.86), rot_deg=(0, 18, 0))
    b.add_prim("Sleeve_ArmR", "CYL", "ArmR", col=13, metal=False, loc=(-0.36, -0.02, 0.72), r1=0.078, r2=0.078, depth=0.18)
    b.add_prim("DrillHousing", "CYL", "ArmR", col=1, metal=True, loc=(-0.40, -0.13, 0.54), rot_deg=(78, 0, 0), r1=0.125, r2=0.145, depth=0.22)
    b.add_bm("RockDrill", make_spiral_drill(length=0.52, r_base=0.14, turns=3.2),
             "SpinBone_Fast_Drill", col=3, metal=True, loc=(-0.42, -0.22, 0.46), rot_deg=(12, 0, 0))

    # Petrol suit legs + heavy brass diving boots
    add_leg_biped(b, "R", "LegR", -0.155, 0.42, thigh_col=13, knee_col=1, shin_col=1, foot_col=1, thigh_metal=False, shin_metal=True)
    add_leg_biped(b, "L", "LegL", 0.155, 0.42, thigh_col=13, knee_col=1, shin_col=1, foot_col=1, thigh_metal=False, shin_metal=True)

    b.finalize_and_skin()
    b.bake_animations(
        lambda bs, f: biped_walk(bs, f, stride=0.35, bob=0.038, arm_swing=0.24),
        lambda bs, f: biped_attack(bs, f, strike_left=False),
    )
    b.export()


# ---------------------------------------------------------------------------
# 10. cryo_colossus (BOSS) — Bronze/Brass Armor + Fluffy White Fur Trims + Twin Icy Chimneys + Ice Cleaver + Round Shield
# ---------------------------------------------------------------------------

def build_cryo_colossus():
    b = EnemyBuilder("enemy_cryo_colossus", target_height=2.32)
    b.add_bone("Body", (0, 0, 0.72), (0, 0, 1.72))
    b.add_bone("Head", (0, 0, 1.72), (0, 0, 2.08), parent="Body")
    b.add_bone("ArmR", (-0.64, 0, 1.56), (-0.68, 0, 0.88), parent="Body")
    b.add_bone("ArmL", (0.64, 0, 1.56), (0.68, 0, 0.88), parent="Body")
    b.add_bone("LegR", (-0.28, 0, 0.72), (-0.28, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.28, 0, 0.72), (0.28, 0, 0.0), parent="Body")

    # Bronze/brass barrel chestplate + belly vertical furnace grill + waist skirt fur
    prof = [(0, 0.68), (0.38, 0.70), (0.50, 1.05), (0.51, 1.48), (0.40, 1.74), (0, 1.74)]
    b.add_bm("BronzeHull", make_lathe(prof, segs=24), "Body", col=1, metal=True)
    b.add_bm("BellyGrillPlate", make_box_bevel(0.32, 0.14, 0.30, 0.025), "Body", col=2, metal=True, loc=(0, -0.45, 1.02))
    for kx in (-0.08, -0.025, 0.025, 0.08):
        b.add_bm(f"CryoSlit_{kx:.2f}", make_box_bevel(0.024, 0.05, 0.20, 0.004), "Body", col=19, metal=False, loc=(kx, -0.51, 1.02))
    # Fluffy white snow-fur collar around neck & waist belt skirt
    for k in range(16):
        a = k * (2 * math.pi / 16)
        b.add_prim(f"NeckFur_{k}", "SPHERE", "Body", col=14, metal=False,
                   loc=(math.cos(a) * 0.34, math.sin(a) * 0.30 + 0.02, 1.69), r1=0.115, segs=10)
    for k in range(14):
        a = k * (2 * math.pi / 14)
        b.add_prim(f"SkirtFur_{k}", "SPHERE", "Body", col=14, metal=False,
                   loc=(math.cos(a) * 0.42, math.sin(a) * 0.36, 0.70), r1=0.105, segs=10)

    # Ribbed bronze boiler helmet + 2 glowing ice eyes + vertical barred face
    b.add_bm("CryoHelm", make_lathe([(0, 1.68), (0.22, 1.70), (0.23, 1.96), (0.17, 2.10), (0, 2.14)], segs=20),
             "Head", col=1, metal=True)
    for sx in (-1, 1):
        b.add_prim(f"IceEye_{sx}", "SPHERE", "Head", glow="GlowIceCrystal", loc=(sx * 0.09, -0.215, 1.94), r1=0.042)
    b.add_bm("IceMouthPlate", make_box_bevel(0.24, 0.14, 0.13, 0.02), "Head", col=2, metal=True, loc=(0, -0.17, 1.78))

    # 2 tall bronze chimneys behind collar with frozen snow/ice rims
    for sx in (-1, 1):
        b.add_prim(f"CryoChim_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.28, 0.24, 2.02),
                   rot_deg=(12, sx * 12, 0), r1=0.085, r2=0.105, depth=0.46)
        b.add_prim(f"CryoChimIce_{sx}", "TORUS", "Body", col=14, metal=False, loc=(sx * 0.32, 0.29, 2.24),
                   rot_deg=(12, sx * 12, 0), r1=0.105, r2=0.042, segs=12)

    # Pauldrons (bronze + snow patch + lower fur rim), dark navy sleeves, fur gauntlet cuffs
    for sx, bone in ((-1, "ArmR"), (1, "ArmL")):
        b.add_bm(f"Pauld_{bone}", make_box_bevel(0.36, 0.40, 0.26, 0.06), bone, col=1, metal=True,
                 loc=(sx * 0.56, 0.0, 1.54), rot_deg=(0, sx * -20, 0))
        b.add_prim(f"SnowCap_{bone}", "SPHERE", bone, col=14, metal=False,
                   loc=(sx * 0.58, 0.0, 1.68), scale=(0.18, 0.16, 0.07), r1=1.0)
        b.add_prim(f"ArmSleeve_{bone}", "CYL", bone, col=15, metal=False, loc=(sx * 0.63, -0.02, 1.24), r1=0.125, r2=0.115, depth=0.34)
        for k in range(8):
            a = k * (2 * math.pi / 8)
            b.add_prim(f"WristFur_{bone}_{k}", "SPHERE", bone, col=14, metal=False,
                       loc=(sx * 0.64 + math.cos(a) * 0.135, -0.04 + math.sin(a) * 0.135, 1.05), r1=0.055, segs=8)
        b.add_prim(f"Gaunt_{bone}", "CYL", bone, col=1, metal=True, loc=(sx * 0.65, -0.09, 0.90), rot_deg=(24, 0, 0), r1=0.13, r2=0.115, depth=0.22)

    # RIGHT hand (-X): notched glowing translucent ICE CLEAVER GREATSWORD
    b.add_prim("SwHilt", "CYL", "ArmR", col=1, metal=True, loc=(-0.66, -0.18, 0.80), rot_deg=(84, 0, 0), r1=0.042, r2=0.042, depth=0.36)
    b.add_bm("SwGuard", make_box_bevel(0.18, 0.06, 0.22, 0.015), "ArmR", col=1, metal=True, loc=(-0.66, -0.34, 0.78))
    b.add_bm("IceBlade", make_cleaver_blade(length=0.86, width=0.26, thick=0.055, glow_edge=False),
             "ArmR", glow="GlowIceCrystal", loc=(-0.66, -0.36, 0.80), rot_deg=(16, -14, 18))

    # LEFT hand (+X): round Nordic bronze-rimmed buckler shield with 4 icy quadrants
    sh_loc = (0.76, -0.26, 0.96)
    sh_rot = (0, 90, -24)
    b.add_prim("RoundShRim", "CYL", "ArmL", col=1, metal=True, loc=sh_loc, rot_deg=sh_rot, r1=0.44, r2=0.44, depth=0.065, segs=24)
    b.add_prim("RoundShIce", "CYL", "ArmL", glow="GlowIceCrystal", loc=(0.74, -0.27, 0.96), rot_deg=sh_rot, r1=0.36, r2=0.36, depth=0.075, segs=24)
    b.add_prim("RoundShBoss", "SPHERE", "ArmL", col=3, metal=True, loc=(0.78, -0.28, 0.96), r1=0.12, segs=14)
    for ang_c in (0, 90):
        b.add_bm(f"RoundShCross_{ang_c}", make_box_bevel(0.05, 0.72, 0.075, 0.008), "ArmL", col=1, metal=True,
                 loc=(0.76, -0.27, 0.96), rot_deg=(ang_c, 0, -24))

    # Heavy bronze boots with snowy fur cuffs
    add_leg_biped(b, "R", "LegR", -0.29, 0.66, thigh_col=15, knee_col=1, shin_col=6, foot_col=1, thigh_metal=False, shin_metal=False, fur_cuff=True, leg_scale=1.82)
    add_leg_biped(b, "L", "LegL", 0.29, 0.66, thigh_col=15, knee_col=1, shin_col=6, foot_col=1, thigh_metal=False, shin_metal=False, fur_cuff=True, leg_scale=1.82)

    b.finalize_and_skin()
    b.bake_animations(
        lambda bs, f: biped_walk(bs, f, stride=0.30, bob=0.04, arm_swing=0.22),
        lambda bs, f: biped_attack(bs, f, strike_left=False),
    )
    b.export()


# ---------------------------------------------------------------------------
# 11. frost_warden — Slate-Blue Diver Knight + Copper Collar/Boots + Glowing Blue Porthole + Rune Knight Shield
# ---------------------------------------------------------------------------

def build_frost_warden():
    b = EnemyBuilder("enemy_frost_warden", target_height=1.28)
    b.add_bone("Body", (0, 0, 0.42), (0, 0, 0.94))
    b.add_bone("Head", (0, 0, 0.94), (0, 0, 1.28), parent="Body")
    b.add_bone("ArmR", (-0.33, 0, 0.84), (-0.34, 0, 0.46), parent="Body")
    b.add_bone("ArmL", (0.33, 0, 0.84), (0.34, 0, 0.46), parent="Body")
    b.add_bone("LegR", (-0.15, 0, 0.42), (-0.15, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.15, 0, 0.42), (0.15, 0, 0.0), parent="Body")

    # Slate-blue padded diver torso + broad copper riveted shoulder collar + copper belt
    b.add_prim("WardenTorso", "CYL", "Body", col=15, metal=False, loc=(0, 0, 0.68), r1=0.24, r2=0.26, depth=0.52)
    b.add_prim("CopperBelt", "CYL", "Body", col=0, metal=True, loc=(0, 0, 0.46), r1=0.255, r2=0.255, depth=0.08)
    b.add_bm("FrontFlap", make_box_bevel(0.14, 0.06, 0.14, 0.014), "Body", col=15, metal=False, loc=(0, -0.23, 0.48))
    b.add_bm("CopperGor", make_lathe([(0.16, 0.86), (0.29, 0.90), (0.25, 0.98), (0.17, 1.00)], segs=22),
             "Body", col=0, metal=True)
    b.add_rivets_ring("GorRiv", (0, 0, 0.91), 0.285, 10, "Body", col=1, rivet_r=0.013)

    # Frosted blue spherical diving helmet + protruding brass porthole with glowing ice glass + ear vents + twin exhaust pack
    b.add_prim("DivHelm", "SPHERE", "Head", col=16, metal=True, loc=(0, -0.02, 1.12), r1=0.21, segs=22)
    b.add_prim("PortholeRing", "CYL", "Head", col=1, metal=True, loc=(0, -0.20, 1.11), rot_deg=(90, 0, 0), r1=0.135, r2=0.125, depth=0.07)
    b.add_rivets_ring("PortRiv", (0, -0.235, 1.11), 0.115, 8, "Head", col=1, rivet_r=0.010, axis="y")
    b.add_prim("FrostGlass", "SPHERE", "Head", glow="GlowCyanTech", loc=(0, -0.22, 1.11), scale=(0.098, 0.045, 0.098), r1=1.0)
    for sx in (-1, 1):
        b.add_prim(f"EarVent_{sx}", "CYL", "Head", col=1, metal=True, loc=(sx * 0.20, -0.02, 1.11), rot_deg=(0, 90, 0), r1=0.06, r2=0.05, depth=0.04)

    # Back diving tank + 2 slanted brass exhaust pipes
    b.add_prim("BackTank", "CYL", "Body", col=15, metal=True, loc=(0, 0.25, 0.80), r1=0.13, r2=0.13, depth=0.34)
    for sx in (-1, 1):
        b.add_prim(f"Pipe_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.12, 0.27, 1.14),
                   rot_deg=(12, sx * 12, 0), r1=0.042, r2=0.048, depth=0.28)

    # Sleeves + copper bracers/gauntlets
    for sx, bone in ((-1, "ArmR"), (1, "ArmL")):
        b.add_prim(f"Upper_{bone}", "CYL", bone, col=15, metal=False, loc=(sx * 0.30, 0.0, 0.78), r1=0.08, r2=0.07, depth=0.22)
        b.add_prim(f"Gaunt_{bone}", "CYL", bone, col=0, metal=True, loc=(sx * 0.31, -0.06, 0.56), rot_deg=(18, 0, 0), r1=0.09, r2=0.075, depth=0.22)
        b.add_bm(f"Fist_{bone}", make_box_bevel(0.10, 0.10, 0.10, 0.024), bone, col=0, metal=True, loc=(sx * 0.31, -0.12, 0.43))

    # Tall slate-steel Rune Shield on LEFT arm (+X) with central ice core & 4 cyan carved rune sigils
    sh_loc = (0.39, -0.26, 0.54)
    sh_rot = (6, 0, 26)
    b.add_bm("WardenShRim", make_shield_plate(w=0.52, h=0.72, depth=0.060, pointed=True), "ArmL", col=3, metal=True, loc=sh_loc, rot_deg=sh_rot)
    b.add_bm("WardenShFace", make_shield_plate(w=0.43, h=0.63, depth=0.078, pointed=True), "ArmL", col=16, metal=True, loc=sh_loc, rot_deg=sh_rot)
    # Cross ribs + central ice crystal boss + 4 glowing cyan rune bars
    dx = math.cos(math.radians(26)); dy = -math.sin(math.radians(26))
    b.add_prim("ShCenterIce", "SPHERE", "ArmL", glow="GlowCyanTech", loc=(0.39, -0.31, 0.55), scale=(0.07, 0.045, 0.07), r1=1.0)
    b.add_prim("ShCenterRim", "CYL", "ArmL", col=1, metal=True, loc=(0.39, -0.295, 0.55), rot_deg=(90, 0, 26), r1=0.088, r2=0.088, depth=0.04)
    for rx, rz in ((-0.10, 0.14), (0.10, 0.14), (-0.08, -0.14), (0.08, -0.14)):
        b.add_bm(f"Rune_{rx:.2f}_{rz:.2f}", make_box_bevel(0.036, 0.03, 0.095, 0.005), "ArmL", glow="GlowCyanTech",
                 loc=(0.39 + dx * rx, -0.31 + dy * rx, 0.55 + rz), rot_deg=(6, 14 if rz > 0 else -14, 26))

    add_leg_biped(b, "R", "LegR", -0.145, 0.38, thigh_col=15, knee_col=0, shin_col=0, foot_col=0, thigh_metal=False, shin_metal=True)
    add_leg_biped(b, "L", "LegL", 0.145, 0.38, thigh_col=15, knee_col=0, shin_col=0, foot_col=0, thigh_metal=False, shin_metal=True)

    b.finalize_and_skin()
    b.bake_animations(
        lambda bs, f: biped_walk(bs, f, stride=0.35, bob=0.035, arm_swing=0.25),
        lambda bs, f: biped_attack(bs, f, strike_left=False),
    )
    b.export()


# ---------------------------------------------------------------------------
# 12. ember_bomber — Olive-Green Clockwork Goblin + Brass Prosthetic Limbs + Wooden Gunpowder Keg + Sparkling Fuse
# ---------------------------------------------------------------------------

def build_ember_bomber():
    b = EnemyBuilder("enemy_ember_bomber", target_height=1.08)
    b.add_bone("Body", (0, 0, 0.36), (0, -0.06, 0.72))
    b.add_bone("Head", (0, -0.10, 0.70), (0, -0.16, 0.98), parent="Body")
    b.add_bone("ArmR", (-0.20, -0.04, 0.66), (-0.22, -0.12, 0.40), parent="Body")
    b.add_bone("ArmL", (0.20, -0.04, 0.66), (0.22, -0.12, 0.40), parent="Body")
    b.add_bone("LegR", (-0.12, 0, 0.36), (-0.12, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.12, 0, 0.36), (0.12, 0, 0.0), parent="Body")
    b.add_bone("SpinBone_Fast_Spark", (0.04, 0.24, 1.24), (0.04, 0.24, 1.44), parent="Body")

    # Hunched forward-leaning goblin torso + brown leather chest straps & round brass buckle + coal trousers
    b.add_prim("GobTorso", "CYL", "Body", col=17, metal=False, loc=(0, -0.06, 0.56), rot_deg=(24, 0, 0), r1=0.15, r2=0.13, depth=0.36)
    b.add_prim("Pelvis", "SPHERE", "Body", col=20, metal=False, loc=(0, 0.01, 0.39), scale=(0.18, 0.15, 0.12), r1=1.0)
    for sx in (-1, 1):
        b.add_bm(f"Harness_{sx}", make_box_bevel(0.055, 0.28, 0.34, 0.01), "Body", col=6, metal=False,
                 loc=(sx * 0.085, -0.065, 0.56), rot_deg=(24, sx * -10, 0))
    b.add_prim("GobBelt", "CYL", "Body", col=6, metal=False, loc=(0, -0.02, 0.43), rot_deg=(16, 0, 0), r1=0.175, r2=0.17, depth=0.068)
    b.add_prim("BeltBuckle", "CYL", "Body", col=22, metal=True, loc=(0, -0.19, 0.43), rot_deg=(90, 0, 0), r1=0.058, r2=0.052, depth=0.032)

    # Organic sculpted green goblin head (bigger expressive caricature) + hooked nose + pointy ears + glowing eyes
    gob_els = [
        {"co": (0, -0.15, 0.80), "r": 0.185, "sx": 1.08, "sy": 1.12, "sz": 0.94},
        {"co": (-0.08, -0.27, 0.78), "r": 0.08, "sx": 1.0, "sy": 1.0, "sz": 0.9},
        {"co": (0.08, -0.27, 0.78), "r": 0.08, "sx": 1.0, "sy": 1.0, "sz": 0.9},
        {"co": (0, -0.29, 0.71), "r": 0.09, "sx": 1.18, "sy": 1.0, "sz": 0.78},
    ]
    b.add_metaball("GobHead", gob_els, "Head", col=17, metal=False, smooth_iter=4, res=0.024)
    b.add_prim("GobNose", "CYL", "Head", col=17, metal=False, loc=(0, -0.39, 0.78), rot_deg=(-108, 0, 0), r1=0.045, r2=0.012, depth=0.15)
    for sx in (-1, 1):
        b.add_prim(f"GobEar_{sx}", "CYL", "Head", col=17, metal=False, loc=(sx * 0.25, -0.11, 0.85),
                   rot_deg=(0, sx * 76, sx * -18), r1=0.062, r2=0.008, depth=0.25)
        b.add_prim(f"GobEye_{sx}", "SPHERE", "Head", glow="GlowAmberEye", loc=(sx * 0.075, -0.315, 0.82), r1=0.042, segs=12)
        b.add_prim(f"GobPupil_{sx}", "SPHERE", "Head", glow="MatEyeDark", loc=(sx * 0.078, -0.352, 0.82), r1=0.016, segs=8)
    for tx in (-0.05, 0.0, 0.05):
        b.add_prim(f"GobTooth_{tx:.2f}", "CYL", "Head", col=18, metal=False, loc=(tx, -0.325, 0.72), r1=0.016, r2=0.004, depth=0.036, segs=4)

    # Continuous articulated brass prosthetic arms (zero segment gaps) + gauntlets
    for sx, bone in ((-1, "ArmR"), (1, "ArmL")):
        b.add_prim(f"GobSh_{bone}", "SPHERE", bone, col=1, metal=True, loc=(sx * 0.20, -0.07, 0.66), r1=0.072)
        b.add_bm(f"GobLimb_{bone}", make_tube([
            (sx * 0.20, -0.07, 0.66),
            (sx * 0.26, -0.10, 0.52),
            (sx * 0.24, -0.22, 0.44),
        ], [0.055, 0.048, 0.055], segs=10), bone, col=1, metal=True)
        b.add_bm(f"GobFist_{bone}", make_box_bevel(0.095, 0.095, 0.095, 0.025), bone, col=1, metal=True, loc=(sx * 0.24, -0.24, 0.44))

    # Giant wooden gunpowder barrel strapped diagonally behind goblin shoulders + crisp orange ember cap + spark
    keg_loc = (0.02, 0.16, 0.86)
    keg_rot = (-30, 8, 0)
    keg_prof = [(0, -0.24), (0.155, -0.24), (0.205, -0.11), (0.22, 0.0), (0.205, 0.11), (0.155, 0.24), (0, 0.24)]
    b.add_bm("PowderKeg", make_lathe(keg_prof, segs=18), "Body", col=5, metal=False, loc=keg_loc, rot_deg=keg_rot)
    for ho_off in (-0.13, 0.13):
        m_ho = Matrix.Translation(keg_loc) @ Euler(tuple(math.radians(a) for a in keg_rot), "XYZ").to_matrix().to_4x4() @ Matrix.Translation((0, 0, ho_off))
        b.add_prim(f"KegHoop_{ho_off}", "CYL", "Body", col=20, metal=True, loc=m_ho.translation, rot_deg=keg_rot, r1=0.208, r2=0.208, depth=0.038, segs=18)
    m_top = Matrix.Translation(keg_loc) @ Euler(tuple(math.radians(a) for a in keg_rot), "XYZ").to_matrix().to_4x4() @ Matrix.Translation((0, 0, 0.24))
    b.add_prim("KegEmberTop", "CYL", "Body", glow="GlowForgeOrange", loc=m_top.translation, rot_deg=keg_rot, r1=0.095, r2=0.095, depth=0.025, segs=16)
    fuse_top = m_top.translation + Vector((0.02, 0.04, 0.16))
    b.add_bm("FuseCord", make_tube([m_top.translation, m_top.translation + Vector((0.03, 0.02, 0.09)), fuse_top], 0.018, segs=6),
             "Body", col=18, metal=False)
    b.add_bm("RopeLoop", make_tube([(-0.18, 0.10, 0.72), (-0.14, 0.28, 0.86), (0.14, 0.26, 0.90), (0.18, 0.08, 0.72)], 0.022, segs=6),
             "Body", col=18, metal=False)
    # Starburst spark at fuse tip (recenter SpinBone_Fast_Spark at fuse_top!)
    b.bones_spec = [
        (nm, fuse_top if nm == "SpinBone_Fast_Spark" else hd,
         fuse_top + Vector((0, 0, 0.20)) if nm == "SpinBone_Fast_Spark" else tl, pr)
        for nm, hd, tl, pr in b.bones_spec
    ]
    for rx, ry, rz in ((0, 0, 0), (45, 45, 0), (90, 0, 45), (0, 90, 45)):
        b.add_prim(f"Spark_{rx}_{ry}", "CYL", "SpinBone_Fast_Spark", glow="GlowForgeOrange",
                   loc=fuse_top, rot_deg=(rx, ry, rz), r1=0.018, r2=0.004, depth=0.18, segs=6)

    # Dark pants legs + brass mechanical boots
    add_leg_biped(b, "R", "LegR", -0.115, 0.34, thigh_col=20, knee_col=1, shin_col=20, foot_col=1, thigh_metal=False, shin_metal=False)
    add_leg_biped(b, "L", "LegL", 0.115, 0.34, thigh_col=20, knee_col=1, shin_col=20, foot_col=1, thigh_metal=False, shin_metal=False)

    b.finalize_and_skin()
    b.bake_animations(
        lambda bs, f: biped_walk(bs, f, stride=0.58, bob=0.06, arm_swing=0.55),
        lambda bs, f: biped_attack(bs, f, both_arms=True),
    )
    b.export()


# ---------------------------------------------------------------------------
# 13. tesla_strider — Riveted Golden Brass Dome Crab + 4 Glowing Cyan Vacuum Tubes + Coils + 2 Pincer Claws + 6 Legs
# ---------------------------------------------------------------------------

def build_tesla_strider():
    b = EnemyBuilder("enemy_tesla_strider", target_height=0.96)
    b.add_bone("Body", (0, 0, 0.34), (0, 0, 0.68))
    b.add_bone("ClawL", (0.24, -0.20, 0.30), (0.34, -0.44, 0.28), parent="Body")
    b.add_bone("ClawR", (-0.24, -0.20, 0.30), (-0.34, -0.44, 0.28), parent="Body")
    b.add_bone("SpinBone_Med_Arc", (0, 0.02, 0.84), (0, 0.02, 1.04), parent="Body")
    legs_l, legs_r = [], []
    for idx, ly in enumerate((-0.08, 0.08, 0.24)):
        ln = f"LegL{idx+1}"; rn = f"LegR{idx+1}"
        b.add_bone(ln, (0.24, ly, 0.28), (0.40, ly, 0.0), parent="Body")
        b.add_bone(rn, (-0.24, ly, 0.28), (-0.40, ly, 0.0), parent="Body")
        legs_l.append(ln); legs_r.append(rn)

    # Squat dome riveted brass crab carapace + dark brow recess + glowing cyan eyes
    crab_prof = [(0, 0.20), (0.28, 0.21), (0.34, 0.28), (0.33, 0.38), (0.25, 0.49), (0.14, 0.56), (0, 0.58)]
    b.add_bm("CrabShell", make_lathe(crab_prof, segs=24), "Body", col=1, metal=True, scale=(1.12, 1.0, 1.0))
    b.add_prim("EquatRim", "TORUS", "Body", col=2, metal=True, loc=(0, 0, 0.30), scale=(1.12, 1.0, 1.0), r1=0.345, r2=0.026, segs=24)
    b.add_rivets_ring("ShellRiv", (0, 0, 0.41), 0.325, 14, "Body", col=1, rivet_r=0.015)
    b.add_bm("BrowRecess", make_box_bevel(0.28, 0.10, 0.095, 0.02), "Body", glow="MatEyeDark", loc=(0, -0.30, 0.29))
    for sx in (-1, 1):
        b.add_prim(f"CrabEye_{sx}", "SPHERE", "Body", glow="GlowCyanTech", loc=(sx * 0.075, -0.34, 0.295), r1=0.036, segs=12)

    # 4 splayed glowing cyan Tesla vacuum glass bulbs sprouting from upper carapace
    tubes = [
        ((-0.24, 0.02, 0.56), (0, 28, 0)),
        ((-0.11, 0.08, 0.62), (-10, 14, 0)),
        ((0.11, 0.08, 0.62), (-10, -14, 0)),
        ((0.24, 0.02, 0.56), (0, -28, 0)),
    ]
    for idx, (tloc, trot) in enumerate(tubes):
        b.add_prim(f"TubeBase_{idx}", "CYL", "Body", col=0, metal=True, loc=tloc, rot_deg=trot, r1=0.048, r2=0.045, depth=0.08, segs=12)
        m_glass = Matrix.Translation(tloc) @ Euler(tuple(math.radians(a) for a in trot), "XYZ").to_matrix().to_4x4()
        p_g = (m_glass @ Vector((0, 0, 0.11)))
        p_t = (m_glass @ Vector((0, 0, 0.22)))
        b.add_prim(f"TubeBulb_{idx}", "CYL", "Body", glow="GlowCyanTech", loc=p_g, rot_deg=trot, r1=0.038, r2=0.034, depth=0.16, segs=12)
        b.add_prim(f"TubeCap_{idx}", "SPHERE", "Body", col=0, metal=True, loc=p_t, rot_deg=trot, r1=0.034, segs=10)

    # 2 copper Tesla antenna coils + crackling cyan electric arc crown rotating on SpinBone_Med_Arc
    for sx in (-1, 1):
        b.add_prim(f"CoilSpire_{sx}", "CYL", "Body", col=0, metal=True, loc=(sx * 0.06, -0.04, 0.68),
                   rot_deg=(0, sx * 8, 0), r1=0.024, r2=0.010, depth=0.28)
        b.add_prim(f"CoilRing_{sx}", "TORUS", "Body", col=1, metal=True, loc=(sx * 0.068, -0.04, 0.74), r1=0.045, r2=0.012)
    b.add_bm("SparkArc1", make_tube([(-0.18, 0.02, 0.78), (-0.08, -0.04, 0.88), (0.04, 0.04, 0.82), (0.18, -0.02, 0.88)], 0.014, segs=6),
             "SpinBone_Med_Arc", glow="GlowCyanTech")
    b.add_bm("SparkArc2", make_tube([(0.0, -0.14, 0.80), (-0.06, 0.0, 0.90), (0.06, 0.12, 0.82)], 0.012, segs=6),
             "SpinBone_Med_Arc", glow="GlowCyanTech")

    # 2 chunky riveted brass crab pincer claws forward-curved (-Y)
    for sx, bone in ((1, "ClawL"), (-1, "ClawR")):
        b.add_bm(f"ClawArm_{bone}", make_tube([(sx * 0.24, -0.22, 0.28), (sx * 0.34, -0.35, 0.24), (sx * 0.25, -0.46, 0.22)], 0.068, segs=10),
                 bone, col=1, metal=True)
        b.add_prim(f"ClawBulb_{bone}", "SPHERE", bone, col=1, metal=True, loc=(sx * 0.22, -0.47, 0.22), scale=(0.105, 0.135, 0.09), r1=1.0)
        b.add_prim(f"PincerOut_{bone}", "CYL", bone, col=2, metal=True, loc=(sx * 0.26, -0.60, 0.23), rot_deg=(84, 0, sx * 26), r1=0.045, r2=0.008, depth=0.16)
        b.add_prim(f"PincerIn_{bone}", "CYL", bone, col=2, metal=True, loc=(sx * 0.17, -0.60, 0.21), rot_deg=(88, 0, sx * -20), r1=0.038, r2=0.008, depth=0.15)

    # 6 stout arched brass crab legs touching z=0
    for idx, ly in enumerate((-0.08, 0.08, 0.24)):
        yaw = (0.28 - idx * 0.35)
        for sx, bone in ((1, legs_l[idx]), (-1, legs_r[idx])):
            b.add_bm(f"CrabLeg_{bone}", make_tube([
                (sx * 0.24, ly, 0.28),
                (sx * 0.40, ly - yaw * 0.12, 0.32),
                (sx * 0.45, ly - yaw * 0.24, 0.16),
                (sx * 0.39, ly - yaw * 0.26, 0.0),
            ], [0.056, 0.048, 0.036, 0.018], segs=8), bone, col=1, metal=True)

    b.finalize_and_skin()
    b.bake_animations(
        insect_walk(legs_l, legs_r, stride=0.35, lift=0.16),
        lambda bs, f: [
            bs["ClawL"].__setattr__("rotation_euler", (0, 0, -0.35 if f == 11 else 0.0)),
            bs["ClawR"].__setattr__("rotation_euler", (0, 0, 0.35 if f == 11 else 0.0)),
        ],
    )
    b.export()


# ---------------------------------------------------------------------------
# 14. magma_overlord (FINAL BOSS) — Sooty Blast-Furnace Iron + Open Lava Crown + Teeth Maw + 4 Chimneys + Dual Glowing Cleavers
# ---------------------------------------------------------------------------

def build_magma_overlord():
    b = EnemyBuilder("enemy_magma_overlord", target_height=2.36)
    b.add_bone("Body", (0, 0, 0.72), (0, 0, 1.72))
    b.add_bone("Head", (0, 0, 1.72), (0, 0, 2.08), parent="Body")
    b.add_bone("ArmR", (-0.64, 0, 1.54), (-0.70, 0, 0.86), parent="Body")
    b.add_bone("ArmL", (0.64, 0, 1.54), (0.70, 0, 0.86), parent="Body")
    b.add_bone("LegR", (-0.27, 0, 0.72), (-0.27, 0, 0.0), parent="Body")
    b.add_bone("LegL", (0.27, 0, 0.72), (0.27, 0, 0.0), parent="Body")

    # Sooty dark iron barrel hull + brass riveted collar & waist trim + blazing 5-slit arched belly furnace grate
    prof = [(0, 0.68), (0.37, 0.70), (0.48, 1.04), (0.50, 1.48), (0.40, 1.74), (0, 1.74)]
    b.add_bm("FurnaceBody", make_lathe(prof, segs=24), "Body", col=19, metal=True)
    b.add_prim("MagCollar", "TORUS", "Body", col=1, metal=True, loc=(0, 0, 1.66), r1=0.39, r2=0.055, segs=22)
    b.add_prim("MagWaist", "CYL", "Body", col=1, metal=True, loc=(0, 0, 0.74), r1=0.40, r2=0.42, depth=0.10)
    # Belly grate protruding brass bars over bright orange furnace core
    b.add_bm("BellyBackBox", make_box_bevel(0.38, 0.10, 0.34, 0.025), "Body", col=1, metal=True, loc=(0, -0.43, 1.04))
    b.add_bm("BellyFirePlane", make_box_bevel(0.30, 0.06, 0.26, 0.01), "Body", glow="GlowForgeOrange", loc=(0, -0.465, 1.04))
    for kx in (-0.11, -0.055, 0.0, 0.055, 0.11):
        b.add_bm(f"MagBar_{kx:.2f}", make_box_bevel(0.024, 0.04, 0.28, 0.004), "Body", col=1, metal=True, loc=(kx, -0.495, 1.04))

    # Open-top blast-furnace cone head with bubbling orange magma pool + scowling fiery triangular eyes + toothed furnace maw!
    head_prof = [(0, 1.68), (0.30, 1.70), (0.28, 1.94), (0.23, 2.12), (0, 2.12)]
    b.add_bm("FurnaceHead", make_lathe(head_prof, segs=20), "Head", col=19, metal=True)
    b.add_prim("HeadTopRim", "TORUS", "Head", col=19, metal=True, loc=(0, 0, 2.12), r1=0.22, r2=0.042, segs=20)
    b.add_prim("LavaCrownPool", "CYL", "Head", glow="GlowForgeOrange", loc=(0, 0, 2.125), r1=0.19, r2=0.19, depth=0.03, segs=18)
    for sx in (-1, 1):
        b.add_bm(f"MagEye_{sx}", make_box_bevel(0.085, 0.05, 0.052, 0.008), "Head", glow="GlowForgeOrange",
                 loc=(sx * 0.115, -0.25, 1.94), rot_deg=(0, sx * 18, sx * -10))
    b.add_bm("FurnaceMawGlow", make_box_bevel(0.28, 0.08, 0.13, 0.014), "Head", glow="GlowForgeOrange", loc=(0, -0.255, 1.80))
    for tx in (-0.10, -0.04, 0.02, 0.08):
        b.add_prim(f"MawToothU_{tx:.2f}", "CYL", "Head", col=19, metal=True, loc=(tx, -0.29, 1.855), rot_deg=(180, 0, 0), r1=0.026, r2=0.004, depth=0.055, segs=4)
        b.add_prim(f"MawToothD_{tx:.2f}", "CYL", "Head", col=19, metal=True, loc=(tx + 0.02, -0.29, 1.755), r1=0.026, r2=0.004, depth=0.055, segs=4)

    # 2 TALL rear perforated brass smokestacks rising cleanly to 2.36 m
    for sx in (-1, 1):
        b.add_prim(f"TallChim_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.24, 0.25, 2.14),
                   rot_deg=(10, sx * 6, 0), r1=0.082, r2=0.072, depth=0.46)
        b.add_prim(f"TallChimLip_{sx}", "CYL", "Body", col=1, metal=True, loc=(sx * 0.25, 0.28, 2.35),
                   rot_deg=(10, sx * 6, 0), r1=0.076, r2=0.098, depth=0.05)

    # Giant brass pauldrons each with a SHORT slanted brass shoulder exhaust stack (= 4 chimneys total!) + dual glowing cleaver axes
    for sx, bone in ((-1, "ArmR"), (1, "ArmL")):
        b.add_bm(f"Pauld_{bone}", make_box_bevel(0.36, 0.40, 0.28, 0.06), bone, col=1, metal=True,
                 loc=(sx * 0.56, 0.0, 1.54), rot_deg=(0, sx * -20, 0))
        b.add_prim(f"ShChim_{bone}", "CYL", bone, col=1, metal=True, loc=(sx * 0.58, 0.05, 1.78),
                   rot_deg=(8, sx * 30, 0), r1=0.068, r2=0.086, depth=0.28)
        b.add_prim(f"ArmUp_{bone}", "CYL", bone, col=19, metal=True, loc=(sx * 0.62, -0.02, 1.24), r1=0.125, r2=0.115, depth=0.34)
        b.add_prim(f"Wrist_{bone}", "CYL", bone, col=1, metal=True, loc=(sx * 0.64, -0.08, 1.02), rot_deg=(24, 0, 0), r1=0.13, r2=0.12, depth=0.22)
        b.add_bm(f"Fist_{bone}", make_box_bevel(0.16, 0.16, 0.16, 0.03), bone, col=19, metal=True, loc=(sx * 0.65, -0.14, 0.88))

        # Dual heavy butcher cleaver battleaxes splayed slightly outward with glowing molten edge!
        axe_rot = (14, sx * 12, sx * -18)
        b.add_prim(f"AxeHaft_{bone}", "CYL", bone, col=5, metal=False, loc=(sx * 0.68, -0.22, 0.86), rot_deg=(80, 0, sx * -18), r1=0.046, r2=0.046, depth=0.58)
        b.add_bm(f"AxeIron_{bone}", make_cleaver_blade(length=0.68, width=0.28, thick=0.048, glow_edge=False),
                 bone, col=19, metal=True, loc=(sx * 0.72, -0.34, 0.86), rot_deg=axe_rot)
        b.add_bm(f"AxeLavaEdge_{bone}", make_cleaver_blade(length=0.68, width=0.28, thick=0.048, glow_edge=True),
                 bone, glow="GlowForgeOrange", loc=(sx * 0.72, -0.34, 0.86), rot_deg=axe_rot)

    add_leg_biped(b, "R", "LegR", -0.29, 0.66, thigh_col=19, knee_col=1, shin_col=19, foot_col=1, leg_scale=1.82)
    add_leg_biped(b, "L", "LegL", 0.29, 0.66, thigh_col=19, knee_col=1, shin_col=19, foot_col=1, leg_scale=1.82)

    b.finalize_and_skin()
    b.bake_animations(
        lambda bs, f: biped_walk(bs, f, stride=0.32, bob=0.04, arm_swing=0.26),
        lambda bs, f: biped_attack(bs, f, both_arms=True),
    )
    b.export()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

BUILDERS = {
    "scout_bot": build_scout_bot,
    "swarm_saw": build_swarm_saw,
    "shield_loader": build_shield_loader,
    "hover_drone": build_hover_drone,
    "mega_harvester": build_mega_harvester,
    "turbo_hopper": build_turbo_hopper,
    "chomp_brute": build_chomp_brute,
    "repair_drone": build_repair_drone,
    "crystal_golem": build_crystal_golem,
    "cryo_colossus": build_cryo_colossus,
    "frost_warden": build_frost_warden,
    "ember_bomber": build_ember_bomber,
    "tesla_strider": build_tesla_strider,
    "magma_overlord": build_magma_overlord,
}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    want = [a.replace("enemy_", "") for a in args if not a.startswith("--")]
    targets = want if want else list(BUILDERS.keys())
    for eid in targets:
        if eid not in BUILDERS:
            raise KeyError(f"Unknown enemy id: {eid}")
        BUILDERS[eid]()
    print(f"BUILT {len(targets)} OPTION-2 ENEMIES SUCCESSFULLY")


if __name__ == "__main__":
    main()
