"""
build_vehicle.py - original autonomous electric crossover.

Requires twin_common.py exec'd into the same namespace first.

Geometry (metres, Z-up, +Y forward):
    length 4.55   width 1.90   height 1.55   wheelbase 2.80   wheel dia 0.72

The body is a loft, not a box: a rounded-rect section is swept along the length
with per-station width and height, then the greenhouse is lofted on top. That is
what gives it real crossover volume rather than a slab with chamfers.

Original design - no manufacturer geometry, badging or trademarked colours. The
front and rear light bars, sensor pod and panel breaks are this build's own.

Explode is driven in the browser from each part's `explode` vector; only the
steering, wheel spin and LiDAR rotation are baked as clips.
"""

import bpy
import bmesh
from math import radians, cos, sin, pi
from mathutils import Matrix, Vector

L, W, H = 4.55, 1.90, 1.55
WHEELBASE = 2.80
WHEEL_R, WHEEL_W = 0.36, 0.12
TRACK = 0.82                      # wheel centre from centreline
AXLE_Y = WHEELBASE / 2            # 1.40
CORNERS = {"FL": (-1, 1), "FR": (1, 1), "RL": (-1, -1), "RR": (1, -1)}

# local Z -> world +Y, local X -> world -X, local Y -> world +Z
SEC_ROT = Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))

scn = reset_scene()                                          # noqa: F821
C = make_collections(scn)                                    # noqa: F821
M = build_materials("CAR", accents=("blue", "orange"))       # noqa: F821
parts, anchors = [], []


def put(name, bm, mat, coll, origin, explode, grp, order=0):
    ob = to_object(name, bm, mat, coll)                      # noqa: F821
    set_origin(ob, origin)                                   # noqa: F821
    tag(ob, explode, grp, order)                             # noqa: F821
    parts.append(ob)
    return ob


def loft(bm, stations, radius=0.26, corner_seg=5, caps=True):
    """
    Sweep a unit rounded-rect along +Y.

    `stations` is a list of (y, half_width, z_bottom, z_top). The section is a
    unit box scaled per station, so width and height vary independently along
    the body - which a uniform sweep scale cannot do.
    """
    frames = []
    for (y, hw, z0, z1) in stations:
        zc = (z0 + z1) * 0.5
        hh = (z1 - z0) * 0.5
        frames.append(Matrix.Translation((0, y, zc)) @ SEC_ROT
                      @ Matrix.Diagonal((hw, hh, 1.0, 1.0)))
    sweep(bm, frames, rect_section(1.0, 1.0, radius, corner_seg), caps=caps)  # noqa: F821


# --------------------------------------------------------------------------- #
# body shell
# --------------------------------------------------------------------------- #

LOWER = [
    (-2.275, 0.80, 0.44, 0.94),
    (-1.95, 0.91, 0.34, 1.02),
    (-1.20, 0.95, 0.30, 1.05),
    (-0.30, 0.95, 0.29, 1.05),
    (0.60, 0.95, 0.29, 1.04),
    (1.45, 0.93, 0.31, 1.01),
    (1.98, 0.87, 0.37, 0.95),
    (2.275, 0.78, 0.46, 0.86),
]
GREENHOUSE = [
    (-1.62, 0.70, 1.00, 1.24),
    (-1.25, 0.79, 1.00, 1.45),
    (-0.45, 0.82, 1.00, 1.54),
    (0.35, 0.82, 1.00, 1.55),
    (0.92, 0.77, 1.00, 1.43),
    (1.32, 0.68, 1.00, 1.16),
]

bm = bmesh.new()
loft(bm, LOWER, radius=0.30)
loft(bm, GREENHOUSE, radius=0.34)
# wheel arches - raised lips around each wheel opening
for key, (sx, sy) in CORNERS.items():
    cy = sy * AXLE_Y
    for i in range(13):
        a = pi * (i / 12)
        add_box(bm,                                                          # noqa: F821
                Matrix.Translation((sx * 0.955, cy + (WHEEL_R + 0.07) * cos(a),
                                    0.34 + (WHEEL_R + 0.07) * sin(a)))
                @ Matrix.Rotation(radians(90) * sx, 4, 'Z'),
                0.030, 0.055, 0.030)
put("CAR_BodyShell", bm, M["shell"], C["SHELL"], (0, 0, 0.7), (0, 0, 1), "body", 0)

bm = bmesh.new()
loft(bm, [(1.20, 0.90, 0.96, 1.02), (1.70, 0.87, 0.93, 1.00),
          (2.05, 0.82, 0.92, 0.97), (2.24, 0.74, 0.92, 0.95)], radius=0.24)
put("CAR_Hood", bm, M["shell"], C["SHELL"], (1.7, 0, 0.97), (0, 0.3, 1), "panel", 0)

bm = bmesh.new()
loft(bm, [(-2.24, 0.76, 0.92, 0.99), (-2.00, 0.86, 0.95, 1.06),
          (-1.72, 0.90, 0.98, 1.10)], radius=0.24)
put("CAR_Trunk", bm, M["shell"], C["SHELL"], (-2.0, 0, 1.0), (0, -0.4, 1), "panel", 1)

# doors - separate so they can swing and explode
def panel_loft(bm, x, stations, thickness=0.024, radius=0.30, corner_seg=4):
    """
    A door-sized skin panel standing at a fixed x.

    Built as its own thin loft rather than by clipping vertices out of the body
    section - that hack collapsed the panel back onto the body surface and the
    doors disappeared.
    """
    frames = []
    for (y, z0, z1) in stations:
        zc, hh = (z0 + z1) * 0.5, (z1 - z0) * 0.5
        frames.append(Matrix.Translation((x, y, zc)) @ SEC_ROT
                      @ Matrix.Diagonal((thickness, hh, 1.0, 1.0)))
    sweep(bm, frames, rect_section(1.0, 1.0, radius, corner_seg))            # noqa: F821


DOORS = {"FL": (-1, 0.62), "FR": (1, 0.62), "RL": (-1, -0.52), "RR": (1, -0.52)}
for key, (sx, cy) in DOORS.items():
    bm = bmesh.new()
    y0, y1 = cy - 0.50, cy + 0.50
    panel_loft(bm, sx * 0.952,
               [(y0, 0.36, 1.02), (cy, 0.33, 1.05), (y1, 0.35, 1.03)])
    add_box(bm, Matrix.Translation((sx * 0.972, cy - 0.28, 0.74)),           # noqa: F821
            0.014, 0.085, 0.020)                                  # handle
    put(f"CAR_Door_{key}", bm, M["shell"], C["SHELL"], (sx * 0.95, cy, 0.7),
        (sx, 0, 0), "door", 0)

# glass
GLASS = [
    ("CAR_Glass_Front", [(0.42, 0.79, 1.02, 1.50), (0.98, 0.75, 1.00, 1.40)]),
    ("CAR_Glass_Rear", [(-1.58, 0.70, 1.02, 1.22), (-1.20, 0.78, 1.03, 1.44)]),
    ("CAR_RoofGlass", [(-0.95, 0.66, 1.505, 1.535), (0.20, 0.68, 1.525, 1.548)]),
]
for nm, st in GLASS:
    bm = bmesh.new()
    loft(bm, st, radius=0.30)
    put(nm, bm, M["glass"], C["SHELL"], (0, st[0][0], 1.3), (0, 0, 1), "glass", 0)

for key, sx in (("Left", -1), ("Right", 1)):
    bm = bmesh.new()
    loft(bm, [(-1.15, 0.83, 1.04, 1.40), (-0.40, 0.845, 1.04, 1.48),
              (0.36, 0.845, 1.04, 1.48), (0.90, 0.80, 1.04, 1.36)], radius=0.22)
    for v in bm.verts:
        if v.co.x * sx < 0:
            v.co.x = 0.0
    put(f"CAR_Glass_{key}", bm, M["glass"], C["SHELL"], (sx * 0.8, 0, 1.25),
        (sx, 0, 0), "glass", 1)

# bumpers + light bars
bm = bmesh.new()
loft(bm, [(2.10, 0.86, 0.36, 0.78), (2.30, 0.80, 0.38, 0.72)], radius=0.24)
put("CAR_FrontBumper", bm, M["shell2"], C["SHELL"], (0, 2.2, 0.55), (0, 1, 0), "panel", 2)

bm = bmesh.new()
loft(bm, [(-2.30, 0.80, 0.40, 0.80), (-2.10, 0.86, 0.38, 0.86)], radius=0.24)
put("CAR_RearBumper", bm, M["shell2"], C["SHELL"], (0, -2.2, 0.6), (0, -1, 0), "panel", 3)

for nm, y, mat, ex in (("CAR_FrontLightBar", 2.255, M["accent1"], (0, 1, 0)),
                       ("CAR_RearLightBar", -2.255, M["accent2"], (0, -1, 0))):
    bm = bmesh.new()
    add_box(bm, Matrix.Translation((0, y, 0.86)), 0.74, 0.020, 0.028)        # noqa: F821
    put(nm, bm, mat, C["EMISSIVE"], (0, y, 0.86), ex, "light", 0)

# --------------------------------------------------------------------------- #
# chassis, battery, drive units
# --------------------------------------------------------------------------- #

bm = bmesh.new()
loft(bm, [(-2.10, 0.78, 0.22, 0.32), (-1.20, 0.86, 0.20, 0.32),
          (1.20, 0.86, 0.20, 0.32), (2.10, 0.78, 0.22, 0.32)], radius=0.18)
put("CAR_Chassis", bm, M["mech"], C["STRUCTURE"], (0, 0, 0.26), (0, 0, -1), "chassis", 0)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0, 0.17)), 0.80, 1.30, 0.055,     # noqa: F821
                r=0.05, corner_seg=4, end_seg=2)
put("CAR_BatteryCover", bm, M["mech"], C["MECHANICAL"], (0, 0, 0.17),
    (0, 0, -1), "battery", 0)

for i in range(5):
    y = -1.04 + i * 0.52
    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation((0, y, 0.115)), 0.76, 0.24, 0.045,  # noqa: F821
                    r=0.03, corner_seg=3, end_seg=2)
    for j in range(6):                                        # cell seams
        add_box(bm, Matrix.Translation((-0.62 + j * 0.25, y, 0.162)),         # noqa: F821
                0.008, 0.22, 0.004)
    put(f"CAR_BatteryModule_{i + 1:02d}", bm, M["shell2"], C["MECHANICAL"],
        (0, y, 0.115), (0, (i - 2) * 0.4, -1), "battery", i + 1)

for nm, y, ex in (("CAR_Motor_Front", 1.34, (0, 1, 0)), ("CAR_Motor_Rear", -1.34, (0, -1, 0))):
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((0, y, 0.38))                         # noqa: F821
                 @ Matrix.Rotation(radians(90), 4, 'Y'), 0.16, 0.20, seg=28)
    for j, a, _ in radial(16, 0.0, 0.0):                                      # noqa: F821
        add_box(bm, Matrix.Translation((0, y + 0.158 * cos(a), 0.38 + 0.158 * sin(a)))  # noqa: F821
                @ Matrix.Rotation(a, 4, 'X'), 0.19, 0.012, 0.014)
    put(nm, bm, M["shell2"], C["MECHANICAL"], (0, y, 0.38), ex, "drive", 0)

for nm, y, ex in (("CAR_Gearbox_Front", 1.34, (0, 1, 0)), ("CAR_Gearbox_Rear", -1.34, (0, -1, 0))):
    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((0.30, y, 0.36))                      # noqa: F821
                 @ Matrix.Rotation(radians(90), 4, 'Y'), 0.13, 0.09, seg=24)
    put(nm, bm, M["mech"], C["MECHANICAL"], (0.30, y, 0.36), ex, "drive", 1)

for nm, y, ex in (("CAR_Inverter_Front", 1.62, (0, 1, 0.4)),
                  ("CAR_Inverter_Rear", -1.62, (0, -1, 0.4))):
    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation((0, y, 0.52)), 0.28, 0.13, 0.10,   # noqa: F821
                    r=0.025, corner_seg=3, end_seg=2)
    for j in range(7):
        add_box(bm, Matrix.Translation((-0.21 + j * 0.07, y, 0.625)),         # noqa: F821
                0.018, 0.11, 0.010)
    put(nm, bm, M["mech"], C["MECHANICAL"], (0, y, 0.52), ex, "drive", 2)

for nm, y, sz, ex in (("CAR_ECU", 1.05, (0.16, 0.11, 0.05), (0, 0, 1)),
                      ("CAR_ThermalModule", 1.80, (0.30, 0.10, 0.14), (0, 1, 0.5))):
    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation((0, y, 0.58)), *sz,                # noqa: F821
                    r=0.02, corner_seg=3, end_seg=2)
    put(nm, bm, M["mech"], C["MECHANICAL"], (0, y, 0.58), ex, "system", 0)

bm = bmesh.new()
add_cylinder(bm, Matrix.Translation((0, 1.34, 0.56))                          # noqa: F821
             @ Matrix.Rotation(radians(90), 4, 'Y'), 0.030, 0.62, seg=16)
put("CAR_SteeringRack", bm, M["mech"], C["MECHANICAL"], (0, 1.34, 0.56),
    (0, 0, -1), "system", 1)

for nm, y0, y1 in (("CAR_Subframe_Front", 1.05, 1.75), ("CAR_Subframe_Rear", -1.75, -1.05)):
    bm = bmesh.new()
    for sx in (-1, 1):
        sweep(bm, frames_along([Vector((sx * 0.30, y0, 0.30)),                # noqa: F821
                                Vector((sx * 0.56, (y0 + y1) / 2, 0.32)),
                                Vector((sx * 0.30, y1, 0.30))]),
              rect_section(0.035, 0.030, 0.012, 3))                           # noqa: F821
    put(nm, bm, M["mech"], C["STRUCTURE"], (0, (y0 + y1) / 2, 0.31),
        (0, 1 if y0 > 0 else -1, 0), "chassis", 1)

# --------------------------------------------------------------------------- #
# wheels + suspension
# --------------------------------------------------------------------------- #

for key, (sx, sy) in CORNERS.items():
    cx, cy, cz = sx * TRACK, sy * AXLE_Y, WHEEL_R
    hub = pivot(f"CAR_Wheel_{key}", (cx, cy, cz), C["RIG"])                   # noqa: F821
    ROT = Matrix.Rotation(radians(90), 4, 'Y')

    bm = bmesh.new()
    lathe(bm, [(0.245, -WHEEL_W), (WHEEL_R, -WHEEL_W + 0.04),                 # noqa: F821
               (WHEEL_R, WHEEL_W - 0.04), (0.245, WHEEL_W)], seg=36,
          M=Matrix.Translation((cx, cy, cz)) @ ROT)
    # After Rotation(a, X) the local axes already read as
    # X = wheel width, Y = radial, Z = tangential. Applying ROT on top of that
    # re-rotated the blocks so they splayed out like cog teeth.
    for j, a, _ in radial(28, 0.0, 0.0):                                      # noqa: F821
        add_box(bm, Matrix.Translation((cx, cy + 0.350 * cos(a), cz + 0.350 * sin(a)))  # noqa: F821
                @ Matrix.Rotation(a, 4, 'X'), WHEEL_W * 0.86, 0.014, 0.022)
    ob = to_object(f"CAR_Tire_{key}", bm, M["rubber"], C["MECHANICAL"])       # noqa: F821
    set_origin(ob, (cx, cy, cz)); attach(ob, hub)                             # noqa: F821
    tag(ob, (sx, 0, 0), "wheel", 0); parts.append(ob)                         # noqa: F821

    bm = bmesh.new()
    lathe(bm, [(0.0, -WHEEL_W + 0.03), (0.245, -WHEEL_W + 0.02),              # noqa: F821
               (0.245, WHEEL_W - 0.02), (0.10, WHEEL_W - 0.03), (0.0, WHEEL_W - 0.05)],
          seg=32, M=Matrix.Translation((cx, cy, cz)) @ ROT)
    for j, a, _ in radial(10, 0.0, 0.0):                                      # noqa: F821
        add_box(bm, Matrix.Translation((cx + sx * 0.02, cy + 0.16 * cos(a), cz + 0.16 * sin(a)))  # noqa: F821
                @ Matrix.Rotation(a, 4, 'X'), 0.028, 0.105, 0.026)
    ob = to_object(f"CAR_Rim_{key}", bm, M["shell2"], C["MECHANICAL"])        # noqa: F821
    set_origin(ob, (cx, cy, cz)); attach(ob, hub)                             # noqa: F821
    tag(ob, (sx, 0, 0), "wheel", 1); parts.append(ob)                         # noqa: F821

    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((cx - sx * 0.035, cy, cz)) @ ROT,     # noqa: F821
                 0.16, 0.012, seg=28)
    put(f"CAR_BrakeDisc_{key}", bm, M["mech"], C["MECHANICAL"],
        (cx, cy, cz), (sx, 0, 0), "brake", 0)

    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation((cx - sx * 0.055, cy - 0.15, cz + 0.06)),  # noqa: F821
                    0.035, 0.045, 0.055, r=0.012, corner_seg=3, end_seg=2)
    put(f"CAR_Caliper_{key}", bm, M["accent1"], C["MECHANICAL"],
        (cx, cy, cz), (sx, 0, 0), "brake", 1)

    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((cx - sx * 0.06, cy, cz)) @ ROT,      # noqa: F821
                 0.055, 0.05, seg=20)
    put(f"CAR_Hub_{key}", bm, M["mech"], C["MECHANICAL"],
        (cx, cy, cz), (sx, 0, 0), "brake", 2)

    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation((cx - sx * 0.10, cy, cz + 0.02)),  # noqa: F821
                    0.045, 0.055, 0.11, r=0.02, corner_seg=3, end_seg=2)
    put(f"CAR_SteeringKnuckle_{key}", bm, M["mech"], C["MECHANICAL"],
        (cx, cy, cz), (sx, 0, 0), "susp", 0)

    for tag_nm, z, ln in (("UpperArm", 0.50, 0.34), ("LowerArm", 0.26, 0.40)):
        bm = bmesh.new()
        sweep(bm, frames_along([Vector((cx - sx * 0.12, cy, z)),              # noqa: F821
                                Vector((cx - sx * ln, cy + sy * 0.06, z - 0.01))]),
              rect_section(0.030, 0.022, 0.010, 3))                           # noqa: F821
        put(f"CAR_{tag_nm}_{key}", bm, M["mech"], C["MECHANICAL"],
            (cx, cy, z), (sx, 0, 0), "susp", 1)

    bm = bmesh.new()
    add_cylinder(bm, Matrix.Translation((cx - sx * 0.14, cy, 0.56)), 0.030, 0.16, seg=16)  # noqa: F821
    put(f"CAR_Damper_{key}", bm, M["mech"], C["MECHANICAL"],
        (cx, cy, 0.56), (sx, 0, 0.4), "susp", 2)

    bm = bmesh.new()
    turns = 7
    pts = [Vector((cx - sx * 0.14 + 0.055 * cos(2 * pi * turns * t / 24),
                   cy + 0.055 * sin(2 * pi * turns * t / 24),
                   0.42 + 0.26 * (t / 24))) for t in range(25)]
    sweep(bm, frames_along(pts), rect_section(0.011, 0.011, 0.005, 3))        # noqa: F821
    put(f"CAR_Spring_{key}", bm, M["shell2"], C["MECHANICAL"],
        (cx, cy, 0.55), (sx, 0, 0.4), "susp", 3)

# --------------------------------------------------------------------------- #
# sensors
# --------------------------------------------------------------------------- #

lidar_spin = pivot("CAR_Lidar_Spin", (0, 0.10, 1.60), C["RIG"])               # noqa: F821
bm = bmesh.new()
lathe(bm, [(0.0, 1.555), (0.13, 1.560), (0.13, 1.600), (0.11, 1.625),         # noqa: F821
           (0.0, 1.630)], seg=28, M=Matrix.Translation((0, 0.10, 0)))
ob = to_object("CAR_Lidar_Roof", bm, M["shell2"], C["SENSORS"])               # noqa: F821
set_origin(ob, (0, 0.10, 1.60)); attach(ob, lidar_spin)                       # noqa: F821
tag(ob, (0, 0, 1), "sensor", 0); parts.append(ob)                             # noqa: F821

CAMS = [("FrontWide", (0, 1.05, 1.44)), ("FrontNarrow", (0.10, 1.05, 1.44)),
        ("Left", (-0.86, 0.55, 1.06)), ("Right", (0.86, 0.55, 1.06)),
        ("Rear", (0, -2.16, 1.02))]
for nm, loc in CAMS:
    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation(loc), 0.030, 0.030, 0.022,         # noqa: F821
                    r=0.008, corner_seg=3, end_seg=2)
    put(f"CAR_Camera_{nm}", bm, M["mech"], C["SENSORS"], loc,
        (0, 1 if loc[1] > 0 else -1, 0.3), "sensor", 1)

RADARS = [("Front", (0, 2.26, 0.55)), ("Rear", (0, -2.26, 0.62)),
          ("Left", (-0.88, 1.10, 0.55)), ("Right", (0.88, 1.10, 0.55))]
for nm, loc in RADARS:
    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation(loc), 0.055, 0.020, 0.045,         # noqa: F821
                    r=0.010, corner_seg=3, end_seg=2)
    put(f"CAR_Radar_{nm}", bm, M["mech"], C["SENSORS"], loc,
        (loc[0], loc[1], 0), "sensor", 2)

bm = bmesh.new()
for i in range(12):
    sx = -1 if i % 2 else 1
    y = 2.24 if i < 6 else -2.24
    add_cylinder(bm, Matrix.Translation((sx * (0.10 + (i % 6) * 0.16), y, 0.46))  # noqa: F821
                 @ Matrix.Rotation(radians(90), 4, 'X'), 0.014, 0.010, seg=12)
put("CAR_Ultrasonics", bm, M["mech"], C["SENSORS"], (0, 0, 0.46), (0, 0, -1), "sensor", 3)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, -0.60, 1.556)), 0.06, 0.05, 0.012,  # noqa: F821
                r=0.006, corner_seg=3, end_seg=2)
put("CAR_GNSS_Antenna", bm, M["shell2"], C["SENSORS"], (0, -0.60, 1.556),
    (0, 0, 1), "sensor", 4)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.0, 0.36)), 0.040, 0.040, 0.018,   # noqa: F821
                r=0.006, corner_seg=3, end_seg=2)
put("CAR_IMU", bm, M["mech"], C["SENSORS"], (0, 0, 0.36), (0, 0, -1), "sensor", 5)

# --------------------------------------------------------------------------- #
# simplified interior
# --------------------------------------------------------------------------- #

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.86, 1.06)), 0.80, 0.16, 0.09,     # noqa: F821
                r=0.03, corner_seg=3, end_seg=2)
add_rounded_box(bm, Matrix.Translation((0, 0.74, 1.20)), 0.28, 0.02, 0.11,     # noqa: F821
                r=0.012, corner_seg=3, end_seg=2)
put("CAR_Dashboard", bm, M["mech"], C["STRUCTURE"], (0, 0.86, 1.06),
    (0, 0, 1), "interior", 0)

bm = bmesh.new()
add_tube(bm, Matrix.Translation((-0.34, 0.66, 1.14))                          # noqa: F821
         @ Matrix.Rotation(radians(72), 4, 'X'), 0.075, 0.115, 0.014, seg=24)
put("CAR_SteeringWheel", bm, M["mech"], C["STRUCTURE"], (-0.34, 0.66, 1.14),
    (0, 0, 1), "interior", 1)

for i, (nm, x, y) in enumerate([("FL", -0.36, 0.28), ("FR", 0.36, 0.28),
                                ("RL", -0.36, -0.52), ("RR", 0.36, -0.52)]):
    bm = bmesh.new()
    add_rounded_box(bm, Matrix.Translation((x, y, 0.72)), 0.24, 0.22, 0.07,    # noqa: F821
                    r=0.05, corner_seg=3, end_seg=2)
    add_rounded_box(bm, Matrix.Translation((x, y - 0.20, 1.02))               # noqa: F821
                    @ Matrix.Rotation(radians(-9), 4, 'X'),
                    0.23, 0.06, 0.25, r=0.05, corner_seg=3, end_seg=2)
    put(f"CAR_Seat_{nm}", bm, M["mech"], C["STRUCTURE"], (x, y, 0.85),
        (0, 0, 1), "interior", 2 + i)

bm = bmesh.new()
add_rounded_box(bm, Matrix.Translation((0, 0.30, 0.80)), 0.14, 0.42, 0.06,     # noqa: F821
                r=0.02, corner_seg=3, end_seg=2)
put("CAR_CentreConsole", bm, M["mech"], C["STRUCTURE"], (0, 0.30, 0.80),
    (0, 0, 1), "interior", 6)

# --------------------------------------------------------------------------- #
# root, anchors, actions
# --------------------------------------------------------------------------- #

root = bpy.data.objects.new("CAR_Root", None)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 1.2
C["ROOT"].objects.link(root)

for nm, loc in [
    ("lidar", (0, 0.10, 1.66)),
    ("camera", (0.10, 1.10, 1.48)),
    ("radar", (0, 2.30, 0.55)),
    ("battery pack", (0, -0.30, 0.10)),
    ("front drive unit", (0, 1.40, 0.40)),
    ("rear drive unit", (0, -1.40, 0.40)),
    ("inverter", (0, 1.66, 0.60)),
    ("suspension", (-0.95, 1.40, 0.52)),
    ("brake", (0.90, -1.40, 0.36)),
    ("steering", (0, 1.34, 0.60)),
    ("chassis", (0, 0, 0.26)),
    ("thermal loop", (0, 1.84, 0.62)),
]:
    anchors.append(anchor(nm, loc, C["ANCHORS"], parent=root))                 # noqa: F821

finish(parts, root,                                                            # noqa: F821
       no_bevel={o.name for o in parts if "Spring" in o.name
                 or "Glass" in o.name or "LightBar" in o.name
                 or "Ultrasonics" in o.name},
       bevel_width=0.006)
for e in [o for o in bpy.data.objects
          if o.type == 'EMPTY' and o.parent is None and o is not root]:
    e.parent = root

# ---- baked clips ----------------------------------------------------------
for key in CORNERS:
    hub = bpy.data.objects[f"CAR_Wheel_{key}"]
    hub.rotation_mode = 'XYZ'
    hub.animation_data_create()
    act = bpy.data.actions.new(f"CAR_WheelSpin_{key}")
    hub.animation_data.action = act
    for f, turns in ((1, 0.0), (60, 1.0)):
        hub.rotation_euler = (turns * 2 * pi, 0, 0)
        hub.keyframe_insert("rotation_euler", frame=f)
    set_linear(act)                                                            # noqa: F821

lidar_spin.rotation_mode = 'XYZ'
lidar_spin.animation_data_create()
act = bpy.data.actions.new("CAR_LidarSpin")
lidar_spin.animation_data.action = act
for f, turns in ((1, 0.0), (60, 1.0)):
    lidar_spin.rotation_euler = (0, 0, turns * 2 * pi)
    lidar_spin.keyframe_insert("rotation_euler", frame=f)
set_linear(act)                                                                # noqa: F821

scn.frame_start, scn.frame_end = 1, 60

RESULT = {"objects": len(parts), "anchors": len(anchors),
          "tris": tri_count(parts)}                                            # noqa: F821
print("build_vehicle.py ->", RESULT)
