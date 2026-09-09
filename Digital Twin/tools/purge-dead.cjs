/* Remove the unreachable legacy Tab-3 engine from script.js.
   Blocks are located by an anchor regex and ended by balanced brace/bracket
   matching, so partial deletions are impossible. Anything not found is
   reported rather than silently skipped. */
const fs = require('fs');
const FILE = process.argv[2] || 'script.js';
let lines = fs.readFileSync(FILE, 'utf8').split('\n');

/* top-level declarations to remove whole */
const BLOCKS = [
  /^function updateSimModel2Material\s*\(/,
  /^function jumpSimTime\s*\(/,
  /^const SCENARIOS = \[/,
  /^function simReset\s*\(/,
  /^function simTick\s*\(/,
  /^function simRun\s*\(/,
  /^function simPause\s*\(/,
  /^function buildScenarioCards\s*\(/,
  /^function loadScenario\s*\(/,
  /^function openScenarioPanel\s*\(/,
  /^function closeScenarioPanel\s*\(/,
  /^function setTimeScale\s*\(/,
  /^async function fetchHistoryForSim\s*\(/,
  /^function extractHistoricalScenarios\s*\(/,
];

/* single lines to remove (calls / listeners / dead element handles) */
const SINGLES = [
  /^\s*buildScenarioCards\(\);/,
  /^\s*fetchHistoryForSim\(\);/,
  /^\s*openScenarioPanel\(\);/,
  /^\s*setTimeScale\(2\);/,
  /^\s*scenarioOpenBtn\?\.addEventListener/,
  /^\s*scenarioCloseBtn\?\.addEventListener/,
  /^\s*tsbSlider\?\.addEventListener/,
  /^\s*tsbPresets\.forEach/,
  /^\s*if \(tsbJump1k\)/,
  /^\s*if \(tsbJump5k\)/,
  /^const scenarioPanel = /,
  /^const scenarioOpenBtn = /,
  /^const scenarioCloseBtn = /,
  /^const simLayoutEl = /,
  /^const tsbSlider = /,
  /^const tsbDisplay = /,
  /^const tsbPresets = /,
  /^const tsbJump1k = /,
  /^const tsbJump5k = /,
  /^const sim2WattSlider = /,
  /^const sim2WattVal = /,
  /^const sim2StateBadge = /,
  /^const sim2ModeLabel = /,
  /^const sim2PowerOverlay = /,
  /^const sim2TempVal = /,
  /^const sim2EffVal = /,
  /^const sim2LumenVal = /,
  /^const sim2AmbientSlider = /,
  /^const sim2AmbientVal = /,
  /^const sim2ToggleBtn = /,
  /^const simModel = /,
  /^const TIME_SCALE_STEPS = /,
];

function endOfBlock(startIdx) {
  let depth = 0, seen = false;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{' || ch === '[') { depth++; seen = true; }
      else if (ch === '}' || ch === ']') depth--;
    }
    if (seen && depth === 0) return i;
  }
  return -1;
}

const removed = [];
let missing = [];

for (const re of BLOCKS) {
  const idx = lines.findIndex(l => re.test(l));
  if (idx < 0) { missing.push(re.source); continue; }
  const end = endOfBlock(idx);
  if (end < 0) { missing.push(re.source + ' (unbalanced)'); continue; }
  removed.push({ what: lines[idx].trim().slice(0, 52), lines: end - idx + 1 });
  lines.splice(idx, end - idx + 1);
}

let singleCount = 0;
for (const re of SINGLES) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (re.test(lines[i])) { lines.splice(i, 1); singleCount++; }
  }
}

const out = lines.join('\n').replace(/\n{4,}/g, '\n\n\n');
fs.writeFileSync(FILE, out);

console.log('REMOVED BLOCKS:');
removed.forEach(r => console.log(`  ${String(r.lines).padStart(4)} lines  ${r.what}`));
console.log(`\nsingle lines removed: ${singleCount}`);
console.log(`total block lines removed: ${removed.reduce((a, r) => a + r.lines, 0)}`);
if (missing.length) console.log('\nNOT FOUND (check manually):\n  ' + missing.join('\n  '));
