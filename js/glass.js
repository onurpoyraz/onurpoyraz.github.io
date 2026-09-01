/* ============================================================
   glass.js — the material layer

   Two jobs:
     1. Specular tracking. Every .glass element gets --mx/--my so its
        highlight follows the pointer, the way a real lens catches a
        light source as you move past it.
     2. The hero forecast. A live posterior: sample paths that agree
        on the left of the "now" line and fan into a widening credible
        band on the right. Drawn at half resolution — it sits behind
        a mask and a blur, so nobody can tell, and it costs half as
        much to paint.

   Both no-op under prefers-reduced-motion: the canvas still draws,
   it just stops advancing.
   ============================================================ */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. Specular tracking ---------- */
  (function specular() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    let pending = false;
    let px = 0, py = 0;

    function paint() {
      pending = false;
      for (const el of document.querySelectorAll('.glass')) {
        const r = el.getBoundingClientRect();
        // Skip anything off screen — no point costing a layout read.
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        el.style.setProperty('--mx', ((px - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--my', ((py - r.top) / r.height) * 100 + '%');
      }
    }

    window.addEventListener('pointermove', (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!pending) {
        pending = true;
        requestAnimationFrame(paint);
      }
    }, { passive: true });
  })();

  /* ---------- 2. Hero forecast canvas ---------- */
  (function forecast() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const SCALE = 0.5;             // half-res backing store
    const NOW = 0.42;              // x fraction where forecast begins
    const PATHS = 7;               // posterior sample paths
    let w = 0, h = 0, t = 0, raf = null;

    /** Read the live theme colors so the canvas re-tints with the page. */
    function palette() {
      const s = getComputedStyle(document.documentElement);
      return {
        c1: s.getPropertyValue('--c1').trim(),
        c2: s.getPropertyValue('--c2').trim(),
        c3: s.getPropertyValue('--c3').trim(),
        c4: s.getPropertyValue('--c4').trim()
      };
    }
    let pal = palette();

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * SCALE));
      h = Math.max(1, Math.round(r.height * SCALE));
      canvas.width = w;
      canvas.height = h;
      draw();
    }

    /** A smooth pseudo-GP path: a few incommensurate sines so it never
     *  visibly repeats. Before the "now" line every path collapses onto
     *  the same observed history; after it, the spread opens up. */
    function value(x, seed, time) {
      const wiggle =
        Math.sin(x * 3.1 + time * 0.7 + seed * 2.3) * 0.5 +
        Math.sin(x * 6.7 - time * 0.45 + seed * 5.1) * 0.28 +
        Math.sin(x * 1.6 + time * 0.31 + seed * 1.1) * 0.34;
      // Uncertainty is near-zero on the observed side and grows steeply
      // across the forecast horizon.
      const ahead = Math.max(0, (x - NOW) / (1 - NOW));
      const spread = 0.03 + Math.pow(ahead, 1.5) * 1.0;
      const observed = Math.sin(x * 2.4 + time * 0.5) * 0.34
                     + Math.sin(x * 5.3 - time * 0.8) * 0.08;
      return observed + wiggle * spread;
    }

    function pathPoints(seed, time) {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const x = i / 64;
        pts.push([x * w, h * 0.5 + value(x, seed, time) * h * 0.3]);
      }
      return pts;
    }

    function stroke(pts, color, width, alpha) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function draw() {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      // Credible band: the envelope of the extreme sample paths.
      const hi = pathPoints(-3.2, t);
      const lo = pathPoints(3.2, t);
      ctx.beginPath();
      ctx.moveTo(hi[0][0], hi[0][1]);
      for (let i = 1; i < hi.length; i++) ctx.lineTo(hi[i][0], hi[i][1]);
      for (let i = lo.length - 1; i >= 0; i--) ctx.lineTo(lo[i][0], lo[i][1]);
      ctx.closePath();
      const band = ctx.createLinearGradient(0, 0, w, 0);
      band.addColorStop(0, pal.c2);
      band.addColorStop(NOW, pal.c1);
      band.addColorStop(1, pal.c3);
      ctx.fillStyle = band;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Posterior sample paths.
      for (let i = 0; i < PATHS; i++) {
        const seed = (i - (PATHS - 1) / 2) * 0.95;
        const pts = pathPoints(seed, t);
        stroke(pts, i % 2 ? pal.c1 : pal.c2, 1.2, 0.26);
      }

      // Posterior mean, drawn brighter — the number you would report.
      stroke(pathPoints(0, t), pal.c1, 2.6, 0.75);

      // The "now" boundary: everything left is observed, right is forecast.
      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      ctx.moveTo(w * NOW, h * 0.3);
      ctx.lineTo(w * NOW, h * 0.7);
      ctx.strokeStyle = pal.c4;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    function tick() {
      t += 0.006;
      draw();
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (raf || reduced.matches) return;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    // Only animate while the hero is actually on screen.
    const hero = canvas.closest('section');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });

    reduced.addEventListener('change', () => (reduced.matches ? stop() : start()));

    // Re-read the palette whenever the theme attribute flips.
    new MutationObserver(() => {
      pal = palette();
      draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(resize, 150);
    });

    resize();
  })();
})();
