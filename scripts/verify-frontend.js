const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.resolve(__dirname, '..');
const htmlPath = path.join(baseDir, 'frontend', 'dist', 'index.html');
const cssPath = path.join(baseDir, 'frontend', 'dist', 'style.css');
const jsPath = path.join(baseDir, 'frontend', 'dist', 'app.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`Verification Failed: ${message}`);
    process.exit(1);
  }
}

assert(fs.existsSync(htmlPath), 'index.html must exist');
assert(fs.existsSync(cssPath), 'style.css must exist');
assert(fs.existsSync(jsPath), 'app.js must exist');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');

assert(cssContent.length > 100, 'style.css must have substantial styling');

try {
  new vm.Script(jsContent);
} catch (e) {
  assert(false, `app.js syntax error: ${e.message}`);
}

// Verify every document.getElementById("...") in app.js has a matching id="..." in index.html
const idMatches = [...jsContent.matchAll(/document\.getElementById\(["']([^"']+)["']\)/g)].map(m => m[1]);
const dynamicIds = new Set(['waveformPlayhead']); // Created dynamically inside initWaveform()
const missingIds = [];

for (const id of new Set(idMatches)) {
  if (dynamicIds.has(id)) continue;
  if (!htmlContent.includes(`id="${id}"`) && !htmlContent.includes(`id='${id}'`)) {
    missingIds.push(id);
  }
}

assert(missingIds.length === 0, `Missing HTML IDs referenced by app.js: ${missingIds.join(', ')}`);

for (const requiredId of ['urlInput', 'previewVideo', 'btnDownloadClip', 'clipCardsList', 'waveformContainer']) {
  assert(htmlContent.includes(`id="${requiredId}"`), `Required ID missing: ${requiredId}`);
}

console.log(`FRONTEND_VERIFIED_SUCCESS (checked ${new Set(idMatches).size} DOM bindings)`);
