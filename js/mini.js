// Round mini-globe inset: its own small renderer, draggable, click to pick a destination.
import * as THREE from '../vendor/three.module.min.js';
import { makeEarthMaterials, makePinMaterial, pinGeometry, makeArc, setArc } from './globe.js';
import { globePose, vecFromLatLon, clamp } from './view.js';
import { RAD } from './astro.js';

export class MiniGlobe {
  constructor(host, tex, sunVec, px, onPick) {
    this.host = host; this.onPick = onPick; this.px = px;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(px); this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement; this.canvas.className = 'mini-canvas';
    host.prepend(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    const m = makeEarthMaterials(tex, sunVec);
    this.mats = m;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), m.earth);
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 24), m.atmo);
    this.pinMat = makePinMaterial(px);
    this.pin = new THREE.Points(pinGeometry(34, [1, 0.8, 0.35], 1), this.pinMat); this.pin.frustumCulled = false;
    this.from = new THREE.Points(pinGeometry(18, [0.6, 0.8, 1], 0), this.pinMat); this.from.frustumCulled = false; this.from.visible = false;
    this.arc = makeArc(0xf2c14e, 0.95);
    this.scene.add(this.earth, this.atmo, this.pin, this.from, this.arc);
    this.view = { lat: 20, lon: 0, dist: 3.5 };
    this.vel = { lat: 0, lon: 0 };
    this.follow = true; this.target = { lat: 20, lon: 0 };
    this.size = 0;
    this._bind();
  }
  resize() {
    const s = Math.round(this.host.clientWidth);
    if (s && s !== this.size) { this.size = s; this.renderer.setSize(s, s, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%'; }
  }
  setObserver(p, lat, lon) { this.pin.position.set(p[0] * 1.012, p[1] * 1.012, p[2] * 1.012); this.target = { lat, lon }; }
  setFrom(v) { if (!v) { this.from.visible = false; return; } this.from.position.set(v[0] * 1.012, v[1] * 1.012, v[2] * 1.012); this.from.visible = true; }
  setArc(gc) { setArc(this.arc, gc, 1.008); }
  recenter() { this.follow = true; }
  _bind() {
    const c = this.canvas; let down = null, moved = 0;
    c.addEventListener('pointerdown', (e) => { try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } down = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; this.vel.lat = this.vel.lon = 0; e.stopPropagation(); });
    c.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y; down.x = e.clientX; down.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) { this.follow = false; }
      const k = 0.55;
      this.view.lon -= dx * k; this.view.lat = clamp(this.view.lat + dy * k, -85, 85);
      this.vel.lon = -dx * k * 0.5; this.vel.lat = dy * k * 0.5;
    });
    const up = (e) => {
      if (!down) return; const start = down; down = null;
      if (moved < 6) { const hit = this.hit(e.clientX, e.clientY); if (hit) this.onPick(hit.lat, hit.lon); }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', () => { down = null; });
  }
  hit(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -(((cy - r.top) / r.height) * 2 - 1);
    this.camera.updateMatrixWorld();
    const o = this.camera.position, d = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera).sub(o).normalize();
    const b = o.dot(d), cc = o.lengthSq() - 1, disc = b * b - cc;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc); const p = o.clone().addScaledVector(d, t);
    return { lat: Math.asin(clamp(p.y, -1, 1)) * RAD, lon: Math.atan2(-p.z, p.x) * RAD };
  }
  update(dt) {
    const v = this.view;
    if (this.follow) {
      const k = 1 - Math.exp(-dt * 4);
      let dl = ((this.target.lon - v.lon + 540) % 360) - 180;
      v.lon += dl * k; v.lat += (clamp(this.target.lat, -70, 70) - v.lat) * k;
    } else {
      v.lon += this.vel.lon; v.lat = clamp(v.lat + this.vel.lat, -85, 85);
      this.vel.lon *= 0.93; this.vel.lat *= 0.93;
    }
  }
  render(time, sunVecChanged) {
    this.resize(); if (!this.size) return;
    globePose(this.view, this.camera.position, this.camera.quaternion);
    this.camera.updateMatrixWorld();
    this.mats.earth.uniforms.uCam.value.copy(this.camera.position); this.mats.atmo.uniforms.uCam.value.copy(this.camera.position);
    this.pinMat.uniforms.uTime.value = time;
    this.renderer.render(this.scene, this.camera);
  }
}
