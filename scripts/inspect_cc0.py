import bpy
import os
from mathutils import Vector

PATHS = [
    "/tmp/palamut_cc0/quaternius/public/glb/mech_pack/George.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/mech_pack/Leela.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/mech_pack/Mike.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/mech_pack/Stan.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/cyberpunk_pack/Enemy_Flying_Gun.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/cyberpunk_pack/Enemy_Flying.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/cyberpunk_pack/Light_Street_1.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/medieval_village_pack/Rock_1.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/modular_dungeon_pack/WallRocks.glb",
    "/tmp/palamut_cc0/kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/nature/rock_single_A.gltf",
    "/tmp/palamut_cc0/kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/nature/hills_A.gltf",
    "/tmp/palamut_cc0/kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/blue/building_archeryrange_blue.gltf",
    "/tmp/palamut_cc0/kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/blue/building_lumbermill_blue.gltf",
    "/tmp/palamut_cc0/kaykit_dungeon/addons/kaykit_dungeon_remastered/Assets/gltf/banner_shield_blue.gltf.glb",
    "/tmp/palamut_cc0/kaykit_dungeon/addons/kaykit_dungeon_remastered/Assets/gltf/barrel_large_decorated.gltf.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/modular_medieval_buildings_pack/SmallSquareTower.glb",
    "/tmp/palamut_cc0/quaternius/public/glb/modular_medieval_buildings_pack/LargeSquareTower.glb",
]

for path in PATHS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not os.path.exists(path):
        print("MISSING", path)
        continue
    bpy.ops.import_scene.gltf(filepath=path)
    acts = [a.name for a in bpy.data.actions]
    info = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            zs = [v.z for v in bb]
            ys = [v.y for v in bb]
            xs = [v.x for v in bb]
            info.append(f"{o.name}:v={len(o.data.vertices)},z=[{min(zs):.2f},{max(zs):.2f}],y=[{min(ys):.2f},{max(ys):.2f}]")
    print(f"=== {os.path.basename(path)} === actions={acts}")
    for line in info:
        print("  ", line)
