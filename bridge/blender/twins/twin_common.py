"""
twin_common.py - shared Blender library for the BRIDGE digital-twin asset family.

Every twin (drone, vehicle, quadruped, humanoid) is built from these helpers so
the whole family reads as one industrial design team's work: same graphite
material set, same bevel/shading standards, same naming, same anchor and
explode metadata contract.

Conventions
-----------
  * metres, Z-up, +Y forward, +X right
  * transforms applied, origins placed deliberately
  * anything that animates is its own object
  * each part carries: explode (unit vector), grp (group), order (index)
  * label anchors are Empties named ANCHOR_* exported as glTF nodes

Usage (from the MCP driver)::

    ns = {}
    exec(open(".../twins/twin_common.py").read(), ns)
    exec(open(".../twins/drone/build_drone.py").read(), ns)
"""

import bpy
import bmesh
import math
from math import cos, sin, pi, radians
from mathutils import Vector, Matrix

TAU = 2.0 * pi

# --------------------------------------------------------------------------- #
# palette - shared across the whole asset family
# --------------------------------------------------------------------------- #

PALETTE = {
    "graphite":   "#413D3D",   # primary outer shell
    "graphite2":  "#302E2E",   # secondary shell
    "dark":       "#242323",   # mechanical
    "cavity":     "#181818",   # deep recess
    "highlight":  "#F5C9AC",   # warm edge (used by the web matcaps)
    "softlight":  "#D0AB93",
}

ACCENTS = {
    "coral":  "#F05A50",
    "orange": "#FF8A42",
    "yellow": "#FFD84C",
    "lime":   "#A8FF5A",
    "mint":   "#65EDC0",
    "cyan":   "#59D6E8",
    "blue":   "#6495F5",
    "violet": "#A26BF2",
}

COLLECTIONS = ["ROOT", "SHELL", "STRUCTURE", "MECHANICAL", "SENSORS",
               "EMISSIVE", "RIG", "ANCHORS", "TECHNICAL"]


# --------------------------------------------------------------------------- #
# scene / collections
# --------------------------------------------------------------------------- #

def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.collections,
                bpy.data.lights, bpy.data.cameras, bpy.data.armatures,
                bpy.data.actions):
        for item in list(blk):
            if item.users == 0:
                blk.remove(item)
    scn = bpy.context.scene
    scn.unit_settings.system = 'METRIC'
    scn.unit_settings.scale_length = 1.0
    return scn


def make_collections(scn):
    cols = {}
    for name in COLLECTIONS:
        c = bpy.data.collections.new(name)
        scn.collection.children.link(c)
        cols[name] = c
    return cols


# --------------------------------------------------------------------------- #
# colour
# --------------------------------------------------------------------------- #

def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h, linear=True):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    if linear:
        r, g, b = _srgb_to_linear(r), _srgb_to_linear(g), _srgb_to_linear(b)
    return (r, g, b, 1.0)


def make_mat(name, base, rough=0.88, metal=0.0, emit=None, emit_str=0.0,
             transmission=0.0, ior=1.45, alpha=1.0):
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
    put("Coat Weight", 0.0)
    if emit is not None:
        put("Emission Color", hex_rgb(emit))
        put("Emission Strength", emit_str)
    return mat


def build_materials(prefix, accents=("mint", "cyan")):
    """Neutral graphite fallback set plus this twin's two accent emissives."""
    M = {
        "shell":  make_mat(f"{prefix}_Shell", PALETTE["graphite"], 0.88, 0.0),
        "shell2": make_mat(f"{prefix}_Shell2", PALETTE["graphite2"], 0.90, 0.0),
        "mech":   make_mat(f"{prefix}_Mech", PALETTE["dark"], 0.92, 0.0),
        "cavity": make_mat(f"{prefix}_Cavity", PALETTE["cavity"], 1.0, 0.0),
        "rubber": make_mat(f"{prefix}_Rubber", "#1B1A1A", 0.98, 0.0),
        "glass":  make_mat(f"{prefix}_Glass", "#0A0A0A", 0.10, 0.0,
                           transmission=0.35, ior=1.45, alpha=0.55),
    }
    for i, key in enumerate(accents):
        hx = ACCENTS[key]
        M[f"accent{i + 1}"] = make_mat(f"{prefix}_Accent_{key}", hx, 0.35, 0.0,
                                       emit=hx, emit_str=1.2)
    return M


# --------------------------------------------------------------------------- #
# bmesh primitives
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
    """Box of half-extents (sx, sy, sz) transformed by matrix M."""
    p = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
         (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    v = [bm.verts.new(M @ Vector(q)) for q in p]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
              (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])


def add_taper_box(bm, M, sx0, sy0, sx1, sy1, sz):
    """Box tapering from (sx0,sy0) at -Z to (sx1,sy1) at +Z. Good for limbs."""
    lo = [(-sx0, -sy0, -sz), (sx0, -sy0, -sz), (sx0, sy0, -sz), (-sx0, sy0, -sz)]
    hi = [(-sx1, -sy1, sz), (sx1, -sy1, sz), (sx1, sy1, sz), (-sx1, sy1, sz)]
    v = [bm.verts.new(M @ Vector(q)) for q in lo + hi]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
              (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])


def add_prism(bm, M, radius, sides, half_len, axis='X'):
    """Regular prism whose axis is the local +axis of M."""
    rings = []
    for s in (-half_len, half_len):
        ring = []
        for k in range(sides):
            a = TAU * k / sides
            c, d = radius * cos(a), radius * sin(a)
            if axis == 'X':
                p = (s, c, d)
            elif axis == 'Y':
                p = (c, s, d)
            else:
                p = (c, d, s)
            ring.append(bm.verts.new(M @ Vector(p)))
        rings.append(ring)
    for k in range(sides):
        k2 = (k + 1) % sides
        bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))
    try:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[1])
    except ValueError:
        pass


def lathe(bm, profile, seg=48, a0=0.0, a1=TAU, close_ends=False, M=None):
    """Revolve a closed (r, z) profile around local Z, optionally transformed."""
    n = len(profile)
    full = abs((a1 - a0) - TAU) < 1e-6
    rings = []
    for i in range(seg if full else seg + 1):
        a = a0 + (a1 - a0) * (i / seg)
        ca, sa = cos(a), sin(a)
        ring = []
        for (r, z) in profile:
            p = Vector((r * ca, r * sa, z))
            ring.append(bm.verts.new(M @ p if M else p))
        rings.append(ring)
    for i in range(seg):
        j = (i + 1) % len(rings) if full else i + 1
        for k in range(n):
            k2 = (k + 1) % n
            try:
                bm.faces.new((rings[i][k], rings[i][k2], rings[j][k2], rings[j][k]))
            except ValueError:
                pass
    if close_ends and not full:
        for ring, flip in ((rings[0], False), (rings[-1], True)):
            try:
                bm.faces.new(list(reversed(ring)) if flip else ring)
            except ValueError:
                pass


def add_cylinder(bm, M, radius, half_len, seg=32, axis='Z'):
    """Solid capped cylinder along the local +axis."""
    prof = [(0.0, -half_len), (radius, -half_len), (radius, half_len), (0.0, half_len)]
    rot = {'Z': Matrix.Identity(4),
           'X': Matrix.Rotation(radians(90), 4, 'Y'),
           'Y': Matrix.Rotation(radians(-90), 4, 'X')}[axis]
    lathe(bm, prof, seg=seg, M=(M @ rot))


def add_tube(bm, M, r_in, r_out, half_len, seg=32, axis='Z'):
    prof = [(r_in, -half_len), (r_out, -half_len), (r_out, half_len), (r_in, half_len)]
    rot = {'Z': Matrix.Identity(4),
           'X': Matrix.Rotation(radians(90), 4, 'Y'),
           'Y': Matrix.Rotation(radians(-90), 4, 'X')}[axis]
    lathe(bm, prof, seg=seg, M=(M @ rot))


def radial(count, radius, z=0.0, phase=0.0):
    for i in range(count):
        a = phase + TAU * i / count
        yield i, a, (Matrix.Translation((radius * cos(a), radius * sin(a), z))
                     @ Matrix.Rotation(a, 4, 'Z'))


# --------------------------------------------------------------------------- #
# object finishing
# --------------------------------------------------------------------------- #

def set_origin(ob, p):
    """Move mesh data so the object origin sits at world point p."""
    p = Vector(p)
    for v in ob.data.vertices:
        v.co -= p
    ob.location = p
    return ob


def tag(ob, explode, grp, order=0):
    d = Vector(explode)
    if d.length > 1e-9:
        d.normalize()
    ob["explode"] = [round(d.x, 5), round(d.y, 5), round(d.z, 5)]
    ob["grp"] = grp
    ob["order"] = order
    return ob


def bevel(ob, width=0.004, segments=2, angle=48.0):
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


def anchor(name, loc, coll, parent=None):
    """Label anchor. Exported as a glTF node and projected in the browser."""
    e = bpy.data.objects.new(f"ANCHOR_{name}", None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.05
    e.location = loc
    coll.objects.link(e)
    if parent is not None:
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    e["anchor"] = name
    return e


def pivot(name, loc, coll, parent=None):
    """Animation pivot empty (propeller hub, joint, gimbal axis...)."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'SPHERE'
    e.empty_display_size = 0.03
    e.location = loc
    coll.objects.link(e)
    if parent is not None:
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


def finish(parts, root, no_bevel=(), bevel_width=0.004):
    """Parent everything to root, apply the family bevel/shading standard."""
    for ob in parts:
        if ob.parent is None:
            ob.parent = root
            ob.matrix_parent_inverse = Matrix.Identity(4)
        if ob.type != 'MESH':
            continue
        if ob.name not in no_bevel:
            bevel(ob, width=bevel_width)
        shade(ob)
    return root


def tri_count(parts):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in parts if o.type == 'MESH')


def action_fcurves(action):
    """
    F-curves of an action, across Blender versions.

    Blender 4.4+ moved to slotted actions: curves now live under
    layers -> strips -> channelbags rather than on `action.fcurves`.
    """
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out


def set_linear(action):
    for fc in action_fcurves(action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


# --------------------------------------------------------------------------- #
# export
# --------------------------------------------------------------------------- #

REPO = r"C:\Users\awaiz\OneDrive\Desktop\scroll\bridge"


def export_twin(name, subdir):
    """Save <subdir>/<name>.blend and export public/models/twins/<name>.glb."""
    import os
    blend = os.path.join(REPO, "blender", "twins", subdir, f"{name}.blend")
    glb = os.path.join(REPO, "public", "models", "twins", f"{name}.glb")
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    os.makedirs(os.path.dirname(glb), exist_ok=True)

    for ob in list(bpy.data.objects):
        if ob.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(ob, do_unlink=True)

    # Bake rotation/scale into the mesh; keep location as the animation pivot.
    vl = bpy.context.view_layer
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        o.select_set(False)
    for o in meshes:
        o.select_set(True)
    if meshes:
        vl.objects.active = meshes[0]
        try:
            bpy.ops.object.transform_apply(location=False, rotation=True,
                                           scale=True, properties=False)
        except Exception:
            pass
    for o in meshes:
        o.select_set(False)

    bpy.ops.wm.save_as_mainfile(filepath=blend)

    kwargs = dict(
        filepath=glb, export_format='GLB', export_apply=True,
        use_selection=False, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False, export_materials='EXPORT',
        export_normals=True, export_tangents=False, export_skins=True,
        export_morph=False, export_animations=True,
        export_animation_mode='ACTIONS',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
    )
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in kwargs.items() if k in props})

    size = os.path.getsize(glb)
    return {
        "blend": blend, "glb": glb,
        "glb_kb": round(size / 1024.0, 1),
        "objects": len(bpy.data.objects),
        "meshes": len(meshes),
    }
