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
# New Chibi Head Builders (Badger, Falcon, Tortoise, Lynx, Silver Wolf)
# ---------------------------------------------------------------------------

def build_badger_head(goggles=False, hood_col=None, flask_crown=False):
    hr = cb.make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.44, "sx": 1.14, "sy": 0.96, "sz": 0.88},
        {"co": (0.0, -0.24, 0.06), "radius": 0.32, "sx": 1.10, "sy": 0.94, "sz": 0.72},
        {"co": (0.0, -0.36, 0.04), "radius": 0.18, "sx": 0.98, "sy": 1.05, "sz": 0.74},
    ]
    # Dark charcoal-brown fur base + bold white center blaze + dark eye stripes
    head = cb.sculpt_metaball_mesh("BgHead", elems, target_dims=(1.06, 0.96, 0.84), target_center_xy=(0.0, -0.03),
                                   bottom_z=1.24, swatch_col=8, resolution=0.038, smooth_iter=6)
    head.parent = hr

    dark_fur = cb.get_solid_mat("BadgerStripeDark", "#211f26", roughness=0.68)
    for sx in (-1, 1):
        eh = cb.make_empty(f"BgEar_{sx}", loc=(sx * 0.42, 0.02, 1.92), parent=hr)
        cb.make_smooth_subdiv_prim("EarOut", "SPHERE", (0, 0, 0), scale=(0.13, 0.075, 0.14),
                                   solid_mat=dark_fur, segs=14, subdiv=1, parent=eh)
        cb.make_smooth_subdiv_prim("EarTip", "SPHERE", (0, -0.01, 0.06), scale=(0.08, 0.05, 0.07),
                                   swatch_col=8, segs=12, subdiv=1, parent=eh)
        # Signature badger black cheek/eye mask stripes
        cb.make_smooth_subdiv_prim(f"BgStripe_{sx}", "SPHERE", (sx * 0.25, -0.34, 1.62),
                                   scale=(0.18, 0.14, 0.24), rot_deg=(0, sx * 10, sx * 14),
                                   solid_mat=dark_fur, segs=14, subdiv=1, parent=hr)

    hit, loc, _ = cb.raycast_front(head, 0.0, 1.48)
    my = loc.y if hit else -0.46
    cb.make_smooth_subdiv_prim("BgMuzzle", "SPHERE", (0.0, my - 0.02, 1.48),
                               scale=(0.24, 0.18, 0.14), swatch_col=3, segs=14, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("BgNose", "SPHERE", (0.0, my - 0.17, 1.52),
                               scale=(0.085, 0.065, 0.058), swatch_col=5, segs=12, subdiv=1, parent=hr)
    cb.add_chibi_eyes(head, hr, eye_x=0.23, eye_z=1.61, eye_rx=0.078, eye_rz=0.088, iris_col_hex="#ff9a2e", brow_col=5)

    gear = []
    if hood_col is not None:
        gear.append(cb.make_headband_ring("NativeHat_BgBand", center=(0.0, -0.03, 1.85), rx=0.50, ry=0.44,
                                          tube_r=0.050, swatch_col=hood_col, parent=hr))
    if goggles:
        brass = cb.get_solid_mat("BgBrassMat", "#f0b438", roughness=0.28, metallic=0.75)
        lens_g = cb.get_solid_mat("BgLensGreen", "#3ef27a", roughness=0.12, emission=0.7)
        gear.append(cb.make_headband_ring("NativeHat_BgStrap", center=(0.0, -0.03, 1.86), rx=0.52, ry=0.45,
                                          tube_r=0.044, swatch_col=5, parent=hr))
        for sx in (-1, 1):
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_BgRim_{sx}", "CYL", (sx * 0.22, -0.45, 1.88),
                                                   scale=(0.16, 0.16, 0.09), rot_deg=(76, sx * -10, 0),
                                                   solid_mat=brass, segs=16, radius=1.0, depth=1.0, parent=hr))
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_BgLens_{sx}", "SPHERE", (sx * 0.22, -0.49, 1.89),
                                                   scale=(0.125, 0.045, 0.125), solid_mat=lens_g, segs=12, parent=hr))
    if flask_crown:
        em = cb.get_solid_mat("BgAlchCrown", "#3df5a7", roughness=0.18, emission=0.9)
        gear.append(cb.make_smooth_subdiv_prim("NativeHat_BgFlaskCrest", "SPHERE", (0.0, -0.35, 2.02),
                                               scale=(0.13, 0.13, 0.18), solid_mat=em, segs=12, parent=hr))
    return hr, gear


def build_falcon_head(plumage_col=2, aviator_cap=False, storm_crest=False):
    hr = cb.make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.24), "radius": 0.44, "sx": 1.06, "sy": 1.00, "sz": 0.92},
        {"co": (0.0, -0.18, 0.10), "radius": 0.28, "sx": 0.96, "sy": 0.98, "sz": 0.78},
    ]
    head = cb.sculpt_metaball_mesh("FlHead", elems, target_dims=(0.98, 0.94, 0.86), target_center_xy=(0.0, -0.03),
                                   bottom_z=1.24, swatch_col=plumage_col, resolution=0.038, smooth_iter=6)
    head.parent = hr

    # Cream throat/cheeks + hooked golden beak + swept feather brow tufts
    cb.make_smooth_subdiv_prim("FlThroat", "SPHERE", (0.0, -0.26, 1.44),
                               scale=(0.34, 0.22, 0.18), swatch_col=3, segs=16, subdiv=1, parent=hr)
    hit, loc, _ = cb.raycast_front(head, 0.0, 1.54)
    by = loc.y if hit else -0.46
    cb.make_smooth_subdiv_prim("FlBeakTop", "CONE", (0.0, by - 0.12, 1.55),
                               scale=(0.12, 0.14, 0.19), rot_deg=(104, 0, 0),
                               swatch_col=14, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=hr)
    cb.make_smooth_subdiv_prim("FlBeakTip", "CONE", (0.0, by - 0.25, 1.49),
                               scale=(0.055, 0.055, 0.09), rot_deg=(150, 0, 0),
                               swatch_col=5, segs=10, radius=1.0, depth=2.0, subdiv=0, parent=hr)

    for sx in (-1, 1):
        cb.make_smooth_subdiv_prim(f"FlPlume_{sx}", "CONE", (sx * 0.26, 0.12, 1.98),
                                   scale=(0.09, 0.06, 0.22), rot_deg=(-58, sx * 22, sx * -12),
                                   swatch_col=1, segs=12, radius=1.0, depth=2.0, subdiv=0, parent=hr)

    cb.add_chibi_eyes(head, hr, eye_x=0.25, eye_z=1.64, eye_rx=0.088, eye_rz=0.094, iris_col_hex="#ffb624", brow_col=1)

    gear = []
    if aviator_cap:
        cap_mat = cb.get_solid_mat("FalconAviatorLeather", "#4b6935", roughness=0.62)
        brass = cb.get_solid_mat("FalconBrassTrim", "#e8a832", roughness=0.30, metallic=0.72)
        gear.append(cb.make_smooth_subdiv_prim("NativeHat_FlCap", "SPHERE", (0.0, -0.01, 1.88),
                                               scale=(0.51, 0.47, 0.28), solid_mat=cap_mat, segs=16, subdiv=1, parent=hr))
        gear.append(cb.make_headband_ring("NativeHat_FlRim", center=(0.0, -0.02, 1.82), rx=0.51, ry=0.45,
                                          tube_r=0.042, solid_mat=brass, parent=hr))
    if storm_crest:
        bolt = cb.get_solid_mat("FalconStormCyan", "#4cf2ff", roughness=0.14, emission=1.1)
        for sx in (-1, 0, 1):
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_FlBolt_{sx}", "CONE", (sx * 0.18, -0.02, 2.08),
                                                   scale=(0.055, 0.04, 0.19), rot_deg=(-18, sx * -16, 0),
                                                   solid_mat=bolt, segs=10, radius=1.0, depth=2.0, subdiv=0, parent=hr))
    return hr, gear


def build_tortoise_head(brass_helm=False, visor_shield=False):
    hr = cb.make_empty("AnimalHeadRoot")
    skin_mat = cb.get_solid_mat("TortoiseSageGreen", "#6b913c", roughness=0.62)
    beak_mat = cb.get_solid_mat("TortoiseBeakTan", "#a89864", roughness=0.55)
    elems = [
        {"co": (0.0, -0.04, 0.22), "radius": 0.44, "sx": 1.16, "sy": 1.02, "sz": 0.88},
        {"co": (0.0, -0.26, 0.06), "radius": 0.30, "sx": 1.24, "sy": 0.92, "sz": 0.72},
    ]
    head = cb.sculpt_metaball_mesh("TrHead", elems, target_dims=(1.08, 0.98, 0.82), target_center_xy=(0.0, -0.04),
                                   bottom_z=1.24, swatch_col=6, resolution=0.038, smooth_iter=6)
    head.data.materials.clear()
    head.data.materials.append(skin_mat)
    head.parent = hr

    hit, loc, _ = cb.raycast_front(head, 0.0, 1.48)
    jy = loc.y if hit else -0.48
    cb.make_smooth_subdiv_prim("TrJaw", "SPHERE", (0.0, jy - 0.02, 1.45),
                               scale=(0.30, 0.16, 0.14), solid_mat=beak_mat, segs=16, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("TrRidge", "SPHERE", (0.0, jy - 0.10, 1.56),
                               scale=(0.14, 0.12, 0.08), solid_mat=skin_mat, segs=12, subdiv=1, parent=hr)
    cb.add_chibi_eyes(head, hr, eye_x=0.25, eye_z=1.62, eye_rx=0.080, eye_rz=0.088, iris_col_hex="#b57024", brow_col=5)

    gear = []
    if brass_helm:
        brass = cb.get_solid_mat("TortoiseHelmBrass", "#d49830", roughness=0.30, metallic=0.76)
        gear.append(cb.make_smooth_subdiv_prim("NativeHat_TrDome", "SPHERE", (0.0, -0.02, 1.88),
                                               scale=(0.54, 0.49, 0.28), solid_mat=brass, segs=18, subdiv=1, parent=hr))
        gear.append(cb.make_smooth_subdiv_prim("NativeHat_TrFin", "CUBE", (0.0, -0.04, 2.04),
                                               scale=(0.08, 0.62, 0.16), solid_mat=brass, subdiv=2, parent=hr))
    if visor_shield:
        steel = cb.get_solid_mat("TortoiseBastionSteel", "#5e748c", roughness=0.34, metallic=0.80)
        gear.append(cb.make_headband_ring("NativeHat_TrArmorBand", center=(0.0, -0.03, 1.84),
                                          rx=0.54, ry=0.48, tube_r=0.056, solid_mat=steel, parent=hr))
    return hr, gear


def build_lynx_head(scarf_rune=False, frost_crown=False):
    hr = cb.make_empty("AnimalHeadRoot")
    elems = [
        {"co": (0.0, -0.02, 0.22), "radius": 0.43, "sx": 1.14, "sy": 0.96, "sz": 0.88},
        {"co": (-0.28, -0.14, 0.05), "radius": 0.28, "sx": 1.18, "sy": 0.88, "sz": 0.78},
        {"co": (0.28, -0.14, 0.05), "radius": 0.28, "sx": 1.18, "sy": 0.88, "sz": 0.78},
    ]
    head = cb.sculpt_metaball_mesh("LxHead", elems, target_dims=(1.08, 0.94, 0.84), target_center_xy=(0.0, -0.03),
                                   bottom_z=1.24, swatch_col=2, resolution=0.038, smooth_iter=6)
    head.parent = hr

    dark_tuft = cb.get_solid_mat("LynxTuftDark", "#1d1a24", roughness=0.65)
    for sx in (-1, 1):
        eh = cb.make_empty(f"LxEar_{sx}", loc=(sx * 0.34, 0.02, 1.92), parent=hr)
        eh.rotation_euler = (math.radians(5), math.radians(sx * -18), math.radians(sx * -8))
        cb.make_smooth_subdiv_prim("EarOut", "CONE", (0, 0, 0.17), scale=(0.15, 0.09, 0.21),
                                   swatch_col=2, segs=16, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        cb.make_smooth_subdiv_prim("EarIn", "CONE", (0, -0.03, 0.14), scale=(0.08, 0.045, 0.14),
                                   swatch_col=3, segs=14, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        # Characteristic upright black lynx ear tufts
        cb.make_smooth_subdiv_prim("EarTuft", "CONE", (0, 0, 0.37), scale=(0.042, 0.036, 0.14),
                                   solid_mat=dark_tuft, segs=10, radius=1.0, depth=2.0, subdiv=0, parent=eh)
        # Fluffy cheek ruffs
        cb.make_smooth_subdiv_prim(f"LxCheek_{sx}", "SPHERE", (sx * 0.38, -0.18, 1.42),
                                   scale=(0.22, 0.14, 0.20), swatch_col=3, segs=14, subdiv=1, parent=hr)

    hit, loc, _ = cb.raycast_front(head, 0.0, 1.48)
    my = loc.y if hit else -0.45
    cb.make_smooth_subdiv_prim("LxMuzzle", "SPHERE", (0.0, my + 0.02, 1.48),
                               scale=(0.28, 0.16, 0.14), swatch_col=3, segs=16, subdiv=1, parent=hr)
    cb.make_smooth_subdiv_prim("LxNose", "SPHERE", (0.0, my - 0.11, 1.53),
                               scale=(0.075, 0.055, 0.050), swatch_col=13, segs=12, subdiv=1, parent=hr)
    cb.add_chibi_eyes(head, hr, eye_x=0.23, eye_z=1.61, eye_rx=0.084, eye_rz=0.096, iris_col_hex="#ffb42e", brow_col=1)

    gear = []
    if scarf_rune:
        rune_v = cb.get_solid_mat("LynxRuneViolet", "#8c54ff", roughness=0.25, emission=0.75)
        gear.append(cb.make_headband_ring("NativeHat_LxBand", center=(0.0, -0.03, 1.84),
                                          rx=0.50, ry=0.43, tube_r=0.048, solid_mat=rune_v, parent=hr))
    if frost_crown:
        ice = cb.get_solid_mat("LynxFrostGem", "#5cf4ff", roughness=0.14, emission=0.95)
        for sx in (-1, 0, 1):
            gear.append(cb.make_smooth_subdiv_prim(f"NativeHat_LxIce_{sx}", "CONE", (sx * 0.20, -0.42, 1.94),
                                                   scale=(0.06, 0.05, 0.16), rot_deg=(10, sx * -14, 0),
                                                   solid_mat=ice, segs=8, radius=1.0, depth=2.0, subdiv=0, parent=hr))
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


def build_new_tower_glb(model_name):
    cb.clear_scene()
    root = cb.make_empty("TowerRoot")
    warm = cb.ensure_warm_hex_atlas()

    if model_name.startswith("tower_badger_"):
        color = "yellow"
        suf = model_name.replace("tower_badger_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        ht = {1: 1.24, 2: 1.48, 3: 1.66}[tier]
        _, o = cb.place(hex_building(color, "tower_base"), parent=root, height=ht)
        cb.retexture(o, "hexagons_medieval", warm)
        mn, mx = cb.mesh_bounds(o)
        deck_z = mx.z - (mx.z - mn.z) * 0.085

        if tier >= 2:
            _, fo = cb.place(os.path.join(HEX_P, "flag_green.gltf"), parent=root, height=0.60,
                             loc=(-0.38, 0.30, deck_z - 0.02))
            cb.retexture(fo, "hexagons_medieval", warm)
        if suf in ("inferno", "corrosion"):
            flask_col = "#ff7c24" if suf == "inferno" else "#3bf274"
            _, go = cb.place(os.path.join(Q, "rpg_items_pack/Crystal3.glb"), parent=root, height=0.28,
                             loc=(0.48, -0.34, 0.0), rot_deg=(0, 12, 0))
            cb.set_flat_color(go, "*", flask_col, emission_hex=flask_col, emission_strength=1.25, force=True)

        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        tex = cb.ensure_kaykit_variant_tex(
            "mage",
            f"badger_{suf}",
            paw_hex="#5c4c48",
            hue_shift=0.18 if suf == "corrosion" else -0.15 if suf == "inferno" else 0.05,
            sat_mult=1.15,
        )
        head, _ = build_badger_head(
            goggles=(suf in ("t2", "inferno", "corrosion")),
            hood_col=13 if suf == "inferno" else 15 if suf == "corrosion" else 14,
            flask_crown=(suf == "corrosion"),
        )
        _, wg = cb.build_tower_crew_mounted(
            turret_head, "Mage.glb", ("1H_Wand",), "Spellcasting", 6,
            head, deck_z, tex_path=tex, offset=(0.04, 0.04),
        )
        # Alchemy mortar cannon barrel on WeaponGroup
        cauldron_mat = cb.get_solid_mat(
            f"BadgerCauldron_{suf}",
            "#3c4754" if suf != "inferno" else "#78311e",
            roughness=0.38,
            metallic=0.7,
        )
        glow_mat = cb.get_solid_mat(
            f"BadgerBrew_{suf}",
            "#ff7e1f" if suf == "inferno" else "#3bf27a",
            roughness=0.15,
            emission=1.2,
        )
        barrel = cb.make_smooth_subdiv_prim("BadgerMortarTube", "CYL", (0.28, -0.18, deck_z + 0.16),
                                            scale=(0.16, 0.16, 0.34), rot_deg=(58, 0, 0), solid_mat=cauldron_mat, segs=16, radius=1.0, depth=1.0)
        brew = cb.make_smooth_subdiv_prim("BadgerBrewCore", "SPHERE", (0.28, -0.30, deck_z + 0.24),
                                          scale=(0.12, 0.12, 0.12), solid_mat=glow_mat, segs=12)
        cb.set_parent_keep(barrel, wg)
        cb.set_parent_keep(brew, wg)

    elif model_name.startswith("tower_falcon_"):
        color = "red"
        suf = model_name.replace("tower_falcon_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        ht = {1: 1.30, 2: 1.54, 3: 1.74}[tier]
        _, o = cb.place(hex_building(color, "tower_base"), parent=root, height=ht)
        cb.retexture(o, "hexagons_medieval", warm)
        mn, mx = cb.mesh_bounds(o)
        deck_z = mx.z - (mx.z - mn.z) * 0.085

        if tier >= 2:
            _, fo = cb.place(os.path.join(HEX_P, "flag_blue.gltf"), parent=root, height=0.64,
                             loc=(-0.38, 0.30, deck_z - 0.02))
            cb.retexture(fo, "hexagons_medieval", warm)
        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        tex = cb.ensure_kaykit_variant_tex(
            "rogue", f"falcon_{suf}", paw_hex="#c49448",
            hue_shift=0.35 if suf == "tempest" else 0.12, sat_mult=1.18,
        )
        head, _ = build_falcon_head(
            plumage_col=7 if suf != "skyhunter" else 14,
            aviator_cap=(suf in ("t2", "skyhunter")),
            storm_crest=(suf == "tempest"),
        )
        cg, wg = cb.build_tower_crew_mounted(
            turret_head, "Rogue.glb", ("1H_Crossbow",), "1H_Ranged_Aiming", 4,
            head, deck_z, tex_path=tex, offset=(0.04, 0.04),
        )
        bh, bo = cb.place(os.path.join(Q, "medieval_weapons_pack/Bow_Golden.glb"), max_xy=0.58 if suf == "skyhunter" else 0.46,
                          loc=(-0.22, -0.18, deck_z + 0.22), rot_deg=(10, -20, -90), ground=False)
        cb.set_parent_keep(bh, wg)
        if suf == "tempest":
            cb.spin_orbit_crystals(turret_head, z=0.20, count=3, radius=0.62, color="#6ef2ff", emi="#2cd8ff", height=0.16)
        elif suf == "skyhunter":
            _, to = cb.place(os.path.join(HEX_P, "target.gltf"), parent=root, height=0.40, loc=(0.54, 0.34, 0), rot_z=-25)
            cb.retexture(to, "hexagons_medieval", warm)

    elif model_name.startswith("tower_tortoise_"):
        color = "green"
        suf = model_name.replace("tower_tortoise_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        ht = {1: 1.18, 2: 1.40, 3: 1.58}[tier]
        _, o = cb.place(hex_building(color, "tower_base"), parent=root, height=ht)
        cb.retexture(o, "hexagons_medieval", warm)
        mn, mx = cb.mesh_bounds(o)
        deck_z = mx.z - (mx.z - mn.z) * 0.085

        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        tex = cb.ensure_kaykit_variant_tex(
            "knight", f"tortoise_{suf}", paw_hex="#6b913c",
            hue_shift=0.08, sat_mult=1.1, armor_tint="#b88438" if suf == "quake" else "#5b7d8f", armor_mix=0.45,
        )
        head, _ = build_tortoise_head(brass_helm=(suf in ("t2", "quake")), visor_shield=(suf == "bastion"))
        cg, wg = cb.build_tower_crew_mounted(
            turret_head, "Knight.glb", ("Spike_Shield",), "Blocking" if suf == "bastion" else "Idle", 4,
            head, deck_z, tex_path=tex, offset=(0.04, 0.05),
        )
        # Carved tortoise shell behind character back
        shell_mat = cb.get_solid_mat(f"TortoiseShell_{suf}", "#755a2b" if suf != "bastion" else "#48685c", roughness=0.48, metallic=0.25)
        shell_trim = cb.get_solid_mat("TortoiseShellTrim", "#d9a238", roughness=0.30, metallic=0.72)
        cb.make_smooth_subdiv_prim("TortoiseShell", "SPHERE", (0.04, 0.24, deck_z + 0.28),
                                   scale=(0.30, 0.16, 0.34), rot_deg=(-12, 0, 0), solid_mat=shell_mat, segs=16, subdiv=1, parent=cg)
        cb.make_smooth_subdiv_prim("TortoiseShellRim", "SPHERE", (0.04, 0.20, deck_z + 0.28),
                                   scale=(0.32, 0.11, 0.36), rot_deg=(-12, 0, 0), solid_mat=shell_trim, segs=14, subdiv=0, parent=cg)
        ch, co = cb.place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.50 if tier >= 2 else 0.38,
                          loc=(0.24, -0.22, deck_z + 0.02), rot_deg=(0, 0, -90))
        cb.set_parent_keep(ch, wg)
        if suf in ("quake", "bastion"):
            ch2, _ = cb.place(os.path.join(Q, "platformer_game_pack/Cannon.glb"), max_xy=0.46,
                              loc=(-0.24, -0.22, deck_z + 0.02), rot_deg=(0, 0, -90))
            cb.set_parent_keep(ch2, wg)

    elif model_name.startswith("tower_lynx_"):
        color = "blue"
        suf = model_name.replace("tower_lynx_", "")
        tier = 1 if suf == "t1" else 2 if suf == "t2" else 3
        ht = {1: 1.26, 2: 1.48, 3: 1.68}[tier]
        _, o = cb.place(hex_building(color, "tower_base"), parent=root, height=ht)
        cb.retexture(o, "hexagons_medieval", warm)
        mn, mx = cb.mesh_bounds(o)
        deck_z = mx.z - (mx.z - mn.z) * 0.085

        if tier >= 2:
            _, fo = cb.place(os.path.join(HEX_P, "flag_blue.gltf"), parent=root, height=0.62,
                             loc=(-0.38, 0.30, deck_z - 0.02))
            cb.retexture(fo, "hexagons_medieval", warm)
        turret_head = cb.make_empty("TurretHead", loc=(0, 0, deck_z), parent=root)
        tex = cb.ensure_kaykit_variant_tex(
            "rogue", f"lynx_{suf}", paw_hex="#d49c58",
            hue_shift=-0.22 if suf == "flurry" else 0.14, sat_mult=1.18,
        )
        head, _ = build_lynx_head(scarf_rune=(suf in ("t2", "flurry")), frost_crown=(suf == "frostbite"))
        _, wg = cb.build_tower_crew_mounted(
            turret_head, "Rogue.glb", ("1H_Crossbow",), "2H_Ranged_Aiming", 4,
            head, deck_z, tex_path=tex, offset=(0.04, 0.04),
            extra_hand_props=((os.path.join(ADV_A, "crossbow_2handed.gltf"), "handslot.r", 1.05),) if tier >= 2 else (),
        )
        rh, ro = cb.place(os.path.join(Q, "modular_sci_fi_guns_pack/Crossbow_2.glb"), max_xy=0.52 if tier >= 2 else 0.40,
                          loc=(-0.22, -0.20, deck_z + 0.18), rot_deg=(0, 0, -90))
        cb.set_flat_color(ro, ("White", "Grey", "LightGrey", "Accent"),
                          "#b46eff" if suf != "frostbite" else "#54eeff",
                          emission_hex="#9c4eff" if suf != "frostbite" else "#38e8ff", emission_strength=1.0, roughness=0.3)
        cb.set_parent_keep(rh, wg)
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
