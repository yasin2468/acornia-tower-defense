"""Palamut Kalesi — Headless Blender 5.2 production builder for 5 Option-1 Biome Castles.

Builds 5 G1-compliant (1 mesh + 1 material, diffuse + emissive atlas) GLBs in public/models/:
  * env_castle_forest.glb   (Orman 1: Great Oak carved tree-trunk castle + golden acorns + ivy)
  * env_castle_canyon.glb   (Kanyon 1: Terracotta Kasbah + gold dome + turquoise gate + awnings + braziers)
  * env_castle_cavern.glb   (Magara 1: Slate cavern keep + cyan quartz spires + glowing mushrooms)
  * env_castle_snow.glb     (Kis 1: Snow-piled navy slate Nordic stone & pine fortress + amber slits)
  * env_castle_foundry.glb  (Dokumhane 1: Magma-cracked black obsidian fortress + horned gate + lava spouts)

Conventions (Z-up in Blender, export_yup=True):
  * Front gate faces -Y in Blender (== +Z in Three.js, facing road entrance at world z = -8.2).
  * Ground sits cleanly at min Z = 0.000; width X ~ [-2.65..+2.65], height Z ~ [0..3.95].
  * Single mesh + single material per GLB (preserves G1 draw-call target).

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_castles_opt1.py
"""

import json
import math
import os
import struct
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

OUT_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi/public/models"
CACHE_DIR = "/tmp/palamut_cc0/_derived_castles"
DIFFUSE_ATLAS = os.path.join(CACHE_DIR, "castle_opt1_diffuse.png")
EMISSIVE_ATLAS = os.path.join(CACHE_DIR, "castle_opt1_emissive.png")
VERIFY_SHEET = "/Users/yasinozkan/.gemini/antigravity/brain/e1cf79ae-9857-4de3-a9bf-7018b27f5aa4/scratch/verify_castles_opt1.png"

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(os.path.dirname(VERIFY_SHEET), exist_ok=True)

# (dark_hex, light_hex, optional_emit_hex_or_None)
SWATCHES = [
    ("#58615d", "#8d9991", None),       # 0: Mossy forest granite stone
    ("#402815", "#7a4d28", None),       # 1: Ancient Great Oak bark & roots
    ("#59381d", "#a66d3b", None),       # 2: Warm oak cottage timber & doors
    ("#335e28", "#74a844", None),       # 3: Mossy green oak shingle roof
    ("#1e5921", "#4fb842", None),       # 4: Climbing forest ivy leaves
    ("#a86e14", "#ffe169", "#a3670c"),  # 5: Gleaming golden acorn finial / gold dome (warm sheen)
    ("#22262e", "#525b69", None),       # 6: Wrought iron hardware / bars
    ("#873d25", "#cc6b47", None),       # 7: Canyon terracotta wall
    ("#692a19", "#a64c32", None),       # 8: Deep crimson canyon stone trim
    ("#0d7a76", "#3de0d2", "#149c96"),  # 9: Turquoise Kasbah ceramic mosaic gate
    ("#1f4d9e", "#f7cc3b", None),       # 10: Tent stripe A (cobalt/gold)
    ("#73218c", "#f55b94", None),       # 11: Tent stripe B (plum/crimson-rose)
    ("#ff5e12", "#ffdd54", "#ff7714"),  # 12: Glowing fire / magma / lava
    ("#252d42", "#4b5a78", None),       # 13: Dark cavern slate stone
    ("#161b29", "#2f384f", None),       # 14: Deep obsidian-slate trim
    ("#0ea8b8", "#8cfcff", "#2ef2ff"),  # 15: Bioluminescent cyan quartz & mushroom glow
    ("#7cb8b8", "#d6f2ed", None),       # 16: Cavern mushroom stem
    ("#4d5d73", "#7d90ab", None),       # 17: Highland Nordic granite stone
    ("#2b3648", "#506480", None),       # 18: Deep pine wood framing / trim
    ("#18253d", "#32496e", None),       # 19: Navy slate shingle roof
    ("#cde0f0", "#ffffff", None),       # 20: Crisp alpine snowdrift
    ("#73808c", "#c8d6e3", None),       # 21: Silver forged iron portcullis
    ("#ff8c1a", "#ffe680", "#ffa826"),  # 22: Warm amber lit window slit
    ("#15141a", "#302f3b", None),       # 23: Black volcanic obsidian basalt
    ("#2d2c36", "#585666", None),       # 24: Horned iron bull crest / gate frame
]


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def ensure_atlases():
    cols = len(SWATCHES)
    cw, h = 32, 256
    w = cols * cw
    px_diff = np.zeros((h, w, 4), dtype=np.float32)
    px_diff[..., 3] = 1.0
    px_emit = np.zeros((h, w, 4), dtype=np.float32)
    px_emit[..., 3] = 1.0

    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    for idx, (dk_h, lt_h, em_h) in enumerate(SWATCHES):
        dk = np.array(hex_rgb(dk_h), dtype=np.float32)
        lt = np.array(hex_rgb(lt_h), dtype=np.float32)
        grad = dk[None, None, :] + (t ** 0.88) * (lt - dk)[None, None, :]
        px_diff[:, idx * cw:(idx + 1) * cw, :3] = np.clip(grad, 0.0, 1.0)
        if em_h:
            em = np.array(hex_rgb(em_h), dtype=np.float32)
            px_emit[:, idx * cw:(idx + 1) * cw, :3] = np.clip(em * (0.7 + 0.3 * t), 0.0, 1.0)

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


def get_castle_mat():
    mat_name = "CastleOpt1Mat"
    mat = bpy.data.materials.get(mat_name)
    if mat:
        return mat
    ensure_atlases()
    mat = bpy.data.materials.new(mat_name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")

    tex_d = nt.nodes.new("ShaderNodeTexImage")
    tex_d.image = bpy.data.images.load(DIFFUSE_ATLAS, check_existing=True)
    tex_d.image.colorspace_settings.name = "sRGB"
    nt.links.new(tex_d.outputs["Color"], bsdf.inputs["Base Color"])

    tex_e = nt.nodes.new("ShaderNodeTexImage")
    tex_e.image = bpy.data.images.load(EMISSIVE_ATLAS, check_existing=True)
    tex_e.image.colorspace_settings.name = "sRGB"
    nt.links.new(tex_e.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.65

    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Metallic"].default_value = 0.12
    return mat


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def bm_to_obj(name: str, bm, smooth: bool = False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def make_box(sx: float, sy: float, sz: float, bevel: float = 0.02):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if bevel > 0 and min(sx, sy, sz) > bevel * 2.6:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES")
    return bm


def make_cyl(r1: float, r2: float, h: float, segs: int = 10):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=h)
    return bm


def make_gable_roof(width: float, depth: float, height: float):
    """Pitched triangular prism roof along Y (ridge runs along Y) or X (rotate as needed)."""
    bm = bmesh.new()
    hw, hd = width * 0.5, depth * 0.5
    v = [
        bm.verts.new((-hw, -hd, 0.0)),
        bm.verts.new((hw, -hd, 0.0)),
        bm.verts.new((hw, hd, 0.0)),
        bm.verts.new((-hw, hd, 0.0)),
        bm.verts.new((0.0, -hd, height)),
        bm.verts.new((0.0, hd, height)),
    ]
    bm.faces.new((v[0], v[3], v[2], v[1]))
    bm.faces.new((v[0], v[1], v[4]))
    bm.faces.new((v[2], v[3], v[5]))
    bm.faces.new((v[1], v[2], v[5], v[4]))
    bm.faces.new((v[3], v[0], v[4], v[5]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def make_lathe(profile_rz, segs: int = 14):
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


def make_tube(pts, radii, segs: int = 7):
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
        rings.append([bm.verts.new(p + n * (math.cos(j * 2 * math.pi / segs) * rad) + b * (math.sin(j * 2 * math.pi / segs) * rad)) for j in range(segs)])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for j in range(segs):
            nj = (j + 1) % segs
            bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def apply_uvs(obj, col_idx: int, solid: bool = False):
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


class CastleBuilder:
    def __init__(self, name: str):
        self.name = name
        self.parts = []
        self.mat = get_castle_mat()

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
        obj = bm_to_obj(f"part_{len(self.parts)}", bm, smooth=smooth)
        apply_uvs(obj, col_idx, solid=solid_uv)
        obj.data.materials.append(self.mat)
        self.parts.append(obj)
        return obj

    def add_battlements(self, cx: float, cy: float, w: float, d: float, z: float, col_idx: int, count_x: int = 4, count_y: int = 3, h: float = 0.22):
        # Corner & edge merlons
        for ix in range(count_x):
            x = cx - w * 0.44 + (w * 0.88) * (ix / max(1, count_x - 1))
            for sy in (-1, 1):
                self.add(make_box(0.24, 0.2, h, 0.015), col_idx, (x, cy + sy * (d * 0.5 - 0.09), z + h * 0.5))
        for iy in range(1, count_y - 1):
            y = cy - d * 0.42 + (d * 0.84) * (iy / max(1, count_y - 1))
            for sx in (-1, 1):
                self.add(make_box(0.2, 0.24, h, 0.015), col_idx, (cx + sx * (w * 0.5 - 0.09), y, z + h * 0.5))

    def finalize_and_export(self, filename: str):
        if not self.parts:
            return
        # Join all meshes cleanly into 1 mesh + 1 material
        bpy.ops.object.select_all(action="DESELECT")
        for o in self.parts:
            o.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]
        bpy.ops.object.join()
        root = bpy.context.view_layer.objects.active
        root.name = filename[:-4]

        # Clamp strictly to min Z = 0.000 and cap max height <= 3.72m for 430x900 mobile camera framing
        min_z = min((root.matrix_world @ v.co).z for v in root.data.vertices)
        if abs(min_z) > 1e-4:
            root.data.transform(Matrix.Translation((0, 0, -min_z)))
        max_z = max(v.co.z for v in root.data.vertices)
        if max_z > 3.72:
            s_z = 3.68 / max_z
            root.data.transform(Matrix.Diagonal((1.0, 1.0, s_z, 1.0)))
        root.data.update()

        out_path = os.path.join(OUT_DIR, filename)
        bpy.ops.object.select_all(action="DESELECT")
        root.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_apply=True,
            export_materials="EXPORT",
            export_texcoords=True,
            export_normals=True,
        )
        # Verify single mesh + single material G1 constraint
        with open(out_path, "rb") as f:
            data = f.read()
        jlen = struct.unpack_from("<I", data, 12)[0]
        gltf = json.loads(data[20:20 + jlen].decode("utf-8"))
        assert len(gltf["meshes"]) == 1, f"{filename} meshes={len(gltf['meshes'])}"
        assert len(gltf["materials"]) == 1, f"{filename} materials={len(gltf['materials'])}"
        zs = [v.co.z for v in root.data.vertices]
        xs = [v.co.x for v in root.data.vertices]
        print(f"[CASTLE] {filename}: verts={len(root.data.vertices)} X=[{min(xs):.2f},{max(xs):.2f}] Z=[{min(zs):.3f},{max(zs):.2f}] size={os.path.getsize(out_path)//1024}KB OK")


def add_golden_acorn(b: CastleBuilder, loc, scale: float = 1.0):
    x, y, z = loc
    nut = make_lathe([(0.001, 0.0), (0.11 * scale, 0.08 * scale), (0.16 * scale, 0.24 * scale), (0.12 * scale, 0.36 * scale), (0.001, 0.44 * scale)], 10)
    b.add(nut, 5, (x, y, z), smooth=True)
    cap = make_lathe([(0.175 * scale, 0.25 * scale), (0.18 * scale, 0.34 * scale), (0.09 * scale, 0.42 * scale), (0.001, 0.45 * scale)], 10)
    b.add(cap, 2, (x, y, z + 0.03 * scale), smooth=False)
    stem = make_cyl(0.025 * scale, 0.02 * scale, 0.1 * scale, 6)
    b.add(stem, 2, (x, y, z + 0.48 * scale))


def build_castle_forest():
    clear_scene()
    b = CastleBuilder("env_castle_forest")

    # Plinth apron
    b.add(make_box(4.6, 3.0, 0.14, 0.04), 0, (0, 0.15, 0.07))

    # Lower mossy stone rampart wall & front arch gate (-Y)
    b.add(make_box(3.8, 2.35, 1.25, 0.04), 0, (0, 0.18, 0.72))
    b.add_battlements(0, 0.18, 3.8, 2.35, 1.34, 0, count_x=6, count_y=4, h=0.22)
    # Recessed dark arch + double planked oak gate facing -Y
    b.add(make_box(1.32, 0.34, 1.05, 0.03), 0, (0, -1.04, 0.62))
    b.add(make_box(0.46, 0.18, 0.88, 0.015), 2, (-0.25, -1.16, 0.54))
    b.add(make_box(0.46, 0.18, 0.88, 0.015), 2, (0.25, -1.16, 0.54))
    b.add(make_box(0.96, 0.22, 0.08, 0.01), 6, (0, -1.18, 0.38))
    b.add(make_box(0.96, 0.22, 0.08, 0.01), 6, (0, -1.18, 0.72))
    b.add(make_box(1.4, 0.36, 0.12, 0.02), 0, (0, -1.12, 0.06))

    # Corner gnarled oak tree roots flaring out to ground (Z = 0)
    root_paths = [
        [(-1.25, -0.45, 1.45), (-1.85, -0.85, 0.78), (-2.35, -1.25, 0.14)],
        [(1.25, -0.45, 1.45), (1.85, -0.85, 0.78), (2.35, -1.25, 0.14)],
        [(-1.45, 0.85, 1.42), (-2.15, 1.25, 0.75), (-2.55, 1.55, 0.14)],
        [(1.45, 0.85, 1.42), (2.15, 1.25, 0.75), (2.55, 1.55, 0.14)],
        [(-0.75, -0.55, 1.65), (-0.95, -0.95, 1.1), (-1.1, -1.25, 0.18)],
        [(0.75, -0.55, 1.65), (0.95, -0.95, 1.1), (1.1, -1.25, 0.18)],
    ]
    for rp in root_paths:
        b.add(make_tube(rp, [0.26, 0.2, 0.11], segs=8), 1, smooth=True)

    # Central ancient carved Great Oak tree trunk core
    trunk = make_lathe([(0.95, 1.15), (0.86, 1.95), (0.98, 2.75), (0.72, 2.95)], 12)
    b.add(trunk, 1, (0, 0.25, 0), smooth=True)

    # Central octagonal mossy-green wooden shingle roof spire + dormer + golden acorn finial
    b.add(make_cyl(1.32, 0.16, 1.22, 8), 3, (0, 0.25, 3.22))
    # Front dormer turret
    b.add(make_box(0.56, 0.56, 0.52, 0.02), 2, (0, -0.48, 2.85))
    b.add(make_gable_roof(0.72, 0.68, 0.42), 3, (0, -0.52, 3.08))
    b.add(make_box(0.24, 0.1, 0.28), 6, (0, -0.76, 2.86))
    add_golden_acorn(b, (0, 0.25, 3.76), 1.05)

    # Left & Right timbered cottage gatehouses with mossy green roofs + golden acorns
    for sx in (-1, 1):
        cx, cy = sx * 1.48, -0.15
        b.add(make_box(1.12, 1.08, 0.92, 0.02), 2, (cx, cy, 1.78))
        b.add(make_box(1.16, 1.12, 0.1, 0.01), 1, (cx, cy, 1.38))
        b.add(make_box(0.32, 0.08, 0.42), 6, (cx, cy - 0.54, 1.76))
        b.add(make_gable_roof(1.34, 1.28, 0.68), 3, (cx, cy, 2.22))
        add_golden_acorn(b, (cx, cy, 2.85), 0.78)

    # Draped emerald ivy foliage bunches across battlements & stone corners
    ivy_locs = [
        (-1.15, -1.04, 1.25, 1.0), (-0.85, -1.05, 0.92, 0.75), (-1.42, -1.02, 0.72, 0.8),
        (1.05, -1.04, 1.28, 0.95), (1.35, -1.03, 0.88, 0.85), (-1.92, -0.25, 1.15, 0.9),
        (1.92, 0.15, 1.1, 0.9), (0.0, -1.06, 1.32, 0.7),
    ]
    for ix, iy, iz, sc in ivy_locs:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.22 * sc)
        b.add(bm, 4, (ix, iy, iz), scale=(1.1, 0.7, 1.25), smooth=False)

    b.finalize_and_export("env_castle_forest.glb")


def build_castle_canyon():
    clear_scene()
    b = CastleBuilder("env_castle_canyon")

    # Stepped terracotta sandstone plinth
    b.add(make_box(4.65, 3.1, 0.14, 0.04), 8, (0, 0.12, 0.07))

    # Tier 1 Kasbah outer courtyard & flanking bastions
    b.add(make_box(4.15, 2.55, 1.32, 0.04), 7, (0, 0.15, 0.78))
    b.add_battlements(0, 0.15, 4.15, 2.55, 1.44, 7, count_x=6, count_y=4, h=0.24)
    # Left & right raised bastion wings
    for sx in (-1, 1):
        b.add(make_box(1.15, 1.65, 0.65, 0.03), 7, (sx * 1.45, 0.45, 1.72))
        b.add_battlements(sx * 1.45, 0.45, 1.15, 1.65, 2.04, 7, count_x=3, count_y=3, h=0.2)

    # Projected Turquoise Ceramic Mosaic Pishtaq Arch Gateway (-Y)
    b.add(make_box(1.66, 0.44, 1.62, 0.03), 7, (0, -1.12, 0.92))
    # Turquoise ceramic arch border surrounding dark arched doorway
    b.add(make_box(1.36, 0.14, 0.28, 0.02), 9, (0, -1.32, 1.42), solid_uv=True)
    for sx in (-1, 1):
        b.add(make_box(0.24, 0.14, 1.08, 0.02), 9, (sx * 0.56, -1.32, 0.74), solid_uv=True)
    b.add(make_box(0.84, 0.24, 1.02, 0.02), 6, (0, -1.28, 0.58))
    b.add(make_box(1.72, 0.48, 0.14, 0.02), 8, (0, -1.12, 1.72))

    # Mid citadel & Golden Onion Dome central minaret tower
    b.add(make_box(2.05, 1.75, 1.02, 0.04), 7, (0, 0.35, 1.92))
    b.add_battlements(0, 0.35, 2.05, 1.75, 2.43, 8, count_x=4, count_y=4, h=0.2)
    b.add(make_box(1.22, 1.22, 0.78, 0.03), 7, (0, 0.38, 2.76))
    b.add(make_box(0.32, 0.1, 0.42), 6, (0, -0.22, 2.76))
    dome = make_lathe([(0.64, 0.0), (0.74, 0.25), (0.60, 0.52), (0.26, 0.72), (0.04, 0.88), (0.001, 1.05)], 16)
    b.add(dome, 5, (0, 0.38, 3.12), smooth=True)

    # 3 striped cloth bazaar awnings (multi-band stripes visible from above)
    for ax, ay, az, col_a, col_b in [
        (-1.38, -0.66, 1.56, 10, 9),
        (0.0, -0.58, 2.34, 11, 5),
        (1.38, -0.66, 1.56, 10, 11),
    ]:
        for s_i in range(5):
            sx_off = (s_i - 2) * 0.18
            b.add(make_box(0.17, 0.64, 0.08, 0.01), col_a if s_i % 2 == 0 else col_b, (ax + sx_off, ay, az), rot=(-22, 0, 0))
        b.add(make_box(0.28, 0.28, 0.28, 0.02), 2, (ax - 0.18, ay + 0.05, az - 0.32))

    # 2 wrought-iron tripod fire braziers flanking entrance with glowing flames
    for sx in (-1, 1):
        bx, by = sx * 1.38, -1.45
        b.add(make_cyl(0.28, 0.14, 0.32, 8), 6, (bx, by, 0.22))
        b.add(make_cyl(0.32, 0.22, 0.18, 8), 6, (bx, by, 0.42))
        flame = make_lathe([(0.24, 0.0), (0.2, 0.18), (0.08, 0.42), (0.001, 0.56)], 7)
        b.add(flame, 12, (bx, by, 0.48), smooth=False, solid_uv=True)

    b.finalize_and_export("env_castle_canyon.glb")


def add_crystal_cluster(b: CastleBuilder, loc, count: int = 5, scale: float = 1.0):
    x, y, z = loc
    for i in range(count):
        ang = (i / max(1, count)) * math.pi * 2 + 0.3
        tilt = 14 if i > 0 else 0
        h = (0.72 - 0.12 * (i > 0)) * scale
        r = (0.14 if i == 0 else 0.10) * scale
        px = x + (math.cos(ang) * 0.18 * scale if i > 0 else 0)
        py = y + (math.sin(ang) * 0.18 * scale if i > 0 else 0)
        bm = make_cyl(r, 0.015 * scale, h, 6)
        b.add(bm, 15, (px, py, z + h * 0.45), rot=(math.sin(ang) * tilt, math.cos(ang) * tilt, i * 25), solid_uv=True)


def build_castle_cavern():
    clear_scene()
    b = CastleBuilder("env_castle_cavern")

    # Dark cavern stone terrace base
    b.add(make_box(4.5, 3.0, 0.16, 0.04), 14, (0, 0.12, 0.08))

    # Main slate castle keep
    b.add(make_box(3.55, 2.35, 1.52, 0.04), 13, (0, 0.18, 0.90))
    b.add_battlements(0, 0.18, 3.55, 2.35, 1.66, 13, count_x=5, count_y=4, h=0.22)

    # 4 Corner slate towers with crystal crowns
    for sx in (-1, 1):
        for sy in (-1, 1):
            tx, ty = sx * 1.62, 0.18 + sy * 1.02
            b.add(make_box(0.88, 0.88, 1.88, 0.03), 13, (tx, ty, 1.08))
            b.add_battlements(tx, ty, 0.88, 0.88, 2.02, 13, count_x=2, count_y=2, h=0.22)
            add_crystal_cluster(b, (tx, ty, 2.04), count=4, scale=0.68)

    # Central tall spire + glowing cyan slit windows + huge quartz crown
    b.add(make_box(1.38, 1.28, 1.18, 0.04), 13, (0, 0.25, 2.15))
    b.add_battlements(0, 0.25, 1.38, 1.28, 2.74, 13, count_x=3, count_y=3, h=0.22)
    b.add(make_box(0.18, 0.08, 0.42), 15, (-0.28, -0.39, 2.2), solid_uv=True)
    b.add(make_box(0.18, 0.08, 0.42), 15, (0.28, -0.39, 2.2), solid_uv=True)
    add_crystal_cluster(b, (0, 0.25, 2.75), count=7, scale=1.22)

    # Recessed arched wooden gate (-Y)
    b.add(make_box(1.32, 0.34, 1.08, 0.03), 14, (0, -1.04, 0.66))
    b.add(make_box(0.92, 0.16, 0.92, 0.02), 2, (0, -1.16, 0.6))
    b.add(make_box(0.98, 0.2, 0.08), 6, (0, -1.18, 0.6), rot=(0, 35, 0))
    b.add(make_box(0.98, 0.2, 0.08), 6, (0, -1.18, 0.6), rot=(0, -35, 0))

    # Flanking wall crystal bursts
    for sx in (-1, 1):
        add_crystal_cluster(b, (sx * 1.15, -1.08, 0.85), count=3, scale=0.55)

    # Glowing teal cave mushrooms clustered around front corners
    for mx, my, sc in [
        (-1.82, -1.25, 0.95), (-1.52, -1.42, 0.72), (-2.1, -0.85, 0.78),
        (1.82, -1.25, 0.95), (1.52, -1.42, 0.72), (2.1, -0.85, 0.78),
    ]:
        b.add(make_cyl(0.08 * sc, 0.11 * sc, 0.38 * sc, 8), 16, (mx, my, 0.16 + 0.19 * sc))
        b.add(make_cyl(0.28 * sc, 0.14 * sc, 0.18 * sc, 10), 15, (mx, my, 0.16 + 0.42 * sc), solid_uv=True)

    b.finalize_and_export("env_castle_cavern.glb")


def build_castle_snow():
    clear_scene()
    b = CastleBuilder("env_castle_snow")

    # Frosted granite foundation + snowbank rim
    b.add(make_box(4.5, 3.05, 0.16, 0.04), 17, (0, 0.12, 0.08))
    b.add(make_box(4.62, 0.45, 0.22, 0.06), 20, (0, -1.35, 0.12))

    # Heavy granite lower fortress + corner buttresses
    b.add(make_box(3.75, 2.38, 1.48, 0.04), 17, (0, 0.18, 0.88))
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.add(make_box(0.55, 0.55, 1.54, 0.03), 17, (sx * 1.8, 0.18 + sy * 1.08, 0.9))
        # Amber narrow glowing slit windows
        b.add(make_box(0.16, 0.08, 0.42), 22, (sx * 1.25, -1.02, 0.88), solid_uv=True)
        b.add(make_box(0.08, 0.16, 0.42), 22, (sx * 1.88, 0.18, 0.88), solid_uv=True)

    # Silver spiked iron portcullis gate (-Y)
    b.add(make_box(1.32, 0.32, 1.06, 0.03), 18, (0, -1.04, 0.66))
    b.add(make_box(0.98, 0.16, 0.92, 0.01), 14, (0, -1.14, 0.6))
    for gx in (-0.36, -0.18, 0.0, 0.18, 0.36):
        b.add(make_cyl(0.03, 0.03, 0.88, 6), 21, (gx, -1.2, 0.6))
    for gz in (0.42, 0.68):
        b.add(make_box(0.92, 0.06, 0.05), 21, (0, -1.2, gz))

    # Overhanging Nordic pine timber rampart balcony
    b.add(make_box(4.08, 2.68, 0.42, 0.03), 18, (0, 0.18, 1.72))
    b.add_battlements(0, 0.18, 4.08, 2.68, 1.92, 18, count_x=6, count_y=4, h=0.26)
    for sx in (-1, 1):
        b.add(make_box(4.12, 0.16, 0.12, 0.02), 20, (0, 0.18 + sx * 1.3, 1.94))

    # Upper Nordic hall + 3 warm amber windows + steep navy slate roof + snowdrifts
    b.add(make_box(2.38, 1.85, 0.98, 0.03), 18, (0, 0.25, 2.38))
    b.add(make_box(2.42, 1.88, 0.1, 0.01), 2, (0, 0.25, 2.32))
    for wx in (-0.42, 0.0, 0.42):
        b.add(make_box(0.2, 0.08, 0.38), 22, (wx, -0.68, 2.36), solid_uv=True)

    # Navy shingle steep pitched roof
    b.add(make_gable_roof(2.85, 2.35, 1.18), 19, (0, 0.25, 2.82))
    # Fluffy sculpted snowdrifts draped along both pitched roof slopes
    for sx in (-1, 1):
        b.add(make_box(1.38, 2.15, 0.14, 0.05), 20, (sx * 0.68, 0.24, 3.42), rot=(0, sx * 39, 0))
    b.add(make_box(0.32, 2.38, 0.18, 0.06), 20, (0, 0.25, 3.98))

    b.finalize_and_export("env_castle_snow.glb")


def build_castle_foundry():
    clear_scene()
    b = CastleBuilder("env_castle_foundry")

    # Volcanic obsidian plinth
    b.add(make_box(4.65, 3.05, 0.16, 0.04), 23, (0, 0.12, 0.08))

    # Main obsidian fortress body + glowing lava seam core underneath dark segmented stone plates
    b.add(make_box(3.46, 2.24, 1.56, 0.02), 12, (0, 0.18, 0.92), solid_uv=True)
    # Segmented dark obsidian ashlar blocks leaving bright magma cracks cleanly exposed both horizontally & vertically
    for bx in (-1.22, 0.0, 1.22):
        for bz, bh in ((0.46, 0.52), (1.10, 0.50)):
            b.add(make_box(1.02, 2.34, bh, 0.02), 23, (bx, 0.18, bz))
    b.add(make_box(3.54, 2.34, 0.24, 0.02), 23, (0, 0.18, 1.62))
    b.add_battlements(0, 0.18, 3.55, 2.35, 1.74, 23, count_x=5, count_y=4, h=0.22)

    # 4 corner bastions: black obsidian stone blocks separated by razor-thin recessed glowing lava veins
    for sx in (-1, 1):
        for sy in (-1, 1):
            tx, ty = sx * 1.68, 0.18 + sy * 1.05
            b.add(make_box(0.84, 0.84, 1.94, 0.02), 12, (tx, ty, 1.10), solid_uv=True)
            for qx in (-0.235, 0.235):
                for qy in (-0.235, 0.235):
                    b.add(make_box(0.425, 0.425, 0.56, 0.015), 23, (tx + qx, ty + qy, 0.42))
                    b.add(make_box(0.425, 0.425, 0.56, 0.015), 23, (tx + qx, ty + qy, 1.06))
                    b.add(make_box(0.425, 0.425, 0.62, 0.015), 23, (tx + qx, ty + qy, 1.72))
            b.add_battlements(tx, ty, 0.96, 0.96, 2.06, 23, count_x=2, count_y=2, h=0.26)
            b.add(make_box(0.68, 0.68, 0.08, 0.01), 12, (tx, ty, 2.08), solid_uv=True)

    # Center upper foundry keep + glowing crown reservoir
    b.add(make_box(1.48, 1.32, 0.88, 0.03), 23, (0, 0.35, 2.1))
    b.add_battlements(0, 0.35, 1.48, 1.32, 2.54, 23, count_x=3, count_y=3, h=0.22)
    b.add(make_box(1.02, 0.92, 0.08), 12, (0, 0.35, 2.55), solid_uv=True)

    # Horned iron demon/bull arch gateway (-Y)
    b.add(make_box(1.42, 0.38, 1.18, 0.03), 24, (0, -1.04, 0.7))
    for gx in (-0.36, -0.18, 0.0, 0.18, 0.36):
        b.add(make_cyl(0.032, 0.032, 0.96, 6), 6, (gx, -1.24, 0.62))
    # Bull skull + sweeping horns above arch
    b.add(make_box(0.38, 0.24, 0.34, 0.04), 24, (0, -1.26, 1.42))
    for sx in (-1, 1):
        b.add(make_tube([(sx * 0.14, -1.28, 1.5), (sx * 0.38, -1.36, 1.66), (sx * 0.44, -1.32, 1.92)], [0.09, 0.06, 0.02], 6), 24)
        b.add(make_box(0.08, 0.06, 0.06), 12, (sx * 0.1, -1.38, 1.42), solid_uv=True)

    # 2 molten lava pour chutes pouring from front bastions into glowing octagonal pools
    for sx in (-1, 1):
        px = sx * 1.45
        b.add(make_box(0.42, 0.56, 0.16, 0.02), 24, (px, -1.16, 0.96))
        b.add(make_box(0.24, 0.18, 0.84, 0.02), 12, (px, -1.36, 0.56), solid_uv=True)
        b.add(make_cyl(0.42, 0.48, 0.28, 8), 23, (px, -1.38, 0.18))
        b.add(make_cyl(0.34, 0.34, 0.08, 8), 12, (px, -1.38, 0.33), solid_uv=True)

    b.finalize_and_export("env_castle_foundry.glb")


def render_verification_sheet():
    clear_scene()
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"
    scn.cycles.samples = 24
    scn.cycles.use_denoising = True
    scn.render.resolution_x = 1800
    scn.render.resolution_y = 540
    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = VERIFY_SHEET

    world = bpy.data.worlds.new("World")
    scn.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.04, 0.045, 0.065, 1.0)
        bg.inputs["Strength"].default_value = 0.85

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 24.5
    cam = bpy.data.objects.new("Cam", cam_data)
    scn.collection.objects.link(cam)
    cam.location = (0.0, -14.5, 15.2)
    cam.rotation_euler = (math.radians(46), 0.0, 0.0)
    scn.camera = cam

    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 2.6
    sun_data.color = (1.0, 0.95, 0.88)
    sun = bpy.data.objects.new("Sun", sun_data)
    scn.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(38), math.radians(-18), math.radians(-22))

    # Ground dark showcase plinth
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.02))
    fl = bpy.context.active_object
    fl_mat = bpy.data.materials.new("StageMat")
    fl_mat.use_nodes = True
    fl_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, 0.055, 0.075, 1.0)
    fl.data.materials.append(fl_mat)

    files = [
        "env_castle_forest.glb",
        "env_castle_canyon.glb",
        "env_castle_cavern.glb",
        "env_castle_snow.glb",
        "env_castle_foundry.glb",
    ]
    xs = [-8.8, -4.4, 0.0, 4.4, 8.8]
    for fn, xp in zip(files, xs):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(OUT_DIR, fn))
        for o in set(bpy.data.objects) - before:
            if not o.parent:
                o.location.x += xp

    bpy.ops.render.render(write_still=True)
    print("[VERIFY] Saved castle lineup render:", VERIFY_SHEET)


if __name__ == "__main__":
    build_castle_forest()
    build_castle_canyon()
    build_castle_cavern()
    build_castle_snow()
    build_castle_foundry()
    render_verification_sheet()
