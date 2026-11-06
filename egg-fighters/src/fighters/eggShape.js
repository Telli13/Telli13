/* The egg profile shared by the body, the chocolate shells (Phase 3) and the costume pieces
 * that wrap around the egg (bands, helmet, armour). Units: metres, egg centre at y = 0.
 */
'use strict';

(() => {
  const R = 0.62;   // widest radius
  const H = 0.82;   // half height

  /** t = 0 bottom … 1 top → { y, r }; slightly wider at the bottom like a real egg */
  function profile(t) {
    const a = t * Math.PI;
    const c = Math.cos(a), s = Math.sin(a);
    return { y: -c * H, r: Math.max(0, s * R * (1 + 0.1 * c)) };
  }

  /** inverse lookup: parameter t for a height y (profile y is monotonic in t) */
  function tAtY(y) {
    return Math.acos(EF.M.clamp(-y / H, -1, 1)) / Math.PI;
  }

  function radiusAt(y) { return profile(tAtY(y)).r; }

  /** a point on the egg surface: height y, angle phi around (phi = 0 is the front, +z) */
  function surfacePoint(y, phi, scale = 1) {
    const r = radiusAt(y) * scale;
    return new THREE.Vector3(Math.sin(phi) * r, y * scale, Math.cos(phi) * r);
  }

  /** profile points (Vector2: x = radius, y = height) between heights y0 < y1 */
  function points(y0, y1, n, scale = 1) {
    const t0 = tAtY(y0), t1 = tAtY(y1), pts = [];
    for (let i = 0; i <= n; i++) {
      const p = profile(t0 + (t1 - t0) * (i / n));
      pts.push(new THREE.Vector2(p.r * scale, p.y * scale));
    }
    return pts;
  }

  /** the whole egg as a smooth lathe */
  function eggGeometry(scale = 1, segments = 40) {
    const g = new THREE.LatheGeometry(points(-H, H, 32, scale), segments);
    g.computeVertexNormals();
    return g;
  }

  /** a solid band hugging the egg between y0 and y1 (outer scale so, inner scale si) */
  function bandGeometry(y0, y1, so = 1.05, si = 0.99, phiStart = 0, phiLength = Math.PI * 2, segments = 40) {
    const outer = points(y0, y1, 10, so);
    const inner = points(y0, y1, 10, si).reverse();
    const pts = outer.concat(inner);
    pts.push(outer[0].clone());
    const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
    g.computeVertexNormals();
    return g;
  }

  EF.egg = { R, H, profile, tAtY, radiusAt, surfacePoint, points, eggGeometry, bandGeometry };
})();
