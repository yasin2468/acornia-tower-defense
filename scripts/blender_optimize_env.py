"""Palamut Kalesi — G1 static environment atlas packer (Blender 5.2).

Reads finalized GLBs from /tmp/palamut_cc0/_orig_env_glb/ (backing up from
public/models/env_*.glb on first run), bakes transforms into vertices, merges
all textures + flat PBR colors into a single atlas texture per prop, joins into
1 diffuse mesh (+ 1 Crystal_glow mesh on env_crystal, preserving LanternLight on
env_lantern), and re-exports optimized GLBs cleanly.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_optimize_env.py
"""

import math
import os
import shutil
import struct
import json
import bpy
import numpy as np
from mathutils import Matrix

ROOT_DIR = "/Users/yasinozkan/Desktop/Projelerim/palamut-kalesi"
OUT_DIR = os.path.join(ROOT_DIR, "public/models")
ORIG_DIR = "/tmp/palamut_cc0/_orig_env_glb"
DERIVED_DIR = "/tmp/palamut_cc0/_derived"

ENV_MODELS = (
    "env_castle",
    "env_cliff_segment",
    "env_crystal",
    "env_tree_oak",
    "env_tree_pine",
    "env_lantern",
    "env_fence",
    "env_slot_pad",
    "env_stump",
)


def linear_to_srgb(c: float) -> float:
    c = max(0.0, min(1.0, float(c)))
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1.0 / 2.4)) - 0.055


def ensure_orig_backup(name: str) -> str:
    os.makedirs(ORIG_DIR, exist_ok=True)
    orig = os.path.join(ORIG_DIR, f"{name}.glb")
    src = os.path.join(OUT_DIR, f"{name}.glb")
    if not os.path.exists(orig):
        shutil.copy2(src, orig)
    return orig


def save_rgba_png(px: np.ndarray, w: int, h: int, out_path: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img_name = os.path.basename(out_path)
    if img_name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[img_name])
    img = bpy.data.images.new(img_name, w, h, alpha=True)
    img.pixels = np.clip(px, 0.0, 1.0).ravel().tolist()
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def bake_mesh_world(obj):
    mw = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data = obj.data.copy()
    obj.data.transform(mw)
    if mw.determinant() < 0:
        obj.data.flip_normals()
    while len(obj.data.uv_layers) > 1:
        obj.data.uv_layers.remove(obj.data.uv_layers[-1])
    if len(obj.data.uv_layers) == 0:
        obj.data.uv_layers.new(name="UVMap")
    else:
        obj.data.uv_layers[0].name = "UVMap"
    obj.data.uv_layers.active = obj.data.uv_layers[0]
    obj.data.update()


def extract_poly_source(mat):
    """Return ('tex', image) or ('col', (r_srgb, g_srgb, b_srgb)) for a material."""
    if not mat or not mat.node_tree:
        return ("col", (0.7, 0.7, 0.7))
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if not bsdf:
        return ("col", (0.7, 0.7, 0.7))
    bc = bsdf.inputs.get("Base Color")
    if bc and bc.is_linked:
        from_node = bc.links[0].from_node
        if from_node.type == "TEX_IMAGE" and from_node.image and from_node.image.size[0] > 0:
            return ("tex", from_node.image)
    rgba = bc.default_value if bc else (0.7, 0.7, 0.7, 1.0)
    return (
        "col",
        (
            round(linear_to_srgb(rgba[0]), 4),
            round(linear_to_srgb(rgba[1]), 4),
            round(linear_to_srgb(rgba[2]), 4),
        ),
    )


def make_single_material(name: str, image_path: str | None = None, flat_srgb=None,
                         emi_path: str | None = None, emi_strength: float = 0.0,
                         roughness: float = 0.85, metallic: float = 0.03):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if image_path:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image_path, check_existing=False)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    elif flat_srgb is not None:
        # Convert back to linear for Principled BSDF input
        def srgb_to_lin(c):
            return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        bsdf.inputs["Base Color"].default_value = (
            srgb_to_lin(flat_srgb[0]),
            srgb_to_lin(flat_srgb[1]),
            srgb_to_lin(flat_srgb[2]),
            1.0,
        )
    if emi_path and emi_strength > 0:
        etex = nt.nodes.new("ShaderNodeTexImage")
        etex.image = bpy.data.images.load(emi_path, check_existing=False)
        nt.links.new(etex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emi_strength
    return mat


def join_objects(objs, target_name: str, parent_empty):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = target_name
    joined.parent = parent_empty
    joined.matrix_world = Matrix.Identity(4)
    return joined


def pack_diffuse_group(objs, model_name: str, out_mesh_name: str, parent_empty):
    for o in objs:
        bake_mesh_world(o)

    tex_list = []
    tex_index = {}
    col_list = []
    col_index = {}
    poly_maps = []

    for o in objs:
        me = o.data
        per_poly = []
        for poly in me.polygons:
            mat = me.materials[poly.material_index] if poly.material_index < len(me.materials) else None
            kind, val = extract_poly_source(mat)
            if kind == "tex":
                key = val.name.split(".")[0]
                if key not in tex_index:
                    tex_index[key] = len(tex_list)
                    tex_list.append(val)
                per_poly.append(("tex", tex_index[key]))
            else:
                if val not in col_index:
                    col_index[val] = len(col_list)
                    col_list.append(val)
                per_poly.append(("col", col_index[val]))
        poly_maps.append(per_poly)

    if len(tex_list) == 0 and len(col_list) <= 1:
        col = col_list[0] if col_list else (0.7, 0.7, 0.7)
        mat = make_single_material(f"{out_mesh_name}_mat", flat_srgb=col)
        for o in objs:
            o.data.materials.clear()
            o.data.materials.append(mat)
            for p in o.data.polygons:
                p.material_index = 0
        return join_objects(objs, out_mesh_name, parent_empty)

    if len(tex_list) == 0:
        # Pure flat palette in compact 256x256 (4x4 64x64 tiles)
        grid = max(2, math.ceil(math.sqrt(len(col_list))))
        size = 256
        tile = size // grid
        atlas = np.ones((size, size, 4), dtype=np.float32)
        centers = []
        for idx, rgb in enumerate(col_list):
            gx = idx % grid
            gy = idx // grid
            x0, x1 = gx * tile, (gx + 1) * tile
            y0, y1 = gy * tile, (gy + 1) * tile
            atlas[y0:y1, x0:x1, :3] = rgb
            centers.append(((x0 + tile * 0.5) / size, (y0 + tile * 0.5) / size))
        atlas_path = os.path.join(DERIVED_DIR, f"{model_name}_atlas.png")
        save_rgba_png(atlas, size, size, atlas_path)
        for o, pmap in zip(objs, poly_maps):
            uv_layer = o.data.uv_layers[0].data
            for poly, (_, cidx) in zip(o.data.polygons, pmap):
                cu, cv = centers[cidx]
                for li in poly.loop_indices:
                    uv_layer[li].uv = (cu, cv)
        mat = make_single_material(f"{out_mesh_name}_mat", image_path=atlas_path)
        for o in objs:
            o.data.materials.clear()
            o.data.materials.append(mat)
            for p in o.data.polygons:
                p.material_index = 0
        return join_objects(objs, out_mesh_name, parent_empty)

    # 1024x1024 atlas: up to 2 512x512 textures on top row + up to 8 256x256 flat colors on bottom half
    size = 1024
    atlas = np.ones((size, size, 4), dtype=np.float32)
    tex_rects = []
    for tidx, img in enumerate(tex_list[:2]):
        iw, ih = img.size
        src = np.array(img.pixels[:], dtype=np.float32).reshape(ih, iw, 4)
        ys = np.arange(512) * ih // 512
        xs = np.arange(512) * iw // 512
        sampled = src[np.ix_(ys, xs, range(4))]
        qx0 = tidx * 512
        atlas[512:1024, qx0:qx0 + 512] = sampled
        tex_rects.append((qx0 / size, 0.5))

    col_centers = []
    for cidx, rgb in enumerate(col_list[:8]):
        gx = cidx % 4
        gy = cidx // 4
        x0, x1 = gx * 256, (gx + 1) * 256
        y0, y1 = gy * 256, (gy + 1) * 256
        atlas[y0:y1, x0:x1, :3] = rgb
        col_centers.append(((x0 + 128.0) / size, (y0 + 128.0) / size))

    atlas_path = os.path.join(DERIVED_DIR, f"{model_name}_atlas.png")
    save_rgba_png(atlas, size, size, atlas_path)

    for o, pmap in zip(objs, poly_maps):
        uv_layer = o.data.uv_layers[0].data
        for poly, (kind, idx) in zip(o.data.polygons, pmap):
            if kind == "tex":
                u0, v0 = tex_rects[min(idx, len(tex_rects) - 1)]
                for li in poly.loop_indices:
                    u, v = uv_layer[li].uv
                    u = max(0.0, min(1.0, float(u)))
                    v = max(0.0, min(1.0, float(v)))
                    uv_layer[li].uv = (u0 + 0.002 + u * 0.496, v0 + 0.002 + v * 0.496)
            else:
                cu, cv = col_centers[min(idx, len(col_centers) - 1)]
                for li in poly.loop_indices:
                    uv_layer[li].uv = (cu, cv)

    mat = make_single_material(f"{out_mesh_name}_mat", image_path=atlas_path)
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(mat)
        for p in o.data.polygons:
            p.material_index = 0
    return join_objects(objs, out_mesh_name, parent_empty)


def pack_emissive_crystal_glow(glow_objs, parent_empty):
    for o in glow_objs:
        bake_mesh_world(o)
    colors = []
    cindex = {}
    poly_maps = []
    for o in glow_objs:
        me = o.data
        per_poly = []
        for poly in me.polygons:
            mat = me.materials[poly.material_index] if poly.material_index < len(me.materials) else None
            bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat and mat.node_tree else None
            bc = bsdf.inputs["Base Color"].default_value[:3] if bsdf else (0.7, 0.4, 1.0)
            ec = bsdf.inputs["Emission Color"].default_value[:3] if bsdf else (0.5, 0.2, 1.0)
            pair = (
                (round(linear_to_srgb(bc[0]), 4), round(linear_to_srgb(bc[1]), 4), round(linear_to_srgb(bc[2]), 4)),
                (round(linear_to_srgb(ec[0]), 4), round(linear_to_srgb(ec[1]), 4), round(linear_to_srgb(ec[2]), 4)),
            )
            if pair not in cindex:
                cindex[pair] = len(colors)
                colors.append(pair)
            per_poly.append(cindex[pair])
        poly_maps.append(per_poly)

    size = 128
    grid = max(2, math.ceil(math.sqrt(len(colors))))
    tile = size // grid
    base_px = np.ones((size, size, 4), dtype=np.float32)
    emi_px = np.ones((size, size, 4), dtype=np.float32)
    centers = []
    for idx, (bc, ec) in enumerate(colors):
        gx, gy = idx % grid, idx // grid
        x0, x1 = gx * tile, (gx + 1) * tile
        y0, y1 = gy * tile, (gy + 1) * tile
        base_px[y0:y1, x0:x1, :3] = bc
        emi_px[y0:y1, x0:x1, :3] = ec
        centers.append(((x0 + tile * 0.5) / size, (y0 + tile * 0.5) / size))

    base_path = os.path.join(DERIVED_DIR, "crystal_glow_base.png")
    emi_path = os.path.join(DERIVED_DIR, "crystal_glow_emi.png")
    save_rgba_png(base_px, size, size, base_path)
    save_rgba_png(emi_px, size, size, emi_path)

    for o, pmap in zip(glow_objs, poly_maps):
        uv_layer = o.data.uv_layers[0].data
        for poly, cidx in zip(o.data.polygons, pmap):
            cu, cv = centers[cidx]
            for li in poly.loop_indices:
                uv_layer[li].uv = (cu, cv)

    mat = make_single_material(
        "Crystal_glow_mat",
        image_path=base_path,
        emi_path=emi_path,
        emi_strength=1.7,
        roughness=0.22,
        metallic=0.05,
    )
    for o in glow_objs:
        o.data.materials.clear()
        o.data.materials.append(mat)
        for p in o.data.polygons:
            p.material_index = 0
    return join_objects(glow_objs, "Crystal_glow", parent_empty)


def optimize_env_model(name: str):
    orig = ensure_orig_backup(name)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=orig)
    bpy.context.view_layer.update()

    # Preserve special socket Empty (e.g. LanternLight) world position
    sockets = []
    for o in list(bpy.data.objects):
        if o.type == "EMPTY" and "lanternlight" in o.name.lower():
            sockets.append((o.name, o.matrix_world.translation.copy()))

    root_empty = bpy.data.objects.new(f"{name}_root", None)
    bpy.context.scene.collection.objects.link(root_empty)

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]

    created = []
    if name == "env_lantern":
        # Preserve HalloweenBits material & emission map; bake world transform and join into 1 mesh
        shared_mat = meshes[0].data.materials[0] if meshes and meshes[0].data.materials else None
        for m in meshes:
            bake_mesh_world(m)
            if shared_mat:
                m.data.materials.clear()
                m.data.materials.append(shared_mat)
                for p in m.data.polygons:
                    p.material_index = 0
        created.append(join_objects(meshes, name, root_empty))
    elif name == "env_crystal":
        glow_objs = [o for o in meshes if "glow" in o.name.lower()]
        base_objs = [o for o in meshes if o not in glow_objs]
        if base_objs:
            created.append(pack_diffuse_group(base_objs, f"{name}_base", f"{name}_base", root_empty))
        if glow_objs:
            created.append(pack_emissive_crystal_glow(glow_objs, root_empty))
    else:
        created.append(pack_diffuse_group(meshes, name, name, root_empty))

    # Remove leftover unused empties/objects BEFORE creating socket empties so names stay exact
    keep = {root_empty} | set(created)
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)

    # Re-create preserved socket empties at exact world location
    for sname, sloc in sockets:
        emp = bpy.data.objects.new(sname, None)
        emp.empty_display_type = "PLAIN_AXES"
        emp.empty_display_size = 0.2
        bpy.context.scene.collection.objects.link(emp)
        emp.parent = root_empty
        emp.location = sloc

    bpy.context.view_layer.update()
    out_path = os.path.join(OUT_DIR, f"{name}.glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_image_format="AUTO",
        export_extras=False,
        export_lights=False,
        export_cameras=False,
    )


def main():
    for name in ENV_MODELS:
        optimize_env_model(name)
        with open(os.path.join(OUT_DIR, f"{name}.glb"), "rb") as f:
            f.read(12)
            clen, _ = struct.unpack("<II", f.read(8))
            j = json.loads(f.read(clen))
        prims = sum(len(m.get("primitives", [])) for m in j.get("meshes", []))
        print(
            f"OPTIMIZED {name:20s} meshes={len(j.get('meshes', []))} "
            f"prims={prims} mats={len(j.get('materials', []))} kb={os.path.getsize(os.path.join(OUT_DIR, f'{name}.glb'))/1024:.1f}"
        )


if __name__ == "__main__":
    main()
