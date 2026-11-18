"""Inspect GLB/GLTF: objects, mesh/material/texture info, actions.
Blender -b -P scripts/blender_inspect.py -- file1 file2 ...
"""
import sys
import bpy

files = sys.argv[sys.argv.index("--") + 1 :]
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    print("=" * 20, f)
    for o in bpy.data.objects:
        extra = ""
        if o.type == "MESH":
            mats = []
            for m in o.data.materials:
                if not m:
                    continue
                tex = [n.image.name for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image] if m.use_nodes else []
                mats.append(f"{m.name}{'[' + ','.join(tex) + ']' if tex else ''}")
            extra = f" verts={len(o.data.vertices)} uv={len(o.data.uv_layers)} mats={mats}"
        print(f"  {o.type:8s} {o.name!r} parent={o.parent.name if o.parent else None!r} pbone={o.parent_bone!r}{extra}")
    print("  ACTIONS:", [a.name for a in bpy.data.actions])
