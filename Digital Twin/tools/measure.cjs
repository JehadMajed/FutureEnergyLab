/* World-space bounds of each node, to work out where a 5th bulb row belongs. */
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { getBounds } = require('@gltf-transform/functions');
const draco3d = require('draco3dgltf');

(async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const doc = await io.read(process.argv[2]);
  const scene = doc.getRoot().listScenes()[0];

  const f = v => v.map(x => x.toFixed(3)).join(', ');
  console.log('=== WORLD-SPACE BOUNDS ===');
  const walk = (node, depth = 0) => {
    const b = getBounds(node);
    const size = b.max.map((v, i) => v - b.min[i]);
    console.log(`${'  '.repeat(depth)}${(node.getName() || '(unnamed)').padEnd(30)} min[${f(b.min)}]  max[${f(b.max)}]  size[${f(size)}]`);
    node.listChildren().forEach(c => walk(c, depth + 1));
  };
  scene.listChildren().forEach(n => walk(n));

  const sb = getBounds(scene);
  console.log(`\nSCENE  min[${f(sb.min)}]  max[${f(sb.max)}]  size[${f(sb.max.map((v, i) => v - sb.min[i]))}]`);
})();
