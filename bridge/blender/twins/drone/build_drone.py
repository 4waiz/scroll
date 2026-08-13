"""
build_drone.py - original industrial inspection quadcopter.

Requires twin_common.py exec'd into the same namespace first.

Geometry (metres, Z-up, +Y forward):
    motor-to-motor diagonal   1.10
    central body              0.38 W x 0.52 L x 0.18 H
    propeller diameter        0.36
    landing clearance         0.20

Surfaces are swept cross-sections rather than chains of boxes: arms are a
tapering rounded-rect sweep, blades are a twisted airfoil sweep. That is what
separates this from a blocked-in placeholder at web render sizes.

Explode/reassemble is NOT baked as an action - the web scene drives it from each
part's `explode` vector so it stays a pure function of scroll progress and
reverses exactly. Propeller spin and gimbal scan ARE baked: they are continuous
local motion the browser should not have to author.
"""

import bpy
import bmesh
from math import radians, cos, sin, pi
from mathutils import Matrix, Vector

MOTOR_R = 0.55 / (2 ** 0.5)     # 0.389 -> 1.10 m diagonal
BODY_HW, BODY_HL, BODY_HH = 0.19, 0.26, 0.09
PROP_R = 0.18
CORNERS = {"FL": (-1, 1), "FR": (1, 1), "RL": (-1, -1), "RR": (1, -1)}

scn = reset_scene()                                        # noqa: F821
C = make_collections(scn)                                  # noqa: F821
M = build_materials("DRN", accents=("mint", "cyan"))       # noqa: F821
parts, anchors = [], []


def put(name, bm, mat, coll, origin, explode, grp, order=0):
    ob = to_object(name, bm, mat, coll)                    # noqa: F821
    set_origin(ob, origin)                                 # noqa: F821
    tag(ob, explode, grp, order)                           # noqa: F821
    parts.append(ob)
    return ob


def fasteners(bm, spots, r=0.005, h=0.004):
    for (x, y, z) in spots:
        add_prism(bm, Matrix.Translation((x, y, z)), r, 6, h, axis='Z')  # noqa: F821


# --------------------------------------------------------------------------- #
# central body
# --------------------------------------------------------------------------- #

bm = bmesh.new()
add_rounded_box(bm, Matrix.Identity(4), BODY_HW, BODY_HL, BODY_HH * 0.72,   # noqa: F821
                r=0.022, corner_seg=5, end_seg=4)
for key, (sx, sy) in CORNERS.items():                       # arm root brackets
    a = (Matrix.Translation((sx * 0.155, sy * 0.215, 0))
         @ Matrix.Rotation(radians(-45) if sx * sy > 0 else radians(45), 4, 'Z'))
    add_rounded_box(bm, a, 0.058, 0.048, 0.056, r=0.012, corner_seg=3)  # noqa: F821
put("DRN_Body_Core", bm, M["mech"], C["STRUCTURE"], (0, 0, 0), (0, 0, -1), "core", 0)

# upper shell - domed, vented, with a recessed service panel
bm = bmesh.new()
frames, secs = [], []
for i in range(7):
    t = i / 6
    z = 0.062 + 0.070 * t
    k = 1.0 - 0.30 * (t ** 1.7)
    frames.append(Matrix.Translation((0, 0, z)))
    secs.append(k)
sweep(bm, [f @ Matrix.Diagonal((s, s, 1, 1)) for f, s in zip(frames, secs)],  # noqa: F821
      rect_section(BODY_HW, BODY_HL, 0.030, 5))                              # noqa: F821
for i in range(9):                                          # vent slots
    y = -0.175 + i * 0.044
    add_box(bm, Matrix.Translation((0, y, 0.128)), 0.085, 0.006, 0.004)      # noqa: F821
add_box(bm, Matrix.Translation((0, 0.055, 0.130)), 0.058, 0.050, 0.003)      # noqa: F821
fasteners(bm, [(sx * 0.148, sy * 0.205, 0.104)
               for sx in (-1, 1) for sy in (-1, 1)])
put("DRN_Body_UpperShell", bm, M["shell"], C["SHELL"], (0, 0, 0.10),
    (0, 0, 1), "shell", 0)

# lower shell
bm = bmesh.new()
frames, secs = [], []
for i in range(6):
    t = i / 5
    z = -0.062 - 0.062 * t
    k = 1.0 - 0.26 * (t ** 1.6)
    frames.append(Matrix.Translation((0, 0, z)))
    secs.append(k)
sweep(bm, [f @ Matrix.Diagonal((s, s, 1, 1)) for f, s in zip(frames, secs)],  # noqa: F821
      rect_section(BODY_HW, BODY_HL, 0.028, 5))                              # noqa: F821
add_box(bm, Matrix.Translation((0, -0.05, -0.122)), 0.072, 0.092, 0.004)     # noqa: F821
for i in range(5):                                          # cable channel
    add_box(bm, Matrix.Translation((0.10, -0.14 + i * 0.05, -0.108)),        # noqa: F821
            0.010, 0.014, 0.006)
put("DRN_Body_LowerShell", bm, M["shell"], C["SHELL"], (0, 0, -0.10),
    (0, 0, -1), "shell", 1)

# --------------------------------------------------------------------------- #
# avionics stack
# --------------------------------------------------------------------------- #

for i, (nm, z, comps) in enumerate([
    ("DRN_FlightComputer", 0.030, 6),
    ("DRN_Avionics_Stack", 0.000, 5),
    ("DRN_PowerDistribution", -0.030, 4),
]):
    bm = bmesh.new()
    add_box(bm, Matrix.Translation((0, 0.01, z)), 0.115, 0.135, 0.0035)      # noqa: F821
    for j in range(comps):                                  # surface-mount chips
        cx = -0.075 + (j % 3) * 0.075
        cy = 0.085 - (j // 3) * 0.085
        add_rounded_box(bm, Matrix.Translation((cx, cy, z + 0.009)),         # noqa: F821
                        0.020, 0.016, 0.005, r=0.003, corner_seg=2, end_seg=2)
    for j in range(4):                                      # stack standoffs
        sx, sy = (-1, 1)[j % 2], (-1, 1)[j // 2]
        add_prism(bm, Matrix.Translation((sx * 0.104, sy * 0.124, z)),       # noqa: F821
                  0.005, 6, 0.014, axis='Z')
    put(nm, bm, M["mech"], C["MECHANICAL"], (0, 0, z),
        (0, 0, 1 if z >= 0 else -1), "avionics", i)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((-0.075, 0.06, 0.048)),               # noqa: F821
                0.022, 0.022, 0.007, r=0.003, corner_seg=2, end_seg=2)
put("DRN_IMU", bm, M["mech"], C["SENSORS"], (-0.075, 0.06, 0.048),
    (0, 0, 1), "avionics", 3)

# --------------------------------------------------------------------------- #
# battery
# --------------------------------------------------------------------------- #

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, -0.12, 0.055)),                   # noqa: F821
                0.115, 0.085, 0.042, r=0.014, corner_seg=4, end_seg=3)
for i in range(4):
    add_box(bm, Matrix.Translation((-0.086 + i * 0.057, -0.12, 0.0975)),     # noqa: F821
            0.003, 0.076, 0.003)
for i in range(3):                                          # charge contacts
    add_box(bm, Matrix.Translation((-0.03 + i * 0.03, -0.203, 0.055)),       # noqa: F821
            0.008, 0.003, 0.010)
put("DRN_Battery", bm, M["shell2"], C["MECHANICAL"], (0, -0.12, 0.055),
    (0, -1, 0.25), "battery", 0)

bm = bmesh.new()
add_tube(bm, Matrix.Translation((0, -0.205, 0.078)), 0.011, 0.019, 0.042,    # noqa: F821
         seg=20, axis='X')
put("DRN_Battery_Handle", bm, M["mech"], C["MECHANICAL"], (0, -0.205, 0.078),
    (0, -1, 0.25), "battery", 1)

# --------------------------------------------------------------------------- #
# sensors
# --------------------------------------------------------------------------- #

bm = bmesh.new()
lathe(bm, [(0.0, 0.118), (0.040, 0.118), (0.040, 0.150), (0.034, 0.158),     # noqa: F821
           (0.022, 0.162), (0.0, 0.162)], seg=32,
      M=Matrix.Translation((0, 0.115, 0)))
add_tube(bm, Matrix.Translation((0, 0.115, 0.152)), 0.026, 0.041, 0.005, seg=32)  # noqa: F821
put("DRN_Lidar", bm, M["shell2"], C["SENSORS"], (0, 0.115, 0.145),
    (0, 0.35, 1), "sensor", 0)

bm = bmesh.new()
lathe(bm, [(0.0, 0.128), (0.033, 0.128), (0.033, 0.138), (0.026, 0.142),     # noqa: F821
           (0.0, 0.142)], seg=28, M=Matrix.Translation((0, -0.19, 0)))
put("DRN_GNSS", bm, M["shell2"], C["SENSORS"], (0, -0.19, 0.132),
    (0, -0.3, 1), "sensor", 1)

for side, sx in (("Left", -1), ("Right", 1)):
    bm = bmesh.new()
    base = Vector((sx * 0.165, -0.20, 0.02))
    tip = base + Vector((sx * 0.03, -0.01, 0.13))
    sweep(bm, frames_along([base, base.lerp(tip, 0.5), tip]),                # noqa: F821
          rect_section(0.006, 0.006, 0.002, 3))                              # noqa: F821
    put(f"DRN_Antenna_{side}", bm, M["mech"], C["SENSORS"],
        (sx * 0.165, -0.20, 0.05), (sx, -0.4, 0.3), "sensor", 2)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.245, 0.0))                       # noqa: F821
                @ Matrix.Rotation(radians(90), 4, 'X'),
                0.085, 0.030, 0.020, r=0.010, corner_seg=4, end_seg=3)
for i in range(3):                                          # sensor apertures
    add_tube(bm, Matrix.Translation((-0.05 + i * 0.05, 0.262, 0.0))          # noqa: F821
             @ Matrix.Rotation(radians(90), 4, 'X'), 0.008, 0.014, 0.004, seg=20)
put("DRN_FrontSensorModule", bm, M["shell2"], C["SENSORS"], (0, 0.245, 0.0),
    (0, 1, 0), "sensor", 3)

# --------------------------------------------------------------------------- #
# gimbal + camera
# --------------------------------------------------------------------------- #

g_yaw = pivot("DRN_Gimbal_Yaw", (0, 0.135, -0.135), C["RIG"])                 # noqa: F821
bm = bmesh.new()
lathe(bm, [(0.0, -0.160), (0.032, -0.160), (0.032, -0.130), (0.020, -0.126),  # noqa: F821
           (0.0, -0.126)], seg=24, M=Matrix.Translation((0, 0.135, 0)))
ob = to_object("DRN_Gimbal_YawShell", bm, M["mech"], C["MECHANICAL"])         # noqa: F821
set_origin(ob, (0, 0.135, -0.135)); attach(ob, g_yaw)                         # noqa: F821
tag(ob, (0, 0, -1), "gimbal", 0); parts.append(ob)                            # noqa: F821

g_roll = pivot("DRN_Gimbal_Roll", (0, 0.135, -0.175), C["RIG"], parent=g_yaw)  # noqa: F821
bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.135, -0.178)),                    # noqa: F821
                0.042, 0.020, 0.022, r=0.008, corner_seg=3, end_seg=2)
ob = to_object("DRN_Gimbal_RollShell", bm, M["mech"], C["MECHANICAL"])        # noqa: F821
set_origin(ob, (0, 0.135, -0.175)); attach(ob, g_roll)                        # noqa: F821
tag(ob, (0, 0, -1), "gimbal", 1); parts.append(ob)                            # noqa: F821

g_pitch = pivot("DRN_Gimbal_Pitch", (0, 0.135, -0.205), C["RIG"], parent=g_roll)  # noqa: F821
bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.140, -0.210)),                   # noqa: F821
                0.032, 0.030, 0.024, r=0.009, corner_seg=3, end_seg=2)
lathe(bm, [(0.0, 0.158), (0.024, 0.158), (0.024, 0.186), (0.017, 0.192),      # noqa: F821
           (0.0, 0.192)], seg=28,
      M=Matrix.Translation((0, 0, -0.210)) @ Matrix.Rotation(radians(-90), 4, 'X'))
ob = to_object("DRN_Camera", bm, M["shell2"], C["SENSORS"])                    # noqa: F821
set_origin(ob, (0, 0.135, -0.205)); attach(ob, g_pitch)                       # noqa: F821
tag(ob, (0, 0, -1), "gimbal", 2); parts.append(ob)                            # noqa: F821

bm = bmesh.new()
lathe(bm, [(0.0, 0.192), (0.015, 0.192), (0.013, 0.196), (0.0, 0.196)],       # noqa: F821
      seg=24, M=Matrix.Translation((0, 0, -0.210)) @ Matrix.Rotation(radians(-90), 4, 'X'))
ob = to_object("DRN_CameraLens", bm, M["glass"], C["SENSORS"])                # noqa: F821
set_origin(ob, (0, 0.135, -0.205)); attach(ob, g_pitch)                       # noqa: F821
tag(ob, (0, 0, -1), "gimbal", 3); parts.append(ob)                            # noqa: F821

# --------------------------------------------------------------------------- #
# arms, motors, ESCs, propellers, gear
# --------------------------------------------------------------------------- #

for idx, (key, (sx, sy)) in enumerate(CORNERS.items()):
    mx, my = sx * MOTOR_R, sy * MOTOR_R
    radial_dir = Vector((sx, sy, 0)).normalized()
    root = Vector((sx * 0.150, sy * 0.208, 0.0))
    tip = Vector((mx, my, 0.006))

    # --- arm: one continuous tapering sweep, with a top stiffening rib ----
    bm = bmesh.new()
    pathpts, scales = [], []
    N = 12
    for i in range(N + 1):
        t = i / N
        p = root.lerp(tip, t)
        p.z += 0.010 * sin(pi * t) * 0.5          # gentle upward camber
        pathpts.append(p)
        scales.append(1.0 - 0.34 * t)
    sweep(bm, frames_along(pathpts, scales=scales),                          # noqa: F821
          rect_section(0.040, 0.026, 0.011, 4))                              # noqa: F821
    rib = [p + Vector((0, 0, 0.024)) for p in pathpts]
    sweep(bm, frames_along(rib, scales=[s * 0.30 for s in scales]),          # noqa: F821
          rect_section(0.040, 0.026, 0.011, 3))                              # noqa: F821
    lathe(bm, [(0.0, -0.014), (0.054, -0.014), (0.054, 0.016), (0.046, 0.022),  # noqa: F821
               (0.0, 0.022)], seg=28, M=Matrix.Translation((mx, my, 0.004)))
    fasteners(bm, [(mx + 0.036 * cos(a), my + 0.036 * sin(a), 0.024)
                   for a in (0.4, 2.5, 4.6)])
    put(f"DRN_Arm_{key}", bm, M["shell"], C["STRUCTURE"], tuple(root),
        radial_dir, "arm", idx)

    # --- ESC ---------------------------------------------------------------
    bm = bmesh.new()
    ang = radians(-45) if sx * sy > 0 else radians(45)
    mm = Matrix.Translation((sx * 0.248, sy * 0.248, -0.030)) @ Matrix.Rotation(ang, 4, 'Z')
    add_rounded_box(bm, mm, 0.034, 0.021, 0.009, r=0.004, corner_seg=3, end_seg=2)  # noqa: F821
    for i in range(4):
        add_box(bm, mm @ Matrix.Translation((-0.018 + i * 0.012, 0, 0.011)),  # noqa: F821
                0.004, 0.014, 0.002)
    put(f"DRN_ESC_{key}", bm, M["mech"], C["MECHANICAL"],
        (sx * 0.248, sy * 0.248, -0.030), (0, 0, -1), "esc", idx)

    # --- motor: bell + stator + cooling fins -------------------------------
    bm = bmesh.new()
    lathe(bm, [(0.0, 0.018), (0.042, 0.018), (0.044, 0.026), (0.044, 0.062),  # noqa: F821
               (0.038, 0.070), (0.020, 0.072), (0.0, 0.072)], seg=32,
          M=Matrix.Translation((mx, my, 0)))
    for j, a, _ in radial(14, 0.0, 0.0):                                      # noqa: F821
        add_box(bm, Matrix.Translation((mx + 0.0435 * cos(a), my + 0.0435 * sin(a), 0.044))  # noqa: F821
                @ Matrix.Rotation(a, 4, 'Z'), 0.005, 0.004, 0.016)
    add_tube(bm, Matrix.Translation((mx, my, 0.020)), 0.030, 0.045, 0.004, seg=32)  # noqa: F821
    put(f"DRN_Motor_{key}", bm, M["shell2"], C["MECHANICAL"], (mx, my, 0.042),
        (0, 0, 1), "motor", idx)

    # --- propeller ---------------------------------------------------------
    hub = pivot(f"DRN_PropHub_{key}", (mx, my, 0.086), C["RIG"])              # noqa: F821
    bm = bmesh.new()
    lathe(bm, [(0.0, 0.078), (0.022, 0.078), (0.022, 0.096), (0.014, 0.100),  # noqa: F821
               (0.0, 0.100)], seg=24, M=Matrix.Translation((mx, my, 0)))
    ob = to_object(f"DRN_PropHubShell_{key}", bm, M["mech"], C["MECHANICAL"])  # noqa: F821
    set_origin(ob, (mx, my, 0.086)); attach(ob, hub)                          # noqa: F821
    tag(ob, (0, 0, 1), "prop", idx); parts.append(ob)                         # noqa: F821

    for b, blade_ang in enumerate((0.0, pi)):
        bm = bmesh.new()
        S = 12
        pathpts, chords, twists = [], [], []
        for i in range(S + 1):
            t = i / S
            r = 0.020 + (PROP_R - 0.020) * t
            pathpts.append(Vector((r, 0, 0)))
            chords.append(1.0 - 0.42 * (t ** 1.3))
            twists.append(radians(19 - 15 * t))
        fr = frames_along(pathpts, scales=chords, rolls=twists)               # noqa: F821
        base = (Matrix.Translation((mx, my, 0.090))
                @ Matrix.Rotation(blade_ang, 4, 'Z'))
        sweep(bm, [base @ f for f in fr], airfoil_section(0.056, 0.0075, 9))  # noqa: F821
        ob = to_object(f"DRN_PropBlade_{'AB'[b]}_{key}", bm, M["shell2"],      # noqa: F821
                       C["MECHANICAL"])
        set_origin(ob, (mx, my, 0.086)); attach(ob, hub)                      # noqa: F821
        tag(ob, (0, 0, 1), "prop", idx); parts.append(ob)                     # noqa: F821

    # --- landing gear ------------------------------------------------------
    bm = bmesh.new()
    top = Vector((sx * 0.285, sy * 0.285, -0.038))
    knee = Vector((sx * 0.318, sy * 0.318, -0.130))
    foot = Vector((sx * 0.330, sy * 0.330, -0.196))
    sweep(bm, frames_along([top, top.lerp(knee, 0.55), knee,                  # noqa: F821
                            knee.lerp(foot, 0.6), foot],
                           scales=[1.0, 0.94, 0.88, 0.84, 0.82]),
          rect_section(0.013, 0.011, 0.005, 4))                               # noqa: F821
    add_rounded_box(bm, Matrix.Translation(foot + Vector((0, 0, -0.006)))      # noqa: F821
                    @ Matrix.Rotation(radians(45) * (1 if sx * sy > 0 else -1), 4, 'Z'),
                    0.034, 0.016, 0.007, r=0.006, corner_seg=3, end_seg=2)
    put(f"DRN_LandingGear_{key}", bm, M["mech"], C["STRUCTURE"],
        tuple(top), (0, 0, -1), "gear", idx)

    # --- status LED --------------------------------------------------------
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((mx, my, -0.014)), 0.011, 0.003, seg=18)  # noqa: F821
    put(f"DRN_StatusLED_{key}", bm, M["accent1"] if sy > 0 else M["accent2"],
        C["EMISSIVE"], (mx, my, -0.014), (0, 0, -1), "led", idx)

bm = bmesh.new()
add_box(bm, Matrix.Translation((0, -0.02, -0.128)), 0.070, 0.150, 0.006)      # noqa: F821
for i in range(6):
    add_box(bm, Matrix.Translation((0, -0.14 + i * 0.048, -0.136)),           # noqa: F821
            0.062, 0.008, 0.004)
put("DRN_PayloadRail", bm, M["shell2"], C["STRUCTURE"], (0, -0.02, -0.128),
    (0, 0, -1), "payload", 0)

# --------------------------------------------------------------------------- #
# root, anchors, actions
# --------------------------------------------------------------------------- #

root = bpy.data.objects.new("DRN_Root", None)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 0.4
C["ROOT"].objects.link(root)

for nm, loc in [
    ("propeller", (MOTOR_R + 0.11, MOTOR_R, 0.10)),
    ("motor", (MOTOR_R, -MOTOR_R, 0.07)),
    ("electronic speed controller", (0.30, -0.30, -0.05)),
    ("flight computer", (0.0, 0.05, 0.05)),
    ("GNSS", (0.0, -0.19, 0.15)),
    ("LiDAR", (0.0, 0.14, 0.18)),
    ("gimbal", (0.0, 0.16, -0.21)),
    ("battery", (0.0, -0.14, 0.10)),
    ("airframe", (-MOTOR_R, MOTOR_R, 0.0)),
    ("powertrain", (-MOTOR_R, -MOTOR_R, 0.05)),
    ("navigation", (0.0, 0.20, 0.14)),
    ("payload", (0.0, -0.02, -0.15)),
    ("telemetry", (0.17, 0.0, 0.12)),
]:
    anchors.append(anchor(nm, loc, C["ANCHORS"], parent=root))                 # noqa: F821

finish(parts, root,                                                            # noqa: F821
       no_bevel={o.name for o in parts if "PropBlade" in o.name
                 or "StatusLED" in o.name or "Antenna" in o.name
                 or "CameraLens" in o.name},
       bevel_width=0.0028)
for e in [o for o in bpy.data.objects
          if o.type == 'EMPTY' and o.parent is None and o is not root]:
    e.parent = root

SPIN = {"FL": 1, "RR": 1, "FR": -1, "RL": -1}   # diagonals match, adjacent oppose
for key, direction in SPIN.items():
    hub = bpy.data.objects[f"DRN_PropHub_{key}"]
    hub.rotation_mode = 'XYZ'
    hub.animation_data_create()
    act = bpy.data.actions.new(f"DRN_PropellerSpin_{key}")
    hub.animation_data.action = act
    for f, turns in ((1, 0.0), (60, direction * 2.0)):
        hub.rotation_euler = (0, 0, turns * 2 * pi)
        hub.keyframe_insert("rotation_euler", frame=f)
    set_linear(act)                                                            # noqa: F821

for name, axis, lo, hi in (("DRN_Gimbal_Yaw", 2, -35, 35),
                           ("DRN_Gimbal_Pitch", 0, -50, 5)):
    g = bpy.data.objects[name]
    g.rotation_mode = 'XYZ'
    g.animation_data_create()
    act = bpy.data.actions.new(f"DRN_GimbalScan_{name.split('_')[-1]}")
    g.animation_data.action = act
    for f, deg in ((1, lo), (60, hi), (120, lo)):
        rot = [0.0, 0.0, 0.0]
        rot[axis] = radians(deg)
        g.rotation_euler = rot
        g.keyframe_insert("rotation_euler", frame=f)

scn.frame_start, scn.frame_end = 1, 120

RESULT = {"objects": len(parts), "anchors": len(anchors),
          "tris": tri_count(parts)}                                            # noqa: F821
print("build_drone.py ->", RESULT)
