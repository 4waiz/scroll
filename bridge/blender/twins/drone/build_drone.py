"""
build_drone.py - original industrial inspection quadcopter.

Requires twin_common.py to be exec'd into the same namespace first.

Geometry (metres, Z-up, +Y forward):
    motor-to-motor diagonal   1.10
    central body              0.38 W x 0.52 L x 0.18 H
    propeller diameter        0.36
    landing clearance         0.20

Explode/reassemble is NOT baked as an action: the web scene drives it from each
part's `explode` vector so it stays a pure function of scroll progress and
reverses exactly. Propeller spin and the gimbal scan ARE baked, because they are
continuous local motion the browser should not have to author.
"""

import bpy
import bmesh
from math import radians, cos, sin, pi
from mathutils import Matrix, Vector

# ---- layout ---------------------------------------------------------------

MOTOR_R = 0.55 / (2 ** 0.5)     # 0.389 -> 1.10 m diagonal
BODY_HW, BODY_HL, BODY_HH = 0.19, 0.26, 0.09
PROP_R = 0.18
CORNERS = {                     # name -> (x_sign, y_sign)
    "FL": (-1, 1), "FR": (1, 1), "RL": (-1, -1), "RR": (1, -1),
}

scn = reset_scene()                                        # noqa: F821
C = make_collections(scn)                                  # noqa: F821
M = build_materials("DRN", accents=("mint", "cyan"))       # noqa: F821
parts = []
anchors = []


def put(name, bm, mat, coll, origin, explode, grp, order=0):
    ob = to_object(name, bm, mat, coll)                    # noqa: F821
    set_origin(ob, origin)                                 # noqa: F821
    tag(ob, explode, grp, order)                           # noqa: F821
    parts.append(ob)
    return ob


# --------------------------------------------------------------------------- #
# central body
# --------------------------------------------------------------------------- #

bm = bmesh.new()
add_box(bm, Matrix.Translation((0, 0, 0)), BODY_HW, BODY_HL, BODY_HH * 0.72)   # noqa: F821
# arm root brackets
for key, (sx, sy) in CORNERS.items():
    a = Matrix.Translation((sx * 0.155, sy * 0.215, 0)) @ Matrix.Rotation(
        radians(45) * (1 if sx * sy > 0 else -1), 4, 'Z')
    add_box(bm, a, 0.055, 0.045, 0.055)                    # noqa: F821
put("DRN_Body_Core", bm, M["mech"], C["STRUCTURE"], (0, 0, 0), (0, 0, -1), "core", 0)

# upper shell - vented, slightly domed
bm = bmesh.new()
add_taper_box(bm, Matrix.Translation((0, 0, 0.095)), BODY_HW, BODY_HL,        # noqa: F821
              BODY_HW * 0.80, BODY_HL * 0.86, 0.032)
for i in range(7):                                          # vent slots
    y = -0.16 + i * 0.045
    add_box(bm, Matrix.Translation((0, y, 0.127)), 0.10, 0.007, 0.006)        # noqa: F821
put("DRN_Body_UpperShell", bm, M["shell"], C["SHELL"], (0, 0, 0.10),
    (0, 0, 1), "shell", 0)

bm = bmesh.new()
add_taper_box(bm, Matrix.Translation((0, 0, -0.095)), BODY_HW * 0.80,         # noqa: F821
              BODY_HL * 0.86, BODY_HW, BODY_HL, 0.030)
add_box(bm, Matrix.Translation((0, -0.05, -0.126)), 0.07, 0.09, 0.005)        # noqa: F821
put("DRN_Body_LowerShell", bm, M["shell"], C["SHELL"], (0, 0, -0.10),
    (0, 0, -1), "shell", 1)

# --------------------------------------------------------------------------- #
# avionics stack
# --------------------------------------------------------------------------- #

STACK = [("DRN_FlightComputer", 0.030, "compute"),
         ("DRN_Avionics_Stack", 0.000, "compute"),
         ("DRN_PowerDistribution", -0.030, "power")]
for i, (nm, z, grp) in enumerate(STACK):
    bm = bmesh.new()
    add_box(bm, Matrix.Translation((0, 0.01, z)), 0.115, 0.135, 0.006)        # noqa: F821
    for j, (cx, cy) in enumerate(((-0.07, 0.09), (0.07, 0.09),
                                  (-0.07, -0.07), (0.07, -0.07))):
        add_box(bm, Matrix.Translation((cx, cy, z + 0.010)), 0.018, 0.018, 0.005)  # noqa: F821
    put(nm, bm, M["mech"], C["MECHANICAL"], (0, 0, z), (0, 0, 1 if z >= 0 else -1),
        "avionics", i)

bm = bmesh.new()
add_box(bm, Matrix.Translation((-0.075, 0.06, 0.048)), 0.022, 0.022, 0.008)   # noqa: F821
put("DRN_IMU", bm, M["mech"], C["SENSORS"], (-0.075, 0.06, 0.048),
    (0, 0, 1), "avionics", 3)

# --------------------------------------------------------------------------- #
# battery - slides out the rear
# --------------------------------------------------------------------------- #

bm = bmesh.new()
add_taper_box(bm, Matrix.Translation((0, -0.12, 0.055)), 0.115, 0.085,        # noqa: F821
              0.108, 0.080, 0.042)
for i in range(4):                                          # cell seams
    add_box(bm, Matrix.Translation((-0.09 + i * 0.06, -0.12, 0.098)),         # noqa: F821
            0.004, 0.078, 0.004)
put("DRN_Battery", bm, M["shell2"], C["MECHANICAL"], (0, -0.12, 0.055),
    (0, -1, 0.25), "battery", 0)

bm = bmesh.new()
add_tube(bm, Matrix.Translation((0, -0.205, 0.075)), 0.012, 0.020, 0.045,     # noqa: F821
         seg=16, axis='X')
put("DRN_Battery_Handle", bm, M["mech"], C["MECHANICAL"], (0, -0.205, 0.075),
    (0, -1, 0.25), "battery", 1)

# --------------------------------------------------------------------------- #
# sensors
# --------------------------------------------------------------------------- #

bm = bmesh.new()
add_cylinder(bm, Matrix.Translation((0, 0.115, 0.145)), 0.038, 0.028, seg=28) # noqa: F821
add_tube(bm, Matrix.Translation((0, 0.115, 0.168)), 0.020, 0.038, 0.006, seg=28)  # noqa: F821
put("DRN_Lidar", bm, M["shell2"], C["SENSORS"], (0, 0.115, 0.145),
    (0, 0.35, 1), "sensor", 0)

bm = bmesh.new()
add_cylinder(bm, Matrix.Translation((0, -0.19, 0.132)), 0.032, 0.008, seg=24) # noqa: F821
put("DRN_GNSS", bm, M["shell2"], C["SENSORS"], (0, -0.19, 0.132),
    (0, -0.3, 1), "sensor", 1)

for side, sx in (("Left", -1), ("Right", 1)):
    bm = bmesh.new()
    add_prism(bm, Matrix.Translation((sx * 0.165, -0.20, 0.05))               # noqa: F821
              @ Matrix.Rotation(radians(sx * -18), 4, 'Y'),
              0.006, 8, 0.075, axis='Z')
    put(f"DRN_Antenna_{side}", bm, M["mech"], C["SENSORS"],
        (sx * 0.165, -0.20, 0.05), (sx, -0.4, 0.3), "sensor", 2)

# front sensor module
bm = bmesh.new()
add_taper_box(bm, Matrix.Translation((0, 0.245, 0.0))                          # noqa: F821
              @ Matrix.Rotation(radians(90), 4, 'X'),
              0.085, 0.030, 0.070, 0.026, 0.018)
put("DRN_FrontSensorModule", bm, M["shell2"], C["SENSORS"], (0, 0.245, 0.0),
    (0, 1, 0), "sensor", 3)

# --------------------------------------------------------------------------- #
# gimbal + camera (three nested pivots)
# --------------------------------------------------------------------------- #

g_yaw = pivot("DRN_Gimbal_Yaw", (0, 0.135, -0.135), C["RIG"])                 # noqa: F821
bm = bmesh.new()
add_cylinder(bm, Matrix.Translation((0, 0.135, -0.145)), 0.030, 0.018, seg=24)  # noqa: F821
ob = to_object("DRN_Gimbal_YawShell", bm, M["mech"], C["MECHANICAL"])          # noqa: F821
set_origin(ob, (0, 0.135, -0.135))                                             # noqa: F821
ob.parent = g_yaw
tag(ob, (0, 0, -1), "gimbal", 0)                                               # noqa: F821
parts.append(ob)

g_roll = pivot("DRN_Gimbal_Roll", (0, 0.135, -0.175), C["RIG"], parent=g_yaw)  # noqa: F821
bm = bmesh.new()
add_box(bm, Matrix.Translation((0, 0.135, -0.178)), 0.042, 0.020, 0.022)       # noqa: F821
ob = to_object("DRN_Gimbal_RollShell", bm, M["mech"], C["MECHANICAL"])         # noqa: F821
set_origin(ob, (0, 0.135, -0.175))                                             # noqa: F821
ob.parent = g_roll
tag(ob, (0, 0, -1), "gimbal", 1)                                               # noqa: F821
parts.append(ob)

g_pitch = pivot("DRN_Gimbal_Pitch", (0, 0.135, -0.205), C["RIG"], parent=g_roll)  # noqa: F821
bm = bmesh.new()
add_box(bm, Matrix.Translation((0, 0.140, -0.210)), 0.032, 0.030, 0.024)       # noqa: F821
add_cylinder(bm, Matrix.Translation((0, 0.172, -0.210))                        # noqa: F821
             @ Matrix.Rotation(radians(90), 4, 'X'), 0.024, 0.016, seg=24)
add_tube(bm, Matrix.Translation((0, 0.188, -0.210))                            # noqa: F821
         @ Matrix.Rotation(radians(90), 4, 'X'), 0.014, 0.024, 0.004, seg=24)
ob = to_object("DRN_Camera", bm, M["shell2"], C["SENSORS"])                     # noqa: F821
set_origin(ob, (0, 0.135, -0.205))                                             # noqa: F821
ob.parent = g_pitch
tag(ob, (0, 0, -1), "gimbal", 2)                                               # noqa: F821
parts.append(ob)

# --------------------------------------------------------------------------- #
# arms, motors, ESCs, propellers
# --------------------------------------------------------------------------- #

for idx, (key, (sx, sy)) in enumerate(CORNERS.items()):
    mx, my = sx * MOTOR_R, sy * MOTOR_R
    ang = -pi / 4 if sx * sy > 0 else pi / 4          # arm yaw toward the motor
    radial_dir = Vector((sx, sy, 0)).normalized()

    # arm - tapered, from the body bracket out to the motor boss
    bm = bmesh.new()
    steps = 5
    for i in range(steps):
        t0, t1 = i / steps, (i + 1) / steps
        x0, y0 = sx * (0.15 + (MOTOR_R - 0.15) * t0), sy * (0.21 + (MOTOR_R - 0.21) * t0)
        x1, y1 = sx * (0.15 + (MOTOR_R - 0.15) * t1), sy * (0.21 + (MOTOR_R - 0.21) * t1)
        mid = Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, 0.0)) @ \
            Matrix.Rotation(ang, 4, 'Z')
        w0 = 0.042 - 0.012 * t0
        w1 = 0.042 - 0.012 * t1
        seg_len = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / 2
        add_taper_box(bm, mid @ Matrix.Rotation(radians(90), 4, 'X'),           # noqa: F821
                      w0, 0.028 - 0.006 * t0, w1, 0.028 - 0.006 * t1, seg_len)
    add_cylinder(bm, Matrix.Translation((mx, my, 0.005)), 0.052, 0.020, seg=24) # noqa: F821
    put(f"DRN_Arm_{key}", bm, M["shell"], C["STRUCTURE"], (sx * 0.15, sy * 0.21, 0),
        radial_dir, "arm", idx)

    # ESC - under the arm, near the body
    bm = bmesh.new()
    add_box(bm, Matrix.Translation((sx * 0.245, sy * 0.245, -0.028))            # noqa: F821
            @ Matrix.Rotation(ang, 4, 'Z'), 0.032, 0.020, 0.010)
    put(f"DRN_ESC_{key}", bm, M["mech"], C["MECHANICAL"],
        (sx * 0.245, sy * 0.245, -0.028), (0, 0, -1), "esc", idx)

    # motor - stator can with cooling slots
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((mx, my, 0.042)), 0.044, 0.026, seg=28) # noqa: F821
    add_tube(bm, Matrix.Translation((mx, my, 0.070)), 0.030, 0.044, 0.004, seg=28)  # noqa: F821
    for j, a, _ in radial(10, 0.0, 0.0):                                        # noqa: F821
        add_box(bm, Matrix.Translation((mx + 0.041 * cos(a), my + 0.041 * sin(a), 0.042))  # noqa: F821
                @ Matrix.Rotation(a, 4, 'Z'), 0.006, 0.005, 0.017)
    put(f"DRN_Motor_{key}", bm, M["shell2"], C["MECHANICAL"], (mx, my, 0.042),
        (0, 0, 1), "motor", idx)

    # propeller hub is a pivot so the browser can spin it
    hub = pivot(f"DRN_PropHub_{key}", (mx, my, 0.086), C["RIG"])                 # noqa: F821
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((mx, my, 0.088)), 0.020, 0.010, seg=20)  # noqa: F821
    ob = to_object(f"DRN_PropHubShell_{key}", bm, M["mech"], C["MECHANICAL"])    # noqa: F821
    set_origin(ob, (mx, my, 0.086))                                              # noqa: F821
    ob.parent = hub
    tag(ob, (0, 0, 1), "prop", idx)                                              # noqa: F821
    parts.append(ob)

    # two blades per hub, twisted
    for b, blade_ang in enumerate((0.0, pi)):
        bm = bmesh.new()
        segs = 6
        for s in range(segs):
            t0, t1 = s / segs, (s + 1) / segs
            r0, r1 = 0.022 + (PROP_R - 0.022) * t0, 0.022 + (PROP_R - 0.022) * t1
            twist = radians(16 - 12 * t0)
            mid_r = (r0 + r1) / 2
            mm = (Matrix.Translation((mx, my, 0.090))
                  @ Matrix.Rotation(blade_ang, 4, 'Z')
                  @ Matrix.Translation((mid_r, 0, 0))
                  @ Matrix.Rotation(twist, 4, 'X'))
            c0 = 0.030 - 0.014 * t0
            c1 = 0.030 - 0.014 * t1
            add_taper_box(bm, mm @ Matrix.Rotation(radians(90), 4, 'Y'),          # noqa: F821
                          c0, 0.0035, c1, 0.0030, (r1 - r0) / 2)
        ob = to_object(f"DRN_PropBlade_{'AB'[b]}_{key}", bm, M["shell2"],         # noqa: F821
                       C["MECHANICAL"])
        set_origin(ob, (mx, my, 0.086))                                           # noqa: F821
        ob.parent = hub
        tag(ob, (0, 0, 1), "prop", idx)                                           # noqa: F821
        parts.append(ob)

    # landing leg
    bm = bmesh.new()
    add_prism(bm, Matrix.Translation((sx * 0.30, sy * 0.30, -0.105))              # noqa: F821
              @ Matrix.Rotation(radians(12) * sx, 4, 'Y'), 0.010, 8, 0.075, axis='Z')
    add_box(bm, Matrix.Translation((sx * 0.315, sy * 0.30, -0.182)),              # noqa: F821
            0.030, 0.016, 0.008)
    put(f"DRN_LandingGear_{key}", bm, M["mech"], C["STRUCTURE"],
        (sx * 0.30, sy * 0.30, -0.105), (0, 0, -1), "gear", idx)

    # status LED
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((mx, my, -0.012)), 0.012, 0.004, seg=16)  # noqa: F821
    put(f"DRN_StatusLED_{key}", bm, M["accent1"] if sy > 0 else M["accent2"],
        C["EMISSIVE"], (mx, my, -0.012), (0, 0, -1), "led", idx)

# payload rail
bm = bmesh.new()
add_box(bm, Matrix.Translation((0, -0.02, -0.128)), 0.070, 0.150, 0.008)          # noqa: F821
put("DRN_PayloadRail", bm, M["shell2"], C["STRUCTURE"], (0, -0.02, -0.128),
    (0, 0, -1), "payload", 0)

# --------------------------------------------------------------------------- #
# root, anchors, actions
# --------------------------------------------------------------------------- #

root = bpy.data.objects.new("DRN_Root", None)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 0.4
C["ROOT"].objects.link(root)

ANCHORS = [
    ("propeller", (MOTOR_R + 0.10, MOTOR_R, 0.10)),
    ("motor", (MOTOR_R, -MOTOR_R, 0.06)),
    ("electronic speed controller", (0.30, -0.30, -0.04)),
    ("flight computer", (0.0, 0.05, 0.05)),
    ("GNSS", (0.0, -0.19, 0.15)),
    ("LiDAR", (0.0, 0.14, 0.18)),
    ("gimbal", (0.0, 0.16, -0.21)),
    ("battery", (0.0, -0.14, 0.10)),
    ("airframe", (-MOTOR_R, MOTOR_R, 0.0)),
    ("powertrain", (-MOTOR_R, -MOTOR_R, 0.05)),
    ("navigation", (0.0, 0.20, 0.13)),
    ("payload", (0.0, -0.02, -0.15)),
    ("telemetry", (0.16, 0.0, 0.12)),
]
for nm, loc in ANCHORS:
    anchors.append(anchor(nm, loc, C["ANCHORS"], parent=root))                    # noqa: F821

finish(parts, root,                                                               # noqa: F821
       no_bevel={o.name for o in parts if "PropBlade" in o.name
                 or "StatusLED" in o.name or "Antenna" in o.name},
       bevel_width=0.0035)
for p in [o for o in bpy.data.objects if o.type == 'EMPTY' and o.parent is None
          and o is not root]:
    p.parent = root

# ---- baked actions ---------------------------------------------------------
# Diagonal motors share a direction; adjacent motors counter-rotate.
SPIN = {"FL": 1, "RR": 1, "FR": -1, "RL": -1}
for key, direction in SPIN.items():
    hub = bpy.data.objects[f"DRN_PropHub_{key}"]
    hub.rotation_mode = 'XYZ'
    hub.animation_data_create()
    act = bpy.data.actions.new(f"DRN_PropellerSpin_{key}")
    hub.animation_data.action = act
    for f, turns in ((1, 0.0), (60, direction * 2.0)):
        hub.rotation_euler = (0, 0, turns * 2 * pi)
        hub.keyframe_insert("rotation_euler", frame=f)
    set_linear(act)                                                               # noqa: F821

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

RESULT = {
    "objects": len(parts),
    "anchors": len(anchors),
    "tris": tri_count(parts),                                                     # noqa: F821
}
print("build_drone.py ->", RESULT)
