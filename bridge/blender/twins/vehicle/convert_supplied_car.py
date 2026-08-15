"""
convert_supplied_car.py - prepare a supplied car GLB for the twin pipeline.

The procedural twins carry explode/grp metadata authored in their build script.
A third-party asset has none, and its node names are generic Maya output
(polySurface318_...), so the exploded view has to be *derived* from geometry.

What this does:
  1. imports the supplied GLB
  2. deletes manufacturer badge / number-plate meshes, identified by material
  3. drops stray environment meshes that sit far outside the car's bulk
  4. assigns each remaining part a `grp` and an `explode` unit vector, derived
     from where the part sits relative to the car's own bounding box
  5. downscales oversized textures and re-exports with Draco

Orientation of the supplied asset, measured on import: Z up, Y along the car's
length, -Y toward the front (the front-light meshes sit at minimum Y).
"""

import bpy
import os
from math import radians
from mathutils import Matrix, Vector

SRC = r"C:\Users\awaiz\OneDrive\Desktop\scroll\bridge\alfa_romeo_stradale_1967.glb"
OUT = r"C:\Users\awaiz\OneDrive\Desktop\scroll\bridge\public\models\twins\car.glb"
BLEND = r"C:\Users\awaiz\OneDrive\Desktop\scroll\bridge\blender\twins\vehicle\car.blend"

# Materials that carry manufacturer marks. Removing these strips the badges and
# the number plate from the asset before it is published.
BADGE_MATS = ("logo", "number", "alpha", "znachok")
MAX_TEX = 1024
# Degrees about Z applied to the whole car, deciding which side the stage's
# hero azimuth looks at. See the note at step 3b for why this is baked.
YAW = 0
# Metres nose to tail, matching the units the rest of the twin family uses.
CAR_LENGTH = 4.4


def world_bb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def convert():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=SRC)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']

    # ---- 1. strip badges -------------------------------------------------
    removed = []
    for o in list(meshes):
        mats = [m.name.lower() for m in o.data.materials if m]
        if any(any(b in mn for b in BADGE_MATS) for mn in mats):
            removed.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']

    # ---- 2. drop stray environment meshes --------------------------------
    # Work out the car's bulk from the median part, then discard anything whose
    # centre sits far outside it - backdrops and ground planes inflate the
    # bounding box and wreck every derived explode direction.
    boxes = {o.name: world_bb(o) for o in meshes}
    diags = sorted(((hi - lo).length, o.name) for o, (lo, hi) in
                   ((o, boxes[o.name]) for o in meshes))
    median = diags[len(diags) // 2][0]
    scene_max = max((hi - lo)[i] for (lo, hi) in boxes.values() for i in range(3))

    outliers = []
    for o in list(meshes):
        lo, hi = boxes[o.name]
        d = hi - lo
        big = max(d)
        # A studio floor survives a pure size test - it is not that much larger
        # than the car - but it is unmistakably planar. Catch it on flatness:
        # one dimension collapsed to nothing while it spans most of the scene.
        floor = big > scene_max * 0.5 and min(d) < big * 0.02
        if d.length > median * 14 or floor:
            outliers.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']

    lo = Vector((9e9, 9e9, 9e9))
    hi = Vector((-9e9, -9e9, -9e9))
    for o in meshes:
        a, b = world_bb(o)
        for i in range(3):
            lo[i] = min(lo[i], a[i])
            hi[i] = max(hi[i], b[i])
    centre = (lo + hi) * 0.5
    size = hi - lo

    # ---- 3. derive grp + explode ----------------------------------------
    counts = {}
    for o in meshes:
        a, b = world_bb(o)
        c = (a + b) * 0.5
        rel = Vector(((c.x - centre.x) / (size.x * 0.5),
                      (c.y - centre.y) / (size.y * 0.5),
                      (c.z - centre.z) / (size.z * 0.5)))
        span = (b - a).length / max(1e-6, size.length)

        mats = " ".join(m.name.lower() for m in o.data.materials if m)

        # This asset has no semantic node names (generic Maya polySurface IDs),
        # so keying groups off names or material guesses mis-sorts almost
        # everything - a first pass put 75 of 100 parts in "interior" and found
        # no wheels at all. Sort geometrically instead: how far a part sits from
        # the car's centre decides how far it travels, which is exactly the
        # radial blow-apart the engine section uses.
        reach = Vector((rel.x, rel.y * 0.55, rel.z)).length

        if "light" in mats or "lamp" in mats:
            grp = "light"
        elif "car_paint" in mats or span > 0.40:
            grp = "shell"           # outer bodywork: lifts and opens
        elif reach > 0.75:
            grp = "detail"          # outer furniture: wheels, trim, mirrors
        elif reach > 0.40:
            grp = "body"
        else:
            grp = "internal"        # cabin and mechanicals: barely move

        # Travel outward from the car's centre, with a slight upward bias so
        # the stack opens rather than smearing sideways.
        d = Vector((rel.x, rel.y * 0.55, rel.z * 0.9 + 0.28))

        if d.length < 1e-6:
            d = Vector((0, 0, 1))
        d.normalize()
        o["explode"] = [round(d.x, 5), round(d.y, 5), round(d.z, 5)]
        o["grp"] = grp
        o["order"] = counts.get(grp, 0)
        counts[grp] = counts.get(grp, 0) + 1

    # ---- 3b. normalise scale --------------------------------------------
    # The asset ships at roughly 1/10 scale (0.44 units nose to tail). Every
    # other twin is authored in metres, and the shared explode amounts in
    # sceneStates are metre-sized, so bring this one into the same units
    # rather than special-casing it downstream.
    car_len = size.y
    k = CAR_LENGTH / car_len if car_len > 1e-6 else 1.0

    # Which way the car faces is baked here rather than solved at runtime: an
    # extra Z term on the twin's baseRotation composes with the -90 that lays
    # the model down and rolls the car onto its roof, and negating the camera's
    # roll to orbit round to the other side flips the frame's up vector and
    # puts the camera under the floor pan. Turning the geometry avoids both.
    # 0 presents the front three-quarter to the stage's hero azimuth.
    # Centre first, then scale and yaw about that origin, so the twin arrives
    # centred on the stage pivot as well as right-way-round.
    M = (Matrix.Scale(k, 4)
         @ Matrix.Rotation(radians(YAW), 4, 'Z')
         @ Matrix.Translation(-centre))
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

    for o in meshes:
        o.matrix_world = M @ o.matrix_world
    bpy.context.view_layer.update()

    # Flatten every transform into the mesh data.
    #
    # This asset is a Maya export: its geometry carries near-world coordinates
    # and each node compensates with a large translation, so the nodes reach
    # glTF as translation ~-74 with scale ~13.5. The stage explodes a part by
    # adding its travel to the node's translation, which at that magnitude is
    # invisible. Applying the transforms leaves identity TRS on every node -
    # the same clean layout the procedural twins export - so the offsets act in
    # the model's own units.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()

    # ---- 4. shrink textures ---------------------------------------------
    resized = 0
    for img in bpy.data.images:
        if img.size[0] > MAX_TEX or img.size[1] > MAX_TEX:
            img.scale(min(MAX_TEX, img.size[0]), min(MAX_TEX, img.size[1]))
            resized += 1

    # ---- 5. export -------------------------------------------------------
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    kwargs = dict(
        filepath=OUT, export_format='GLB', export_apply=True, use_selection=False,
        export_yup=True, export_extras=True, export_cameras=False,
        export_lights=False, export_materials='EXPORT', export_animations=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in kwargs.items() if k in props})

    return {
        "badges_removed": removed,
        "outliers_removed": outliers,
        "meshes": len(meshes),
        "tris": sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes),
        "size": [round(v, 3) for v in size],
        "centre": [round(v, 3) for v in centre],
        "groups": counts,
        "textures_resized": resized,
        "src_mb": round(os.path.getsize(SRC) / 1048576.0, 2),
        "out_mb": round(os.path.getsize(OUT) / 1048576.0, 2),
    }
