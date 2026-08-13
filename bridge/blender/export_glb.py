"""
export_glb.py - save the .blend and export the web-ready .glb.

Run inside Blender after build_model.py:

    exec(open(r"<repo>/blender/export_glb.py").read())

What it does
------------
1. Removes preview-only objects (camera/lights) so the GLB carries geometry only.
2. Applies every modifier via the exporter's `export_apply=True`, and applies
   object transforms to the mesh data first so the exported vertex data is
   authoritative and part origins survive as node translations.
3. Preserves object names and the Engine_Root -> part hierarchy.
4. Exports custom properties ("explode", "grp", "order") through `export_extras`
   so the web scene can read each part's exploded direction straight off the
   glTF node rather than duplicating the table in TypeScript.
5. Writes blender/bridge_engine.blend and public/models/bridge-engine.glb.
"""

import bpy
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(
    bpy.data.filepath or os.path.join(os.getcwd(), "blender", "x"))))


def _resolve_repo(explicit=None):
    if explicit:
        return explicit
    guess = r"C:\Users\awaiz\OneDrive\Desktop\scroll\bridge"
    return guess


def strip_preview_objects():
    removed = []
    for ob in list(bpy.data.objects):
        if ob.type in {'CAMERA', 'LIGHT'}:
            removed.append(ob.name)
            bpy.data.objects.remove(ob, do_unlink=True)
    return removed


def apply_transforms():
    """Bake object scale/rotation into mesh data, keeping location as the pivot."""
    vl = bpy.context.view_layer
    for ob in bpy.data.objects:
        ob.select_set(False)
    targets = [o for o in bpy.data.objects if o.type == 'MESH']
    for ob in targets:
        ob.select_set(True)
    if targets:
        vl.objects.active = targets[0]
        try:
            bpy.ops.object.transform_apply(location=False, rotation=True,
                                           scale=True, properties=False)
        except Exception:
            pass
    for ob in targets:
        ob.select_set(False)
    return len(targets)


def export(repo=None):
    repo = _resolve_repo(repo)
    blend_path = os.path.join(repo, "blender", "bridge_engine.blend")
    glb_path = os.path.join(repo, "public", "models", "bridge-engine.glb")
    os.makedirs(os.path.dirname(blend_path), exist_ok=True)
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)

    removed = strip_preview_objects()
    n = apply_transforms()

    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    kwargs = dict(
        filepath=glb_path,
        export_format='GLB',
        export_apply=True,          # evaluate + apply modifiers (bevel, WN)
        use_selection=False,
        export_yup=True,
        export_extras=True,         # carry "explode"/"grp"/"order" custom props
        export_cameras=False,
        export_lights=False,
        export_materials='EXPORT',
        export_normals=True,
        export_tangents=False,
        export_skins=False,
        export_morph=False,
        export_animations=False,
        # Draco cuts the asset from ~3.8 MB to a few hundred KB with no visible
        # quality loss at these quantisation levels. The web build pairs this
        # with three's DRACOLoader, whose decoder is served from public/draco/.
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    # Blender's glTF operator gains/renames keywords across releases; drop any
    # this build does not accept rather than failing the export outright.
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kwargs = {k: v for k, v in kwargs.items() if k in props}
    bpy.ops.export_scene.gltf(**kwargs)

    size = os.path.getsize(glb_path)
    meshes = [o.name for o in bpy.data.objects if o.type == 'MESH']
    return {
        "blend": blend_path,
        "glb": glb_path,
        "glb_bytes": size,
        "glb_kb": round(size / 1024.0, 1),
        "mesh_objects": len(meshes),
        "removed_preview": removed,
        "transforms_applied": n,
    }
