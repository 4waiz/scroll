"""
convert_supplied.py - prepare third-party GLB assets for the twin pipeline.

The procedural twins carry explode/grp metadata authored in their build script.
A supplied asset has none, and its node names are whatever its DCC emitted
(polySurface318_..., Object_96, Cylinder.004_...), so the exploded view has to
be *derived* from geometry rather than read off names.

Each asset is put through the same steps:

  1. import, and drop manufacturer badge / marking meshes by material
  2. drop studio floor planes - caught on flatness, not size
  3. derive `grp` and an `explode` unit vector from where each part sits
     relative to the asset's own bounding box
  4. decimate to a web-sane triangle count
  5. normalise scale and yaw, then flatten every transform into the mesh data
  6. downscale textures and re-export with Draco

Step 5 matters more than it looks. Supplied assets routinely carry near-world
coordinates in their geometry with the node compensating - the Alfa arrived at
translation ~-74 with scale ~13.5 - and the stage explodes a part by adding its
travel to the node's translation, which at that magnitude is invisible.
Flattening leaves identity TRS on every node, the same layout the procedural
twins export.

An asset with `keep_rig` set skips steps 4 and 5 and keeps its hierarchy,
skin and clips: those assets drive their exploded view from a baked clip that
scroll scrubs, so flattening them would destroy the very thing being used.
"""

import bpy
import os
from math import radians
from mathutils import Matrix, Vector

ROOT = r"C:\Users\awaiz\OneDrive\Desktop\scroll\bridge"
SRC_DIR = ROOT
OUT_DIR = os.path.join(ROOT, "public", "models", "twins")
BLEND_DIR = os.path.join(ROOT, "blender", "twins")

# Materials that carry manufacturer marks. Removing these strips badges,
# number plates and painted-on branding before the asset is published.
BADGE_MATS = ("logo", "number", "alpha", "znachok", "decal", "badge", "brand")


ASSETS = {
    # id            source file                        out          metres  yaw  tris   tex
    "drone": dict(
        src="animated_drone.glb", out="drone-uav.glb",
        length=1.2, yaw=0, keep_rig=True, max_tex=1024, target_tris=None,
        blend="drone/drone-uav.blend",
    ),
    "quadruped": dict(
        src="spotboston_dynamic_high_poly.glb", out="quadruped-field.glb",
        length=1.1, yaw=0, keep_rig=False, max_tex=1024, target_tris=150_000,
        blend="quadruped/quadruped-field.blend",
    ),
    "sidearm": dict(
        src="benelli_m3_tactical.glb", out="sidearm.glb",
        length=1.0, yaw=0, keep_rig=False, max_tex=512, target_tris=None,
        blend="sidearm/sidearm.blend",
    ),
    "launcher": dict(
        # 1024 left this the heaviest asset in the build at 11 MB, almost all
        # of it texture, for a machine that is only ever seen whole.
        src="buk-m3_9k317_sam.glb", out="launcher.glb",
        length=9.3, yaw=0, keep_rig=False, max_tex=512, target_tris=150_000,
        blend="launcher/launcher.blend",
    ),
}


def world_bb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def scene_bounds(meshes):
    lo = Vector((9e9, 9e9, 9e9))
    hi = Vector((-9e9, -9e9, -9e9))
    for o in meshes:
        a, b = world_bb(o)
        for i in range(3):
            lo[i] = min(lo[i], a[i])
            hi[i] = max(hi[i], b[i])
    return lo, hi


def tri_count(meshes):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)


def mesh_objects():
    return [o for o in bpy.data.objects if o.type == 'MESH']


def convert(key):
    cfg = ASSETS[key]
    src = os.path.join(SRC_DIR, cfg["src"])
    out = os.path.join(OUT_DIR, cfg["out"])

    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=src)

    meshes = mesh_objects()
    report = {"id": key, "src_mb": round(os.path.getsize(src) / 1048576.0, 2)}

    # ---- 1. strip badges -------------------------------------------------
    removed = []
    for o in list(meshes):
        mats = [m.name.lower() for m in o.data.materials if m]
        if any(any(b in mn for b in BADGE_MATS) for mn in mats):
            removed.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = mesh_objects()
    report["badges_removed"] = removed

    # ---- 2. drop stray environment meshes --------------------------------
    boxes = {o.name: world_bb(o) for o in meshes}
    diags = sorted((hi - lo).length for (lo, hi) in boxes.values())
    median = diags[len(diags) // 2]
    scene_max = max((hi - lo)[i] for (lo, hi) in boxes.values() for i in range(3))

    outliers = []
    for o in list(meshes):
        lo, hi = boxes[o.name]
        d = hi - lo
        big = max(d)
        # A studio floor survives a pure size test - it is not that much larger
        # than the subject - but it is unmistakably planar. Catch it on
        # flatness: one dimension collapsed while it spans most of the scene.
        floor = big > scene_max * 0.5 and min(d) < big * 0.02
        if d.length > median * 14 or floor:
            outliers.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = mesh_objects()
    report["outliers_removed"] = outliers

    lo, hi = scene_bounds(meshes)
    centre = (lo + hi) * 0.5
    size = hi - lo
    report["source_size"] = [round(v, 3) for v in size]

    # ---- 3. derive grp + explode ----------------------------------------
    # Supplied assets have no semantic node names, so keying groups off names
    # mis-sorts almost everything. Sort geometrically instead: how far a part
    # sits from the centre decides how far it travels, which is exactly the
    # radial blow-apart the engine section uses.
    counts = {}
    half = Vector((max(size.x, 1e-6) * 0.5, max(size.y, 1e-6) * 0.5, max(size.z, 1e-6) * 0.5))
    long_axis = max(range(3), key=lambda i: size[i])

    for o in meshes:
        a, b = world_bb(o)
        c = (a + b) * 0.5
        rel = Vector(((c.x - centre.x) / half.x,
                      (c.y - centre.y) / half.y,
                      (c.z - centre.z) / half.z))
        span = (b - a).length / max(1e-6, size.length)
        mats = " ".join(m.name.lower() for m in o.data.materials if m)

        # Foreshorten the long axis so a long machine does not classify most of
        # itself as "outboard" purely by being long.
        r = Vector(rel)
        r[long_axis] *= 0.55
        reach = r.length

        if "light" in mats or "lamp" in mats or "glass" in mats:
            grp = "light"
        elif "paint" in mats or span > 0.40:
            grp = "shell"
        elif reach > 0.75:
            grp = "detail"
        elif reach > 0.40:
            grp = "body"
        else:
            grp = "internal"

        # Travel outward from the centre, with a slight upward bias so the
        # stack opens rather than smearing sideways.
        d = Vector(rel)
        d[long_axis] *= 0.55
        d.z = d.z * 0.9 + 0.28
        if d.length < 1e-6:
            d = Vector((0, 0, 1))
        d.normalize()
        o["explode"] = [round(d.x, 5), round(d.y, 5), round(d.z, 5)]
        o["grp"] = grp
        o["order"] = counts.get(grp, 0)
        counts[grp] = counts.get(grp, 0) + 1
    report["groups"] = counts
    report["source_tris"] = tri_count(meshes)

    if cfg["keep_rig"]:
        # A rigged asset cannot be flattened, but it still has to arrive
        # centred and in the family's units. Transform only the parentless
        # objects: the hierarchy and the skin follow them intact.
        k = cfg["length"] / max(size[long_axis], 1e-6)
        M = (Matrix.Scale(k, 4)
             @ Matrix.Rotation(radians(cfg["yaw"]), 4, 'Z')
             @ Matrix.Translation(-centre))
        for o in bpy.data.objects:
            if o.parent is None:
                o.matrix_world = M @ o.matrix_world
        bpy.context.view_layer.update()
    else:
        # ---- 4. decimate -------------------------------------------------
        # A 930k-triangle hero asset is not shippable. Decimate proportionally
        # so every part keeps its share rather than crushing the small ones.
        target = cfg["target_tris"]
        if target and report["source_tris"] > target:
            ratio = target / float(report["source_tris"])
            for o in meshes:
                m = o.modifiers.new("dec", 'DECIMATE')
                m.ratio = ratio
                m.use_collapse_triangulate = True
            report["decimate_ratio"] = round(ratio, 4)

        # Skins and armatures cannot survive a transform flatten, and these
        # assets are static poses anyway.
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            for mod in list(o.modifiers):
                if mod.type == 'ARMATURE':
                    o.modifiers.remove(mod)
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        for o in list(bpy.data.objects):
            if o.type == 'ARMATURE':
                bpy.data.objects.remove(o, do_unlink=True)

        # ---- 5. normalise + flatten --------------------------------------
        k = cfg["length"] / max(size[long_axis], 1e-6)
        M = (Matrix.Scale(k, 4)
             @ Matrix.Rotation(radians(cfg["yaw"]), 4, 'Z')
             @ Matrix.Translation(-centre))
        for o in meshes:
            o.matrix_world = M @ o.matrix_world
        bpy.context.view_layer.update()

        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.convert(target='MESH')          # bakes the decimate too
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.context.view_layer.update()

    # ---- 6. textures + export -------------------------------------------
    resized = 0
    cap = cfg["max_tex"]
    for img in bpy.data.images:
        if img.size[0] > cap or img.size[1] > cap:
            img.scale(min(cap, img.size[0]), min(cap, img.size[1]))
            resized += 1
    report["textures_resized"] = resized

    os.makedirs(OUT_DIR, exist_ok=True)
    blend = os.path.join(BLEND_DIR, cfg["blend"])
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend)

    kwargs = dict(
        filepath=out, export_format='GLB', export_apply=True, use_selection=False,
        export_yup=True, export_extras=True, export_cameras=False,
        export_lights=False, export_materials='EXPORT',
        export_animations=bool(cfg["keep_rig"]),
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in kwargs.items() if k in props})

    meshes = mesh_objects()
    lo, hi = scene_bounds(meshes)
    report["final_size"] = [round(v, 3) for v in (hi - lo)]
    report["final_tris"] = tri_count(meshes)
    report["meshes"] = len(meshes)
    report["out_mb"] = round(os.path.getsize(out) / 1048576.0, 2)
    return report


def convert_all():
    return [convert(k) for k in ASSETS]
