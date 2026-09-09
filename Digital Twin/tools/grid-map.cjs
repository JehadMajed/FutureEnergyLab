/* Map the bulb grid: full centroid list + inferred rows/cols, for both primitives. */
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const draco3d = require('draco3dgltf');

(async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const doc = await io.read(process.argv[2]);
  const mesh = doc.getRoot().listMeshes().find(m => m.getName() === (process.env.MESH||'Cylinder.001'));

  const all = [];
  for (const [pi, prim] of mesh.listPrimitives().entries()) {
    const pos = prim.getAttribute('POSITION');
    const indices = prim.getIndices().getArray();
    const n = pos.getCount();

    const key2rep = new Map(); const rep = new Int32Array(n); const p = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      pos.getElement(i, p);
      const k = `${p[0].toFixed(5)},${p[1].toFixed(5)},${p[2].toFixed(5)}`;
      if (!key2rep.has(k)) key2rep.set(k, i);
      rep[i] = key2rep.get(k);
    }
    const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
    const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    for (let i = 0; i < n; i++) if (rep[i] !== i) union(rep[i], i);
    for (let t = 0; t < indices.length; t += 3) { union(indices[t], indices[t + 1]); union(indices[t + 1], indices[t + 2]); }

    const comps = new Map();
    for (let t = 0; t < indices.length; t += 3) {
      const r = find(indices[t]);
      if (!comps.has(r)) comps.set(r, { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], tris: 0 });
      const c = comps.get(r); c.tris++;
      for (let k = 0; k < 3; k++) { pos.getElement(indices[t + k], p); for (let d = 0; d < 3; d++) { if (p[d] < c.min[d]) c.min[d] = p[d]; if (p[d] > c.max[d]) c.max[d] = p[d]; } }
    }
    [...comps.values()].forEach(c => all.push({
      prim: pi, tris: c.tris,
      x: (c.min[0] + c.max[0]) / 2, y: (c.min[1] + c.max[1]) / 2, z: (c.min[2] + c.max[2]) / 2,
      size: [c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]],
    }));
  }

  const uniq = (vals, tol = 0.01) => {
    const out = [];
    vals.slice().sort((a, b) => a - b).forEach(v => { if (!out.length || Math.abs(v - out[out.length - 1]) > tol) out.push(v); });
    return out;
  };

  for (const pi of [0, 1]) {
    const s = all.filter(c => c.prim === pi);
    const xs = uniq(s.map(c => c.x)), ys = uniq(s.map(c => c.y)), zs = uniq(s.map(c => c.z));
    console.log(`\n=== prim${pi}: ${s.length} components ===`);
    console.log(`distinct X (${xs.length}): ${xs.map(v => v.toFixed(3)).join(' ')}`);
    console.log(`distinct Y (${ys.length}): ${ys.map(v => v.toFixed(3)).join(' ')}`);
    console.log(`distinct Z (${zs.length}): ${zs.map(v => v.toFixed(3)).join(' ')}`);
    console.log(`=> grid ${xs.length} x ${zs.length} = ${xs.length * zs.length}`);
    console.log(`component bbox size: ${s[0].size.map(v => v.toFixed(4)).join(' x ')}`);
  }

  // pair prim0 <-> prim1 components by nearest XY
  const a0 = all.filter(c => c.prim === 0), a1 = all.filter(c => c.prim === 1);
  let maxd = 0;
  a0.forEach(c => {
    let best = 1e9;
    a1.forEach(d => { const dd = Math.hypot(c.x - d.x, c.y - d.y); if (dd < best) best = dd; });
    if (best > maxd) maxd = best;
  });
  console.log(`\nprim0<->prim1 pairing: worst XY distance = ${maxd.toFixed(5)} (small => two parts of the same bulb)`);
})();
