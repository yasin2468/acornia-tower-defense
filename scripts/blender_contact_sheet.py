"""Headless contact-sheet renderer for GLB/GLTF assets.

Usage:
  Blender -b -P scripts/blender_contact_sheet.py -- OUT.png [--normalize] [--cols N] [--view iso|front|side|top] file1.glb file2.glb ...

Each asset is placed in its own grid cell (optionally normalized to a unit cell),
labelled with its file name, and rendered with an orthographic camera.
In --view front the camera looks from Blender -Y (== three.js +Z forward).
A red arrow is drawn in every cell pointing toward -Y (three.js +Z) so facing can be checked.
"""
import math
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0]
    files, cols, view, normalize, res = [], 0, "iso", False, 1600
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--cols":
            cols = int(argv[i + 1]); i += 2; continue
        if a == "--view":
            view = argv[i + 1]; i += 2; continue
        if a == "--res":
            res = int(argv[i + 1]); i += 2; continue
        if a == "--normalize":
            normalize = True; i += 1; continue
        files.append(a); i += 1
    return out, files, cols, view, normalize, res


def bounds(objs):
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9)); ok = False
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != "MESH":
            continue
        ok = True
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
        ev.to_mesh_clear()
    return (mn, mx) if ok else (Vector(), Vector())


def mat_emit(name, rgba, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Emission Color"].default_value = rgba
    b.inputs["Emission Strength"].default_value = strength
    return m


def main():
    out, files, cols, view, normalize, res = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    n = len(files)
    cols = cols or max(1, math.ceil(math.sqrt(n)))
    rows = math.ceil(n / cols)
    cell = 1.0 if normalize else 0.0
    placed = []
    max_extent = 0.0
    for idx, f in enumerate(files):
        before = set(bpy.data.objects)
        try:
            bpy.ops.import_scene.gltf(filepath=f)
        except Exception as exc:  # noqa
            print("IMPORT FAIL", f, exc)
            continue
        added = [o for o in bpy.data.objects if o not in before]
        for o in list(added):
            if "icosphere" in o.name.lower():
                bpy.data.objects.remove(o, do_unlink=True)
                added.remove(o)
        holder = bpy.data.objects.new(f"H_{idx}", None)
        scene.collection.objects.link(holder)
        for o in added:
            if o.parent is None:
                o.parent = holder
        mn, mx = bounds(added)
        dims = mx - mn
        ext = max(dims.x, dims.y, dims.z, 1e-4)
        print(f"ASSET {os.path.basename(f)} dims=({dims.x:.3f},{dims.y:.3f},{dims.z:.3f}) min=({mn.x:.3f},{mn.y:.3f},{mn.z:.3f}) max=({mx.x:.3f},{mx.y:.3f},{mx.z:.3f})")
        placed.append((holder, added, f, ext, mn, mx))
        max_extent = max(max_extent, ext)

    spacing = 1.45 if normalize else max_extent * 1.35
    red = mat_emit("FacingArrow", (1, 0.1, 0.05, 1), 2.0)
    for idx, (holder, added, f, ext, mn, mx) in enumerate(placed):
        s = (0.9 / ext) if normalize else 1.0
        holder.scale = (s, s, s)
        r, c = divmod(idx, cols)
        cx, cy = c * spacing, -r * spacing
        if view == "top" or view == "front":
            pass
        # keep each model's own origin (do not recentre) so pivots are visible, but shift into cell
        holder.location = (cx, cy, 0)
        # facing arrow on ground toward -Y (three.js +Z)
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.06 * spacing, depth=0.16 * spacing,
                                        location=(cx, cy - 0.42 * spacing, 0.01), rotation=(math.radians(90), 0, 0))
        arrow = bpy.context.active_object
        arrow.data.materials.append(red)
        # label
        bpy.ops.object.text_add(location=(cx - 0.45 * spacing, cy + 0.40 * spacing, 0.0))
        t = bpy.context.active_object
        t.data.body = os.path.splitext(os.path.basename(f))[0][:28]
        t.data.size = 0.075 * spacing
        t.data.materials.append(mat_emit("Lbl", (0.05, 0.05, 0.08, 1), 0.0))
        if view == "front":
            t.rotation_euler = (math.radians(90), 0, 0)
            t.location = (cx - 0.45 * spacing, cy, -0.12 * spacing)

    # ground grid plane
    gw = cols * spacing; gh = rows * spacing
    bpy.ops.mesh.primitive_plane_add(size=1, location=((cols - 1) * spacing / 2, -(rows - 1) * spacing / 2, -0.002))
    gp = bpy.context.active_object
    gp.scale = (gw, gh, 1)
    gm = bpy.data.materials.new("Ground"); gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.36, 0.42, 0.46, 1)
    gp.data.materials.append(gm)

    # world
    world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
    bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.7, 0.8, 1); bg.inputs[1].default_value = 0.55
    # sun
    sun_data = bpy.data.lights.new("Sun", "SUN"); sun_data.energy = 3.2; sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new("Sun", sun_data); scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))

    # camera
    cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("Cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
    center = Vector(((cols - 1) * spacing / 2, -(rows - 1) * spacing / 2, (0.35 if normalize else max_extent * 0.35)))
    if view == "front":
        cam.location = center + Vector((0, -50, 0)); cam.rotation_euler = (math.radians(90), 0, 0)
    elif view == "side":
        cam.location = center + Vector((50, 0, 0)); cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    elif view == "top":
        cam.location = center + Vector((0, 0, 50)); cam.rotation_euler = (0, 0, 0)
    else:
        d = Vector((0.0, -1.0, 0.95)).normalized() * 50  # from three.js +Z side, elevated like game cam
        d = Vector((0.55, -1.0, 1.05)).normalized() * 50
        cam.location = center + d
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.clip_end = 500
    scene.render.resolution_x = res
    scene.render.resolution_y = max(200, int(res * rows / cols * (0.9 if view == "iso" else 1.0)))
    # fit camera to every object's bounds (models + labels + ground)
    bpy.context.view_layer.update()
    pts = []
    for o in scene.objects:
        if o.type in ("MESH", "FONT") and o.name != gp.name:
            for c in o.bound_box:
                pts.append(o.matrix_world @ Vector(c))
    inv = cam.matrix_world.inverted()
    loc_pts = [inv @ p for p in pts]
    xs = [p.x for p in loc_pts]; ys = [p.y for p in loc_pts]
    cx_, cy_ = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w_, h_ = max(xs) - min(xs), max(ys) - min(ys)
    scene.render.resolution_y = max(200, int(res * h_ / max(w_, 1e-4)))
    cam.location = cam.matrix_world @ Vector((cx_, cy_, 0))
    cam_data.ortho_scale = max(w_, h_) * 1.06
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = eng
            break
        except Exception:
            continue
    try:
        scene.view_settings.view_transform = "Standard"
    except Exception:
        pass
    scene.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", out)


main()
