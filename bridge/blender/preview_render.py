"""
preview_render.py - reference-angle previews of the engine model.

The model's long axis is +Z, so the camera is placed in a *model-relative*
spherical frame:

    tilt = angle away from the front (+Z) axis;  0 = dead-on the lens
    roll = which way the camera swings around the barrel
    rad  = distance from the target

Run inside Blender after build_model.py:

    exec(open(r"<repo>/blender/preview_render.py").read())
"""

import bpy
import os
import math
from math import radians, cos, sin
from mathutils import Vector

OUT_DIR = os.environ.get("ENGINE_PREVIEW_DIR") or bpy.app.tempdir


def _clear(names):
    for n in names:
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)


def setup(dark=True):
    scn = bpy.context.scene
    _clear(("PreviewCam", "KeyLight", "FillLight", "RimLight", "TopLight"))

    cd = bpy.data.cameras.new("PreviewCam")
    cd.lens_unit = 'FOV'
    cd.angle = radians(32)
    cam = bpy.data.objects.new("PreviewCam", cd)
    scn.collection.objects.link(cam)
    scn.camera = cam

    def light(name, energy, loc, size, color):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.color = color
        ld.size = size
        o = bpy.data.objects.new(name, ld)
        scn.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat(
            '-Z', 'Y').to_euler()

    if dark:
        light("KeyLight", 2600, (-9.0, -11.0, 7.0), 12, (1.00, 0.86, 0.72))
        light("FillLight", 260, (7.0, -12.0, -2.0), 16, (0.72, 0.80, 1.00))
        light("RimLight", 1400, (8.0, 7.0, 5.0), 10, (1.00, 0.78, 0.62))
        world = (0.055, 0.050, 0.047)
    else:
        light("KeyLight", 1800, (-8.0, -10.0, 8.0), 16, (1.0, 0.97, 0.94))
        light("FillLight", 900, (8.0, -9.0, 2.0), 18, (0.96, 0.96, 1.0))
        light("TopLight", 700, (0.0, 0.0, 14.0), 20, (1.0, 1.0, 1.0))
        world = (0.72, 0.70, 0.68)

    if scn.world is None:
        scn.world = bpy.data.worlds.new("World")
    scn.world.use_nodes = True
    bg = scn.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (*world, 1.0)
        bg.inputs[1].default_value = 1.0

    scn.render.engine = 'BLENDER_EEVEE'
    scn.render.resolution_x = 960
    scn.render.resolution_y = 960
    scn.render.resolution_percentage = 100
    scn.render.image_settings.file_format = 'PNG'
    scn.view_settings.view_transform = 'Standard'
    return cam


def place(cam, tilt, roll, rad, target=(0, 0, 0)):
    t, r = radians(tilt), radians(roll)
    p = Vector((rad * sin(t) * sin(r), -rad * sin(t) * cos(r), rad * cos(t)))
    cam.location = p + Vector(target)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat(
        '-Z', 'Y').to_euler()


SHOTS = {
    "face":     dict(tilt=6,  roll=0,  rad=17.0),
    "quarter":  dict(tilt=38, roll=18, rad=19.0),
    "rolled":   dict(tilt=58, roll=12, rad=20.0),
    "side":     dict(tilt=88, roll=0,  rad=21.0),
    "rear":     dict(tilt=150, roll=20, rad=20.0),
}


def render_all(out_dir=None, prefix="preview", dark=True, shots=None):
    out_dir = out_dir or OUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    cam = setup(dark=dark)
    made = []
    for name, kw in (shots or SHOTS).items():
        place(cam, **kw)
        fp = os.path.join(out_dir, "%s_%s.png" % (prefix, name))
        bpy.context.scene.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        made.append(fp)
    return made
