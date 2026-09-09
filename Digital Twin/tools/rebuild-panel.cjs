/* Rebuild Panel.glb from the pristine original:
 *   1. Bulbs + holders re-spaced from 4 rows to 5 (8 cols x 5 rows = 40),
 *      keeping the outer rows where they are so nothing leaves the sheet.
 *   2. One material per bulb: MAT_LAMP_01_BULB .. MAT_LAMP_40_BULB, row-major.
 *   3. Perforated back sheet decimated.
 *
 * Usage: node tools/rebuild-panel.cjs <in.glb> <out.glb> [--rows 5] [--sheet-ratio 0.02] [--flip-rows]
 */
const { NodeIO, PropertyType } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { draco, prune, dedup } = require('@gltf-transform/functions');
const { MeshoptSimplifier } = require('meshoptimizer');
const draco3d = require('draco3dgltf');

const IN = process.argv[2], OUT = process.argv[3];
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > -1 ? parseFloat(process.argv[i + 1]) : def; };
const ROWS = arg('--rows', 5);
const SHEET_RATIO = arg('--sheet-ratio', 0.02);
const FLIP_ROWS = process.argv.includes('--flip-rows');

const BULB_MESH = 'Cylinder.001';
const HOLDER_MESH = 'Cylinder.253';
const SHEET_MESH = 'BODY_PERFORATED_SHEET_REAL_MESH.001';

/* ── connected components, welded by position ── */
function components(prim) {
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

  const g = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const r = find(indices[t]);
    if (!g.has(r)) g.set(r, { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
    const c = g.get(r); c.tris.push(indices[t], indices[t + 1], indices[t + 2]);
    for (let k = 0; k < 3; k++) {
      pos.getElement(indices[t + k], p);
      for (let d = 0; d < 3; d++) { if (p[d] < c.min[d]) c.min[d] = p[d]; if (p[d] > c.max[d]) c.max[d] = p[d]; }
    }
  }
  return [...g.values()].map(c => ({
    tris: c.tris,
    x: (c.min[0] + c.max[0]) / 2, y: (c.min[1] + c.max[1]) / 2, z: (c.min[2] + c.max[2]) / 2,
  }));
}

const cluster = (vals, tol) => {
  const o = []; vals.slice().sort((a, b) => a - b).forEach(v => { if (!o.length || Math.abs(v - o[o.length - 1]) > tol) o.push(v); }); return o;
};
const nearest = (arr, v) => arr.reduce((bi, _, i) => Math.abs(arr[i] - v) < Math.abs(arr[bi] - v) ? i : bi, 0);

/* Build a fresh primitive from a component, translated by dz along local Z. */
function makePrim(doc, buf, srcPrim, comp, dz, material) {
  const semantics = srcPrim.listSemantics();
  const used = [...new Set(comp.tris)];
  const remap = new Map(used.map((v, i) => [v, i]));
  const prim = doc.createPrimitive();
  for (const sem of semantics) {
    const a = srcPrim.getAttribute(sem);
    const size = a.getElementSize();
    const out = new Float32Array(used.length * size);
    const tmp = new Array(size).fill(0);
    used.forEach((vi, i) => {
      a.getElement(vi, tmp);
      if (sem === 'POSITION') tmp[2] += dz;
      out.set(tmp, i * size);
    });
    prim.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(out).setBuffer(buf));
  }
  prim.setIndices(doc.createAccessor().setType('SCALAR')
    .setArray(new Uint32Array(comp.tris.map(v => remap.get(v)))).setBuffer(buf));
  if (material) prim.setMaterial(material);
  return prim;
}

(async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  await MeshoptSimplifier.ready;

  const doc = await io.read(IN);
  const root = doc.getRoot();
  const buf = root.listBuffers()[0];

  /* ── plan the new row positions from the BULB mesh ── */
  const bulbMesh = root.listMeshes().find(m => m.getName() === BULB_MESH);
  const bulbPrims = bulbMesh.listPrimitives();
  const bulbComps = bulbPrims.map(components);
  const cols = cluster(bulbComps[0].map(c => c.x), 0.01).length;
  const srcRowZ = bulbPrims.map((_, i) => cluster(bulbComps[i].map(c => c.z), 0.05));
  const srcRows = srcRowZ[0].length;
  console.log(`source: ${cols} cols x ${srcRows} rows = ${cols * srcRows} bulbs`);

  // keep the outer rows fixed; redistribute ROWS evenly between them
  const planRows = zs => {
    const lo = zs[0], hi = zs[zs.length - 1], pitch = (hi - lo) / (ROWS - 1);
    return Array.from({ length: ROWS }, (_, i) => lo + i * pitch);
  };
  const bulbTargetZ = planRows(srcRowZ[0]);
  console.log(`target rows (local Z): ${bulbTargetZ.map(v => v.toFixed(3)).join(', ')}  pitch=${(bulbTargetZ[1] - bulbTargetZ[0]).toFixed(4)} (was ${(srcRowZ[0][1] - srcRowZ[0][0]).toFixed(4)})`);

  const nLamps = cols * ROWS;
  const baseBulbMat = bulbPrims[0].getMaterial();
  const mats = Array.from({ length: nLamps }, (_, i) =>
    baseBulbMat.clone().setName(`MAT_LAMP_${String(i + 1).padStart(2, '0')}_BULB`));

  /* ── rebuild bulbs: instance the template row into ROWS rows ── */
  for (const [pi, prim] of bulbPrims.entries()) {
    const comps = bulbComps[pi];
    const rowsZ = srcRowZ[pi];
    const xs = cluster(comps.map(c => c.x), 0.01);
    const templateZ = rowsZ[0];
    const template = comps.filter(c => Math.abs(c.z - templateZ) < 0.05);
    if (template.length !== cols) throw new Error(`template row has ${template.length} components, expected ${cols}`);

    const targetZ = planRows(rowsZ);
    for (let r = 0; r < ROWS; r++) {
      for (const comp of template) {
        const col = nearest(xs, comp.x);
        const rowIdx = FLIP_ROWS ? (ROWS - 1 - r) : r;
        bulbMesh.addPrimitive(makePrim(doc, buf, prim, comp, targetZ[r] - templateZ, mats[rowIdx * cols + col]));
      }
    }
    bulbMesh.removePrimitive(prim); prim.dispose();
  }
  baseBulbMat.dispose();
  console.log(`bulbs: ${bulbMesh.listPrimitives().length} primitives, ${nLamps} materials`);

  /* ── rebuild holders the same way (single shared material, so merge per row) ── */
  const holderMesh = root.listMeshes().find(m => m.getName() === HOLDER_MESH);
  if (holderMesh) {
    const hPrims = holderMesh.listPrimitives();
    for (const prim of hPrims) {
      const comps = components(prim);
      const rowsZ = cluster(comps.map(c => c.z), 0.05);
      // holders may model each unit as sub-parts at close Z; collapse to true rows
      const trueRows = cluster(rowsZ, 0.05);
      const rowsUsed = trueRows.length >= srcRows ? trueRows.slice(0, srcRows) : trueRows;
      const templateZ = rowsUsed[0];
      const template = comps.filter(c => Math.abs(c.z - templateZ) < 0.05);
      const targetZ = planRows(rowsUsed);
      /* Holders all share one material, and each unit splits into many
         sub-components, so emitting one primitive per component gives 400
         draw calls. Merge the whole template row into a single component
         and emit one primitive per row instead. */
      const mat = prim.getMaterial();
      const rowComp = { tris: template.flatMap(c => c.tris) };
      for (let r = 0; r < ROWS; r++) {
        holderMesh.addPrimitive(makePrim(doc, buf, prim, rowComp, targetZ[r] - templateZ, mat));
      }
      holderMesh.removePrimitive(prim); prim.dispose();
    }
    console.log(`holders: ${holderMesh.listPrimitives().length} primitives`);
  }

  /* ── decimate the perforated sheet (targeted; see build-glb.cjs notes) ── */
  const sheet = root.listMeshes().find(m => m.getName() === SHEET_MESH);
  if (sheet) {
    for (const prim of sheet.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
      const before = idx.getCount() / 3, nv = pos.getCount();
      const positions = new Float32Array(nv * 3); const p = [0, 0, 0];
      for (let i = 0; i < nv; i++) { pos.getElement(i, p); positions.set(p, i * 3); }
      const key2new = new Map(); const old2new = new Uint32Array(nv); const wPos = [];
      for (let i = 0; i < nv; i++) {
        const k = `${positions[i * 3].toFixed(5)},${positions[i * 3 + 1].toFixed(5)},${positions[i * 3 + 2].toFixed(5)}`;
        let n = key2new.get(k);
        if (n === undefined) { n = wPos.length / 3; key2new.set(k, n); wPos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); }
        old2new[i] = n;
      }
      const wPositions = new Float32Array(wPos);
      const src = idx.getArray(); const wIndices = new Uint32Array(src.length);
      for (let i = 0; i < src.length; i++) wIndices[i] = old2new[src[i]];
      const target = Math.max(192, Math.floor(before * SHEET_RATIO) * 3);
      const [used, err] = MeshoptSimplifier.simplify(wIndices, wPositions, 3, target, 0.05, ['LockBorder']);
      const newPos = doc.createAccessor().setType('VEC3').setArray(wPositions).setBuffer(buf);
      for (const sem of prim.listSemantics()) {
        if (sem === 'POSITION') continue;
        const a = prim.getAttribute(sem), size = a.getElementSize();
        const out = new Float32Array((wPositions.length / 3) * size); const tmp = new Array(size).fill(0);
        for (let i = 0; i < nv; i++) { a.getElement(i, tmp); out.set(tmp, old2new[i] * size); }
        prim.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(out).setBuffer(buf));
      }
      prim.setAttribute('POSITION', newPos);
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(used)).setBuffer(buf));
      console.log(`sheet: ${before.toLocaleString()} -> ${(used.length / 3).toLocaleString()} tris (err=${(err ?? 0).toFixed(4)})`);
    }
  }

  /* dedup/prune must not touch materials — the per-bulb clones are identical
     by design and a default dedup() merges them back into one. */
  await doc.transform(
    prune({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.BUFFER, PropertyType.TEXTURE] }),
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
    draco(),
  );

  await io.write(OUT, doc);
  const fs = require('fs');
  const names = root.listMaterials().map(m => m.getName());
  console.log(`\nmaterials: ${names.length} (${names.filter(n => /_BULB$/.test(n)).length} bulbs)`);
  console.log(`wrote ${OUT}  ${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB`);
})();
