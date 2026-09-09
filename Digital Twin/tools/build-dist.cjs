/* Assemble a clean Cloudflare Pages asset directory.
 *
 * Why this exists: wrangler.toml previously set pages_build_output_dir = "./",
 * which makes the WHOLE project folder the deploy payload. That would publish
 * .dev.vars (Home Assistant token + three sets of MQTT credentials), the
 * .wrangler cache including wrangler-account.json, 54 MB of node_modules, the
 * 9.4 MB superseded Panel_original.glb, and every .bak copy of the source.
 * .gitignore does not help here: it governs Git, not direct uploads.
 *
 * Only the files the browser actually requests are copied. history.json and
 * real_analytics.json stay at the project root as well, because the Pages
 * Functions import them at build time (functions/api/*.js).
 *
 * Usage: node tools/build-dist.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

/* Every local asset referenced by index.html, plus history.json which
   script.js fetches directly for the model back-test. */
const ASSETS = [
  'index.html',
  'script.js',
  'style.css',
  'Panel.glb',
  'psau-logo.png',
  'history.json',
];

/* Anything matching these must never reach the deploy directory. */
const FORBIDDEN = [/^\.dev\.vars$/, /^\.wrangler$/, /^node_modules$/, /\.bak\d*$/,
                   /^Panel_original\.glb$/, /\.bat$/, /^tools$/, /\.log$/];

/* Empty the directory rather than removing it: on Windows a process with the
   directory as its cwd (a dev server, an open shell) holds a lock and rmSync
   fails with EPERM, which would break the build for no good reason. */
fs.mkdirSync(DIST, { recursive: true });
for (const entry of fs.readdirSync(DIST)) {
  fs.rmSync(path.join(DIST, entry), { recursive: true, force: true });
}

let total = 0;
const copied = [];
for (const name of ASSETS) {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) { console.error('MISSING: ' + name); process.exit(1); }
  fs.copyFileSync(src, path.join(DIST, name));
  const kb = fs.statSync(src).size / 1024;
  total += kb;
  copied.push({ name, kb });
}

/* Verify nothing forbidden slipped in. */
const leaked = fs.readdirSync(DIST).filter(f => FORBIDDEN.some(re => re.test(f)));
if (leaked.length) { console.error('FORBIDDEN FILES IN dist/: ' + leaked.join(', ')); process.exit(1); }

console.log('dist/ contents:');
copied.forEach(c => console.log('  ' + c.kb.toFixed(0).padStart(6) + ' KB  ' + c.name));
console.log('  ' + '-'.repeat(30));
console.log('  ' + total.toFixed(0).padStart(6) + ' KB  total (' + (total / 1024).toFixed(2) + ' MB)');
console.log('\nsecrets check: .dev.vars in dist/? ' +
  (fs.existsSync(path.join(DIST, '.dev.vars')) ? 'YES — ABORT' : 'no'));
