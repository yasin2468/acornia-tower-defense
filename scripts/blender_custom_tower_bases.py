"""Palamut Kalesi — Headless Blender 5.2 builder for 8 Selected Custom Tower Bases.

Builds bespoke, G1 single-mesh + single-material architectural tower bases for all 8 heroes:
  1. squirrel -> Option 1: Great Oak Hollow (Ulu Mese Kovugu)
  2. beaver   -> Option 2: Resin Cauldron Workshop (Recine Kazan Atolyesi)
  3. owl      -> Option 1: Moonlight Tree Library (Ayisigi Agac Kutuphanesi)
  4. hedgehog -> Option 1: Bramble Thorn & Rock Bastion (Dikenli Kaya Siperi)
  5. badger   -> Option 1: Luminous Mushroom Tower (Fosforlu Mantar Kulesi - Rakun)
  6. falcon   -> Option 2: Gothic Bell & Lantern Watchtower (Gotik Can & Fener - Kuzgun)
  7. tortoise -> Option 1: Mine Shaft & Timber Bastion (Maden Tuneli Istihkami - Kostebek)
  8. lynx     -> Option 3: Sapphire Glacier Crystal Spire (Safir Buzul Kristali - Kakim)

All coordinates are Blender Z-up with front facade facing -Y (Three.js +Z), min Z = 0.000,
footprint kept strictly inside [-0.61..+0.61] for env_slot_pad, and open top deck
at deck_z = {1: 1.12, 2: 1.34, 3: 1.50}[tier] with perimeter <= deck_z + 0.12 so
TurretHead rotates freely 360 deg.
"""

import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

CACHE_DIR = "/tmp/palamut_cc0/_derived_custom_towers"
DIFFUSE_ATLAS = os.path.join(CACHE_DIR, "custom_towers_diffuse.png")
EMISSIVE_ATLAS = os.path.join(CACHE_DIR, "custom_towers_emissive.png")
os.makedirs(CACHE_DIR, exist_ok=True)

# (dark_hex, light_hex, optional_emissive_hex_or_None)
SWATCHES = [
    ("#2d5922", "#73ad40", None),       # 0: Forest moss green
    ("#387028", "#84bf48", None),       # 1: Grass turf cushion
    ("#1b4d1d", "#48a33a", None),       # 2: Deep ivy vine / leaves
    ("#3d591e", "#80a63a", None),       # 3: Olive bramble vine
    ("#3b2313", "#784b29", None),       # 4: Ancient oak bark & roots
    ("#6e748a", "#b8bfd1", None),       # 5: Silver-lavender moonlight tree bark
    ("#59341b", "#ab6c38", None),       # 6: Warm craftsman oak timber
    ("#2b1a10", "#5c3b24", None),       # 7: Dark walnut / mine shoring timber
    ("#6e4826", "#cc9454", None),       # 8: Sharpened light oak stake
    ("#525c57", "#8b968e", None),       # 9: Mossy cobblestone / forest stone
    ("#444b54", "#808b99", None),       # 10: Craggy grey quarry stone
    ("#78311f", "#c7603c", None),       # 11: Warm workshop brick
    ("#242a3b", "#4b5773", None),       # 12: Dark gothic slate masonry
    ("#5e1b24", "#ab3542", None),       # 13: Gothic crimson terracotta brick
    ("#523823", "#966c44", None),       # 14: Mine packed earth / rock clay
    ("#1d2129", "#495261", None),       # 15: Wrought black iron / rails
    ("#3b4452", "#788699", None),       # 16: Riveted gunmetal steel
    ("#8c4123", "#de7c4c", None),       # 17: Brushed copper pipes
    ("#9e6e18", "#f2c44d", None),       # 18: Polished brass trim
    ("#ad7114", "#ffe061", "#6e4608"),  # 19: Radiant gold bell / crest
    ("#c77510", "#ffe45e", "#ffa820"),  # 20: Golden acorn lantern glow
    ("#b84b0d", "#ffbe3b", "#ff8414"),  # 21: Amber resin cauldron / barrel glow
    ("#1466cc", "#7ae4ff", "#2bb2ff"),  # 22: Sapphire stained glass / moonlight
    ("#0ca6b8", "#9cfaff", "#2ee8ff"),  # 23: Cyan frost rune / glacier glow
    ("#198f3f", "#66f770", "#2cd452"),  # 24: Phosphorescent green mushroom cap
    ("#b33610", "#ffb038", "#ff6614"),  # 25: Inferno orange-amber mushroom cap
    ("#c96912", "#ffdd5c", "#ff9d22"),  # 26: Warm gothic / mine lantern glow
    ("#0c8c58", "#4effb0", "#24e08a"),  # 27: Emerald alchemist glass / rune
    ("#144ca6", "#66c7ff", "#1c7ae0"),  # 28: Sapphire glacier crystal core
    ("#8eb8db", "#eef9ff", None),       # 29: Frosted alpine ice plinth / snow
    ("#5d28a6", "#d48aff", "#8a42f5"),  # 30: Aurora amethyst-violet crystal
    ("#b8a78c", "#f7ecd7", None),       # 31: Ivory parchment / mushroom stem
    ("#0a0b0f", "#171b24", None),       # 32: Deep mine tunnel interior void
    ("#731922", "#cc3b47", None),       # 33: Tome ruby leather
    ("#155939", "#3cb87a", None),       # 34: Tome emerald leather
    ("#b36812", "#ffcf47", "#ff991a"),  # 35: Golden mine ore crystal
    ("#c7c3ba", "#ffffff", None),       # 36: Ivory target ring / trim
    ("#89cf7a", "#e8ffde", "#4ec758"),  # 37: Glowing mushroom spots
    ("#942126", "#eb4446", None),       # 38: Crimson target ring
    ("#1d458a", "#3d80e0", None),       # 39: Cobalt target ring
]


def _hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def ensure_custom_tower_atlases():
    cols = len(SWATCHES)
    cw, h = 32, 256
    w = cols * cw
    px_diff = np.zeros((h, w, 4), dtype=np.float32)
    px_diff[..., 3] = 1.0
    px_emit = np.zeros((h, w, 4), dtype=np.float32)
    px_emit[..., 3] = 1.0

    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    for idx, (dk_h, lt_h, em_h) in enumerate(SWATCHES):
        dk = np.array(_hex_rgb(dk_h), dtype=np.float32)
        lt = np.array(_hex_rgb(lt_h), dtype=np.float32)
        grad = dk[None, None, :] + (t ** 0.88) * (lt - dk)[None, None, :]
        px_diff[:, idx * cw:(idx + 1) * cw, :3] = np.clip(grad, 0.0, 1.0)
        if em_h:
            em = np.array(_hex_rgb(em_h), dtype=np.float32)
            px_emit[:, idx * cw:(idx + 1) * cw, :3] = np.clip(em * (0.68 + 0.32 * t), 0.0, 1.0)

    for path, px in ((DIFFUSE_ATLAS, px_diff), (EMISSIVE_ATLAS, px_emit)):
        name = os.path.basename(path)
        if name in bpy.data.images:
            bpy.data.images.remove(bpy.data.images[name])
        img = bpy.data.images.new(name, w, h, alpha=True)
        img.pixels = px.ravel().tolist()
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
        bpy.data.images.remove(img)


def get_custom_tower_mat():
    mat_name = "CustomTowerAtlasMat"
    mat = bpy.data.materials.get(mat_name)
    if mat:
        return mat
    ensure_custom_tower_atlases()
    mat = bpy.data.materials.new(mat_name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")

    tex_d = nt.nodes.new("ShaderNodeTexImage")
    tex_d.image = bpy.data.images.load(DIFFUSE_ATLAS, check_existing=True)
    tex_d.image.colorspace_settings.name = "sRGB"
    tex_d.extension = "EXTEND"
    nt.links.new(tex_d.outputs["Color"], bsdf.inputs["Base Color"])

    tex_e = nt.nodes.new("ShaderNodeTexImage")
    tex_e.image = bpy.data.images.load(EMISSIVE_ATLAS, check_existing=True)
    tex_e.image.colorspace_settings.name = "sRGB"
    tex_e.extension = "EXTEND"
    nt.links.new(tex_e.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.45

    bsdf.inputs["Roughness"].default_value = 0.68
    bsdf.inputs["Metallic"].default_value = 0.10
    return mat


def _bm_box(sx: float, sy: float, sz: float, bevel: float = 0.015):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if bevel > 0 and min(sx, sy, sz) > bevel * 2.6:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES")
    return bm


def _bm_cyl(r1: float, r2: float, h: float, segs: int = 12):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=h)
    return bm


def _bm_sphere(r: float, sx: float = 1.0, sy: float = 1.0, sz: float = 1.0, segs: int = 12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(8, segs - 2), radius=r)
    if sx != 1.0 or sy != 1.0 or sz != 1.0:
        bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return bm


def _bm_gable(w: float, d: float, h: float):
    bm = bmesh.new()
    hw, hd = w * 0.5, d * 0.5
    v = [
        bm.verts.new((-hw, -hd, 0.0)),
        bm.verts.new((hw, -hd, 0.0)),
        bm.verts.new((hw, hd, 0.0)),
        bm.verts.new((-hw, hd, 0.0)),
        bm.verts.new((0.0, -hd, h)),
        bm.verts.new((0.0, hd, h)),
    ]
    bm.faces.new((v[0], v[3], v[2], v[1]))
    bm.faces.new((v[0], v[1], v[4]))
    bm.faces.new((v[2], v[3], v[5]))
    bm.faces.new((v[1], v[2], v[5], v[4]))
    bm.faces.new((v[3], v[0], v[4], v[5]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def _bm_lathe(profile_rz, segs: int = 14):
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
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def _bm_tube(pts, radii, segs: int = 7):
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
        up = Vector((0, 1, 0)) if abs(t.dot(Vector((0, 1, 0)))) < 0.92 else Vector((1, 0, 0))
        n = t.cross(up).normalized()
        if i > 0 and n.dot(prev_n) < 0:
            n = -n
        prev_n = n
        b = t.cross(n).normalized()
        rad = radii[i]
        rings.append([
            bm.verts.new(p + n * (math.cos(j * 2 * math.pi / segs) * rad) + b * (math.sin(j * 2 * math.pi / segs) * rad))
            for j in range(segs)
        ])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for j in range(segs):
            nj = (j + 1) % segs
            bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def _bm_crystal(r: float, h: float, segs: int = 6):
    return _bm_lathe([(0.0, 0.0), (r, 0.0), (r * 0.78, h * 0.65), (0.0, h)], segs=segs)


def _apply_uvs(obj, col_idx: int, solid: bool = False):
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    u = (col_idx + 0.5) / len(SWATCHES)
    zs = [v.co.z for v in me.vertices]
    lo, hi = (min(zs), max(zs)) if zs else (0.0, 1.0)
    span = max(hi - lo, 1e-4)
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            v = 0.55 if solid else 0.08 + 0.84 * max(0.0, min(1.0, (me.vertices[vi].co.z - lo) / span))
            uv[li].uv = (u, v)
    me.update()


class TowerGeoBuilder:
    def __init__(self, label: str):
        self.label = label
        self.parts = []
        self.mat = get_custom_tower_mat()

    def add(self, bm, col_idx: int, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), smooth: bool = False, solid_uv: bool = False):
        m = (
            Matrix.Translation(Vector(loc))
            @ Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        )
        bm.transform(m)
        if m.determinant() < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(f"{self.label}_m{len(self.parts)}")
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = smooth
        obj = bpy.data.objects.new(f"{self.label}_p{len(self.parts)}", me)
        bpy.context.scene.collection.objects.link(obj)
        _apply_uvs(obj, col_idx, solid=solid_uv)
        obj.data.materials.append(self.mat)
        self.parts.append(obj)
        return obj

    def add_arched_door(self, x: float, y: float, z_bot: float, rot_z_deg: float, w: float, h: float,
                        col_frame: int, col_wood: int, col_iron: int, gem_col=None):
        rad = math.radians(rot_z_deg)
        c_ang, s_ang = math.cos(rad), math.sin(rad)

        def _loc(lx, ly, lz):
            return (x + lx * c_ang - ly * s_ang, y + lx * s_ang + ly * c_ang, z_bot + lz)

        post_h = h * 0.68
        self.add(_bm_box(0.055, 0.08, post_h, 0.008), col_frame, _loc(-w * 0.5, 0, post_h * 0.5), (0, 0, rot_z_deg))
        self.add(_bm_box(0.055, 0.08, post_h, 0.008), col_frame, _loc(w * 0.5, 0, post_h * 0.5), (0, 0, rot_z_deg))
        self.add(_bm_cyl(w * 0.58, w * 0.58, 0.08, 12), col_frame, _loc(0, 0, post_h), (90, 0, rot_z_deg), smooth=True)
        self.add(_bm_box(w * 0.88, 0.06, post_h, 0.006), col_wood, _loc(0, 0.012, post_h * 0.5), (0, 0, rot_z_deg))
        self.add(_bm_cyl(w * 0.44, w * 0.44, 0.06, 12), col_wood, _loc(0, 0.012, post_h), (90, 0, rot_z_deg), smooth=True)
        self.add(_bm_box(w * 0.16, 0.025, 0.025, 0.004), col_iron, _loc(w * 0.22, -0.025, post_h * 0.55), (0, 0, rot_z_deg), solid_uv=True)
        if gem_col is not None:
            self.add(_bm_sphere(w * 0.18, 1.0, 0.5, 1.0, 10), gem_col, _loc(0, -0.024, post_h * 0.85), (0, 0, rot_z_deg), smooth=True, solid_uv=True)

    def add_round_window(self, loc, rot_z_deg: float, rad: float, col_rim: int, col_glow: int):
        self.add(_bm_cyl(rad, rad, 0.07, 14), col_rim, loc, (90, 0, rot_z_deg), smooth=True)
        dx = math.sin(math.radians(rot_z_deg)) * 0.022
        dy = -math.cos(math.radians(rot_z_deg)) * 0.022
        self.add(_bm_sphere(rad * 0.76, 1.0, 0.55, 1.0, 12), col_glow, (loc[0] + dx, loc[1] + dy, loc[2]), (0, 0, rot_z_deg), smooth=True, solid_uv=True)

    def add_round_balcony_rail(self, radius: float, z: float, col_post: int, col_rail: int, posts: int = 12, post_h: float = 0.095):
        for i in range(posts):
            a = i * (2.0 * math.pi / posts)
            px = math.cos(a) * radius
            py = math.sin(a) * radius
            self.add(_bm_box(0.036, 0.036, post_h, 0.005), col_post, (px, py, z + post_h * 0.5), (0, 0, math.degrees(a)))
        pts = [(math.cos(i * 2.0 * math.pi / 20) * radius, math.sin(i * 2.0 * math.pi / 20) * radius, z + post_h) for i in range(21)]
        self.add(_bm_tube(pts, 0.024, segs=6), col_rail, smooth=True)

    def add_square_battlements(self, half_w: float, z: float, col_merlon: int, h: float = 0.105, per_side: int = 3):
        vals = [(-half_w + 2.0 * half_w * i / max(1, per_side - 1)) for i in range(per_side)]
        coords = set()
        for vx in vals:
            coords.add((round(vx, 3), round(-half_w, 3)))
            coords.add((round(vx, 3), round(half_w, 3)))
            coords.add((round(-half_w, 3), round(vx, 3)))
            coords.add((round(half_w, 3), round(vx, 3)))
        for mx, my in coords:
            self.add(_bm_box(0.115, 0.115, h, 0.010), col_merlon, (mx, my, z + h * 0.5))

    def add_hanging_lantern(self, wall_pt, out_dir_xy, col_arm: int, col_glow: int, acorn: bool = False):
        vx, vy = Vector(out_dir_xy).normalized()
        ax, ay, az = wall_pt
        tip = (ax + vx * 0.14, ay + vy * 0.14, az)
        self.add(_bm_tube([wall_pt, tip, (tip[0], tip[1], az - 0.045)], 0.014, segs=6), col_arm, solid_uv=True)
        lz = az - 0.095
        if acorn:
            self.add(_bm_sphere(0.048, 0.95, 0.95, 1.25, 10), col_glow, (tip[0], tip[1], lz), smooth=True, solid_uv=True)
            self.add(_bm_cyl(0.056, 0.032, 0.042, 10), col_arm, (tip[0], tip[1], lz + 0.042), smooth=True, solid_uv=True)
        else:
            self.add(_bm_box(0.068, 0.068, 0.088, 0.008), col_glow, (tip[0], tip[1], lz), solid_uv=True)
            self.add(_bm_cyl(0.058, 0.015, 0.038, 6), col_arm, (tip[0], tip[1], lz + 0.058), solid_uv=True)

    def add_mushroom(self, base_pt, top_pt, cap_r: float, cap_col: int, stem_col: int = 31, spot_col: int = 37):
        bx, by, bz = base_pt
        tx, ty, tz = top_pt
        mid = ((bx + tx) * 0.5 + (tx - bx) * 0.15, (by + ty) * 0.5 + (ty - by) * 0.15, (bz + tz) * 0.52)
        self.add(_bm_tube([base_pt, mid, top_pt], [cap_r * 0.28, cap_r * 0.22, cap_r * 0.24], segs=8), stem_col, smooth=True)
        tilt_x = math.degrees(math.atan2(by - ty, max(0.06, tz - bz))) * 0.45
        tilt_y = math.degrees(math.atan2(tx - bx, max(0.06, tz - bz))) * 0.45
        prof = [(0.0, -cap_r * 0.12), (cap_r * 0.96, -cap_r * 0.08), (cap_r, cap_r * 0.08), (cap_r * 0.68, cap_r * 0.42), (0.0, cap_r * 0.56)]
        self.add(_bm_lathe(prof, segs=14), cap_col, top_pt, (tilt_x, tilt_y, 0), smooth=True)
        for i in range(4):
            a = i * (math.pi * 0.5) + 0.45
            sx = tx + math.cos(a) * cap_r * 0.54
            sy = ty + math.sin(a) * cap_r * 0.54
            sz = tz + cap_r * 0.34
            self.add(_bm_sphere(cap_r * 0.17, 1.0, 1.0, 0.55, 8), spot_col, (sx, sy, sz), smooth=True, solid_uv=True)

    def join_and_attach(self, name: str, root):
        bpy.ops.object.select_all(action="DESELECT")
        for o in self.parts:
            o.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]
        bpy.ops.object.join()
        base = bpy.context.view_layer.objects.active
        base.name = name

        # Ensure min Z sits at >= 0.000 without shifting upper deck_z
        for v in base.data.vertices:
            if v.co.z < 0.0:
                v.co.z = 0.0
        base.data.update()

        # Clamp XY overshoot safely inside env_slot_pad (max abs <= 0.605)
        max_abs = max((max(abs(v.co.x), abs(v.co.y)) for v in base.data.vertices), default=0.5)
        if max_abs > 0.605:
            scale_xy = 0.595 / max_abs
            base.data.transform(Matrix.Diagonal((scale_xy, scale_xy, 1.0, 1.0)))
            base.data.update()

        base.parent = root
        return base


# ---------------------------------------------------------------------------
# 8 Selected Custom Tower Base Builders
# ---------------------------------------------------------------------------

def _build_squirrel_oak(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    r_base = 0.49 + 0.02 * (tier - 1)
    # Tiered mossy stone plinth + turf cushion
    b.add(_bm_cyl(r_base, r_base - 0.03, 0.11, 14), 9, (0, 0, 0.055), smooth=True)
    b.add(_bm_cyl(r_base - 0.05, r_base - 0.07, 0.05, 14), 1, (0, 0, 0.125), smooth=True)

    # Ribbed ancient oak trunk
    prof = [
        (0.39, 0.13), (0.33, deck_z * 0.30), (0.29, deck_z * 0.68),
        (0.35, deck_z * 0.90), (0.42, deck_z),
    ]
    b.add(_bm_lathe(prof, segs=16), 4, smooth=True)
    for i in range(6):
        a = i * (2.0 * math.pi / 6.0) + 0.28
        if abs(math.sin(a) + 1.0) < 0.18:
            continue
        p0 = (math.cos(a) * 0.30, math.sin(a) * 0.30, 0.18)
        p1 = (math.cos(a) * 0.38, math.sin(a) * 0.38, 0.10)
        p2 = (math.cos(a) * r_base * 0.96, math.sin(a) * r_base * 0.96, 0.025)
        b.add(_bm_tube([p0, p1, p2], [0.068, 0.055, 0.030], segs=7), 4, smooth=True)

    # Arched wooden door at -Y + upper mossy eaves porch
    b.add_arched_door(-0.08, -0.34, 0.12, 0.0, 0.21, 0.29, 9, 6, 15)
    b.add_round_window((0.0, -0.305, deck_z * 0.66), 0.0, 0.078, 6, 20)
    b.add(_bm_gable(0.32, 0.26, 0.14), 0, (0.0, -0.31, deck_z * 0.77), (0, 0, 0))
    if tier >= 2:
        b.add(_bm_box(0.24, 0.22, 0.22, 0.015), 4, (0.24, -0.22, 0.24))
        b.add(_bm_gable(0.30, 0.28, 0.15), 0, (0.24, -0.22, 0.34), (0, 0, -25))

    # Climbing ivy vines + leaf tuft clusters
    b.add(_bm_tube([(-0.26, -0.20, 0.15), (-0.31, 0.0, deck_z * 0.42), (-0.20, 0.24, deck_z * 0.80)], 0.022, 6), 2, smooth=True)
    b.add(_bm_tube([(0.26, -0.22, 0.16), (0.31, 0.05, deck_z * 0.50), (0.18, 0.26, deck_z * 0.84)], 0.020, 6), 2, smooth=True)
    for lx, ly, lz in ((-0.31, -0.08, deck_z * 0.45), (0.31, -0.05, deck_z * 0.55), (-0.15, -0.28, deck_z * 0.82)):
        b.add(_bm_sphere(0.068, 1.2, 0.9, 0.7, 8), 2, (lx, ly, lz), smooth=True)

    # Golden acorn lanterns hanging under wooden deck
    acorn_dirs = [(-0.34, -0.18, deck_z - 0.10, (-0.8, -0.5)), (0.34, -0.18, deck_z - 0.10, (0.8, -0.5))]
    if tier >= 2:
        acorn_dirs.append((0.0, -0.35, deck_z - 0.09, (0.0, -1.0)))
    for ax, ay, az, dv in acorn_dirs:
        b.add_hanging_lantern((ax, ay, az), dv, 7, 20, acorn=True)

    if suf == "sniper":
        b.add(_bm_cyl(0.145, 0.145, 0.036, 16), 36, (0.32, 0.02, deck_z * 0.48), (0, 90, 0), solid_uv=True)
        b.add(_bm_cyl(0.095, 0.095, 0.042, 14), 39, (0.326, 0.02, deck_z * 0.48), (0, 90, 0), solid_uv=True)
        b.add(_bm_cyl(0.048, 0.048, 0.048, 12), 38, (0.332, 0.02, deck_z * 0.48), (0, 90, 0), solid_uv=True)

    # Open circular wooden terrace & balcony posts (<= deck_z + 0.105)
    b.add(_bm_cyl(0.45, 0.42, 0.065, 16), 6, (0, 0, deck_z - 0.032), smooth=True)
    b.add_round_balcony_rail(0.42, deck_z, 6, 4, posts=12, post_h=0.095)


def _build_beaver_resin_workshop(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    b.add(_bm_box(0.86, 0.86, 0.10, 0.02), 10, (0, 0, 0.05))
    body_h = deck_z - 0.10
    b.add(_bm_box(0.62, 0.62, body_h, 0.015), 11, (0, 0, 0.10 + body_h * 0.5))

    # Oak corner timber posts + 3 riveted iron straps
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.add(_bm_box(0.085, 0.085, body_h + 0.04, 0.01), 6, (sx * 0.30, sy * 0.30, 0.10 + body_h * 0.5))
    for k in (0.28, 0.62, 0.92):
        b.add(_bm_box(0.67, 0.67, 0.055, 0.008), 15, (0, 0, 0.10 + body_h * k))

    # Front workshop arched door & window
    b.add_arched_door(-0.11, -0.32, 0.10, 0.0, 0.22, 0.31, 11, 6, 15)
    b.add_round_window((0.0, -0.325, deck_z * 0.66), 0.0, 0.072, 6, 21)

    # Coiled copper resin pipes along left & front wall feeding bubbling amber cauldron
    pipe_col = 17 if suf != "mortar" else 16
    b.add(_bm_tube([
        (-0.34, -0.10, deck_z * 0.72), (-0.37, -0.26, deck_z * 0.66),
        (-0.32, -0.36, deck_z * 0.52), (0.04, -0.36, deck_z * 0.44),
        (0.26, -0.36, 0.32), (0.28, -0.32, 0.24),
    ], 0.032, segs=8), pipe_col, smooth=True)
    b.add(_bm_tube([
        (-0.34, 0.14, deck_z * 0.48), (-0.37, -0.24, deck_z * 0.40), (0.14, -0.37, 0.36)
    ], 0.028, segs=8), pipe_col, smooth=True)

    # Bubbling amber resin cauldron + glowing resin barrels at front-right
    b.add(_bm_cyl(0.14, 0.16, 0.18, 12), 15, (0.28, -0.31, 0.15), smooth=True)
    b.add(_bm_sphere(0.125, 1.0, 1.0, 0.45, 10), 21, (0.28, -0.31, 0.24), smooth=True, solid_uv=True)
    barrel_locs = [(0.45, -0.18), (0.12, -0.45)]
    if tier >= 2:
        barrel_locs.extend([(-0.44, -0.22), (0.44, 0.16)])
    for bx, by in barrel_locs:
        b.add(_bm_cyl(0.082, 0.088, 0.19, 10), 6, (bx, by, 0.15), smooth=True)
        b.add(_bm_cyl(0.092, 0.092, 0.032, 10), 21, (bx, by, 0.15), smooth=True, solid_uv=True)

    # Oak jib crane mounted BELOW deck_z on left-back wall so TurretHead rotates cleanly
    cz = deck_z * 0.66
    b.add(_bm_box(0.24, 0.055, 0.055, 0.008), 6, (-0.42, 0.16, cz))
    b.add(_bm_box(0.05, 0.05, 0.20, 0.008), 6, (-0.39, 0.16, cz - 0.09), (0, -35, 0))
    b.add(_bm_tube([(-0.52, 0.16, cz - 0.02), (-0.52, 0.16, cz - 0.26)], 0.012, 6), 15, solid_uv=True)

    # Timber cannon terrace & notched oak parapet (<= deck_z + 0.105)
    b.add(_bm_box(0.78, 0.78, 0.075, 0.015), 6, (0, 0, deck_z - 0.038))
    b.add_square_battlements(0.36, deck_z, 6, h=0.095, per_side=4)


def _build_owl_tree_library(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    snow = (suf == "blizzard")
    plinth_col = 29 if snow else 9
    bark_col = 5
    glow_col = 23 if suf in ("blizzard", "chain") else 22
    trim_col = 19 if suf == "chain" else 18

    b.add(_bm_cyl(0.50, 0.45, 0.10, 14), plinth_col, (0, 0, 0.05), smooth=True)
    # Sculpted silver moonlight tree trunk
    prof = [(0.38, 0.10), (0.30, deck_z * 0.35), (0.27, deck_z * 0.66), (0.34, deck_z * 0.88), (0.41, deck_z)]
    b.add(_bm_lathe(prof, segs=14), bark_col, smooth=True)
    for i in range(6):
        a = i * (2.0 * math.pi / 6.0) + 0.35
        b.add(_bm_tube([
            (math.cos(a) * 0.27, math.sin(a) * 0.27, deck_z * 0.55),
            (math.cos(a + 0.2) * 0.33, math.sin(a + 0.2) * 0.33, 0.22),
            (math.cos(a + 0.3) * 0.47, math.sin(a + 0.3) * 0.47, 0.035),
        ], [0.050, 0.052, 0.028], segs=6), bark_col, smooth=True)

    # Arched cottage door bottom-right
    b.add_arched_door(0.16, -0.32, 0.09, 25.0, 0.16, 0.23, trim_col if suf == "chain" else 6, 7, 15)

    # Recessed exterior bookshelves + colorful tiny spellbooks & scrolls!
    shelf_locs = [(-0.21, -0.26, 0.32, -28.0), (0.20, -0.26, 0.44, 28.0)]
    book_cols = (33, 34, 28, 30, 19)
    for s_idx, (sx, sy, sz, rot_z) in enumerate(shelf_locs):
        b.add(_bm_box(0.21, 0.10, 0.24, 0.008), 7, (sx, sy, sz), (0, 0, rot_z))
        b.add(_bm_box(0.19, 0.11, 0.02, 0.004), 6, (sx, sy, sz), (0, 0, rot_z))
        rad = math.radians(rot_z)
        for bi in range(4):
            off = -0.06 + bi * 0.04
            bx = sx + off * math.cos(rad)
            by = sy + off * math.sin(rad) - 0.03 * math.cos(rad)
            b.add(_bm_box(0.030, 0.048, 0.072, 0.004), book_cols[(bi + s_idx * 2) % len(book_cols)], (bx, by, sz + 0.055), (0, 0, rot_z))
            b.add(_bm_cyl(0.016, 0.016, 0.068, 8), 31, (bx, by, sz - 0.055), (0, 90, rot_z), smooth=True)

    # Paired glowing sapphire stained-glass owl eyes at upper front
    for sx in (-0.125, 0.125):
        b.add_round_window((sx, -0.285, deck_z * 0.68), 0.0 if sx == 0 else (-16 if sx < 0 else 16), 0.088, trim_col if suf == "chain" else bark_col, glow_col)

    # Hanging moonlight lanterns
    lantern_spots = [(-0.34, -0.14, deck_z - 0.10, (-0.8, -0.4)), (0.34, -0.14, deck_z - 0.10, (0.8, -0.4))]
    if tier >= 2:
        lantern_spots.append((0.0, -0.35, deck_z - 0.11, (0.0, -1.0)))
    for lpt in lantern_spots:
        b.add_hanging_lantern((lpt[0], lpt[1], lpt[2]), lpt[3], bark_col, glow_col, acorn=False)

    # Silver-branch curved terrace (<= deck_z + 0.105)
    b.add(_bm_cyl(0.44, 0.40, 0.065, 16), 6, (0, 0, deck_z - 0.032), smooth=True)
    b.add_round_balcony_rail(0.42, deck_z, bark_col, 29 if snow else bark_col, posts=10, post_h=0.095)


def _build_hedgehog_thorn_bastion(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    b.add(_bm_cyl(0.51, 0.48, 0.10, 12), 10, (0, 0, 0.05), smooth=True)
    keep_h = deck_z - 0.10
    b.add(_bm_box(0.58, 0.58, keep_h, 0.015), 10, (0, 0, 0.10 + keep_h * 0.5))

    # Corner stone quoins + steel straps on shred / rune slits on rail
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.add(_bm_box(0.11, 0.11, keep_h, 0.012), 9, (sx * 0.27, sy * 0.27, 0.10 + keep_h * 0.5))
            if suf == "rail":
                b.add(_bm_box(0.03, 0.03, keep_h * 0.65, 0.005), 23, (sx * 0.32, sy * 0.32, 0.12 + keep_h * 0.5), solid_uv=True)
    if suf == "shred":
        b.add(_bm_box(0.64, 0.64, 0.06, 0.008), 16, (0, 0, deck_z * 0.55))

    # Iron-barred gate at -Y + narrow arrow slits
    b.add_arched_door(0.0, -0.30, 0.10, 0.0, 0.24, 0.30, 10, 32, 15)
    for bar_x in (-0.06, 0.0, 0.06):
        b.add(_bm_cyl(0.010, 0.010, 0.25, 6), 16, (bar_x, -0.308, 0.23))
    for sx in (-0.14, 0.14):
        b.add(_bm_box(0.05, 0.03, 0.18, 0.004), 32, (sx, -0.295, deck_z * 0.68))

    # Perimeter sharpened oak palisade stakes pointing outward (skipping front gate gap)
    stake_cnt = 12 + (tier - 1) * 4
    stake_col = 16 if suf == "shred" else 8
    for i in range(stake_cnt):
        ang = i * (2.0 * math.pi / stake_cnt)
        # Keep doorway corridor [-0.22..+0.22, -Y] clear
        if math.sin(ang) < -0.78 and abs(math.cos(ang)) < 0.42:
            continue
        r_s = 0.46
        sx = math.cos(ang) * r_s
        sy = math.sin(ang) * r_s
        out_rot_z = math.degrees(ang) - 90.0
        b.add(_bm_cyl(0.036, 0.006, 0.32, 7), stake_col, (sx, sy, 0.14), (24.0, 0.0, out_rot_z))

    # Coiled thorny bramble vines climbing walls with protruding thorns
    pts_vine = []
    for k in range(18):
        t = k / 17.0
        va = t * math.pi * 2.5 - 0.6
        r_v = 0.34
        vz = 0.18 + t * (deck_z - 0.26)
        pts_vine.append((math.cos(va) * r_v, math.sin(va) * r_v, vz))
    b.add(_bm_tube(pts_vine, 0.020, 6), 3, smooth=True)
    for vp in pts_vine[2::3]:
        vn = Vector((vp[0], vp[1], 0)).normalized()
        b.add(_bm_cyl(0.018, 0.003, 0.08, 6), 3, (vp[0] + vn.x * 0.03, vp[1] + vn.y * 0.03, vp[2]),
              (65, 0, math.degrees(math.atan2(vn.y, vn.x)) - 90))

    # Classic stone crenels terrace
    b.add(_bm_box(0.74, 0.74, 0.085, 0.015), 10, (0, 0, deck_z - 0.042))
    b.add_square_battlements(0.35, deck_z, 10, h=0.105, per_side=4)


def _build_badger_mushroom_tower(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    b.add(_bm_cyl(0.50, 0.46, 0.10, 14), 9, (0, 0, 0.05), smooth=True)
    b.add(_bm_cyl(0.35, 0.32, deck_z - 0.10, 14), 9, (0, 0, 0.10 + (deck_z - 0.10) * 0.5), smooth=True)

    # Wrapping mossy roots
    for i in range(5):
        a = i * (2.0 * math.pi / 5.0) + 0.55
        if math.sin(a) < -0.75 and abs(math.cos(a)) < 0.35:
            continue
        b.add(_bm_tube([
            (math.cos(a) * 0.32, math.sin(a) * 0.32, deck_z * 0.45),
            (math.cos(a + 0.22) * 0.40, math.sin(a + 0.22) * 0.40, 0.14),
            (math.cos(a + 0.32) * 0.48, math.sin(a + 0.32) * 0.48, 0.03),
        ], [0.052, 0.048, 0.025], 6), 4, smooth=True)

    cap_col = 25 if suf == "inferno" else 30 if suf == "corrosion" else 24
    glow_win = 21 if suf == "inferno" else 27

    # Cozy mossy porch door with glowing elixir peephole
    b.add_arched_door(0.14, -0.32, 0.09, 20.0, 0.18, 0.24, 6, 4, 15, gem_col=glow_win)
    b.add(_bm_gable(0.24, 0.20, 0.12), 0, (0.15, -0.33, 0.33), (0, 0, 20))

    # Paired glowing alchemist porthole windows on upper front
    b.add_round_window((-0.14, -0.29, deck_z * 0.66), -22, 0.085, 6, glow_win)
    b.add_round_window((0.14, -0.29, deck_z * 0.66), 22, 0.085, 6, glow_win)

    # Clustered luminous spotted mushrooms sprouting from sides & roots
    mush_specs = [
        ((-0.30, -0.14, 0.38), (-0.47, -0.18, 0.62), 0.145, cap_col),
        ((0.30, -0.06, 0.36), (0.47, -0.08, 0.58), 0.135, 24 if suf == "corrosion" else cap_col),
        ((-0.26, -0.26, 0.10), (-0.40, -0.36, 0.24), 0.105, cap_col),
        ((0.32, 0.22, 0.28), (0.46, 0.32, 0.48), 0.125, cap_col),
    ]
    if tier >= 2:
        mush_specs.extend([
            ((-0.28, 0.26, 0.46), (-0.44, 0.36, 0.72), 0.115, 27 if suf == "corrosion" else cap_col),
            ((0.02, -0.34, 0.09), (0.04, -0.47, 0.19), 0.078, cap_col),
        ])
    for bp, tp, cr, mc in mush_specs:
        b.add_mushroom(bp, tp, cr, mc)

    # Mossy stone parapet terrace (<= deck_z + 0.105)
    b.add(_bm_cyl(0.44, 0.40, 0.075, 14), 9, (0, 0, deck_z - 0.038), smooth=True)
    for i in range(8):
        a = i * (2.0 * math.pi / 8.0)
        b.add(_bm_box(0.11, 0.09, 0.10, 0.012), 9, (math.cos(a) * 0.39, math.sin(a) * 0.39, deck_z + 0.05), (0, 0, math.degrees(a)))


def _build_falcon_gothic_watchtower(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    b.add(_bm_box(0.80, 0.80, 0.10, 0.02), 12, (0, 0, 0.05))
    h_bot = (deck_z - 0.10) * 0.52
    h_top = (deck_z - 0.10) * 0.48

    # Lower gothic story (crimson brick + charcoal slate buttresses)
    b.add(_bm_box(0.56, 0.56, h_bot, 0.015), 13, (0, 0, 0.10 + h_bot * 0.5))
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.add(_bm_box(0.13, 0.13, deck_z - 0.08, 0.012), 12, (sx * 0.27, sy * 0.27, 0.10 + (deck_z - 0.08) * 0.5))
            if suf == "tempest":
                b.add(_bm_box(0.032, 0.032, deck_z * 0.58, 0.005), 23, (sx * 0.32, sy * 0.32, deck_z * 0.45), solid_uv=True)

    # Arched gothic doorway + sculpted gold raven-wing heraldic emblem above it!
    b.add_arched_door(0.0, -0.29, 0.10, 0.0, 0.20, 0.28, 12, 7, 19)
    z_crest = 0.43 if tier == 1 else 0.48
    b.add(_bm_box(0.06, 0.05, 0.09, 0.008), 19, (0.0, -0.305, z_crest))
    for sx in (-1, 1):
        b.add(_bm_box(0.13, 0.04, 0.045, 0.006), 19, (sx * 0.09, -0.305, z_crest + 0.025), (0, sx * -26, 0))

    # Mid-level overhanging gothic wrought-iron gallery balcony
    gal_z = 0.10 + h_bot
    b.add(_bm_box(0.74, 0.74, 0.06, 0.012), 12, (0, 0, gal_z))
    b.add_round_balcony_rail(0.41, gal_z + 0.03, 15, 15, posts=16, post_h=0.075)

    # Upper belfry arch level housing a gleaming golden bell in front of a dark arch recess
    b.add(_bm_box(0.38, 0.38, h_top, 0.010), 32, (0, 0, gal_z + 0.03 + h_top * 0.5))
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.add(_bm_box(0.11, 0.11, h_top, 0.008), 13, (sx * 0.18, sy * 0.18, gal_z + 0.03 + h_top * 0.5))
    b.add(_bm_cyl(0.088, 0.042, 0.13, 12), 19, (0, -0.19, gal_z + 0.03 + h_top * 0.52), smooth=True, solid_uv=True)
    b.add(_bm_sphere(0.028, 1, 1, 1, 8), 19, (0, -0.19, gal_z + 0.03 + h_top * 0.38), smooth=True, solid_uv=True)

    # Hanging amber lanterns at upper corners
    lan_pts = [(-0.34, -0.28, deck_z - 0.12, (-0.7, -0.7)), (0.34, -0.28, deck_z - 0.12, (0.7, -0.7))]
    if tier >= 2:
        lan_pts.extend([(-0.34, 0.28, deck_z - 0.12, (-0.7, 0.7)), (0.34, 0.28, deck_z - 0.12, (0.7, 0.7))])
    for lp in lan_pts:
        b.add_hanging_lantern((lp[0], lp[1], lp[2]), lp[3], 15, 23 if suf == "tempest" else 26)

    # Gothic slate parapet terrace (<= deck_z + 0.115)
    b.add(_bm_box(0.72, 0.72, 0.075, 0.014), 12, (0, 0, deck_z - 0.038))
    b.add_square_battlements(0.33, deck_z, 12, h=0.10, per_side=4)


def _build_tortoise_mine_bastion(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    b.add(_bm_box(0.88, 0.88, 0.08, 0.02), 10, (0, 0, 0.04))
    # Tapered earth & rock bastion core
    b.add(_bm_lathe([(0.40, 0.08), (0.35, deck_z * 0.50), (0.31, deck_z - 0.06)], segs=8), 14)

    # Heavy dark mine-shaft corner posts & X-bracing beams
    h_post = deck_z - 0.08
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.add(_bm_box(0.085, 0.085, h_post, 0.01), 7, (sx * 0.30, sy * 0.30, 0.08 + h_post * 0.5),
                  (sy * -5.0, sx * 5.0, 0))
    for tz in (deck_z * 0.44, deck_z * 0.80):
        w_t = 0.68 if tz < deck_z * 0.5 else 0.62
        b.add(_bm_box(w_t, w_t, 0.065, 0.008), 7, (0, 0, tz))

    # Front mine tunnel portal + protruding iron rails & sleepers!
    b.add_arched_door(0.0, -0.34, 0.08, 0.0, 0.25, 0.29, 7, 32, 15)
    for rx in (-0.065, 0.065):
        b.add(_bm_box(0.022, 0.28, 0.024, 0.004), 15, (rx, -0.44, 0.045))
    for sy in (-0.36, -0.43, -0.50, -0.56):
        b.add(_bm_box(0.22, 0.036, 0.022, 0.004), 6, (0.0, sy, 0.026))

    # Jutting side quarry rocks + golden ore crystals on quake / steel armor on bastion
    for rx, ry, rz in ((-0.36, -0.14, 0.20), (0.36, -0.16, 0.22), (0.34, 0.22, 0.18), (-0.34, 0.24, 0.16)):
        b.add(_bm_sphere(0.11, 1.1, 0.9, 0.8, 7), 10, (rx, ry, rz))
        if suf == "quake":
            b.add(_bm_crystal(0.058, 0.18, 6), 35, (rx * 1.08, ry * 1.08, rz + 0.04), (15, -20 if rx < 0 else 20, 0), solid_uv=True)
    if suf == "bastion":
        b.add(_bm_box(0.68, 0.68, 0.08, 0.008), 16, (0, 0, deck_z * 0.60))

    # Warm mining lanterns hanging from timber posts
    m_lans = [(-0.34, -0.26, deck_z * 0.72, (-0.7, -0.6)), (0.34, -0.26, deck_z * 0.72, (0.7, -0.6))]
    if tier >= 2:
        m_lans.extend([(-0.18, -0.34, deck_z * 0.40, (-0.3, -1.0)), (0.18, -0.34, deck_z * 0.40, (0.3, -1.0))])
    for mp in m_lans:
        b.add_hanging_lantern((mp[0], mp[1], mp[2]), mp[3], 15, 26)

    # Notched timber artillery parapet (<= deck_z + 0.105)
    b.add(_bm_box(0.76, 0.76, 0.08, 0.014), 6, (0, 0, deck_z - 0.04))
    b.add_square_battlements(0.35, deck_z, 7, h=0.095, per_side=4)


def _build_lynx_glacier_spire(b: TowerGeoBuilder, suf: str, tier: int, deck_z: float):
    # Carved frosted stone stepped plinth
    b.add(_bm_box(0.84, 0.84, 0.09, 0.025), 29, (0, 0, 0.045))
    b.add(_bm_box(0.72, 0.72, 0.08, 0.020), 29, (0, 0, 0.125))

    core_col = 30 if suf == "flurry" else 28
    rune_col = 30 if suf == "flurry" else 23

    # Faceted sapphire glacier crystal shaft flaring out to frozen crown parapet
    prof = [
        (0.32, 0.16), (0.28, deck_z * 0.36), (0.29, deck_z * 0.74),
        (0.37, deck_z * 0.90), (0.41, deck_z),
    ]
    b.add(_bm_lathe(prof, segs=8), core_col, smooth=False)

    # Glowing engraved snowflake & Nordic runes on front & side facets
    for rz_deg in (0.0, 90.0, -90.0):
        rad = math.radians(rz_deg)
        fx = math.sin(rad) * 0.285
        fy = -math.cos(rad) * 0.285
        cz = deck_z * 0.56
        for ang_b in (0, 60, 120):
            b.add(_bm_box(0.18, 0.032, 0.024, 0.004), rune_col, (fx, fy, cz), (0, ang_b, rz_deg), solid_uv=True)

    # Diagonal corner aurora & glacier crystal clusters
    clust_r = 0.34 if tier == 1 else 0.37
    for sx in (-1, 1):
        for sy in (-1, 1):
            c_col = 30 if (suf == "flurry" or (sx * sy < 0)) else 28
            ch = 0.28 + 0.05 * (tier - 1)
            b.add(_bm_crystal(0.085, ch, 6), c_col, (sx * clust_r, sy * clust_r, 0.12),
                  (sy * 18.0, sx * -18.0, 0), solid_uv=(c_col == 30))
            b.add(_bm_crystal(0.058, ch * 0.65, 6), 23, (sx * (clust_r + 0.06), sy * (clust_r - 0.04), 0.10),
                  (sy * 28.0, sx * -26.0, 18), solid_uv=True)

    # Hanging translucent icicles beneath ice parapet lip
    for i in range(8):
        a = i * (2.0 * math.pi / 8.0) + 0.25
        ix = math.cos(a) * 0.38
        iy = math.sin(a) * 0.38
        b.add(_bm_cyl(0.030, 0.002, 0.14, 6), 29, (ix, iy, deck_z - 0.14))

    # Carved frosted ice parapet crown (<= deck_z + 0.115)
    b.add(_bm_cyl(0.43, 0.39, 0.08, 8), 29, (0, 0, deck_z - 0.04))
    for i in range(8):
        a = i * (2.0 * math.pi / 8.0)
        b.add(_bm_box(0.11, 0.085, 0.105, 0.010), 29, (math.cos(a) * 0.375, math.sin(a) * 0.375, deck_z + 0.052),
              (0, 0, math.degrees(a)))


_TOWER_DISPATCH = {
    "squirrel": _build_squirrel_oak,
    "beaver": _build_beaver_resin_workshop,
    "owl": _build_owl_tree_library,
    "hedgehog": _build_hedgehog_thorn_bastion,
    "badger": _build_badger_mushroom_tower,
    "falcon": _build_falcon_gothic_watchtower,
    "tortoise": _build_tortoise_mine_bastion,
    "lynx": _build_lynx_glacier_spire,
}


def build_custom_tower_base(tower_id: str, suf: str, tier: int, root):
    if tower_id not in _TOWER_DISPATCH:
        raise ValueError(f"Unknown custom tower_id: {tower_id}")
    deck_z = {1: 1.12, 2: 1.34, 3: 1.50}[tier]
    builder = TowerGeoBuilder(f"{tower_id}_{suf}")
    _TOWER_DISPATCH[tower_id](builder, suf, tier, deck_z)
    base_obj = builder.join_and_attach(f"CustomTowerBase_{tower_id}_{suf}", root)
    return base_obj, deck_z
