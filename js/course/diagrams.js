// Small flat diagrams for chapters 5 and 6, drawn in screen space by the overlay (ov.screen). Each factory returns draw(ctx, env),
// called every frame with env = { W, H, fade, u, label } (label(text, x, y, { color, size, align, fade }) draws outlined text).
// Colours follow the overlay: gold = what is active, pale blue = reference. No DOM, no state of their own: values come from callbacks.
const GOLD = '242,193,78', BLUE = '150,198,255', WHITE = '236,242,255', INK = '2,5,12';
const rgba = (c, a) => `rgba(${c},${a.toFixed(3)})`;
const TOP = 54;

function panel(ctx, x, y, w, h, fade) {
  ctx.fillStyle = rgba('6,12,26', 0.62 * fade); ctx.strokeStyle = rgba(BLUE, 0.28 * fade); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 12) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
}
/** Where a panel of width w goes: centred at the top on phones, top-right on wide screens. */
/** Position a diagram and, on wide screens, draw it 30 % larger (the caller restores the context at the end). */
function place(ctx, env, w, h) { const k = env.W >= 900 ? 1.3 : 1, q = slot(env, w * k, h * k); ctx.save(); ctx.scale(k, k); return { x: q.x / k, y: q.y / k, w, h }; }
const slot = (env, w, h) => ({ x: env.W < 600 ? Math.round((env.W - w) / 2) : env.W - w - 16, y: TOP, w, h });

/** Sun, Earth and Moon seen from above: the Moon's lit half always faces the Sun and the phase is the angle at Earth. angle() = Moon phase angle in degrees (0 new, 180 full). */
export function moonInset({ angle, sunText = 'Sun', earthText = 'Earth', moonText = 'Moon', day }) {
  return (ctx, env) => {
    const f = env.fade, w = 150, h = 138, p = place(ctx, env, w, h), cx = p.x + 58, cy = p.y + 72, R = 42, th = angle() * Math.PI / 180;
    panel(ctx, p.x, p.y, w, h, f);
    // sunlight: three parallel arrows from the right
    ctx.strokeStyle = rgba(GOLD, 0.8 * f); ctx.fillStyle = rgba(GOLD, 0.9 * f); ctx.lineWidth = 1.6;
    for (const dy of [-22, 0, 22]) { ctx.beginPath(); ctx.moveTo(p.x + w - 8, cy + dy); ctx.lineTo(p.x + w - 34, cy + dy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x + w - 34, cy + dy); ctx.lineTo(p.x + w - 28, cy + dy - 3); ctx.lineTo(p.x + w - 28, cy + dy + 3); ctx.fill(); }
    env.label(sunText, p.x + w - 28, p.y + 18, { color: 'gold', size: 12, fade: f });
    // orbit and Earth
    ctx.strokeStyle = rgba(BLUE, 0.5 * f); ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = rgba('70,130,220', f); ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
    env.label(earthText, cx, cy + 22, { color: 'blue', size: 11, fade: f * 0.9 });
    // Moon: dark disc with its lit half toward the Sun (right-hand side)
    const mx = cx + R * Math.cos(th), my = cy - R * Math.sin(th);
    ctx.strokeStyle = rgba(WHITE, 0.4 * f); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my); ctx.stroke();
    ctx.strokeStyle = rgba(GOLD, 0.55 * f); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R + 4, cy); ctx.stroke();
    ctx.fillStyle = rgba('52,58,74', f); ctx.beginPath(); ctx.arc(mx, my, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = rgba('246,244,230', f); ctx.beginPath(); ctx.arc(mx, my, 6.5, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.5 * f); ctx.beginPath(); ctx.arc(mx, my, 7.2, 0, 7); ctx.stroke();
    // the angle at Earth
    if (th > 0.08 && th < 6.2) { ctx.strokeStyle = rgba(GOLD, f); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 17, -th, 0); ctx.stroke(); }
    const deg = Math.round(angle() % 360), mid = th / 2;
    const lx = th < 0.9 ? cx + 24 : cx + 27 * Math.cos(mid), ly = th < 0.9 ? cy + 13 : cy - 27 * Math.sin(mid);
    env.label(`${deg}°`, lx, ly, { color: 'gold', size: 13, fade: f });
    if (day) env.label(day(), p.x + 12, p.y + h - 14, { color: 'white', size: 11.5, fade: f * 0.9, align: 'left' });
    ctx.restore();
  };
}

/** A time chart: a signed value (degrees from the Sun) over a number of days, drawn up to progress() (0..1) with a dot at the end.
 *  series = [{t, v}], span = max |v| shown. The upper half is the evening sky (east of the Sun), the lower half the morning sky. */
export function elongationChart({ series, progress, span = 50, topText, bottomText, sunText, valueText, mark }) {
  return (ctx, env) => {
    const f = env.fade, w = Math.min(env.W - 24, 380), h = 132, p = place(ctx, env, w, h), x0 = p.x + 14, x1 = p.x + w - 14, ym = p.y + h / 2, k = (h / 2 - 26) / span;
    panel(ctx, p.x, p.y, w, h, f);
    ctx.strokeStyle = rgba(GOLD, 0.7 * f); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, ym); ctx.lineTo(x1, ym); ctx.stroke();
    env.label(sunText, x1 - 2, ym - 8, { color: 'gold', size: 11, fade: f, align: 'right' });
    env.label(topText, x0, p.y + 12, { color: 'blue', size: 11, fade: f * 0.9, align: 'left' });
    env.label(bottomText, x0, p.y + h - 11, { color: 'blue', size: 11, fade: f * 0.9, align: 'left' });
    const n = series.length, X = (i) => x0 + (x1 - x0) * i / (n - 1), Y = (v) => ym - v * k, cur = Math.max(0, Math.min(n - 1, progress() * (n - 1)));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, a, lw, upto] of [[BLUE, 0.28, 1.4, n - 1], [WHITE, 0.95, 2.6, cur]]) {
      ctx.strokeStyle = rgba(col, a * f); ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i <= Math.floor(upto); i++) { const x = X(i), y = Y(series[i].v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      if (upto % 1 > 0 && upto < n - 1) { const i = Math.floor(upto), t = upto - i, v = series[i].v + (series[i + 1].v - series[i].v) * t; ctx.lineTo(X(i + t), Y(v)); }
      ctx.stroke();
    }
    const i = Math.floor(cur), t = cur - i, v = i >= n - 1 ? series[n - 1].v : series[i].v + (series[i + 1].v - series[i].v) * t, dx = X(cur), dy = Y(v);
    ctx.fillStyle = rgba(GOLD, f); ctx.strokeStyle = rgba(INK, 0.6 * f); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(dx, dy, 6, 0, 7); ctx.fill(); ctx.stroke();
    const vt = valueText ? valueText(v) : '';
    if (vt) env.label(vt, dx + (dx < (x0 + x1) / 2 ? 24 : -24), dy, { color: 'gold', size: 12.5, fade: f });
    if (mark) mark(ctx, env, { X, Y, cur, ym, p });
    ctx.restore();
  };
}

/** The Moon's height above or below the Sun's path at successive full Moons. items = [{lat, text, eclipsed}], shown() = how many dots are drawn. */
export function eclipseChart({ items, shown, band = 1.3, range = 6.5, sunText, shadowText, nowIndex, note }) {
  return (ctx, env) => {
    const f = env.fade, w = Math.min(env.W - 24, 380), h = 136, p = place(ctx, env, w, h), x0 = p.x + 104, x1 = p.x + w - 24, ym = p.y + 70, k = 44 / range, n = items.length;
    panel(ctx, p.x, p.y, w, h, f);
    // Earth's shadow: a band along the Sun's path
    ctx.fillStyle = rgba(GOLD, 0.16 * f); ctx.fillRect(p.x + 10, ym - band * k, w - 20, 2 * band * k);
    ctx.strokeStyle = rgba(GOLD, 0.8 * f); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x + 10, ym); ctx.lineTo(p.x + w - 10, ym); ctx.stroke();
    env.label(sunText, p.x + 12, ym + 12, { color: 'gold', size: 10.5, fade: f * 0.95, align: 'left' });
    env.label(shadowText, p.x + 12, ym - 12, { color: 'gold', size: 10.5, fade: f * 0.95, align: 'left' });
    const X = (i) => x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), Y = (v) => ym - Math.max(-range, Math.min(range, v)) * k, m = Math.min(n, Math.floor(shown() + 1e-6));
    ctx.strokeStyle = rgba(WHITE, 0.4 * f); ctx.lineWidth = 1.4;
    ctx.beginPath(); for (let i = 0; i < m; i++) { if (i === 0) ctx.moveTo(X(i), Y(items[i].lat)); else ctx.lineTo(X(i), Y(items[i].lat)); } ctx.stroke();
    for (let i = 0; i < m; i++) {
      const it = items[i], x = X(i), y = Y(it.lat), hit = !!it.eclipsed;
      ctx.fillStyle = rgba(hit ? GOLD : WHITE, f); ctx.strokeStyle = rgba(INK, 0.6 * f); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, hit ? 7 : 5.5, 0, 7); ctx.fill(); ctx.stroke();
      if (hit) { ctx.strokeStyle = rgba(GOLD, f); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke(); }
      env.label(it.text, x, p.y + h - 10, { color: hit ? 'gold' : 'blue', size: 10.5, fade: f * (hit ? 1 : 0.85) });
      if (i === m - 1) env.label(note ? note(i) : '', Math.max(x0 + 18, Math.min(x1 - 18, x)), y + (it.lat >= 0 ? -17 : 17), { color: hit ? 'gold' : 'white', size: 12, fade: f });
    }
    ctx.restore();
  };
}
