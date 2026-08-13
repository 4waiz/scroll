"""
build_quadruped.py - original industrial inspection quadruped.

Requires twin_common.py exec'd into the same namespace first.

Geometry (metres, Z-up, +Y forward):
    torso 0.90 L x 0.42 W x 0.25 H      standing height ~0.67
    upper leg 0.28   lower leg 0.28     3-DOF leg (abduction, hip pitch, knee)

Unlike the drone and vehicle, this machine's motion cannot be authored as a few
static offsets: the legs are a real nested chain

    HipAbd -> HipPitch -> UpperLeg -> Knee -> LowerLeg -> Foot

and the walk cycle is baked by solving 2-link IK per frame for a foot
trajectory, so the knee bends correctly instead of being eyeballed. Knees point
backwards on all four legs, which is the industrial-quadruped stance.

Original design. Broad visual language only - the shell proportions, panelling,
joint housings and sensor placement are this build's own, and nothing in the
public copy names a manufacturer or product.
"""

import bpy
import bmesh
from math import radians, degrees, cos, sin, pi, atan2, acos, sqrt
from mathutils import Matrix, Vector

BODY_L, BODY_W, BODY_H = 0.90, 0.42, 0.25
BODY_Z = 0.55                      # torso centre height
HIP_Y, HIP_X = 0.30, 0.215         # hip joint offsets from torso centre
L1, L2 = 0.28, 0.28                # upper / lower leg
STAND_H = 0.50                     # hip-to-foot drop when standing
LEGS = {"FL": (-1, 1), "FR": (1, 1), "RL": (-1, -1), "RR": (1, -1)}

scn = reset_scene()                                          # noqa: F821
C = make_collections(scn)                                    # noqa: F821
M = build_materials("QRP", accents=("lime", "yellow"))       # noqa: F821
parts, anchors = [], []


def put(name, bm, mat, coll, origin, explode, grp, order=0, parent=None):
    ob = to_object(name, bm, mat, coll)                      # noqa: F821
    set_origin(ob, origin)                                   # noqa: F821
    tag(ob, explode, grp, order)                             # noqa: F821
    if parent is not None:
        attach(ob, parent)                                   # noqa: F821
    parts.append(ob)
    return ob


# --------------------------------------------------------------------------- #
# torso
# --------------------------------------------------------------------------- #

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0, BODY_Z)),                       # noqa: F821
                BODY_W * 0.42, BODY_L * 0.46, BODY_H * 0.34,
                r=0.030, corner_seg=4, end_seg=3)
for sy in (-1, 1):                                            # hip mounting bosses
    for sx in (-1, 1):
        add_cylinder(bm, Matrix.Translation((sx * HIP_X * 0.72, sy * HIP_Y, BODY_Z))  # noqa: F821
                     @ Matrix.Rotation(radians(90), 4, 'Y'), 0.058, 0.055, seg=20)
put("QRP_TorsoFrame", bm, M["mech"], C["STRUCTURE"], (0, 0, BODY_Z),
    (0, 0, -1), "frame", 0)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, -0.02, BODY_Z + 0.105)),           # noqa: F821
                BODY_W * 0.50, BODY_L * 0.50, 0.035, r=0.026, corner_seg=4, end_seg=3)
for i in range(6):                                            # vent slots
    add_box(bm, Matrix.Translation((0, -0.30 + i * 0.055, BODY_Z + 0.142)),   # noqa: F821
            0.070, 0.008, 0.005)
put("QRP_UpperShell", bm, M["shell"], C["SHELL"], (0, 0, BODY_Z + 0.10),
    (0, 0, 1), "shell", 0)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0, BODY_Z - 0.105)),               # noqa: F821
                BODY_W * 0.48, BODY_L * 0.48, 0.032, r=0.024, corner_seg=4, end_seg=3)
put("QRP_LowerShell", bm, M["shell"], C["SHELL"], (0, 0, BODY_Z - 0.10),
    (0, 0, -1), "shell", 1)

for side, sx in (("Left", -1), ("Right", 1)):
    bm = bmesh.new()
    # angular side panel - deliberately faceted rather than a smooth flank
    add_taper_box(bm, Matrix.Translation((sx * 0.205, 0, BODY_Z))             # noqa: F821
                  @ Matrix.Rotation(radians(90), 4, 'Y'),
                  0.085, 0.40, 0.070, 0.36, 0.014)
    for i in range(4):
        add_box(bm, Matrix.Translation((sx * 0.222, -0.20 + i * 0.13, BODY_Z + 0.03)),  # noqa: F821
                0.006, 0.045, 0.012)
    put(f"QRP_SidePanel_{side}", bm, M["shell2"], C["SHELL"],
        (sx * 0.205, 0, BODY_Z), (sx, 0, 0), "shell", 2)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.44, BODY_Z + 0.02)),             # noqa: F821
                0.150, 0.055, 0.085, r=0.022, corner_seg=4, end_seg=3)
put("QRP_FrontSensorHead", bm, M["shell2"], C["SENSORS"], (0, 0.44, BODY_Z + 0.02),
    (0, 1, 0.2), "head", 0)

for side, sx in (("Left", -1), ("Right", 1)):
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((sx * 0.085, 0.492, BODY_Z + 0.04))   # noqa: F821
                 @ Matrix.Rotation(radians(90), 4, 'X'), 0.026, 0.012, seg=20)
    put(f"QRP_StereoCamera_{side}", bm, M["mech"], C["SENSORS"],
        (sx * 0.085, 0.492, BODY_Z + 0.04), (0, 1, 0), "sensor", 0)

bm = bmesh.new()
add_cylinder(bm, Matrix.Translation((0, 0.492, BODY_Z - 0.01))                # noqa: F821
             @ Matrix.Rotation(radians(90), 4, 'X'), 0.022, 0.012, seg=20)
put("QRP_DepthCamera", bm, M["mech"], C["SENSORS"], (0, 0.492, BODY_Z - 0.01),
    (0, 1, 0), "sensor", 1)

lidar_spin = pivot("QRP_Lidar_Spin", (0, 0.16, BODY_Z + 0.18), C["RIG"])      # noqa: F821
bm = bmesh.new()
lathe(bm, [(0.0, BODY_Z + 0.140), (0.052, BODY_Z + 0.140), (0.052, BODY_Z + 0.190),  # noqa: F821
           (0.042, BODY_Z + 0.208), (0.0, BODY_Z + 0.212)], seg=26,
      M=Matrix.Translation((0, 0.16, 0)))
put("QRP_Lidar", bm, M["shell2"], C["SENSORS"], (0, 0.16, BODY_Z + 0.18),
    (0, 0, 1), "sensor", 2, parent=lidar_spin)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.10, BODY_Z + 0.02)),             # noqa: F821
                0.115, 0.135, 0.045, r=0.014, corner_seg=3, end_seg=2)
for j in range(5):
    add_box(bm, Matrix.Translation((-0.08 + j * 0.04, 0.10, BODY_Z + 0.070)), # noqa: F821
            0.012, 0.115, 0.006)
put("QRP_ComputeModule", bm, M["mech"], C["MECHANICAL"], (0, 0.10, BODY_Z + 0.02),
    (0, 0, 1), "compute", 0)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, -0.13, BODY_Z - 0.045)),           # noqa: F821
                0.145, 0.175, 0.052, r=0.018, corner_seg=4, end_seg=2)
for j in range(4):
    add_box(bm, Matrix.Translation((-0.10 + j * 0.067, -0.13, BODY_Z - 0.100)),  # noqa: F821
            0.006, 0.165, 0.005)
put("QRP_Battery", bm, M["shell2"], C["MECHANICAL"], (0, -0.13, BODY_Z - 0.045),
    (0, -0.35, -1), "battery", 0)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, -0.34, BODY_Z - 0.02)),            # noqa: F821
                0.075, 0.030, 0.030, r=0.010, corner_seg=3, end_seg=2)
put("QRP_BatteryLatch", bm, M["mech"], C["MECHANICAL"], (0, -0.34, BODY_Z - 0.02),
    (0, -1, 0), "battery", 1)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, -0.32, BODY_Z + 0.06)),            # noqa: F821
                0.115, 0.080, 0.040, r=0.012, corner_seg=3, end_seg=2)
for j in range(7):
    add_box(bm, Matrix.Translation((-0.09 + j * 0.03, -0.395, BODY_Z + 0.06)),  # noqa: F821
            0.008, 0.008, 0.030)
put("QRP_CoolingModule", bm, M["mech"], C["MECHANICAL"], (0, -0.32, BODY_Z + 0.06),
    (0, -1, 0.3), "compute", 1)

bm = bmesh.new()
for sx in (-1, 1):
    sweep(bm, frames_along([Vector((sx * 0.075, -0.34, BODY_Z + 0.148)),      # noqa: F821
                            Vector((sx * 0.075, 0.30, BODY_Z + 0.148))]),
          rect_section(0.012, 0.010, 0.004, 3))                               # noqa: F821
for i in range(7):
    add_box(bm, Matrix.Translation((0, -0.30 + i * 0.10, BODY_Z + 0.148)),    # noqa: F821
            0.075, 0.010, 0.008)
put("QRP_PayloadRail", bm, M["shell2"], C["STRUCTURE"], (0, 0, BODY_Z + 0.148),
    (0, 0, 1), "payload", 0)

bm = bmesh.new()
add_box(bm, Matrix.Translation((0, -0.455, BODY_Z + 0.02)), 0.055, 0.008, 0.018)  # noqa: F821
put("QRP_RearStatusLight", bm, M["accent1"], C["EMISSIVE"], (0, -0.455, BODY_Z + 0.02),
    (0, -1, 0), "light", 0)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0, BODY_Z)), 0.032, 0.032, 0.012,  # noqa: F821
                r=0.006, corner_seg=3, end_seg=2)
put("QRP_IMU", bm, M["mech"], C["SENSORS"], (0, 0, BODY_Z), (0, 0, 1), "sensor", 3)

# --------------------------------------------------------------------------- #
# legs - nested 3-DOF chains
# --------------------------------------------------------------------------- #

joints = {}
for key, (sx, sy) in LEGS.items():
    hx, hy = sx * HIP_X, sy * HIP_Y

    kx = hx + sx * 0.075                       # hip-pitch axis in world space

    # pivot() places its empty in WORLD space (matching the drone and vehicle
    # rigs) and re-parents without moving it. Passing local offsets here put
    # every joint at its raw offset from the origin and the legs floated free.
    abd = pivot(f"QRP_HipAbd_{key}", (hx, hy, BODY_Z), C["RIG"])              # noqa: F821
    hip = pivot(f"QRP_HipPitch_{key}", (kx, hy, BODY_Z), C["RIG"], parent=abd)  # noqa: F821
    knee = pivot(f"QRP_Knee_{key}", (kx, hy, BODY_Z - L1), C["RIG"], parent=hip)  # noqa: F821
    ankle = pivot(f"QRP_Ankle_{key}", (kx, hy, BODY_Z - L1 - L2), C["RIG"],   # noqa: F821
                  parent=knee)
    joints[key] = (abd, hip, knee, ankle)

    # hip abduction housing
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((hx + sx * 0.030, hy, BODY_Z))        # noqa: F821
                 @ Matrix.Rotation(radians(90), 4, 'Y'), 0.052, 0.034, seg=22)
    put(f"QRP_HipAbdHousing_{key}", bm, M["shell2"], C["MECHANICAL"],
        (hx, hy, BODY_Z), (sx, 0, 0), "hip", 0, parent=abd)

    # hip pitch actuator
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((kx, hy, BODY_Z))                     # noqa: F821
                 @ Matrix.Rotation(radians(90), 4, 'Y'), 0.048, 0.040, seg=22)
    for j, a, _ in radial(8, 0.0, 0.0):                                       # noqa: F821
        add_box(bm, Matrix.Translation((kx + sx * 0.042, hy + 0.046 * cos(a),  # noqa: F821
                                        BODY_Z + 0.046 * sin(a)))
                @ Matrix.Rotation(a, 4, 'X'), 0.008, 0.010, 0.016)
    put(f"QRP_HipPitchActuator_{key}", bm, M["shell2"], C["MECHANICAL"],
        (kx, hy, BODY_Z), (sx, 0, 0), "hip", 1, parent=hip)

    # upper leg - tapering swept section, hip down to knee
    bm = bmesh.new()
    sweep(bm, frames_along([Vector((kx, hy, BODY_Z - 0.03)),                  # noqa: F821
                            Vector((kx, hy, BODY_Z - L1 + 0.03))],
                           scales=[1.0, 0.80]),
          rect_section(0.036, 0.052, 0.016, 4))                               # noqa: F821
    put(f"QRP_UpperLeg_{key}", bm, M["shell"], C["MECHANICAL"],
        (kx, hy, BODY_Z), (sx, 0, -0.2), "upperleg", 0, parent=hip)

    # knee actuator
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((kx, hy, BODY_Z - L1))                # noqa: F821
                 @ Matrix.Rotation(radians(90), 4, 'Y'), 0.040, 0.030, seg=20)
    put(f"QRP_KneeActuator_{key}", bm, M["shell2"], C["MECHANICAL"],
        (kx, hy, BODY_Z - L1), (sx, 0, 0), "knee", 0, parent=knee)

    # lower leg
    bm = bmesh.new()
    sweep(bm, frames_along([Vector((kx, hy, BODY_Z - L1 - 0.02)),             # noqa: F821
                            Vector((kx, hy, BODY_Z - L1 - L2 + 0.03))],
                           scales=[1.0, 0.62]),
          rect_section(0.026, 0.036, 0.012, 4))                               # noqa: F821
    put(f"QRP_LowerLeg_{key}", bm, M["shell"], C["MECHANICAL"],
        (kx, hy, BODY_Z - L1), (sx, 0, -0.2), "lowerleg", 0, parent=knee)

    # compliant foot + force sensor
    bm = bmesh.new()
    lathe(bm, [(0.0, BODY_Z - L1 - L2 - 0.035), (0.042, BODY_Z - L1 - L2 - 0.030),  # noqa: F821
               (0.046, BODY_Z - L1 - L2 - 0.006), (0.030, BODY_Z - L1 - L2 + 0.012),
               (0.0, BODY_Z - L1 - L2 + 0.014)], seg=22,
          M=Matrix.Translation((kx, hy, 0)))
    put(f"QRP_Foot_{key}", bm, M["rubber"], C["MECHANICAL"],
        (kx, hy, BODY_Z - L1 - L2), (0, 0, -1), "foot", 0, parent=ankle)

    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((kx, hy, BODY_Z - L1 - L2 + 0.024)),  # noqa: F821
                 0.024, 0.010, seg=18)
    put(f"QRP_FootSensor_{key}", bm, M["accent1"], C["EMISSIVE"],
        (kx, hy, BODY_Z - L1 - L2), (0, 0, -1), "foot", 1, parent=ankle)

# --------------------------------------------------------------------------- #
# root + anchors
# --------------------------------------------------------------------------- #

root = bpy.data.objects.new("QRP_Root", None)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 0.5
C["ROOT"].objects.link(root)

for nm, loc in [
    ("stereo cameras", (0.10, 0.52, BODY_Z + 0.06)),
    ("LiDAR", (0, 0.16, BODY_Z + 0.24)),
    ("compute module", (0, 0.10, BODY_Z + 0.09)),
    ("battery", (0, -0.16, BODY_Z - 0.12)),
    ("hip actuator", (HIP_X + 0.09, 0.30, BODY_Z)),
    ("upper-leg actuator", (-HIP_X - 0.09, 0.30, BODY_Z - 0.14)),
    ("knee actuator", (HIP_X + 0.09, -0.30, BODY_Z - L1)),
    ("foot force sensor", (-HIP_X - 0.06, -0.30, 0.03)),
    ("payload rail", (0, 0.02, BODY_Z + 0.20)),
    ("IMU", (0.06, 0, BODY_Z + 0.02)),
]:
    anchors.append(anchor(nm, loc, C["ANCHORS"], parent=root))                 # noqa: F821

finish(parts, root,                                                            # noqa: F821
       no_bevel={o.name for o in parts if "FootSensor" in o.name
                 or "StatusLight" in o.name},
       bevel_width=0.0035)
for e in [o for o in bpy.data.objects
          if o.type == 'EMPTY' and o.parent is None and o is not root]:
    e.parent = root

# --------------------------------------------------------------------------- #
# gait - 2-link IK baked per frame
# --------------------------------------------------------------------------- #


def leg_ik(ty, tz):
    """
    Solve hip-pitch and knee angles for a foot at (ty, tz) relative to the hip.

    tz is negative (below the hip). Returns radians with the knee bending
    backwards, which is the stance this machine uses on all four legs.
    """
    d = sqrt(ty * ty + tz * tz)
    d = max(abs(L1 - L2) + 1e-4, min(L1 + L2 - 1e-4, d))
    # interior angle at the knee, then the bend away from straight
    cos_k = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)
    knee = pi - acos(max(-1.0, min(1.0, cos_k)))
    # angle from straight-down to the target, minus the shoulder offset
    alpha = atan2(ty, -tz)
    cos_b = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
    beta = acos(max(-1.0, min(1.0, cos_b)))
    return alpha + beta, -knee


def foot_target(phase, stride=0.11, lift=0.075, duty=0.75):
    """Foot position relative to the hip for a walk-in-place gait."""
    t = phase % 1.0
    if t < duty:                       # stance: slide back along the ground
        u = t / duty
        return stride * (1 - 2 * u), -STAND_H
    u = (t - duty) / (1 - duty)        # swing: lift and reach forward
    return -stride + 2 * stride * u, -STAND_H + lift * sin(pi * u)


PHASE = {"FL": 0.00, "RR": 0.25, "FR": 0.50, "RL": 0.75}   # crawl gait
FRAMES = 96

for key, (abd, hip, knee, ankle) in joints.items():
    for j in (abd, hip, knee, ankle):
        j.rotation_mode = 'XYZ'
        j.animation_data_create()

    act_stand = bpy.data.actions.new(f"QRP_IdleStand_{key}")
    hip.animation_data.action = act_stand
    hp, kn = leg_ik(0.0, -STAND_H)
    hip.rotation_euler = (hp, 0, 0)
    hip.keyframe_insert("rotation_euler", frame=1)

    act = bpy.data.actions.new(f"QRP_WalkCycle_{key}_hip")
    hip.animation_data.action = act
    for f in range(1, FRAMES + 1):
        ty, tz = foot_target(PHASE[key] + (f - 1) / FRAMES)
        hp, kn = leg_ik(ty, tz)
        hip.rotation_euler = (hp, 0, 0)
        hip.keyframe_insert("rotation_euler", frame=f)

    actk = bpy.data.actions.new(f"QRP_WalkCycle_{key}_knee")
    knee.animation_data.action = actk
    for f in range(1, FRAMES + 1):
        ty, tz = foot_target(PHASE[key] + (f - 1) / FRAMES)
        hp, kn = leg_ik(ty, tz)
        knee.rotation_euler = (kn, 0, 0)
        knee.keyframe_insert("rotation_euler", frame=f)

    # keep the foot flat to the ground: ankle cancels hip + knee
    acta = bpy.data.actions.new(f"QRP_WalkCycle_{key}_ankle")
    ankle.animation_data.action = acta
    for f in range(1, FRAMES + 1):
        ty, tz = foot_target(PHASE[key] + (f - 1) / FRAMES)
        hp, kn = leg_ik(ty, tz)
        ankle.rotation_euler = (-(hp + kn), 0, 0)
        ankle.keyframe_insert("rotation_euler", frame=f)

    # gentle abduction sway so the body does not read as rigid
    acta2 = bpy.data.actions.new(f"QRP_WalkCycle_{key}_abd")
    abd.animation_data.action = acta2
    sx = LEGS[key][0]
    for f in range(1, FRAMES + 1):
        u = (f - 1) / FRAMES
        abd.rotation_euler = (0, radians(2.2) * sx * sin(2 * pi * u), 0)
        abd.keyframe_insert("rotation_euler", frame=f)

lidar_spin.rotation_mode = 'XYZ'
lidar_spin.animation_data_create()
act = bpy.data.actions.new("QRP_SensorScan")
lidar_spin.animation_data.action = act
for f, turns in ((1, 0.0), (FRAMES, 1.0)):
    lidar_spin.rotation_euler = (0, 0, turns * 2 * pi)
    lidar_spin.keyframe_insert("rotation_euler", frame=f)
set_linear(act)                                                                # noqa: F821

scn.frame_start, scn.frame_end = 1, FRAMES

RESULT = {"objects": len(parts), "anchors": len(anchors),
          "tris": tri_count(parts),                                            # noqa: F821
          "stand_deg": [round(degrees(x), 1) for x in leg_ik(0.0, -STAND_H)]}
print("build_quadruped.py ->", RESULT)
