// Field Shift build: inlines everything into one self-contained dist/index.html.
// Usage: node build.mjs
import fs from 'node:fs';
const rd = p => fs.readFileSync(p, 'utf8');
const ring = rd('tools/mn_ring.json');
let leafletCss = rd('node_modules/leaflet/dist/leaflet.css').replace(/url\(images\/[^)]+\)/g, 'none');
const leafletJs = rd('node_modules/leaflet/dist/leaflet.js').replace(/\/\/# sourceMappingURL=.*$/m, '');
const parts = {
  LEAFLET_CSS: leafletCss,
  APP_CSS: rd('src/styles.css'),
  LEAFLET_JS: leafletJs,
  DATA_JS: rd('src/data.js').replace('/*MN_RING*/[]', ring),
  I18N_JS: rd('src/i18n.js'),
  PROMPT_JS: rd('src/prompt.js'),
  APP_JS: rd('src/app.js')
};
let html = rd('src/index.html');
for (const [k, v] of Object.entries(parts)) {
  if (/<\/script/i.test(v) && k.endsWith('_JS')) throw new Error(k + ' contains a closing script tag');
  html = html.replace(`/*${k}*/`, () => v);
}
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
fs.copyFileSync('src/sw.js', 'dist/sw.js');
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
