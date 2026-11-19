"""Palamut Kalesi — Headless Blender 5.2 builder for:
- 16 new defender tower .glb models (badger, falcon, tortoise, lynx x 4 tiers/evolutions)
- 1 new hero .glb model (hero_wolf — Gümüş Kurt)
- 4 new 3D head accessory .glb models (hat_crown, hat_goggles, hat_antlers, hat_samurai)

Reuses tested helpers & CC0 library cache from scripts/blender_build_chibi_units.py.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_build_new_units_and_hats.py
"""

import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import blender_build_chibi_units as cb  # noqa: E402
from blender_custom_tower_bases import build_custom_tower_base  # noqa: E402

ADV_C = cb.ADV_C
ADV_A = cb.ADV_A
HEX_B = os.path.join(cb.CC0, "kaykit_medieval_hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings")
HEX_P = cb.HEX_P
Q = cb.Q
HERO_SCALE = cb.HERO_SCALE


# ---------------------------------------------------------------------------
# Reference Head & HeadSocket Space Helpers (matches existing hats 1:1)
# ---------------------------------------------------------------------------

def reference_head():
    objs = cb.import_asset(os.path.join(ADV_C, "Barbarian.glb"))
    arm = next(o for o in objs if o.type == "ARMATURE")
    holder = cb.make_empty("RefH")
    for r in cb.roots_of(objs):
        r.parent = holder
    holder.scale = (HERO_SCALE, HERO_SCALE, HERO_SCALE)
    cb.clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    head = next(o for o in objs if o.name == "Barbarian_Head")
    mn, mx = cb.mesh_bounds([head])
    hm = cb.bone_world(arm, "head")
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(holder, do_unlink=True)
    return hm, mn, mx


def hat_parts_to_head_space(parts_objs, hm, out_name):
    meshes = [ob for ob in parts_objs if ob.type == "MESH"]
    root = cb.make_empty("HatRoot")
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
        cb.set_parent_keep(ob, root)
        ob.name = f"Hat_{out_name}_{ob.name}"
    cb.export_glb(out_name, has_armature=False)


def build_hat_crown():
    cb.clear_scene()
    hm, hmn, hmx = reference_head()
    head_w = hmx.x - hmn.x
    cx, cy = (hmn.x + hmx.x) * 0.5, (hmn.y + hmx.y) * 0.5
    base_z = hmx.z - head_w * 0.10

    gold = cb.get_solid_mat("CrownGoldMat", "#f5c238", roughness=0.22, metallic=0.82)
    em_gem = cb.get_solid_mat("CrownEmeraldGem", "#26e885", roughness=0.14, metallic=0.15, emission=0.65)
    parts = []

    holder = cb.make_empty("CrownHolder", loc=(cx, cy, base_z))
    r_outer = head_w * 0.52
    parts.append(cb.make_headband_ring("CrownBand", center=(cx, cy, base_z), rx=r_outer, ry=r_outer * 0.90,
                                       tube_r=head_w * 0.085, solid_mat=gold, parent=holder))
    for i in range(6):
        ang = math.radians(i * 60 + 30)
        px = cx + math.sin(ang) * r_outer * 0.92
        py = cy - math.cos(ang) * r_outer * 0.84
        is_front = i == 5 or i == 0
        h_spike = head_w * (0.28 if is_front else 0.22)
        parts.append(cb.make_smooth_subdiv_prim(f"CrownPoint_{i}", "CONE", (px, py, base_z + h_spike * 0.45),
                                                scale=(head_w * 0.09, head_w * 0.07, h_spike * 0.55),
                                                solid_mat=gold, segs=12, radius=1.0, depth=2.0, subdiv=0, parent=holder))
        parts.append(cb.make_smooth_subdiv_prim(f"CrownOrb_{i}", "SPHERE", (px, py, base_z + h_spike * 0.98),
                                                scale=(head_w * 0.048,) * 3, solid_mat=gold, segs=10, subdiv=0, parent=holder))

    # Front central golden acorn crest + emerald gems
    parts.append(cb.make_smooth_subdiv_prim("CrownAcorn", "SPHERE", (cx, cy - r_outer * 0.90, base_z + head_w * 0.26),
                                            scale=(head_w * 0.09, head_w * 0.085, head_w * 0.11),
                                            solid_mat=gold, segs=14, subdiv=1, parent=holder))
    for gx, gy in ((0.0, -r_outer * 0.96), (-r_outer * 0.65, -r_outer * 0.68), (r_outer * 0.65, -r_outer * 0.68)):
        parts.append(cb.make_smooth_subdiv_prim("CrownGem", "SPHERE", (cx + gx, cy + gy, base_z + head_w * 0.02),
                                                scale=(head_w * 0.065, head_w * 0.045, head_w * 0.08),
                                                solid_mat=em_gem, segs=10, subdiv=0, parent=holder))
    hat_parts_to_head_space(parts, hm, "hat_crown")


def build_hat_goggles():
    cb.clear_scene()
    hm, hmn, hmx = reference_head()
    head_w = hmx.x - hmn.x
    cx, cy = (hmn.x + hmx.x) * 0.5, (hmn.y + hmx.y) * 0.5
    strap_z = hmx.z - head_w * 0.18

    leather = cb.get_solid_mat("GoggleLeather", "#5c3318", roughness=0.72, metallic=0.05)
    brass = cb.get_solid_mat("GoggleBrass", "#e8a832", roughness=0.28, metallic=0.78)
    cyan_lens = cb.get_solid_mat("GoggleLens", "#4ef7f2", roughness=0.10, metallic=0.1, emission=0.85)
    parts = []

    strap = cb.make_headband_ring("GoggleStrap", center=(cx, cy, strap_z), rx=head_w * 0.55, ry=head_w * 0.49,
                                  tube_r=head_w * 0.075, solid_mat=leather)
    parts.append(strap)
    for sx in (-1, 1):
        gx = cx + sx * head_w * 0.22
        gy = cy - head_w * 0.49
        gz = strap_z + head_w * 0.03
        parts.append(cb.make_smooth_subdiv_prim(f"GoggleRim_{sx}", "CYL", (gx, gy, gz),
                                                scale=(head_w * 0.17, head_w * 0.17, head_w * 0.11),
                                                rot_deg=(78, sx * -14, 0), solid_mat=brass, segs=18, radius=1.0, depth=1.0))
        parts.append(cb.make_smooth_subdiv_prim(f"GoggleLens_{sx}", "SPHERE", (gx, gy - head_w * 0.05, gz + head_w * 0.01),
                                                scale=(head_w * 0.135, head_w * 0.06, head_w * 0.135),
                                                rot_deg=(12, sx * 14, 0), solid_mat=cyan_lens, segs=14))
    hat_parts_to_head_space(parts, hm, "hat_goggles")


def build_hat_antlers():
    cb.clear_scene()
    hm, hmn, hmx = reference_head()
    head_w = hmx.x - hmn.x
    cx, cy = (hmn.x + hmx.x) * 0.5, (hmn.y + hmx.y) * 0.5
    band_z = hmx.z - head_w * 0.12

    wood = cb.get_solid_mat("AntlerWood", "#7c4c24", roughness=0.72, metallic=0.04)
    horn = cb.get_solid_mat("AntlerHorn", "#f0e3c6", roughness=0.45, metallic=0.05)
    leaf = cb.get_solid_mat("AntlerLeaf", "#36cf68", roughness=0.48, emission=0.22)
    rune = cb.get_solid_mat("AntlerRune", "#52f0ff", roughness=0.20, emission=0.90)
    parts = []

    parts.append(cb.make_headband_ring("ForestCirclet", center=(cx, cy, band_z), rx=head_w * 0.53, ry=head_w * 0.47,
                                       tube_r=head_w * 0.068, solid_mat=wood))
    parts.append(cb.make_smooth_subdiv_prim("RuneGem", "SPHERE", (cx, cy - head_w * 0.49, band_z),
                                            scale=(head_w * 0.08, head_w * 0.05, head_w * 0.10), solid_mat=rune, segs=12))
    for sx in (-1, 1):
        bx = cx + sx * head_w * 0.34
        by = cy - head_w * 0.04
        # Main antler trunk + 2 fork tines
        parts.append(cb.make_smooth_subdiv_prim(f"AntlerStem_{sx}", "CONE", (bx + sx * head_w * 0.16, by, band_z + head_w * 0.32),
                                                scale=(head_w * 0.07, head_w * 0.07, head_w * 0.38),
                                                rot_deg=(10, sx * -32, 0), solid_mat=horn, segs=12, radius=1.0, depth=2.0, subdiv=0))
        parts.append(cb.make_smooth_subdiv_prim(f"AntlerTineA_{sx}", "CONE", (bx + sx * head_w * 0.28, by - head_w * 0.06, band_z + head_w * 0.56),
                                                scale=(head_w * 0.048, head_w * 0.048, head_w * 0.20),
                                                rot_deg=(-12, sx * -12, 0), solid_mat=horn, segs=10, radius=1.0, depth=2.0, subdiv=0))
        parts.append(cb.make_smooth_subdiv_prim(f"AntlerTineB_{sx}", "CONE", (bx + sx * head_w * 0.42, by + head_w * 0.04, band_z + head_w * 0.44),
                                                scale=(head_w * 0.042, head_w * 0.042, head_w * 0.18),
                                                rot_deg=(8, sx * -55, 0), solid_mat=horn, segs=10, radius=1.0, depth=2.0, subdiv=0))
        parts.append(cb.make_smooth_subdiv_prim(f"AntlerLeaf_{sx}", "SPHERE", (bx + sx * head_w * 0.10, by - head_w * 0.08, band_z + head_w * 0.22),
                                                scale=(head_w * 0.09, head_w * 0.04, head_w * 0.12),
                                                rot_deg=(0, sx * 25, 0), solid_mat=leaf, segs=10))
    hat_parts_to_head_space(parts, hm, "hat_antlers")


def build_hat_samurai():
    cb.clear_scene()
    hm, hmn, hmx = reference_head()
    head_w = hmx.x - hmn.x
    cx, cy = (hmn.x + hmx.x) * 0.5, (hmn.y + hmx.y) * 0.5
    dom_z = hmx.z - head_w * 0.14

    em_lacq = cb.get_solid_mat("SamuraiEmerald", "#1c8056", roughness=0.32, metallic=0.35)
    gold = cb.get_solid_mat("SamuraiGold", "#f5c238", roughness=0.22, metallic=0.84)
    dark_trim = cb.get_solid_mat("SamuraiTrim", "#1b242e", roughness=0.45, metallic=0.6)
    parts = []

    parts.append(cb.make_smooth_subdiv_prim("KabutoDome", "SPHERE", (cx, cy, dom_z),
                                            scale=(head_w * 0.58, head_w * 0.54, head_w * 0.36), solid_mat=em_lacq, segs=18, subdiv=1))
    parts.append(cb.make_smooth_subdiv_prim("KabutoSkirt", "CYL", (cx, cy + head_w * 0.12, dom_z - head_w * 0.10),
                                            scale=(head_w * 0.68, head_w * 0.56, head_w * 0.22),
                                            rot_deg=(-18, 0, 0), solid_mat=dark_trim, segs=18, radius=1.0, depth=1.0))
    parts.append(cb.make_headband_ring("KabutoGoldRim", center=(cx, cy, dom_z - head_w * 0.06),
                                       rx=head_w * 0.57, ry=head_w * 0.52, tube_r=head_w * 0.045, solid_mat=gold))
    # Crescent V-horns on forehead
    for sx in (-1, 1):
        parts.append(cb.make_smooth_subdiv_prim(f"KabutoCrest_{sx}", "CONE", (cx + sx * head_w * 0.20, cy - head_w * 0.50, dom_z + head_w * 0.22),
                                                scale=(head_w * 0.055, head_w * 0.032, head_w * 0.30),
                                                rot_deg=(12, sx * -38, 0), solid_mat=gold, segs=10, radius=1.0, depth=2.0, subdiv=0))
    parts.append(cb.make_smooth_subdiv_prim("KabutoHub", "SPHERE", (cx, cy - head_w * 0.52, dom_z + head_w * 0.04),
                                            scale=(head_w * 0.085, head_w * 0.045, head_w * 0.085), solid_mat=gold, segs=12))
    hat_parts_to_head_space(parts, hm, "hat_samurai")


# ---------------------------------------------------------------------------
# New Chibi Head & Tail Builders (Raccoon, Raven, Mole, Ermine, Silver Wolf)
# ---------------------------------------------------------------------------

def attach_raccoon_tail(hips_local, scale, parent):
    fur_light = cb.get_solid_mat("RaccoonTailLight", "#9c826c", roughness=0.68)
    fur_dark = cb.get_solid_mat("RaccoonTailDark", "#251f26", roughness=0.68)
    # 5 chunky ringed tail segments curling upward behind hips (+Y in Blender)
    segs = [
        (0.0, 0.08, 0.00, 0.14, fur_light),
        (0.0, 0.22, 0.08, 0.17, fur_dark),
        (0.0, 0.36, 0.20, 0.20, fur_light),
        (0.0, 0.44, 0.36, 0.21, fur_dark),
        (0.0, 0.42, 0.52, 0.16, fur_dark),
    ]
    for idx, (ox, oy, oz, rad, mat) in enumerate(segs):
        cb.make_smooth_subdiv_prim(
            f"RaccoonTailSeg_{idx}",
            "SPHERE",
            hips_local + Vector((ox * scale, oy * scale, oz * scale)),
            scale=(rad * scale * 1.15, rad * scale * 1.05, rad * scale * 1.12),
            solid_mat=mat,
            segs=14,
            subdiv=1,
            parent=parent,
        )


def attach_ermine_tail(hips_local, scale, parent):
    fur_white = cb.get_solid_mat("ErmineTailWhite", "#f5f8ff", roughness=0.60)
    fur_tip = cb.get_solid_mat("ErmineTailBlackTip", "#171921", roughness=0.62)
    segs = [
        (0.0, 0.08, 0.00, 0.12, fur_white),
        (0.0, 0.22, 0.07, 0.15, fur_white),
        (0.0, 0.34, 0.20, 0.17, fur_white),
        (0.0, 0.40, 0.36, 0.18, fur_tip),
        (0.0, 0.36, 0.52, 0.14, fur_tip),
    ]
    for idx, (ox, oy, oz, rad, mat) in enumerate(segs):
        cb.make_smooth_subdiv_prim(
            f"ErmineTailSeg_{idx}",
            "SPHERE",
            hips_local + Vector((ox * scale, oy * scale, oz * scale)),
            scale=(rad * scale * 1.05, rad * scale * 1.05, rad * scale * 1.15),
            solid_mat=mat,
            segs=14,
            subdiv=1,
            parent=parent,
        )


def build_raccoon_head(beret_hex="#219649", goggles=False, alch_orb=False):
    hr = cb.make_empty("AnimalHeadRoot")
    fur_main = cb.get_solid_mat("RaccoonMainFur", "#8f7560", roughness=0.66)
    fur_cream = cb.get_solid_mat("RaccoonCreamFur", "#f7e5cd", roughness=0.62)
    fur_dark = cb.get_solid_mat("RaccoonMaskDark", "#251e26", roughness=0.65)
    black_nose = cb.get_solid_mat("RaccoonNoseMat", "#18151a", roughness=0.22)

    elems = [
        {"co": (0.0, -0.02, 0.24), "radius": 0.46, "sx": 1.18, "sy": 0.96, "sz": 0.88},
        {"co": (-0.28, -0.14, 0.06), "radius": 0.30, "sx": 1.22, "sy": 0.92, "sz": 0.78},
        {"co": (0.28, -0.14, 0.06), "radius": 0.30, "sx": 1.22, "sy": 0.92, "sz": 0.78},
    ]
    head = cb.sculpt_metaball_mesh(
        "RkHead", elems, target_dims=(1.18, 0.98, 0.90), target_center_xy=(0.0, -0.03),
        bottom_z=1.22, swatch_col=1, resolution=0.038, smooth_iter=6,
    )
    head.data.materials.clear()
    head.data.materials.append(fur_main)
    head.parent = hr

    # Fluffy raccoon ears + white rim tufts + signature dark bandit eye mask
    for sx in (-1, 1):
        eh = cb.make_empty(f"RkEar_{sx}", loc=(sx * 0.40, 0.02, 1.94), parent=hr)
        eh.rotation_euler = (math.radians(4), math.radians(sx * -22), math.radians(sx * -8))
        cb.make_smooth_subdiv_prim("EarOut", "CONE", (0, 0, 0.14), scale=(0.14, 0.08, 0.18),
                                   solid_mat=fur_main, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        cb.make_smooth_subdiv_prim("EarIn", "CONE", (0, -0.03, 0.12), scale=(0.08, 0.04, 0.12),
                                   solid_mat=fur_cream, segs=12, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        # Signature dark eye bandit mask + bright cream cheek floof
        cb.make_smooth_subdiv_prim(f"RkMask_{sx}", "SPHERE", (sx * 0.25, -0.40, 1.62),
                                   scale=(0.21, 0.13, 0.17), rot_deg=(0, sx * 12, sx * -14),
                                   solid_mat=fur_dark, segs=14, subdiv=1, parent=hr)
        cb.make_smooth_subdiv_prim(f"RkCheek_{sx}", "SPHERE", (sx * 0.38, -0.22, 1.44),
                                   scale=(0.24, 0.16, 0.18), solid_mat=fur_cream, segs=14, subdiv=1, parent=hr)

    hit, loc, _ = cb.raycast_front(head, 0.0, 1.48)
    my = loc.y if hit else -0.46
    cb.make_smooth_subdiv_prim("RkMuzzle", "SPHERE", (0.0, my - 0.02, 1.48),
                               scale=(0.25, 0.18, 0.14), solid_mat=fur_cream, segs=14, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("RkNose", "SPHERE", (0.0, my - 0.17, 1.52),
                               scale=(0.082, 0.064, 0.056), solid_mat=black_nose, segs=12, subdiv=1, parent=hr)
    cb.add_chibi_eyes(head, hr, eye_x=0.24, eye_z=1.62, eye_rx=0.092, eye_rz=0.104,
                      iris_col_hex="#9c541f", brow_col=5, angry_brow=False)

    gear = []
    # Alchemist beret tilted jauntily + brown leather band & gold buckle
    beret_mat = cb.get_solid_mat(f"RkBeret_{beret_hex}", beret_hex, roughness=0.58)
    leather_mat = cb.get_solid_mat("RkBeretBand", "#6b3e1f", roughness=0.65)
    gold_mat = cb.get_solid_mat("RkBeretBuckle", "#f5be36", roughness=0.25, metallic=0.82)
    gear.append(cb.make_smooth_subdiv_prim("NativeHat_RkBeret", "SPHERE", (-0.08, -0.02, 1.98),
                                           scale=(0.56, 0.50, 0.24), rot_deg=(4, 14, 0),
                                           solid_mat=beret_mat, segs=18, subdiv=1, parent=hr))
    gear.append(cb.make_headband_ring("NativeHat_RkBand", center=(0.0, -0.02, 1.88), rx=0.52, ry=0.45,
                                      tube_r=0.048, solid_mat=leather_mat, parent=hr))
    gear.append(cb.make_smooth_subdiv_prim("NativeHat_RkBuckle", "CUBE", (0.0, -0.49, 1.90),
                                           scale=(0.14, 0.04, 0.14), solid_mat=gold_mat, subdiv=2, parent=hr))
    if goggles:
        brass = cb.get_solid_mat("RkGoggleBrass", "#f0b438", roughness=0.28, metallic=0.75)
        lens_g = cb.get_solid_mat("RkGoggleGreen", "#3ef27a", roughness=0.12, emission=0.8)
        for sx in (-1, 1):
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_RkRim_{sx}", "CYL", (sx * 0.21, -0.46, 1.90),
                                                   scale=(0.14, 0.14, 0.08), rot_deg=(76, sx * -10, 0),
                                                   solid_mat=brass, segs=16, radius=1.0, depth=1.0, parent=hr))
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_RkLens_{sx}", "SPHERE", (sx * 0.21, -0.50, 1.91),
                                                   scale=(0.105, 0.04, 0.105), solid_mat=lens_g, segs=12, parent=hr))
    if alch_orb:
        orb = cb.get_solid_mat("RkCrownFlask", "#42f59e", roughness=0.14, emission=0.95)
        gear.append(cb.make_smooth_subdiv_prim("NativeHat_RkGem", "SPHERE", (0.0, -0.34, 2.08),
                                               scale=(0.11, 0.11, 0.15), solid_mat=orb, segs=12, parent=hr))
    return hr, gear


def build_raven_head(hood_hex="#b52330", storm_crest=False):
    hr = cb.make_empty("AnimalHeadRoot")
    midnight = cb.get_solid_mat("RavenPlumageBlue", "#2d3b66", roughness=0.58)
    beak_mat = cb.get_solid_mat("RavenBeakSlate", "#5a6b8c", roughness=0.34, metallic=0.20)
    blush_mat = cb.get_solid_mat("RavenCheekBlush", "#f06a82", roughness=0.66)

    elems = [
        {"co": (0.0, -0.02, 0.24), "radius": 0.45, "sx": 1.08, "sy": 1.00, "sz": 0.92},
        {"co": (0.0, -0.20, 0.08), "radius": 0.30, "sx": 1.06, "sy": 0.96, "sz": 0.78},
    ]
    head = cb.sculpt_metaball_mesh(
        "RvHead", elems, target_dims=(1.06, 0.98, 0.88), target_center_xy=(0.0, -0.03),
        bottom_z=1.22, swatch_col=6, resolution=0.038, smooth_iter=6,
    )
    head.data.materials.clear()
    head.data.materials.append(midnight)
    head.parent = hr

    # Rosy cheeks & crisp pointed chibi raven beak
    for sx in (-1, 1):
        cb.make_smooth_subdiv_prim(f"RvBlush_{sx}", "SPHERE", (sx * 0.29, -0.36, 1.46),
                                   scale=(0.12, 0.06, 0.08), solid_mat=blush_mat, segs=12, subdiv=1, parent=hr)
    hit, loc, _ = cb.raycast_front(head, 0.0, 1.49)
    by = loc.y if hit else -0.46
    cb.make_smooth_subdiv_prim("RvBeak", "CONE", (0.0, by - 0.13, 1.50),
                               scale=(0.12, 0.11, 0.20), rot_deg=(104, 0, 0),
                               solid_mat=beak_mat, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=hr)
    cb.add_chibi_eyes(head, hr, eye_x=0.25, eye_z=1.62, eye_rx=0.098, eye_rz=0.106,
                      iris_col_hex="#ffb824", brow_col=12, angry_brow=False)

    gear = []
    # Signature crimson cowl pulled back slightly above brow with side hood flaps
    hood_mat = cb.get_solid_mat(f"RavenHood_{hood_hex}", hood_hex, roughness=0.62)
    gold_mat = cb.get_solid_mat("RavenGoldClasp", "#f5be36", roughness=0.24, metallic=0.80)
    gear.append(cb.make_smooth_subdiv_prim("NativeHat_RvHoodTop", "SPHERE", (0.0, 0.10, 1.88),
                                           scale=(0.56, 0.54, 0.40), rot_deg=(-14, 0, 0),
                                           solid_mat=hood_mat, segs=18, subdiv=1, parent=hr))
    for sx in (-1, 1):
        gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_RvHoodFlap_{sx}", "SPHERE", (sx * 0.44, -0.02, 1.58),
                                               scale=(0.15, 0.34, 0.34), rot_deg=(0, sx * 10, sx * -10),
                                               solid_mat=hood_mat, segs=14, subdiv=1, parent=hr))
    gear.append(cb.make_smooth_subdiv_prim("NativeHat_RvHoodPeak", "CONE", (0.0, 0.40, 2.04),
                                           scale=(0.24, 0.24, 0.28), rot_deg=(54, 0, 0),
                                           solid_mat=hood_mat, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=hr))
    # Golden feather brooch below chin
    cb.make_smooth_subdiv_prim("RvFeatherClasp", "SPHERE", (-0.12, -0.44, 1.24),
                               scale=(0.14, 0.05, 0.07), rot_deg=(10, 0, 28),
                               solid_mat=gold_mat, segs=12, subdiv=1, parent=hr)
    if storm_crest:
        bolt = cb.get_solid_mat("RavenStormBolt", "#5ef4ff", roughness=0.14, emission=1.15)
        for sx in (-1, 0, 1):
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_RvBolt_{sx}", "CONE", (sx * 0.18, -0.04, 2.24),
                                                   scale=(0.055, 0.04, 0.19), rot_deg=(-18, sx * -16, 0),
                                                   solid_mat=bolt, segs=10, radius=1.0, depth=2.0, subdiv=0, parent=hr))
    return hr, gear


def build_mole_head(lamp_tier=1, armored_rim=False):
    hr = cb.make_empty("AnimalHeadRoot")
    fur_mat = cb.get_solid_mat("MoleVelvetBrown", "#6e4937", roughness=0.66)
    muzzle_mat = cb.get_solid_mat("MoleCreamSnout", "#f2d8bc", roughness=0.60)
    pink_nose = cb.get_solid_mat("MolePinkButtonNose", "#f56c88", roughness=0.35)
    blush_mat = cb.get_solid_mat("MoleCheekBlush", "#ed7b8c", roughness=0.66)
    tooth_mat = cb.get_solid_mat("MoleToothWhite", "#ffffff", roughness=0.22)
    brass_mat = cb.get_solid_mat("MoleBrassSpec", "#e8ae35", roughness=0.26, metallic=0.80)
    dark_bronze = cb.get_solid_mat("MoleBronzeBezel", "#6e4c14", roughness=0.36, metallic=0.72)

    elems = [
        {"co": (0.0, -0.04, 0.22), "radius": 0.45, "sx": 1.16, "sy": 1.00, "sz": 0.88},
        {"co": (0.0, -0.26, 0.06), "radius": 0.30, "sx": 1.18, "sy": 0.94, "sz": 0.72},
    ]
    head = cb.sculpt_metaball_mesh(
        "MlHead", elems, target_dims=(1.14, 1.00, 0.86), target_center_xy=(0.0, -0.04),
        bottom_z=1.22, swatch_col=4, resolution=0.038, smooth_iter=6,
    )
    head.data.materials.clear()
    head.data.materials.append(fur_mat)
    head.parent = hr

    hit, loc, _ = cb.raycast_front(head, 0.0, 1.46)
    my = loc.y if hit else -0.48
    cb.make_smooth_subdiv_prim("MlMuzzle", "SPHERE", (0.0, my - 0.02, 1.44),
                               scale=(0.27, 0.17, 0.15), solid_mat=muzzle_mat, segs=16, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("MlPinkNose", "SPHERE", (0.0, my - 0.16, 1.50),
                               scale=(0.092, 0.072, 0.065), solid_mat=pink_nose, segs=14, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("MlBuckTooth", "CUBE", (0.0, my - 0.11, 1.36),
                               scale=(0.085, 0.038, 0.072), solid_mat=tooth_mat, subdiv=2, parent=hr)
    for sx in (-1, 1):
        cb.make_smooth_subdiv_prim(f"MlBlush_{sx}", "SPHERE", (sx * 0.34, -0.36, 1.45),
                                   scale=(0.13, 0.07, 0.09), solid_mat=blush_mat, segs=12, subdiv=1, parent=hr)

    cb.add_chibi_eyes(head, hr, eye_x=0.23, eye_z=1.63, eye_rx=0.090, eye_rz=0.098,
                      iris_col_hex="#9c541f", brow_col=5, angry_brow=False)

    # Open hollow brass spectacles around expressive eyes (no opaque cylinder!)
    for sx in (-1, 1):
        rim = cb.make_headband_ring(
            f"MlSpecFrame_{sx}", center=(0.0, 0.0, 0.0), rx=0.128, ry=0.128,
            tube_r=0.020, solid_mat=brass_mat, parent=hr,
        )
        rim.location = (sx * 0.23, -0.505, 1.63)
        rim.rotation_euler = (math.radians(90), 0, 0)
    cb.make_smooth_subdiv_prim("MlSpecBridge", "CUBE", (0.0, -0.505, 1.63),
                               scale=(0.14, 0.025, 0.025), solid_mat=brass_mat, subdiv=1, parent=hr)

    gear = []
    # Yellow-brass miner helmet with dark bronze bezel & glowing amber headlamp
    helm_mat = cb.get_solid_mat(f"MoleHelmMat_{armored_rim}", "#7c8d9e" if armored_rim else "#f2c230",
                                roughness=0.28, metallic=0.68 if armored_rim else 0.48)
    lamp_mat = cb.get_solid_mat(f"MoleLampCrystal_{lamp_tier}", "#ffe05c", roughness=0.08, emission=1.4 + lamp_tier * 0.25)
    gear.append(cb.make_smooth_subdiv_prim("NativeHat_MlDome", "SPHERE", (0.0, -0.02, 1.88),
                                           scale=(0.56, 0.50, 0.30), solid_mat=helm_mat, segs=18, subdiv=1, parent=hr))
    gear.append(cb.make_headband_ring("NativeHat_MlBrim", center=(0.0, -0.04, 1.80), rx=0.58, ry=0.51,
                                      tube_r=0.056, solid_mat=brass_mat, parent=hr))
    gear.append(cb.make_smooth_subdiv_prim("NativeHat_MlLampSocket", "CYL", (0.0, -0.49, 1.94),
                                           scale=(0.125, 0.125, 0.11), rot_deg=(84, 0, 0),
                                           solid_mat=dark_bronze, segs=16, radius=1.0, depth=1.0, parent=hr))
    gear.append(cb.make_smooth_subdiv_prim("NativeHat_MlLampGem", "SPHERE", (0.0, -0.55, 1.95),
                                           scale=(0.095, 0.06, 0.095), solid_mat=lamp_mat, segs=14, parent=hr))
    return hr, gear


def build_ermine_head(scarf_hex="#2563eb", crown_crystals=False, twin_violet=False):
    hr = cb.make_empty("AnimalHeadRoot")
    white_fur = cb.get_solid_mat("ErmineSnowWhite", "#f7faff", roughness=0.56)
    pink_ear = cb.get_solid_mat("ErminePinkInnerEar", "#f598b0", roughness=0.64)
    pink_nose = cb.get_solid_mat("ErminePinkNose", "#e85d7e", roughness=0.35)
    blush_mat = cb.get_solid_mat("ErmineCheekBlush", "#ff94aa", roughness=0.65)

    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.44, "sx": 1.12, "sy": 0.98, "sz": 0.88},
        {"co": (-0.25, -0.14, 0.05), "radius": 0.28, "sx": 1.14, "sy": 0.90, "sz": 0.78},
        {"co": (0.25, -0.14, 0.05), "radius": 0.28, "sx": 1.14, "sy": 0.90, "sz": 0.78},
    ]
    head = cb.sculpt_metaball_mesh(
        "ErHead", elems, target_dims=(1.12, 0.96, 0.86), target_center_xy=(0.0, -0.03),
        bottom_z=1.22, swatch_col=8, resolution=0.038, smooth_iter=6,
    )
    head.data.materials.clear()
    head.data.materials.append(white_fur)
    head.parent = hr

    # Small rounded ermine ears (no lynx tufts!) with pink inner cushion
    for sx in (-1, 1):
        eh = cb.make_empty(f"ErEar_{sx}", loc=(sx * 0.36, 0.00, 1.94), parent=hr)
        eh.rotation_euler = (math.radians(4), math.radians(sx * -26), math.radians(sx * -6))
        cb.make_smooth_subdiv_prim("EarOut", "SPHERE", (0, 0, 0.04), scale=(0.145, 0.085, 0.145),
                                   solid_mat=white_fur, segs=16, subdiv=1, parent=eh)
        cb.make_smooth_subdiv_prim("EarIn", "SPHERE", (0, -0.05, 0.04), scale=(0.092, 0.045, 0.092),
                                   solid_mat=pink_ear, segs=12, subdiv=1, parent=eh)
        cb.make_smooth_subdiv_prim(f"ErBlush_{sx}", "SPHERE", (sx * 0.32, -0.36, 1.46),
                                   scale=(0.13, 0.065, 0.085), solid_mat=blush_mat, segs=12, subdiv=1, parent=hr)

    hit, loc, _ = cb.raycast_front(head, 0.0, 1.48)
    my = loc.y if hit else -0.45
    cb.make_smooth_subdiv_prim("ErMuzzle", "SPHERE", (0.0, my - 0.01, 1.46),
                               scale=(0.24, 0.15, 0.13), solid_mat=white_fur, segs=14, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("ErNose", "SPHERE", (0.0, my - 0.14, 1.51),
                               scale=(0.068, 0.052, 0.048), solid_mat=pink_nose, segs=12, subdiv=1, parent=hr)
    cb.add_chibi_eyes(head, hr, eye_x=0.22, eye_z=1.62, eye_rx=0.094, eye_rz=0.104,
                      iris_col_hex="#36b5ff", brow_col=6, angry_brow=False)

    gear = []
    # Trim cozy knit neck scarf with trailing end & glowing frost snowflake brooch
    scarf_mat = cb.get_solid_mat(f"ErmineScarf_{scarf_hex}", scarf_hex, roughness=0.68)
    flake_mat = cb.get_solid_mat("ErmineSnowflakeGem", "#80f4ff" if not twin_violet else "#c98aff", roughness=0.12, emission=1.1)
    cb.make_headband_ring("ErScarfRing", center=(0.0, -0.02, 1.21), rx=0.28, ry=0.26,
                          tube_r=0.062, solid_mat=scarf_mat, parent=hr)
    cb.make_smooth_subdiv_prim("ErScarfTail", "CUBE", (0.16, -0.28, 1.06),
                               scale=(0.11, 0.04, 0.18), rot_deg=(-8, 0, -14), solid_mat=scarf_mat, subdiv=2, parent=hr)
    cb.make_smooth_subdiv_prim("ErSnowflakeBrooch", "SPHERE", (0.14, -0.30, 1.21),
                               scale=(0.085, 0.045, 0.085), solid_mat=flake_mat, segs=8, parent=hr)
    if crown_crystals:
        for sx in (-1, 0, 1):
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_ErCrystal_{sx}", "CONE", (sx * 0.16, -0.42, 1.92),
                                                   scale=(0.055, 0.045, 0.16 if sx == 0 else 0.11), rot_deg=(12, sx * -14, 0),
                                                   solid_mat=flake_mat, segs=8, radius=1.0, depth=2.0, subdiv=0, parent=hr))
    return hr, gear


def build_wolf_head():
    hr = cb.make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.44, "sx": 1.12, "sy": 0.98, "sz": 0.90},
        {"co": (0.0, -0.26, 0.06), "radius": 0.28, "sx": 0.92, "sy": 1.10, "sz": 0.72},
        {"co": (0.0, -0.40, 0.05), "radius": 0.17, "sx": 0.76, "sy": 1.14, "sz": 0.68},
        {"co": (0.0, 0.04, -0.04), "radius": 0.34, "sx": 1.18, "sy": 0.96, "sz": 0.68},
    ]
    head = cb.sculpt_metaball_mesh("WfHead", elems, target_dims=(1.04, 1.06, 0.86), target_center_xy=(0.0, -0.04),
                                   bottom_z=1.24, swatch_col=6, resolution=0.038, smooth_iter=6)
    head.parent = hr

    for sx in (-1, 1):
        eh = cb.make_empty(f"WfEar_{sx}", loc=(sx * 0.32, 0.04, 1.92), parent=hr)
        eh.rotation_euler = (math.radians(4), math.radians(sx * -16), math.radians(sx * -8))
        cb.make_smooth_subdiv_prim("EarOut", "CONE", (0, 0, 0.17), scale=(0.145, 0.09, 0.22),
                                   swatch_col=6, segs=16, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        cb.make_smooth_subdiv_prim("EarIn", "CONE", (0, -0.03, 0.14), scale=(0.078, 0.045, 0.14),
                                   swatch_col=8, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=eh)

    hit, loc, _ = cb.raycast_front(head, 0.0, 1.48)
    my = loc.y if hit else -0.52
    cb.make_smooth_subdiv_prim("WfMuzzle", "SPHERE", (0.0, my + 0.06, 1.47),
                               scale=(0.24, 0.22, 0.14), swatch_col=8, segs=16, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("WfNose", "SPHERE", (0.0, my - 0.10, 1.54),
                               scale=(0.082, 0.064, 0.056), swatch_col=12, segs=12, subdiv=1, parent=hr)
    cb.add_chibi_eyes(head, hr, eye_x=0.23, eye_z=1.62, eye_rx=0.082, eye_rz=0.092, iris_col_hex="#55e8ff", brow_col=6)
    return hr, []


# ---------------------------------------------------------------------------
# New Tower Builder (16 models)
# ---------------------------------------------------------------------------

def hex_building(color, name):
    return os.path.join(HEX_B, color, f"building_{name}_{color}.gltf")


def _add_cog_turntable(parent, center, radius, mat_brass):
    spin = cb.make_empty("SpinPart", loc=center)
    cb.set_parent_keep(spin, parent)
    ring = cb.make_smooth_subdiv_prim(
        "MoleCogHub", "CYL", center,
        scale=(radius, radius, 0.055), solid_mat=mat_brass, segs=18, radius=1.0, depth=1.0,
    )
    cb.set_parent_keep(ring, spin)
    for i in range(8):
        ang = i * (math.pi / 4.0)
        tx = center[0] + math.cos(ang) * (radius + 0.045)
        ty = center[1] + math.sin(ang) * (radius + 0.045)
        tooth = cb.make_smooth_subdiv_prim(
            f"MoleCogTooth_{i}", "CUBE", (tx, ty, center[2]),
            scale=(0.055, 0.055, 0.050), rot_deg=(0, 0, math.degrees(ang)),
            solid_mat=mat_brass, subdiv=1,
        )
        cb.set_parent_keep(tooth, spin)
    return spin


def build_new_tower_glb(model_name):
    cb.clear_scene()
    root = cb.make_empty("TowerRoot")

    if model_name.startswith("tower_badger_"):
        # Chibi Rakun İksirci -> Fosforlu Mantar Kulesi (Seçenek 1)
        suf = model_name.replace("tower_badger_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("badger", suf, tier, root)

        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        armor_col = "#219649" if suf in ("t1", "t2") else "#bd3a22" if suf == "inferno" else "#7d35d4"
        tex = cb.ensure_kaykit_variant_tex(
            "mage",
            f"raccoon_{suf}",
            paw_hex="#342b29",
            hue_shift=0.14 if suf == "corrosion" else -0.18 if suf == "inferno" else 0.08,
            sat_mult=1.18,
            armor_tint=armor_col,
            armor_mix=0.40,
        )
        head, _ = build_raccoon_head(
            beret_hex=armor_col,
            goggles=(suf in ("t2", "inferno", "corrosion")),
            alch_orb=(suf == "corrosion"),
        )
        cg, wg = cb.build_tower_crew_mounted(
            turret_head, "Mage.glb", ("1H_Wand",), "Spellcasting", 6,
            head, deck_z, tex_path=tex, offset=(0.04, 0.04), tail_fn=attach_raccoon_tail,
        )
        # Cross chest potion bandolier vials on CharacterGroup front (-Y)
        strap_mat = cb.get_solid_mat("RaccoonBandolierLeather", "#5c3419", roughness=0.62)
        strap = cb.make_smooth_subdiv_prim(
            "RaccoonBandolier", "CUBE", (0.04, -0.11, deck_z + 0.28),
            scale=(0.045, 0.045, 0.26), rot_deg=(0, 48, 0), solid_mat=strap_mat, subdiv=1,
        )
        cb.set_parent_keep(strap, cg)
        vial_colors = ("#3ef582", "#35d4ff", "#ffe14d") if suf != "inferno" else ("#ff7e29", "#ffd23b", "#ff4224")
        for idx, vx in enumerate((-0.05, 0.04, 0.13)):
            vmat = cb.get_solid_mat(f"RaccoonVial_{suf}_{idx}", vial_colors[idx], roughness=0.14, emission=0.85)
            vial = cb.make_smooth_subdiv_prim(
                f"RaccoonVial_{idx}", "CYL", (vx, -0.14, deck_z + 0.24 + idx * 0.045),
                scale=(0.026, 0.026, 0.070), rot_deg=(8, 35, 0), solid_mat=vmat, segs=10, radius=1.0, depth=1.0,
            )
            cb.set_parent_keep(vial, cg)

        # Brass potion mortar cannon + glowing brew orb on WeaponGroup
        cauldron_mat = cb.get_solid_mat(
            f"RaccoonCauldron_{suf}",
            "#3c4754" if suf != "inferno" else "#78311e",
            roughness=0.36, metallic=0.72,
        )
        brass_mat = cb.get_solid_mat("RaccoonMortarBrass", "#e5ac39", roughness=0.26, metallic=0.82)
        glow_col = "#ff7e1f" if suf == "inferno" else "#b766ff" if suf == "corrosion" else "#3bf27a"
        glow_mat = cb.get_solid_mat(f"RaccoonBrew_{suf}", glow_col, roughness=0.14, emission=1.25)
        barrel = cb.make_smooth_subdiv_prim(
            "RaccoonMortarTube", "CYL", (0.28, -0.18, deck_z + 0.16),
            scale=(0.155, 0.155, 0.34), rot_deg=(58, 0, 0), solid_mat=cauldron_mat, segs=16, radius=1.0, depth=1.0,
        )
        collar = cb.make_smooth_subdiv_prim(
            "RaccoonMortarCollar", "CYL", (0.28, -0.25, deck_z + 0.21),
            scale=(0.175, 0.175, 0.075), rot_deg=(58, 0, 0), solid_mat=brass_mat, segs=16, radius=1.0, depth=1.0,
        )
        brew = cb.make_smooth_subdiv_prim(
            "RaccoonBrewCore", "SPHERE", (0.28, -0.32, deck_z + 0.25),
            scale=(0.12, 0.12, 0.12), solid_mat=glow_mat, segs=12,
        )
        cb.set_parent_keep(barrel, wg)
        cb.set_parent_keep(collar, wg)
        cb.set_parent_keep(brew, wg)

    elif model_name.startswith("tower_falcon_"):
        # Chibi Kuzgun Nişancı -> Gotik Çan & Fener Kulesi (Seçenek 2)
        suf = model_name.replace("tower_falcon_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("falcon", suf, tier, root)

        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        hood_col = "#b52330" if suf != "tempest" else "#2c4fa8"
        tex = cb.ensure_kaykit_variant_tex(
            "rogue", f"raven_v2_{suf}", paw_hex="#2d3b66",
            hue_shift=0.22 if suf == "tempest" else -0.35, sat_mult=1.15,
            armor_tint=hood_col, armor_mix=0.55,
        )
        head, _ = build_raven_head(hood_hex=hood_col, storm_crest=(suf == "tempest"))
        _, wg = cb.build_tower_crew_mounted(
            turret_head, "Rogue.glb", ("1H_Crossbow",), "1H_Ranged_Aiming", 4,
            head, deck_z, tex_path=tex, offset=(0.04, 0.04),
        )
        bh, _ = cb.place(os.path.join(Q, "medieval_weapons_pack/Bow_Golden.glb"),
                         max_xy=0.58 if suf == "skyhunter" else 0.46,
                         loc=(-0.22, -0.18, deck_z + 0.22), rot_deg=(10, -20, -90), ground=False)
        cb.set_parent_keep(bh, wg)
        # Cyan lightning arrow loaded at the bow
        bolt_mat = cb.get_solid_mat("RavenCyanArrow", "#4ef2ff", roughness=0.14, emission=1.15)
        arrow_shaft = cb.make_smooth_subdiv_prim(
            "RavenLightningShaft", "CYL", (-0.22, -0.32, deck_z + 0.23),
            scale=(0.018, 0.018, 0.34), rot_deg=(90, 0, 0), solid_mat=bolt_mat, segs=8, radius=1.0, depth=1.0,
        )
        arrow_tip = cb.make_smooth_subdiv_prim(
            "RavenLightningTip", "CONE", (-0.22, -0.52, deck_z + 0.23),
            scale=(0.052, 0.052, 0.095), rot_deg=(90, 0, 0), solid_mat=bolt_mat, segs=8, radius=1.0, depth=2.0, subdiv=0,
        )
        cb.set_parent_keep(arrow_shaft, wg)
        cb.set_parent_keep(arrow_tip, wg)

        if suf == "tempest":
            cb.spin_orbit_crystals(turret_head, z=0.20, count=3, radius=0.62, color="#6ef2ff", emi="#2cd8ff", height=0.16)

    elif model_name.startswith("tower_tortoise_"):
        # Chibi Köstebek Mühendis -> Maden Tüneli İstihkâmı (Seçenek 1)
        suf = model_name.replace("tower_tortoise_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("tortoise", suf, tier, root)

        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        tex = cb.ensure_kaykit_variant_tex(
            "knight", f"mole_{suf}", paw_hex="#7a513e",
            hue_shift=0.05, sat_mult=1.12,
            armor_tint="#cc902d" if suf != "bastion" else "#567085", armor_mix=0.48,
        )
        head, _ = build_mole_head(lamp_tier=tier, armored_rim=(suf == "bastion"))
        _, wg = cb.build_tower_crew_mounted(
            turret_head, "Knight.glb", ("Spike_Shield",), "Blocking" if suf == "bastion" else "Idle", 4,
            head, deck_z, tex_path=tex, offset=(0.04, 0.05),
        )
        # Spinning brass engineering cogwheel turntable on turret head
        brass_gear = cb.get_solid_mat("MoleCogBrass", "#e3a72e", roughness=0.25, metallic=0.84)
        _add_cog_turntable(turret_head, (0.0, 0.0, deck_z + 0.06), 0.30, brass_gear)

        ch, _ = cb.place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.50 if tier >= 2 else 0.38,
                         loc=(0.24, -0.22, deck_z + 0.02), rot_deg=(0, 0, -90))
        cb.set_parent_keep(ch, wg)
        if suf in ("quake", "bastion"):
            ch2, _ = cb.place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.46,
                              loc=(-0.24, -0.22, deck_z + 0.02), rot_deg=(0, 0, -90))
            cb.set_parent_keep(ch2, wg)

    elif model_name.startswith("tower_lynx_"):
        # Chibi Kakım Buz Okçusu -> Safir Buzul Kristali (Seçenek 3)
        suf = model_name.replace("tower_lynx_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        _, deck_z = build_custom_tower_base("lynx", suf, tier, root)

        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        scarf_col = "#2563eb" if suf != "flurry" else "#5645d6"
        tex = cb.ensure_kaykit_variant_tex(
            "rogue", f"ermine_v2_{suf}", paw_hex="#f2f6ff",
            hue_shift=-0.12 if suf == "flurry" else 0.08, sat_mult=0.95,
            armor_tint="#3b6ea8" if suf != "flurry" else "#5c4bc4", armor_mix=0.35,
        )
        head, _ = build_ermine_head(
            scarf_hex=scarf_col,
            crown_crystals=(suf in ("t2", "frostbite")),
            twin_violet=(suf == "flurry"),
        )
        _, wg = cb.build_tower_crew_mounted(
            turret_head, "Rogue.glb", ("1H_Crossbow",), "2H_Ranged_Aiming", 4,
            head, deck_z, tex_path=tex, offset=(0.04, 0.04), tail_fn=attach_ermine_tail,
            extra_hand_props=((os.path.join(ADV_A, "crossbow_2handed.gltf"), "handslot.r", 1.05),) if tier >= 2 else (),
        )
        rh, ro = cb.place(os.path.join(Q, "modular_sci_fi_guns_pack/Crossbow_2.glb"), max_xy=0.52 if tier >= 2 else 0.40,
                          loc=(-0.22, -0.20, deck_z + 0.18), rot_deg=(0, 0, -90))
        xbow_col = "#66eeff" if suf != "flurry" else "#9b78ff"
        cb.set_flat_color(ro, ("White", "Grey", "LightGrey", "Accent"),
                          xbow_col, emission_hex=xbow_col, emission_strength=1.05, roughness=0.25)
        cb.set_parent_keep(rh, wg)
        if suf in ("frostbite", "flurry"):
            orb_col = "#72f2ff" if suf == "frostbite" else "#a88cff"
            cb.spin_orbit_crystals(turret_head, z=0.22, count=4 if suf == "frostbite" else 3,
                                   radius=0.60, color=orb_col, emi=orb_col, height=0.17)
    else:
        raise ValueError(f"Unknown new tower model: {model_name}")

    cb.finalize_ground(root)
    cb.export_glb(model_name, has_armature=False)


# ---------------------------------------------------------------------------
# New Hero Builder: hero_wolf (Gümüş Kurt)
# ---------------------------------------------------------------------------

def build_hero_wolf():
    cb.clear_scene()
    char_file = "Knight.glb"
    tex = cb.ensure_kaykit_variant_tex(
        "knight", "wolf_frost", paw_hex="#c2d2e3", hue_shift=0.14, sat_mult=1.22,
        armor_tint="#6c8eb5", armor_mix=0.45,
    )
    keep = {"1H_Sword"}
    keep_actions = ("Idle", "Walking_A", "Running_A", "1H_Melee_Attack_Chop", "Cheer", "Hit_A")
    default_action = "Idle"

    objs = cb.import_asset(os.path.join(ADV_C, char_file))
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

    cb.retexture(body_meshes, "knight", tex)

    for act in list(bpy.data.actions):
        if act.name not in keep_actions:
            bpy.data.actions.remove(act)
        else:
            act.use_fake_user = True

    cb.clear_nla(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.context.view_layer.update()

    head_root, _ = build_wolf_head()
    head_mesh_objs = list(cb.collect_meshes(head_root))
    cb.skin_meshes_to_bone(head_mesh_objs, arm, "WolfChibiHead", "head")

    # Silver wolf fluffy tail skinned to hips
    tail_holder = cb.make_empty("WolfTailTmp")
    hips_m = cb.bone_world(arm, "hips")
    hips_pos = hips_m.translation
    tail_obj = cb.attach_squirrel_tail(tail_holder, hips_pos=hips_pos + Vector((0.0, 0.14, 0.02)), scale=0.86, swatch_col=6)
    tail_tip = cb.make_smooth_subdiv_prim("WolfTailTip", "SPHERE",
                                          hips_pos + Vector((0.10, 0.28, 0.72)),
                                          scale=(0.13, 0.13, 0.17), swatch_col=8, segs=12, parent=tail_holder)
    cb.skin_meshes_to_bone([tail_obj, tail_tip], arm, "WolfTailMesh", "hips")

    for o in list(bpy.data.objects):
        if o.type == "EMPTY" and (o is head_root or o is tail_holder or o.name.startswith("WfEar_")):
            bpy.data.objects.remove(o, do_unlink=True)

    root = cb.make_empty("HeroRoot")
    body = cb.make_empty("Body", parent=root)
    holder = cb.make_empty("HeroScale", parent=body)
    holder.scale = (HERO_SCALE * 1.0, HERO_SCALE * 1.0, HERO_SCALE * 1.0)
    for r in cb.roots_of([o for o in bpy.data.objects if o not in (body, root, holder)]):
        r.parent = holder
    bpy.context.view_layer.update()

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    mn, _ = cb.mesh_bounds(all_meshes)
    holder.location.z -= mn.z
    bpy.context.view_layer.update()

    head_m = cb.bone_world(arm, "head")
    sock = cb.make_empty("HeadSocket")
    sock_mat = head_m @ Matrix.Translation((0.0, -0.02 * HERO_SCALE, -0.03 * HERO_SCALE)) @ Matrix.Scale(HERO_SCALE / 0.56, 4)
    cb.attach_to_bone(arm, "head", sock, sock_mat)

    cb.set_action(arm, default_action)
    bpy.context.scene.frame_set(int(bpy.data.actions[default_action].frame_range[0]))
    cb.export_glb("hero_wolf", has_armature=True)


NEW_TOWERS = [
    "tower_badger_t1", "tower_badger_t2", "tower_badger_inferno", "tower_badger_corrosion",
    "tower_falcon_t1", "tower_falcon_t2", "tower_falcon_tempest", "tower_falcon_skyhunter",
    "tower_tortoise_t1", "tower_tortoise_t2", "tower_tortoise_quake", "tower_tortoise_bastion",
    "tower_lynx_t1", "tower_lynx_t2", "tower_lynx_flurry", "tower_lynx_frostbite",
]


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    want = {a for a in args if not a.startswith("--")}
    cb.ensure_cc0_sources()
    cb.ensure_warm_hex_atlas()
    cb.ensure_animal_chibi_atlas()

    for tn in NEW_TOWERS:
        if not want or tn in want:
            build_new_tower_glb(tn)

    if not want or "hero_wolf" in want:
        build_hero_wolf()

    hat_builders = {
        "hat_crown": build_hat_crown,
        "hat_goggles": build_hat_goggles,
        "hat_antlers": build_hat_antlers,
        "hat_samurai": build_hat_samurai,
    }
    for hname, hfn in hat_builders.items():
        if not want or hname in want:
            hfn()


if __name__ == "__main__":
    main()
