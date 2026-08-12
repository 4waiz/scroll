"""
build_model.py - procedural construction of the "anime engine" hard-surface model.

Run inside Blender (via Blender MCP):

    exec(open(r"<repo>/blender/build_model.py").read())

Design constraints (see REFERENCE_NOTES.md sections 6 and 10):

  * long axis = local +Z, face (lens) at +Z
  * main radius 2.2 BU
  * total length ~11 BU

    NOTE / documented deviation: the brief suggested a 5.5-6 BU total length,
    but the supplied screenshots - which the brief itself ranks as the primary
    source of truth - unambiguously show a barrel whose length is ~2.5x its
    diameter. A 5.5 BU length at r=2.2 gives 1.3:1, which does not read as the
    reference object at all. Radius is kept at the specified 2.2 and the length
    extended to ~11 BU so the silhouette matches the screenshots.

  * 13 major cylindrical sections
  * 180 radial tick elements on the face
  * 8 repeating rear pods
  * 4 detachable curved shell panels
  * every animatable component is its own named object with a useful origin
  * each object carries "explode" (unit direction), "grp" and "order" props

Everything is built with bmesh from analytic profiles - no sculpting, no textures.
"""

import bpy
import bmesh
import math
from math import cos, sin, pi, radians
from mathutils import Vector, Matrix

TAU = 2.0 * pi

# --------------------------------------------------------------------------- #
# scene reset
# --------------------------------------------------------------------------- #


def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.collections,
                bpy.data.lights, bpy.data.cameras):
        for item in list(blk):
            if item.users == 0:
                blk.remove(item)
    scn = bpy.context.scene
    scn.unit_settings.system = 'NONE'
    return scn


# --------------------------------------------------------------------------- #
# bmesh helpers
# --------------------------------------------------------------------------- #


def finalize(bm, merge=2e-5):
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=merge)
    bmesh.ops.dissolve_degenerate(bm, dist=merge, edges=bm.edges[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def to_object(name, bm, mat, coll, finalize_mesh=True):
    if finalize_mesh:
        finalize(bm)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.validate(verbose=False)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if mat is not None:
        ob.data.materials.append(mat)
    return ob


def add_box(bm, M, sx, sy, sz):
    p = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
         (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    v = [bm.verts.new(M @ Vector(q)) for q in p]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
              (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])


def add_prism(bm, M, radius, sides, half_len):
    """Regular prism whose axis is the local +X of matrix M (radial outward)."""
    rings = []
    for sx in (-half_len, half_len):
        rings.append([bm.verts.new(M @ Vector(
            (sx, radius * cos(TAU * k / sides), radius * sin(TAU * k / sides))))
            for k in range(sides)])
    for k in range(sides):
        k2 = (k + 1) % sides
        bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))
    try:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[1])
    except ValueError:
        pass


def lathe(bm, profile, seg=64, a0=0.0, a1=TAU, close_ends=False):
    """Revolve a closed (r, z) profile around Z. Partial sweeps make arcs."""
    n = len(profile)
    full = abs((a1 - a0) - TAU) < 1e-6
    steps = seg
    rings = []
    for i in range(steps if full else steps + 1):
        a = a0 + (a1 - a0) * (i / steps)
        ca, sa = cos(a), sin(a)
        rings.append([bm.verts.new((r * ca, r * sa, z)) for (r, z) in profile])
    for i in range(steps):
        j = (i + 1) % len(rings) if full else i + 1
        for k in range(n):
            k2 = (k + 1) % n
            try:
                bm.faces.new((rings[i][k], rings[i][k2],
                              rings[j][k2], rings[j][k]))
            except ValueError:
                pass
    if close_ends and not full:
        for ring, flip in ((rings[0], False), (rings[-1], True)):
            try:
                bm.faces.new(list(reversed(ring)) if flip else ring)
            except ValueError:
                pass
    return rings


def lathe_object(name, profile, mat, coll, seg=64):
    bm = bmesh.new()
    lathe(bm, profile, seg=seg)
    return to_object(name, bm, mat, coll)


def arc_shell(name, r_in, r_out, z0, z1, a0, a1, mat, coll, seg=26):
    bm = bmesh.new()
    lathe(bm, [(r_in, z0), (r_out, z0), (r_out, z1), (r_in, z1)],
          seg=seg, a0=a0, a1=a1, close_ends=True)
    return to_object(name, bm, mat, coll)


def radial(count, radius, z, phase=0.0):
    for i in range(count):
        a = phase + TAU * i / count
        yield i, a, (Matrix.Translation((radius * cos(a), radius * sin(a), z))
                     @ Matrix.Rotation(a, 4, 'Z'))


def set_origin(ob, p):
    p = Vector(p)
    for v in ob.data.vertices:
        v.co -= p
    ob.location = p


def tag(ob, explode, grp, order=0):
    d = Vector(explode)
    if d.length > 1e-9:
        d.normalize()
    ob["explode"] = [round(d.x, 5), round(d.y, 5), round(d.z, 5)]
    ob["grp"] = grp
    ob["order"] = order
    return ob


def bevel(ob, width=0.010, segments=2, angle=46.0):
    m = ob.modifiers.new("Bevel", 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = radians(angle)
    m.miter_outer = 'MITER_ARC'
    w = ob.modifiers.new("WeightedNormal", 'WEIGHTED_NORMAL')
    w.keep_sharp = True
    return ob


def shade(ob, angle=30.0):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        prev = bpy.context.view_layer.objects.active
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.shade_auto_smooth(angle=radians(angle))
        ob.select_set(False)
        bpy.context.view_layer.objects.active = prev
    except Exception:
        pass
    return ob


# --------------------------------------------------------------------------- #
# materials
# --------------------------------------------------------------------------- #


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h, linear=True):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    if linear:
        r, g, b = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    return (r, g, b, 1.0)


def make_mat(name, base, rough=0.6, metal=0.0, emit=None, emit_str=0.0,
             transmission=0.0, ior=1.45, alpha=1.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')

    def put(k, v):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v

    put("Base Color", hex_rgb(base))
    put("Roughness", rough)
    put("Metallic", metal)
    put("IOR", ior)
    put("Alpha", alpha)
    put("Transmission Weight", transmission)
    put("Coat Weight", coat)
    if emit is not None:
        put("Emission Color", hex_rgb(emit))
        put("Emission Strength", emit_str)
    return mat


LED_HUES = [
    ("Red", "#ff4b4b"), ("Corail", "#ff7d36"), ("Orange", "#ffa828"),
    ("Yellow", "#ffcc2a"), ("Citrus", "#f9f640"), ("Lime", "#b7ff54"),
    ("Green", "#8dff55"), ("Turquoise", "#00ffaa"), ("Cyan", "#26f2d5"),
    ("Sky", "#05dbe9"), ("Sega", "#33b3f1"), ("King", "#4d9cff"),
]


def build_materials():
    """
    Neutral matte graphite.

    Everything here is metallic 0 / roughness ~0.9 with near-equal RGB, so the
    GLB carries a sane non-bronze fallback. The browser then overrides the
    housing groups with matcaps (src/scene/matcap.ts); these values are what you
    see in Blender and in any viewer that ignores our runtime override.

    The previous palette combined metalness 0.18-0.7 with warm-tinted lights and
    ACES tone mapping, which is what produced the polished-bronze look.
    """
    M = {}
    # outer shell panels - the brightest, cleanest graphite surfaces
    M["shell"] = make_mat("MAT_Shell_Plate", "#413D3D", 0.90, 0.0)
    # main cylindrical housings
    M["housing"] = make_mat("MAT_Housing_Dark", "#3B3838", 0.90, 0.0)
    M["housing2"] = make_mat("MAT_Housing_Mid", "#363333", 0.90, 0.0)
    M["housing3"] = make_mat("MAT_Housing_Light", "#302D2D", 0.90, 0.0)
    # ribbed grip sections read darker so the ribs do not turn into noise
    M["ribbed"] = make_mat("MAT_Ribbed_Grip", "#292828", 0.94, 0.0)
    M["gear"] = make_mat("MAT_Gear_Ring", "#2B2929", 0.92, 0.0)
    M["detail"] = make_mat("MAT_Detail_Ring", "#302D2D", 0.90, 0.0)
    M["dark"] = make_mat("MAT_Recess_Black", "#181818", 0.96, 0.0)
    M["bezel"] = make_mat("MAT_Bezel", "#242323", 0.90, 0.0)
    M["module"] = make_mat("MAT_Internal_Module", "#252424", 0.92, 0.0)
    M["fastener"] = make_mat("MAT_Fastener", "#1D1D1D", 0.90, 0.0)

    # Glass stays a separate, mostly non-reflective dark element.
    M["glass"] = make_mat("MAT_Front_Glass", "#0a0a0a", 0.18, 0.0,
                          transmission=0.35, ior=1.45, alpha=0.5)
    M["display"] = make_mat("MAT_Front_Display", "#141312", 0.60, 0.0,
                            emit="#221e1c", emit_str=0.2)

    # Emissive elements are deliberately untouched by the graphite correction.
    M["tick"] = make_mat("MAT_Tick_Accent", "#3a1f1c", 0.5, 0.0,
                         emit="#ff4b4b", emit_str=2.2)
    for nm, hx in LED_HUES:
        # 1.35 keeps every hue inside the display range - at 5.0 the red/orange/
        # yellow band and the lime/green band each clip to the same colour and
        # the 12 segments collapse into 3 visible arcs.
        M["led_" + nm.lower()] = make_mat("MAT_LED_" + nm, hx, 0.25, 0.0,
                                          emit=hx, emit_str=1.35)
    return M


# --------------------------------------------------------------------------- #
# Z layout - 13 major cylindrical sections, front (+Z) to rear (-Z)
# --------------------------------------------------------------------------- #

Z_FACE = 5.50      # front-most point
Z_TAIL = -5.50     # rear-most point


def build_front(coll, M, parts):
    """
    Face stack, deepest first. Radii/heights are chosen so that nothing
    occludes anything else when viewed dead-on:

        display  r 0.00-1.560   z 5.130-5.160   (deepest, the demo surface)
        glass    r 0.00-1.598   z 5.190-5.252   (domed)
        bezel    r 1.600-2.000  shelf floor at z 5.300, rims to 5.500
        ticks    r 1.700-1.905  z 5.300-5.324   (sitting on the bezel shelf)
        LEDs     r 2.020-2.160  z 5.350-5.425   (in the housing channel)
        housing  r 2.010-2.290  channel floor at z 5.340
    """
    disp = lathe_object("Front_Display",
                        [(0.0, 5.130), (1.560, 5.130), (1.560, 5.160), (0.0, 5.160)],
                        M["display"], coll, seg=96)
    set_origin(disp, (0, 0, 5.145))
    parts.append(tag(disp, (0, 0, 1), "front", 0))

    gp, steps = [], 16
    for i in range(steps + 1):
        t = i / steps
        gp.append((1.598 * t, 5.252 - 0.062 * (t * t)))
    for i in range(steps, -1, -1):
        gp.append((1.598 * (i / steps), 5.190))
    glass = lathe_object("Front_Glass", gp, M["glass"], coll, seg=96)
    set_origin(glass, (0, 0, 5.22))
    parts.append(tag(glass, (0, 0, 1), "front", 1))

    bez = lathe_object("Front_Bezel", [
        (1.600, 5.020), (2.000, 5.020), (2.000, 5.500), (1.940, 5.500),
        (1.940, 5.300), (1.660, 5.300), (1.660, 5.420), (1.600, 5.420),
    ], M["bezel"], coll, seg=96)
    set_origin(bez, (0, 0, 5.26))
    parts.append(tag(bez, (0, 0, 1), "front", 2))

    bm = bmesh.new()
    for i, a, _ in radial(180, 0.0, 0.0):
        major = (i % 15 == 0)
        r0, r1 = (1.700, 1.905) if major else (1.742, 1.898)
        w = 0.020 if major else 0.0090
        rm = 0.5 * (r0 + r1)
        Mx = (Matrix.Translation((rm * cos(a), rm * sin(a), 5.312))
              @ Matrix.Rotation(a, 4, 'Z'))
        add_box(bm, Mx, 0.5 * (r1 - r0), w, 0.012)
    ticks = to_object("Front_Tick_Ring", bm, M["tick"], coll)
    set_origin(ticks, (0, 0, 5.312))
    parts.append(tag(ticks, (0, 0, 1), "front", 3))

    gap, span = radians(2.6), TAU / len(LED_HUES)
    for i, (nm, _) in enumerate(LED_HUES):
        a0 = pi / 2 - i * span + gap * 0.5
        a1 = pi / 2 - (i + 1) * span - gap * 0.5
        ob = arc_shell("LED_Ring_" + nm, 2.020, 2.160, 5.350, 5.425,
                       a1, a0, M["led_" + nm.lower()], coll, seg=14)
        set_origin(ob, (0, 0, 5.388))
        parts.append(tag(ob, (0, 0, 1), "led", i))


def ribbed_profile(r_lo, r_hi, z0, z1, ribs):
    prof = [(r_lo, z0), (r_lo + 0.06, z0)]
    for i in range(ribs):
        za = z0 + (z1 - z0) * (i + 0.28) / ribs
        zb = z0 + (z1 - z0) * (i + 0.78) / ribs
        prof += [(r_hi, za), (r_lo + 0.06, zb)]
    prof += [(r_lo + 0.06, z1), (r_lo, z1)]
    return prof


def build_housing(coll, M, parts):
    # Front housing carries an open annular channel (r 2.010-2.175, floor
    # z 5.340) that the emissive LED arcs sit inside, so they read from the
    # front instead of being buried under a solid lip.
    hf = lathe_object("Housing_Front", [
        (2.010, 4.300), (2.290, 4.300), (2.290, 5.180), (2.255, 5.250),
        (2.255, 5.500), (2.175, 5.500), (2.175, 5.340), (2.010, 5.340),
    ], M["housing"], coll, seg=96)
    set_origin(hf, (0, 0, 4.9))
    parts.append(tag(hf, (0, 0, 1), "housing", 0))

    rb = lathe_object("Ribbed_Barrel",
                      ribbed_profile(2.060, 2.262, 3.100, 4.240, 36),
                      M["ribbed"], coll, seg=96)
    set_origin(rb, (0, 0, 3.67))
    parts.append(tag(rb, (0, 0, 1), "housing", 1))

    hma = lathe_object("Housing_Middle", [
        (1.94, 1.200), (2.195, 1.200), (2.195, 2.100), (2.140, 2.180),
        (2.140, 2.560), (2.205, 2.640), (2.205, 2.800), (1.94, 2.800),
    ], M["housing"], coll, seg=96)
    set_origin(hma, (0, 0, 2.0))
    parts.append(tag(hma, (0, 0, -1), "housing", 2))

    hmb = lathe_object("Housing_Core", [
        (1.86, -0.600), (2.150, -0.600), (2.150, 0.280), (2.095, 0.360),
        (2.095, 0.760), (2.160, 0.840), (2.160, 0.850), (1.86, 0.850),
    ], M["housing2"], coll, seg=96)
    set_origin(hmb, (0, 0, 0.12))
    parts.append(tag(hmb, (0, 0, -1), "housing", 3))

    rb2 = lathe_object("Ribbed_Barrel_Rear",
                       ribbed_profile(1.940, 2.120, -1.900, -0.620, 28),
                       M["ribbed"], coll, seg=96)
    set_origin(rb2, (0, 0, -1.26))
    parts.append(tag(rb2, (0, 0, -1), "housing", 4))

    hr = lathe_object("Housing_Rear", [
        (1.42, -4.300), (1.925, -4.300), (1.925, -3.400), (1.845, -3.310),
        (1.845, -2.760), (1.760, -2.680), (1.760, -2.250), (1.42, -2.250),
    ], M["housing"], coll, seg=96)
    set_origin(hr, (0, 0, -3.27))
    parts.append(tag(hr, (0, 0, -1), "housing", 5))

    cap = lathe_object("Rear_Cap", [
        (0.0, -5.500), (1.620, -5.500), (1.620, -5.290), (1.470, -5.120),
        (1.470, -4.980), (1.560, -4.900), (1.560, -4.280), (0.0, -4.280),
    ], M["housing3"], coll, seg=96)
    set_origin(cap, (0, 0, -4.9))
    parts.append(tag(cap, (0, 0, -1), "rear", 0))


def build_gears(coll, M, parts):
    specs = [
        ("Gear_Ring_01", 1.95, 2.250, 2.810, 3.090, 56, 0.080),
        ("Gear_Ring_02", 1.88, 2.210, 0.860, 1.190, 46, 0.090),
        ("Gear_Ring_03", 1.72, 2.055, -2.230, -1.910, 34, 0.100),
    ]
    for idx, (nm, r_in, r_tip, z0, z1, teeth, depth) in enumerate(specs):
        bm = bmesh.new()
        root = r_tip - depth
        lathe(bm, [(r_in, z0), (root, z0), (root, z1), (r_in, z1)], seg=96)
        tw = (TAU * root / teeth) * 0.34
        for i, a, _ in radial(teeth, 0.0, 0.0):
            rm = 0.5 * (root + r_tip)
            Mx = (Matrix.Translation((rm * cos(a), rm * sin(a), 0.5 * (z0 + z1)))
                  @ Matrix.Rotation(a, 4, 'Z'))
            add_box(bm, Mx, 0.5 * (r_tip - root), tw, 0.5 * (z1 - z0) * 0.84)
        ob = to_object(nm, bm, M["gear"], coll)
        set_origin(ob, (0, 0, 0.5 * (z0 + z1)))
        parts.append(tag(ob, (0, 0, 1 if z0 > 0 else -1), "gear", idx))

    rings = [
        ("Detail_Ring_01", 2.150, 2.225, 2.740, 2.812),
        ("Detail_Ring_02", 2.150, 2.215, 3.090, 3.150),
        ("Detail_Ring_03", 2.100, 2.180, 0.790, 0.862),
        ("Detail_Ring_04", 1.960, 2.060, -2.300, -2.230),
        ("Detail_Ring_05", 2.200, 2.270, 4.240, 4.302),
        ("Detail_Ring_06", 1.840, 1.940, -3.380, -3.310),
        ("Detail_Ring_07", 2.080, 2.150, -0.620, -0.550),
    ]
    for idx, (nm, ri, ro, z0, z1) in enumerate(rings):
        ob = lathe_object(nm, [(ri, z0), (ro, z0), (ro, z1), (ri, z1)],
                          M["detail"], coll, seg=80)
        set_origin(ob, (0, 0, 0.5 * (z0 + z1)))
        parts.append(tag(ob, (0, 0, 1 if z0 > 0 else -1), "detail", idx))


def build_pods(coll, M, parts):
    R = 1.18
    for i, a, _ in radial(8, 0.0, 0.0, phase=radians(22.5)):
        bm = bmesh.new()
        lathe(bm, [(0.0, -4.150), (0.330, -4.150), (0.330, -3.050),
                   (0.375, -3.010), (0.375, -2.840), (0.255, -2.790),
                   (0.255, -2.600), (0.0, -2.600)], seg=24)
        for j, b, _ in radial(10, 0.0, 0.0):
            Mx = (Matrix.Translation((0.305 * cos(b), 0.305 * sin(b), -2.700))
                  @ Matrix.Rotation(b, 4, 'Z'))
            add_box(bm, Mx, 0.055, 0.022, 0.085)
        ob = to_object("Rear_Pod_%02d" % (i + 1), bm, M["module"], coll)
        set_origin(ob, (0, 0, -3.40))
        ob.location = (R * cos(a), R * sin(a), -3.40)
        parts.append(tag(ob, (cos(a), sin(a), -0.35), "pod", i))


def build_shells(coll, M, parts):
    span = radians(64.0)
    for i in range(4):
        c = radians(45.0) + i * TAU / 4.0
        ob = arc_shell("Shell_Panel_%02d" % (i + 1),
                       2.250, 2.372, -0.480, 4.180,
                       c - span / 2, c + span / 2, M["shell"], coll, seg=22)
        set_origin(ob, (0, 0, 1.85))
        parts.append(tag(ob, (cos(c), sin(c), 0.0), "shell", i))


def build_internals(coll, M, parts):
    specs = [
        ("Internal_Module_01", 'cyl', dict(r=0.95, z0=2.90, z1=4.20), (0, 0, 1)),
        ("Internal_Module_02", 'cyl', dict(r=0.72, z0=1.30, z1=2.70), (0, 0, 1)),
        ("Internal_Module_03", 'box', dict(sx=0.32, sy=0.74, sz=0.62,
                                           loc=(1.15, 0.0, 0.20)), (1, 0, 0.15)),
        ("Internal_Module_04", 'box', dict(sx=0.32, sy=0.74, sz=0.62,
                                           loc=(-1.15, 0.0, 0.20)), (-1, 0, 0.15)),
        ("Internal_Module_05", 'box', dict(sx=0.74, sy=0.32, sz=0.52,
                                           loc=(0.0, 1.12, -1.20)), (0, 1, -0.15)),
        ("Internal_Module_06", 'box', dict(sx=0.74, sy=0.32, sz=0.52,
                                           loc=(0.0, -1.12, -1.20)), (0, -1, -0.15)),
        ("Internal_Module_07", 'cyl', dict(r=1.20, z0=-2.60, z1=-2.30), (0, 0, -1)),
        ("Internal_Module_08", 'cyl', dict(r=0.86, z0=-4.90, z1=-4.30), (0, 0, -1)),
    ]
    for idx, (nm, kind, kw, ex) in enumerate(specs):
        bm = bmesh.new()
        if kind == 'cyl':
            lathe(bm, [(0.0, kw["z0"]), (kw["r"], kw["z0"]),
                       (kw["r"], kw["z1"]), (0.0, kw["z1"])], seg=48)
            centre = (0, 0, 0.5 * (kw["z0"] + kw["z1"]))
        else:
            add_box(bm, Matrix.Translation(kw["loc"]),
                    kw["sx"], kw["sy"], kw["sz"])
            centre = kw["loc"]
        ob = to_object(nm, bm, M["module"], coll)
        set_origin(ob, centre)
        parts.append(tag(ob, ex, "internal", idx))


def build_greebles(coll, M, parts):
    bm = bmesh.new()
    for band_z, rr, count, ln in ((3.680, 2.300, 44, 0.90),
                                  (2.000, 2.230, 38, 0.72),
                                  (0.120, 2.185, 34, 0.60),
                                  (-3.300, 1.880, 30, 0.52)):
        for i, a, _ in radial(count, 0.0, 0.0):
            if i % 4 in (2, 3):
                continue
            Mx = (Matrix.Translation((rr * cos(a), rr * sin(a), band_z))
                  @ Matrix.Rotation(a, 4, 'Z'))
            add_box(bm, Mx, 0.012, 0.032, ln * 0.5)
    vents = to_object("Vents", bm, M["dark"], coll)
    set_origin(vents, (0, 0, 1.0))
    parts.append(tag(vents, (0, 0, 1), "detail", 9))

    bm = bmesh.new()
    for band_z, rr, count in ((5.020, 2.300, 12), (2.900, 2.220, 10),
                              (0.960, 2.190, 10), (-2.480, 1.880, 8),
                              (-4.700, 1.700, 8)):
        for i, a, Mx in radial(count, rr, band_z):
            add_prism(bm, Mx, radius=0.058, sides=6, half_len=0.032)
    fast = to_object("Fasteners", bm, M["fastener"], coll)
    set_origin(fast, (0, 0, 0.5))
    parts.append(tag(fast, (0, 0, 1), "detail", 10))


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #


def main():
    scn = reset_scene()
    coll = bpy.data.collections.new("AnimeEngine")
    scn.collection.children.link(coll)

    M = build_materials()
    parts = []
    build_front(coll, M, parts)
    build_housing(coll, M, parts)
    build_gears(coll, M, parts)
    build_pods(coll, M, parts)
    build_shells(coll, M, parts)
    build_internals(coll, M, parts)
    build_greebles(coll, M, parts)

    root = bpy.data.objects.new("Engine_Root", None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 2.0
    coll.objects.link(root)

    no_bevel = {"Front_Tick_Ring", "Fasteners", "Vents", "Front_Glass"}
    for ob in parts:
        ob.parent = root
        ob.matrix_parent_inverse = Matrix.Identity(4)
        if ob.name not in no_bevel:
            bevel(ob)
        shade(ob)

    scn.render.engine = 'BLENDER_EEVEE'
    if scn.world is None:
        scn.world = bpy.data.worlds.new("World")
    scn.world.use_nodes = True
    bg = scn.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = hex_rgb("#3a3634")
        bg.inputs[1].default_value = 1.0

    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts)
    return {"objects": len(parts), "base_tris": tris,
            "names": sorted(o.name for o in parts)}


RESULT = main()
print("build_model.py ->", RESULT["objects"], "objects,", RESULT["base_tris"], "base tris")
