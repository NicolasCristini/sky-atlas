// GLSL sources. Every shader writes display-referred colour directly (no colour-space conversion).

export const STAR_VERT = /* glsl */`
attribute float aSize; attribute float aBright; attribute vec3 aColor; attribute float aPhase; attribute float aHalo; attribute float aMag;
uniform float uTime; uniform float uPx; uniform float uScale; uniform float uFade;
uniform float uLimit;   // limiting magnitude of the sky quality (large = everything)
uniform float uGain;    // brightness gain from the sky quality (Enhanced boosts beyond the eye)
uniform float uExp;     // user exposure
uniform float uPol;     // light pollution 0..1: eats into the limit near the horizon
uniform float uLand;    // 0 in globe mode, 1 when landed in the sky view
uniform vec3 uUp;       // observer zenith in the celestial frame
varying vec3 vColor; varying float vBright; varying float vCore; varying float vHalo;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float tw = 1.0 + (0.14 - 0.10 * aBright) * sin(uTime * (1.3 + aPhase * 2.1) + aPhase * 57.0) + 0.04 * sin(uTime * 3.7 + aPhase * 91.0);
  // limiting magnitude, lowered near the horizon by light pollution (sky glow washes out low stars)
  float sinAlt = dot(position, uUp) / 50.0;
  float lim = mix(8.0, uLimit, uLand) - uPol * uLand * 1.2 * (1.0 - smoothstep(-0.05, 0.55, sinAlt));
  float vis = 1.0 - smoothstep(lim - 0.9, lim + 0.2, aMag);     // smooth fade near the limit: no popping
  if (vis < 0.004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); vBright = 0.0; vCore = 1.0; vHalo = 0.0; return; }
  float g = uGain * uExp;
  // aSize = core diameter in CSS px. Keep the core at least ~1.7 device px so faint stars read as crisp dust, not shimmer.
  float coreRaw = aSize * uPx * uScale * pow(g, 0.34) * (0.8 + 0.2 * vis);
  float core = max(coreRaw, 1.7);
  float dim = clamp(coreRaw / 1.7, 0.6, 1.0);
  // sprite diameter: core plus room for the halo (only bright stars get a large one)
  float sprite = core * (2.6 + 10.0 * aHalo * min(pow(g, 0.5), 1.6));
  gl_PointSize = min(sprite, 160.0);
  vCore = core / max(gl_PointSize, 1.0);       // core diameter as a fraction of the sprite
  vHalo = aHalo;
  vColor = aColor; vBright = aBright * dim * (0.97 + 0.06 * tw) * uFade * g * vis;
}`;
export const STAR_FRAG = /* glsl */`
varying vec3 vColor; varying float vBright; varying float vCore; varying float vHalo;
void main(){
  vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0;      // 0 centre, 1 sprite edge
  if (d > 1.0) discard;
  float x = d / max(vCore, 1e-3);                                 // radius in core diameters
  float core = exp(-x * x * 2.2);
  float skirt = exp(-x * 0.9) * 0.22;                             // soft shoulder around the core
  float edge = smoothstep(1.0, 0.55, d);
  // halo: gentle 1/r bloom plus a very faint wide ring, like diffraction in the eye
  float halo = vHalo * (0.58 / (1.0 + x * x * 0.5) + 0.05 * exp(-pow((x - 3.6) * 0.55, 2.0))) * edge;
  float a = (core + skirt * (0.4 + 0.6 * vHalo)) * vBright + halo * vBright;
  // the hot core burns towards white; the glow keeps the star's colour
  vec3 col = mix(vColor, vec3(1.0), clamp(core * 0.4 * min(vBright, 1.4), 0.0, 1.0));
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;

export const BODY_VERT = /* glsl */`
attribute float aSize; attribute vec3 aColor; attribute float aKind; attribute float aDisc;
uniform float uPx; uniform float uScale; uniform float uFade;
varying vec3 vColor; varying float vKind; varying float vDisc;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx * uScale;
  vColor = aColor; vKind = aKind; vDisc = aDisc;
}`;
export const BODY_FRAG = /* glsl */`
precision highp float;
varying vec3 vColor; varying float vKind; varying float vDisc;
uniform vec2 uMoonSun;   // screen-space direction of the Sun from the Moon (x right, y up)
uniform vec2 uMoonNorth; // screen-space direction of celestial north at the Moon
uniform float uMoonAngle; // phase angle (0 = full, pi = new)
uniform float uFade; uniform float uSunGlare; uniform float uOtherFade;   // uOtherFade: Moon and planets fade out when their positions are unreliable (Ages)
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float blob(vec2 q, vec2 c, float r){ return smoothstep(r, r * 0.35, length(q - c)); }
void main(){
  vec2 p = (gl_PointCoord - 0.5) * 2.0; p.y = -p.y; float d = length(p);
  if (d > 1.0) discard;
  if (vKind > 1.5) {            // Moon
    float R = 0.5;
    vec3 col = vec3(0.0); float a = 0.0;
    float halo = exp(-max(d - R, 0.0) * 9.0) * 0.16 * (1.0 + cos(uMoonAngle)) * 0.5;
    if (d < R) {
      vec2 q = p / R;
      float z = sqrt(max(1.0 - dot(q, q), 0.0));
      vec3 n = vec3(q, z);
      vec3 L = vec3(uMoonSun * sin(uMoonAngle), cos(uMoonAngle));
      float lit = smoothstep(-0.02, 0.07, dot(n, L));
      // maria in a frame whose up axis is celestial north
      vec2 nn = normalize(uMoonNorth + 1e-5), rr = vec2(nn.y, -nn.x);
      vec2 m = vec2(dot(q, rr), dot(q, nn));
      float mare = 0.0;
      mare += blob(m, vec2(-0.30, 0.40), 0.32) + blob(m, vec2(-0.62, 0.08), 0.34) + blob(m, vec2(0.12, 0.36), 0.18);
      mare += blob(m, vec2(0.30, 0.12), 0.20) + blob(m, vec2(0.58, 0.28), 0.12) + blob(m, vec2(-0.25, -0.38), 0.24);
      mare = clamp(mare, 0.0, 1.0) * (0.55 + 0.45 * noise(m * 9.0));
      float tex = 0.88 - 0.38 * mare + 0.07 * (noise(m * 22.0) - 0.5);
      float limb = pow(z, 0.25);
      vec3 base = vec3(0.93, 0.92, 0.88) * tex * limb;
      col = base * lit + vec3(0.05, 0.065, 0.09) * (1.0 - lit) * 0.9;
      a = smoothstep(R, R - 0.03, d);
      col = mix(col, vColor * halo, 0.0);
      gl_FragColor = vec4(col, max(a, 0.0) * uFade * uOtherFade);
      return;
    }
    gl_FragColor = vec4(vec3(0.75, 0.82, 1.0), halo * uFade * uOtherFade);
    return;
  }
  if (vKind > 0.5) {            // Sun
    float core = smoothstep(0.15, 0.11, d);
    float glow = exp(-d * d * 10.0) * 0.9 + exp(-d * 3.2) * 0.3 * uSunGlare;
    vec3 col = mix(vec3(1.0, 0.82, 0.5), vec3(1.0, 0.98, 0.9), core);
    gl_FragColor = vec4(col, clamp(core + glow, 0.0, 1.0));
    return;
  }
  // planets: a crisp disc with a coloured glow
  float disc = smoothstep(vDisc, vDisc * 0.72, d);
  float glow = exp(-d * d * 7.0) * 0.40 + exp(-d * 2.6) * 0.16;
  vec3 dcol = mix(vColor, vec3(1.0), 0.45) * (0.82 + 0.18 * smoothstep(vDisc, 0.0, d));
  vec3 col = mix(vColor * 1.1, dcol, disc);
  float a = clamp(max(disc, glow * smoothstep(1.0, 0.6, d)) * uFade * uOtherFade, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;

export const MW_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const MW_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uTex; uniform float uOpacity; uniform float uThr;   // uThr: faint parts vanish first when the sky is brighter
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec3 d = normalize(vDir);
  float ra = atan(-d.z, d.x); if (ra < 0.0) ra += 6.28318530718;
  float u = ra / 6.28318530718, v = asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
  float m = texture2D(uTex, vec2(u, v)).r;
  if (m < 0.006) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float n = 0.86 + 0.22 * vnoise(d * 9.0) + 0.10 * vnoise(d * 26.0) - 0.06;
  float k = max(m * n - uThr, 0.0) / max(1.0 - uThr, 0.2);
  vec3 col = mix(vec3(0.20, 0.27, 0.42), vec3(0.78, 0.72, 0.62), smoothstep(0.25, 1.0, m)) * k * uOpacity;
  gl_FragColor = vec4(col, 1.0);
}`;

export const EARTH_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){ vUv = uv; vN = normal; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const EARTH_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; uniform vec3 uCam;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){
  vec3 n = normalize(vN);
  float ndl = dot(n, uSun);
  float k = smoothstep(-0.10, 0.16, ndl);
  vec3 day = texture2D(uDay, vUv).rgb, night = texture2D(uNight, vUv).rgb;
  float lightD = 0.22 + 0.9 * smoothstep(-0.05, 0.7, ndl);
  vec3 dayC = day * lightD;
  vec3 nightC = night * 1.35 + day * vec3(0.012, 0.02, 0.04);
  vec3 c = mix(nightC, dayC, k);
  float tw = exp(-pow(ndl / 0.1, 2.0));
  c += vec3(1.0, 0.42, 0.12) * tw * 0.10 * (0.5 + 0.5 * k);
  vec3 V = normalize(uCam - vP);
  float f = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  c += vec3(0.22, 0.45, 0.95) * f * 0.35 * (0.25 + 0.75 * k);
  gl_FragColor = vec4(c, 1.0);
}`;

export const ATMO_VERT = /* glsl */`
varying vec3 vN; varying vec3 vP;
void main(){ vN = normal; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const ATMO_FRAG = /* glsl */`
precision highp float;
uniform vec3 uCam; uniform vec3 uSun;
varying vec3 vN; varying vec3 vP;
void main(){
  vec3 n = normalize(vN), V = normalize(uCam - vP);
  float f = pow(max(1.0 - dot(n, V), 0.0), 2.6);
  float lit = 0.3 + 0.7 * smoothstep(-0.4, 0.5, dot(n, uSun));
  vec3 c = mix(vec3(0.18, 0.4, 0.95), vec3(0.45, 0.7, 1.0), f);
  gl_FragColor = vec4(c, clamp(f * 0.85 * lit, 0.0, 1.0));
}`;

export const PIN_VERT = /* glsl */`
attribute float aSize; attribute vec3 aColor; attribute float aPulse;
uniform float uTime; uniform float uPx;
varying vec3 vColor; varying float vPulse;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float p = 1.0 + aPulse * 0.18 * sin(uTime * 3.0);
  gl_PointSize = aSize * uPx * p; vColor = aColor; vPulse = aPulse;
}`;
export const PIN_FRAG = /* glsl */`
varying vec3 vColor; varying float vPulse;
void main(){
  vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.26, 0.2, d);
  float ring = smoothstep(0.42, 0.36, d) - smoothstep(0.34, 0.28, d);
  float glow = exp(-d * d * 4.5) * 0.65;
  float a = clamp(core + glow + ring * 0.6 * (1.0 - vPulse * 0.0), 0.0, 1.0);
  gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.6), a);
}`;

export const DOME_VERT = /* glsl */`
varying vec3 vL;
void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const DOME_FRAG = /* glsl */`
precision highp float;
varying vec3 vL;
uniform float uGround;   // 0..1 how much we are "landed"
uniform float uSkyA;     // daylight sky opacity
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGlowCol; uniform float uGlow;
uniform vec3 uSunL; uniform float uSunTw;
uniform float uPol; uniform vec3 uPolCol;   // light pollution: warm grey-orange haze rising from the horizon
void main(){
  vec3 d = normalize(vL); float y = d.y;
  if (y < 0.0) {
    float t = smoothstep(0.0, -0.42, y);
    vec3 horizonLit = mix(vec3(0.05, 0.065, 0.10), vec3(0.28, 0.20, 0.12), uSunTw * 0.6);
    horizonLit = mix(horizonLit, uPolCol * 0.42, uPol * 0.75);
    vec3 col = mix(horizonLit, vec3(0.010, 0.013, 0.021), pow(t, 0.6));
    gl_FragColor = vec4(col, uGround);
    return;
  }
  float alt = asin(clamp(y, 0.0, 1.0));
  vec3 sky = mix(uHor, uZen, pow(clamp(y, 0.0, 1.0), 0.45));
  vec2 hd = normalize(d.xz + 1e-5), sd = normalize(uSunL.xz + 1e-5);
  float towardSun = pow(max(dot(hd, sd) * 0.5 + 0.5, 0.0), 4.0);
  vec3 tw = mix(sky, vec3(1.0, 0.55, 0.28), uSunTw * towardSun * exp(-alt * 4.0));
  float g = exp(-alt * 11.0) * uGlow;
  float a = uSkyA * uGround;
  float ga = clamp(g * uGround, 0.0, 1.0);
  float oa = clamp(a + ga * (1.0 - a), 0.0, 1.0);
  vec3 col = (tw * a + uGlowCol * ga * (1.0 - a)) / max(oa, 1e-4);
  // light-pollution haze: strongest at the horizon, thinning with a long tail up the sky, a little lopsided like a real town glow
  float az = atan(d.x, d.z);
  float pg = uPol * (0.7 * exp(-alt * 3.6) + 0.17 * exp(-alt * 1.0)) * (1.0 + 0.16 * sin(az * 2.0 + 1.0) + 0.08 * sin(az * 5.0)) * (1.0 - 0.85 * uSkyA);
  float pa = clamp(pg * uGround, 0.0, 0.9);
  vec3 pm = col * oa + uPolCol * pa * (1.0 - oa);
  float oa2 = oa + pa * (1.0 - oa);
  gl_FragColor = vec4(pm / max(oa2, 1e-4), oa2);
}`;
