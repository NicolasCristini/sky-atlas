// DOM label layer with priority-based collision avoidance. Positions are projected every frame,
// DOM writes happen only when something changed.
import * as THREE from '../vendor/three.module.min.js';
import { R_SKY } from './sky.js';

const _d = new THREE.Vector3(), _p = new THREE.Vector3();

export class LabelLayer {
  constructor(container) { this.el = container; this.items = []; this.rects = []; this.dirty = true; }

  /** item: {text, cls, kind:'eq'|'local'|'world', v:Vector3, group, prio, mag, anchor:'c'|'r', charW, click, minAlt} */
  add(item) {
    const el = document.createElement('div');
    el.className = `lbl ${item.cls || ''}`; el.textContent = item.text; el.style.opacity = 0;
    this.el.appendChild(el);
    item.el = el; item.shown = false; item._op = -1; item._x = -1e9; item._y = -1e9; item.rect = [0, 0, 0, 0];
    item.w = (item.charW || 6.4) * item.text.length + 10; item.h = 16;
    this.items.push(item); this.dirty = true;
    return item;
  }
  finalize() { this.items.sort((a, b) => a.prio - b.prio); }

  /**
   * ctx: {camera, rot (Matrix4 celestial->world, rotation only), local (Matrix4 local->world), U (Vector3),
   *       on:{group:boolean}, landed:boolean, w, h, fov, forward:Vector3, magLimit, selectedCons}
   */
  update(ctx) {
    const { camera, w, h } = ctx;
    const rects = this.rects; rects.length = 0;
    for (const it of this.items) {
      let vis = ctx.on[it.group] !== false && ctx.on[it.group];
      let op = 1, x = 0, y = 0;
      if (vis) {
        if (it.kind === 'world') {
          _d.copy(it.v).sub(camera.position);
          if (_d.dot(ctx.forward) <= 0.01) vis = false; else _p.copy(it.v).project(camera);
        } else {
          if (it.kind === 'eq') _d.copy(it.v).applyMatrix4(ctx.rot); else _d.copy(it.v).applyMatrix4(ctx.local);
          if (_d.dot(ctx.forward) <= 0.05) vis = false;
          else {
            if (ctx.landed && it.group !== 'cardinal' && _d.dot(ctx.U) < (it.minAlt ?? -0.015)) vis = false;
            _p.copy(_d).multiplyScalar(R_SKY).add(camera.position).project(camera);
          }
        }
      }
      if (vis) {
        x = (_p.x * 0.5 + 0.5) * w; y = (-_p.y * 0.5 + 0.5) * h;
        if (x < -30 || x > w + 30 || y < -20 || y > h + 20) vis = false;
      }
      if (vis && ctx.clip && y - 8 < ctx.clip.b && x + it.w / 2 > ctx.clip.l && x - it.w / 2 < ctx.clip.r) vis = false;   // phones: the status line owns the top strip
      if (vis && it.mag !== undefined && it.mag > ctx.magLimit && !it.force) vis = false;
      if (vis && it.group === 'const') { if (ctx.fov < 26 && ctx.selectedCons !== it.id) op = 0.0, vis = false; }
      if (vis && !it.noCollide) {
        const r = it.anchor === 'r' ? [x + 6, y - 8, x + 6 + it.w, y + 8] : [x - it.w / 2, y - 8, x + it.w / 2, y + 8];
        for (let i = 0; i < rects.length; i++) { const q = rects[i]; if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) { vis = false; break; } }
        if (vis) { rects.push(r); it.rect = r; }
      } else if (vis) { it.rect = [x - it.w / 2, y - 8, x + it.w / 2, y + 8]; }
      if (vis && it.group === 'const' && ctx.selectedCons === it.id) op = 1;
      else if (vis && it.baseOp !== undefined) op = it.baseOp;
      this._write(it, vis, x, y, op);
    }
  }
  _write(it, vis, x, y, op) {
    const o = vis ? op : 0;
    if (o !== it._op) { it.el.style.opacity = o; it._op = o; }
    it.shown = vis;
    if (vis && (Math.abs(x - it._x) > 0.2 || Math.abs(y - it._y) > 0.2)) {
      it.el.style.transform = it.anchor === 'r' ? `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(8px,-50%)` : `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`;
      it._x = x; it._y = y;
    }
  }
  hitTest(x, y) {
    let best = null;
    for (const it of this.items) {
      if (!it.shown || !it.click) continue;
      const r = it.rect; if (x >= r[0] - 4 && x <= r[2] + 4 && y >= r[1] - 4 && y <= r[3] + 4) { best = it; break; }
    }
    return best;
  }
  /** Screen position of an item (for reticle). */
  setClass(it, cls, on) { it.el.classList.toggle(cls, on); }
}
