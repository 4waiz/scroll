/**
 * Technical labels for a twin.
 *
 * Labels sit in two fixed columns (lower-left and upper-right, matching the
 * existing technical sections) and each is joined to its 3D anchor by a leader
 * line. Fixed columns rather than free placement means no per-frame collision
 * solving and no labels drifting over the heading or the code card - only the
 * leader line moves as the model does.
 *
 * Anchor positions are projected every frame, so labels stay correct through
 * any camera move, explode or viewport size. Nothing is hard-coded in pixels.
 */

import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import type { TwinInstance } from './TwinInstance';

const SVG_NS = 'http://www.w3.org/2000/svg';
const _world = new Vector3();

interface LabelRow {
  label: string;
  side: 'left' | 'right';
  el: HTMLElement;
  line: SVGPolylineElement;
}

export interface TwinLabels {
  root: HTMLElement;
  setTwin(twin: TwinInstance | null): void;
  update(camera: PerspectiveCamera, w: number, h: number, opacity: number): void;
  destroy(): void;
}

export function createTwinLabels(parent: HTMLElement): TwinLabels {
  const root = document.createElement('div');
  root.className = 'twin-labels';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'twin-labels__lines');
  svg.setAttribute('preserveAspectRatio', 'none');
  root.appendChild(svg);

  const colLeft = document.createElement('ul');
  colLeft.className = 'twin-labels__col twin-labels__col--left';
  const colRight = document.createElement('ul');
  colRight.className = 'twin-labels__col twin-labels__col--right';
  root.append(colLeft, colRight);
  parent.appendChild(root);

  let rows: LabelRow[] = [];
  let twin: TwinInstance | null = null;
  let lastOpacity = -1;

  function clear(): void {
    for (const r of rows) {
      r.el.remove();
      r.line.remove();
    }
    rows = [];
  }

  function setTwin(next: TwinInstance | null): void {
    if (twin === next) return;
    twin = next;
    clear();
    if (!next) return;

    const build = (labels: string[], side: 'left' | 'right'): void => {
      for (const label of labels) {
        if (!next.anchor(label)) continue;      // asset lacks this anchor
        const li = document.createElement('li');
        li.className = 'twin-label';
        li.textContent = label;
        (side === 'left' ? colLeft : colRight).appendChild(li);

        const line = document.createElementNS(SVG_NS, 'polyline');
        line.setAttribute('class', 'twin-label__leader');
        svg.appendChild(line);

        rows.push({ label, side, el: li, line });
      }
    };
    build(next.def.labelsLeft, 'left');
    build(next.def.labelsRight, 'right');
  }

  function update(camera: PerspectiveCamera, w: number, h: number, opacity: number): void {
    if (Math.abs(opacity - lastOpacity) > 0.01) {
      lastOpacity = opacity;
      root.style.opacity = String(opacity);
      root.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
    }
    if (opacity < 0.02 || !twin) return;

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    for (const row of rows) {
      const node = twin.anchor(row.label);
      if (!node) continue;
      node.updateWorldMatrix(true, false);
      _world.setFromMatrixPosition(node.matrixWorld).project(camera);

      const behind = _world.z > 1;
      const ax = (_world.x * 0.5 + 0.5) * w;
      const ay = (-_world.y * 0.5 + 0.5) * h;
      const onScreen = !behind && ax > -60 && ax < w + 60 && ay > -40 && ay < h + 40;

      row.el.classList.toggle('is-hidden', !onScreen);
      row.line.style.display = onScreen ? '' : 'none';
      if (!onScreen) continue;

      // Leader runs from the label's inner edge, horizontally, then diagonally
      // to the anchor - the same drafting convention as the existing sections.
      const box = row.el.getBoundingClientRect();
      const hostBox = root.getBoundingClientRect();
      const ly = box.top - hostBox.top + box.height / 2;
      const lx = row.side === 'left'
        ? box.right - hostBox.left + 8
        : box.left - hostBox.left - 8;

      const midX = row.side === 'left'
        ? Math.min(lx + Math.max(24, (ax - lx) * 0.45), ax)
        : Math.max(lx - Math.max(24, (lx - ax) * 0.45), ax);

      row.line.setAttribute('points', `${lx},${ly} ${midX},${ly} ${ax},${ay}`);
    }
  }

  return {
    root,
    setTwin,
    update,
    destroy(): void {
      clear();
      root.remove();
    },
  };
}
