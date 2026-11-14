/* ------------------------------------------------------------------
   Field Shift — application logic. Plain JS, no framework, no storage:
   all state lives in memory (see `state`). All text goes through t().
   ------------------------------------------------------------------ */
'use strict';

/* ---------- tiny DOM helpers (text is always set as text, never as HTML) ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
function build(el, attrs, kids) {
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const setKids = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
const h = (tag, attrs, ...kids) => build(document.createElement(tag), attrs, kids);
const s = (tag, attrs, ...kids) => build(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, kids);

/* ---------- state ---------- */
const state = {
  lang: 'mn',
  theme: (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
  view: 'flow',            // 'flow' | 'sources' | 'reviewers'
  step: 1, maxStep: 1,
  picking: 'A',            // which location the map is choosing: 'A' or 'B' (comparison)
  loc: null, locB: null,   // { lat, lon, custom? }
  climate: { A: null, B: null },   // { status:'loading'|'ok', kind:'embedded'|'live'|'fallback', data, site?, km?, date? }
  sg: null,                // SoilGrids: { key, status:'loading'|'ok'|'null'|'error', data? }
  answers: {}, priorities: [], prioritySkipped: false,
  ai: { text: '', parsed: null },
  advanced: false,
  mapOffline: false,
  swReady: false,
  verify: null
};

function t(key, vars) {
  let str = I18N[state.lang][key];
  if (str == null) str = I18N.en[key];
  if (str == null) return key;
  return vars ? str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : str;
}
const today = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fx = (v, d) => Number(v).toFixed(d);

/* ---------- geography ---------- */
function distKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
/* Is the point inside Mongolia? Ray casting on the Natural Earth ring, with a
   3 km tolerance so border towns (e.g. Altanbulag) are not rejected by map generalisation. */
function inMongolia(lat, lon) {
  const ring = MN_RING; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  if (inside) return { ok: true, near: false };
  const kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = 110.57;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][1] - lon) * kx, ay = (ring[j][0] - lat) * ky, bx = (ring[i][1] - lon) * kx, by = (ring[i][0] - lat) * ky;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const u = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    const d = Math.hypot(ax + u * dx, ay + u * dy);
    if (d < best) best = d;
  }
  return { ok: best <= 3, near: best <= 3 };
}
const placeName = p => (state.lang === 'mn' ? p.mn : p.en);
const presetNear = loc => PRESETS.find(p => distKm(loc.lat, loc.lon, p.lat, p.lon) <= 3) || null;
function nearestOf(list, loc) {
  let best = null;
  for (const p of list) { const d = distKm(loc.lat, loc.lon, p.lat, p.lon); if (!best || d < best.d) best = { p, d }; }
  return best;
}
function locLabel(loc) {
  if (loc.custom) return loc.custom;
  const pre = presetNear(loc); if (pre) return placeName(pre);
  const n = nearestOf(PLACES, loc);
  if (n.d <= 2) return placeName(n.p);
  if (n.d <= 250) return t('loc_near', { place: placeName(n.p), km: Math.round(n.d) });
  return t('coords_fmt', { lat: fx(loc.lat, 2), lon: fx(loc.lon, 2) });
}
const locCoords = loc => t('coords_fmt', { lat: fx(loc.lat, 4), lon: fx(loc.lon, 4) });

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

/* ---------- theme: radial reveal from the button, with safe fallbacks ---------- */
function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); }
function toggleTheme(btn) {
  const flip = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); renderTop(); };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof document.startViewTransition !== 'function' || reduce) { flip(); return; }
  const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  try {
    const tr = document.startViewTransition(flip);
    tr.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  } catch (e) { flip(); }
}

/* ---------- navigation ---------- */
function go(step, opts) {
  if (step > 1 && !state.loc) { toast(t('pick_first')); return; }
  state.view = 'flow'; state.step = step; state.maxStep = Math.max(state.maxStep, step);
  if (step !== 1) state.picking = 'A';
  if (step >= 3) { ensureClimate('A'); if (state.locB) ensureClimate('B'); ensureSoilGrids(); }
  render();
  if (!opts || opts.focus !== false) focusHeading();
}
function openView(v) { state.view = v; render(); focusHeading(); }
function focusHeading() {
  window.scrollTo(0, 0);
  const hd = $('#pre h1') || $('#view h1'); if (hd) hd.focus({ preventScroll: true });
}
function setLang(l) { if (state.lang === l) return; state.lang = l; render(); if (map) refreshMapLabels(); }
function clearAI() { state.ai = { text: '', parsed: null }; }

/* ---------- chrome: top bar, stepper, navbar, footer ---------- */
function renderTop() {
  document.documentElement.lang = state.lang;
  $('#skipLink').textContent = t('skip_link');
  const dark = state.theme === 'dark';
  const icon = dark
    ? s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('circle', { cx: 12, cy: 12, r: 4.2 }), s('path', { d: 'M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8' }))
    : s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z' }));
  $('#top').replaceChildren(h('div', { class: 'wrap' },
    h('div', { class: 'brand' }, h('b', null, 'Field Shift'), h('span', null, t('brand_tag'))),
    h('div', { class: 'tools' },
      h('div', { class: 'seg', role: 'group', 'aria-label': t('lang_label') },
        h('button', { type: 'button', id: 'lang-mn', lang: 'mn', 'aria-pressed': String(state.lang === 'mn'), onclick: () => setLang('mn') }, 'МОН'),
        h('button', { type: 'button', id: 'lang-en', lang: 'en', 'aria-pressed': String(state.lang === 'en'), onclick: () => setLang('en') }, 'ENG')),
      h('button', { type: 'button', id: 'themeBtn', class: 'iconbtn', 'aria-label': t(dark ? 'theme_to_light' : 'theme_to_dark'), title: t(dark ? 'theme_to_light' : 'theme_to_dark'), onclick: e => toggleTheme(e.currentTarget) }, icon))));
}
function renderStepper() {
  const nav = $('#stepper'); nav.setAttribute('aria-label', t('progress_label'));
  nav.hidden = state.view !== 'flow';
  const items = [1, 2, 3, 4, 5].map(n => {
    const cls = n === state.step ? 'cur' : (n < state.step ? 'done' : '');
    const reachable = n <= state.maxStep && !!state.loc || n === 1;
    return h('li', { class: cls },
      h('button', { type: 'button', disabled: !reachable, 'aria-current': n === state.step ? 'step' : null, onclick: () => go(n) },
        h('span', { class: 'dot', 'aria-hidden': 'true' }, n < state.step ? '✓' : n),
        h('span', null, h('span', { class: 'sr' }, t('step_of', { n }) + ': '), t('step' + n))));
  });
  nav.replaceChildren(h('div', { class: 'wrap' }, h('ol', null, items)));
}
function renderNavbar() {
  const bar = $('#navbar');
  if (state.view !== 'flow') { bar.hidden = true; return; }
  bar.hidden = false;
  const kids = [];
  if (state.step === 1 && state.picking === 'B') {
    kids.push(h('button', { type: 'button', class: 'btn', onclick: () => { state.picking = 'A'; go(3); } }, t('back')));
    kids.push(h('button', { type: 'button', class: 'btn primary', onclick: () => { if (!state.locB) { toast(t('pick_first')); return; } go(3); } }, t('next')));
  } else {
    if (state.step > 1) kids.push(h('button', { type: 'button', class: 'btn', id: 'backBtn', onclick: () => go(state.step - 1) }, t('back')));
    if (state.step < 5) kids.push(h('button', { type: 'button', class: 'btn primary', id: 'nextBtn', onclick: () => go(state.step + 1) }, t('next')));
  }
  bar.replaceChildren(h('div', { class: 'wrap' }, kids));
}
function renderFoot() {
  const other = state.lang === 'mn' ? 'en' : 'mn';
  $('#foot').replaceChildren(h('div', { class: 'wrap stack' },
    h('div', { class: 'stack-s', role: 'note' },
      h('strong', null, t('disclaimer_title')),
      h('p', null, t('disclaimer')),
      h('p', { class: 'other', lang: other }, I18N[other].disclaimer)),
    h('nav', { 'aria-label': t('nav_sources') },
      h('button', { type: 'button', class: 'linkbtn', id: 'navSources', onclick: () => openView('sources') }, t('nav_sources')),
      h('button', { type: 'button', class: 'linkbtn', id: 'navReviewers', onclick: () => openView('reviewers') }, t('nav_reviewers'))),
    h('p', { class: 'muted small' }, t('updated_line'))));
}
const confTag = kind => h('span', { class: 'tag ' + kind }, t('c_' + kind));
const confKey = () => h('div', { class: 'stack-s' }, h('span', { class: 'lbl small' }, t('conf_title')),
  h('div', { class: 'key' }, ['measured', 'modelled', 'estimated'].map(k => h('span', null, confTag(k), t('c_' + k + '_d')))));
const stepHead = (n, title, lead) => h('div', { class: 'wrap stack-s' },
  h('span', { class: 'eyebrow' }, t('step_of', { n })), h('h1', { tabindex: '-1' }, title), lead ? h('p', { class: 'lead' }, lead) : null);

function render() {
  document.title = 'Field Shift — ' + t('brand_tag');
  renderTop(); renderStepper(); renderFoot(); renderNavbar();
  const pre = $('#pre'), view = $('#view');
  pre.replaceChildren(); view.replaceChildren();
  const showMap = state.view === 'flow' && state.step === 1;
  $('#mapHost').hidden = !showMap;
  if (state.view === 'sources') return viewSources(view);
  if (state.view === 'reviewers') return viewReviewers(view);
  [step1, step2, step3, step4, step5][state.step - 1](pre, view);
  if (showMap) showMapNow();
}

/* =====================================================================
   STEP 1 — the map
   ===================================================================== */
let map = null, tiles = null, selMarker = null, selMarkerB = null, cellRect = null, presetMarkers = [];

function seasonKey() {
  const m = new Date().getMonth() + 1;
  if (m >= 11 || m <= 2) return 'season_winter';
  if (m <= 4) return 'season_prespring';
  if (m === 5) return 'season_may';
  if (m <= 7) return 'season_summer';
  if (m <= 9) return 'season_harvest';
  return 'season_autumn';
}
function initMap() {
  if (map || typeof L === 'undefined') return;
  map = L.map('map', { center: [46.9, 103.8], zoom: 5, minZoom: 4, maxZoom: 14, maxBounds: MN_BOUNDS, maxBoundsViscosity: 0.9, zoomSnap: 0.25 });
  map.attributionControl.setPrefix('Leaflet');
  tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 14, attribution: '© OpenStreetMap' }).addTo(map);
  let loaded = 0, failed = 0;
  tiles.on('tileload', () => { loaded++; if (state.mapOffline) { state.mapOffline = false; updateMapNote(); } });
  tiles.on('tileerror', () => { failed++; if (!loaded && failed >= 2 && !state.mapOffline) { state.mapOffline = true; updateMapNote(); } });
  L.polygon(MN_RING, { className: 'mk-border', weight: 2, fillOpacity: 0.07, interactive: false }).addTo(map);
  presetMarkers = PRESETS.map(p => {
    const mk = L.circleMarker([p.lat, p.lon], { className: 'mk-preset', radius: 8, weight: 2, fillOpacity: 1, bubblingMouseEvents: false }).addTo(map);
    mk.on('click', () => selectPoint(p.lat, p.lon));
    mk.bindTooltip(placeName(p), { direction: 'top', offset: [0, -6] });
    return mk;
  });
  map.on('click', e => selectPoint(e.latlng.lat, e.latlng.lng));
  map.fitBounds(MN_BOUNDS, { padding: [4, 4] });
}
function refreshMapLabels() { presetMarkers.forEach((mk, i) => mk.setTooltipContent(placeName(PRESETS[i]))); }
function showMapNow() {
  initMap(); $('#map').setAttribute('aria-label', t('map_label'));
  if (map) { map.invalidateSize(); drawSelection(false); }
  updateMapNote();
}
function updateMapNote() {
  const n = $('#mapNote'); if (!n) return;
  setKids(n,
    state.mapOffline ? h('p', { class: 'notice warn' }, t('map_offline')) : null,
    (state.loc || state.locB) ? h('p', { class: 'muted small' }, t('cell_scale')) : null);
}
function drawSelection(pan) {
  if (!map) return;
  const put = (loc, cur, cls) => {
    if (cur) cur.remove();
    return loc ? L.circleMarker([loc.lat, loc.lon], { className: cls, radius: 10, weight: 3, fillOpacity: 1, interactive: false }).addTo(map) : null;
  };
  selMarker = put(state.loc, selMarker, 'mk-sel');
  selMarkerB = put(state.locB, selMarkerB, 'mk-selb');
  if (cellRect) { cellRect.remove(); cellRect = null; }
  const loc = state.picking === 'B' ? state.locB : state.loc;
  if (loc) {
    cellRect = L.rectangle([[loc.lat - CELL.dLat / 2, loc.lon - CELL.dLon / 2], [loc.lat + CELL.dLat / 2, loc.lon + CELL.dLon / 2]],
      { className: 'mk-cell', weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(map);
    if (pan) map.setView([loc.lat, loc.lon], Math.max(map.getZoom(), 7));
  }
}
function selectPoint(lat, lon, custom) {
  const chk = inMongolia(lat, lon);
  if (!chk.ok) { toast(t('outside')); setSelMsg(t('outside')); return false; }
  const loc = { lat: +lat.toFixed(4), lon: +lon.toFixed(4), custom: custom || null, near: chk.near };
  if (state.picking === 'B') { state.locB = loc; state.climate.B = null; }
  else { state.loc = loc; state.climate.A = null; state.sg = null; clearAI(); state.maxStep = 1; }
  drawSelection(true); updateSelBar(); updateMapNote(); renderStepper();
  return true;
}
function setSelMsg(msg) { const el = $('#selMsg'); if (el) el.textContent = msg || ''; }
function updateSelBar() {
  const bar = $('#selBar'); if (!bar) return;
  const loc = state.picking === 'B' ? state.locB : state.loc;
  setKids(bar,
    h('span', { class: 'lbl small muted' }, t(state.picking === 'B' ? 'selected_b' : 'selected')),
    loc ? h('strong', null, locLabel(loc)) : h('strong', null, t('none_selected')),
    loc ? h('span', { class: 'num small muted' }, locCoords(loc)) : null,
    loc && loc.near ? h('span', { class: 'small' }, t('near_border')) : null);
  setSelMsg('');
}

/* place search: built-in list first, Nominatim only on request */
const norm = str => String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9а-яөү]+/g, ' ').trim();
const PLACE_INDEX = PLACES.map(p => norm([p.mn, p.en, p.aMn, p.aEn, p.alt || ''].join(' ')));
let lastNominatim = 0;
function searchPlaces(q) {
  const nq = norm(q); if (nq.length < 2) return [];
  return PLACES.filter((p, i) => PLACE_INDEX[i].includes(nq))
    .sort((a, b) => (norm(placeName(b)).startsWith(nq) - norm(placeName(a)).startsWith(nq)) || ((b.c ? 1 : 0) - (a.c ? 1 : 0))).slice(0, 8);
}
function updateResults(q, online) {
  const box = $('#results'); if (!box) return;
  const found = searchPlaces(q);
  const kids = found.map(p => {
    const aimag = state.lang === 'mn' ? p.aMn : p.aEn;
    return h('button', { type: 'button', class: 'result', onclick: () => { selectPoint(p.lat, p.lon); box.replaceChildren(); } },
      h('span', null, placeName(p)), h('small', null, p.c ? t('aimag_centre', { aimag }) : t('in_aimag', { aimag })));
  });
  if (online && online.status === 'ok') {
    online.items.forEach(it => kids.push(h('button', { type: 'button', class: 'result', onclick: () => { selectPoint(it.lat, it.lon, it.short); box.replaceChildren(); } },
      h('span', null, it.short), h('small', null, it.long + ' · OpenStreetMap'))));
  }
  if (norm(q).length >= 2) {
    if (!found.length && !(online && online.status === 'ok')) kids.push(h('p', { class: 'muted small' }, t('search_none')));
    if (online && online.status === 'wait') kids.push(h('p', { class: 'row small' }, h('span', { class: 'spinner' }), t('search_online_wait')));
    else if (online && online.status === 'fail') kids.push(h('p', { class: 'notice warn small' }, t('search_online_fail')));
    else if (online && online.status === 'none') kids.push(h('p', { class: 'muted small' }, t('search_online_none')));
    else if (!online) kids.push(h('button', { type: 'button', class: 'linkbtn', onclick: () => searchOnline(q) }, t('search_online')));
  }
  box.replaceChildren(...kids);
}
async function searchOnline(q) {
  updateResults(q, { status: 'wait' });
  const wait = 1100 - (Date.now() - lastNominatim);           // Nominatim policy: at most 1 request per second
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatim = Date.now();
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=mn&limit=5&accept-language=' + state.lang + '&q=' + encodeURIComponent(q);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    const items = (Array.isArray(rows) ? rows : []).map(r => ({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), short: String(r.name || r.display_name || '').slice(0, 60), long: String(r.display_name || '').slice(0, 120) }))
      .filter(it => isFinite(it.lat) && isFinite(it.lon) && it.short);
    updateResults(q, items.length ? { status: 'ok', items } : { status: 'none' });
  } catch (e) { updateResults(q, { status: 'fail' }); }
}
function goCoords() {
  const lat = parseFloat(String($('#latIn').value).replace(',', '.')), lon = parseFloat(String($('#lonIn').value).replace(',', '.'));
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { setSelMsg(t('coords_bad')); toast(t('coords_bad')); return; }
  selectPoint(lat, lon);
}
function step1(pre, view) {
  const pickingB = state.picking === 'B';
  pre.append(h('div', { class: 'wrap stack' },
    pickingB ? null : h('div', { class: 'notice season' }, h('div', { class: 'stack-s' },
      h('div', { class: 'row' }, h('strong', null, t('season_title')), h('span', { class: 'tag estimated' }, t('season_tag'))),
      h('p', null, t(seasonKey())))),
    h('div', { class: 'stack-s' },
      h('span', { class: 'eyebrow' }, t('step_of', { n: 1 })),
      h('h1', { tabindex: '-1' }, t(pickingB ? 's1_title_b' : 's1_title')),
      h('p', { class: 'lead' }, t('s1_help'))),
    h('div', { class: 'card selbar', id: 'selBar', 'aria-live': 'polite' }),
    h('p', { id: 'selMsg', class: 'small', role: 'alert', style: 'color:var(--danger);font-weight:700' })));
  view.append(h('div', { class: 'wrap stack' },
    h('div', { class: 'card stack' },
      h('div', { class: 'field' },
        h('label', { for: 'searchIn' }, t('search_label')),
        h('input', { class: 'input', id: 'searchIn', type: 'search', autocomplete: 'off', placeholder: t('search_ph'), oninput: e => updateResults(e.target.value), onkeydown: e => { if (e.key === 'Enter') { const f = searchPlaces(e.target.value)[0]; if (f) { selectPoint(f.lat, f.lon); $('#results').replaceChildren(); } } } })),
      h('div', { class: 'results', id: 'results', 'aria-live': 'polite' })),
    h('form', { class: 'card stack-s', onsubmit: e => { e.preventDefault(); goCoords(); } },
      h('span', { class: 'lbl' }, t('coords_label')),
      h('div', { class: 'coords' },
        h('div', { class: 'field' }, h('label', { for: 'latIn', class: 'small' }, t('lat')), h('input', { class: 'input num', id: 'latIn', inputmode: 'decimal', placeholder: '49.49', value: state.loc && !pickingB ? state.loc.lat : null })),
        h('div', { class: 'field' }, h('label', { for: 'lonIn', class: 'small' }, t('lon')), h('input', { class: 'input num', id: 'lonIn', inputmode: 'decimal', placeholder: '105.95', value: state.loc && !pickingB ? state.loc.lon : null })),
        h('button', { type: 'submit', class: 'btn' }, t('go')))),
    h('div', { class: 'card stack-s' },
      h('span', { class: 'lbl' }, t('presets_label')),
      h('div', { class: 'chips' }, PRESETS.map(p => h('button', { type: 'button', class: 'chip', onclick: () => selectPoint(p.lat, p.lon) }, placeName(p)))),
      h('p', { class: 'muted small' }, t('presets_help')))));
  updateSelBar();
}

/* =====================================================================
   STEP 2 — multiple-choice questions (no free text)
   ===================================================================== */
function icon(code) {
  const box = h('span', { class: 'ico', 'aria-hidden': 'true' });
  if (/^sq\d$/.test(code)) { const px = [10, 14, 19, 25, 31][+code[2] - 1]; box.append(h('i', { style: `width:${px}px;height:${px}px` })); }
  else if (/^slope\d$/.test(code)) { const d = ['M3 22H29', 'M3 25L29 15', 'M3 28L27 6'][+code[5]]; box.append(s('svg', { viewBox: '0 0 32 32' }, s('path', { d }))); }
  else box.textContent = code;
  return box;
}
const qTitle = q => t('q_' + q.id);
const optLabel = (q, v) => t('o_' + q.id + '_' + v);
function missingList() {
  return QUESTIONS.filter(q => q.rank ? state.priorities.length === 0 : (!state.answers[q.id] || state.answers[q.id] === 'skip')).map(qTitle);
}
function answerText(q) {
  if (q.rank) return state.priorities.length ? state.priorities.map((v, i) => `${i + 1}) ${optLabel(q, v)}`).join('  ') : t('not_answered');
  const v = state.answers[q.id];
  return v && v !== 'skip' ? optLabel(q, v) : t('not_answered');
}
function updateMissing() {
  const el = $('#missingNote'); if (!el) return;
  const miss = missingList();
  el.className = miss.length ? 'notice warn' : 'notice';
  el.textContent = miss.length ? t('missing_note', { list: miss.join(', ') }) : t('missing_none');
}
function rankOptions(q) {
  const kids = q.opts.map(([v, ic]) => {
    const pos = state.priorities.indexOf(v);
    return h('button', { type: 'button', class: 'opt', id: `q_${q.id}_${v}`, 'aria-pressed': String(pos >= 0), onclick: () => {
      if (pos >= 0) state.priorities.splice(pos, 1); else state.priorities.push(v);
      state.prioritySkipped = false; clearAI(); redrawRank(q);
    } }, icon(ic), h('span', null, optLabel(q, v)), pos >= 0 ? h('span', { class: 'rank' }, h('span', { class: 'sr' }, t('rank_n', { n: pos + 1 })), h('span', { 'aria-hidden': 'true' }, pos + 1)) : null);
  });
  kids.push(h('button', { type: 'button', class: 'opt skip', id: `q_${q.id}_skip`, 'aria-pressed': String(state.prioritySkipped), onclick: () => {
    state.prioritySkipped = !state.prioritySkipped; if (state.prioritySkipped) state.priorities = []; clearAI(); redrawRank(q);
  } }, icon('❔'), h('span', null, t('skip'))));
  return kids;
}
function redrawRank(q) {
  const box = $('#opts_' + q.id), active = document.activeElement && document.activeElement.id;
  box.replaceChildren(...rankOptions(q));
  if (active) { const el = document.getElementById(active); if (el) el.focus(); }
  updateMissing();
}
function step2(pre, view) {
  pre.append(stepHead(2, t('s2_title'), t('s2_help')));
  const sets = QUESTIONS.map(q => {
    let opts;
    if (q.rank) opts = rankOptions(q);
    else {
      const radio = (v, ic, cls) => h('label', { class: 'opt' + (cls || ''), for: `q_${q.id}_${v}` },
        h('input', { type: 'radio', name: 'q_' + q.id, id: `q_${q.id}_${v}`, value: v, checked: state.answers[q.id] === v, onchange: () => { state.answers[q.id] = v; clearAI(); updateMissing(); } }),
        icon(ic), h('span', null, v === 'skip' ? t('skip') : optLabel(q, v)));
      opts = q.opts.map(([v, ic]) => radio(v, ic));
      opts.push(radio('skip', '❔', ' skip'));
    }
    return h('fieldset', { class: 'card' }, h('legend', null, qTitle(q)),
      q.rank ? h('p', { class: 'muted small' }, t('q_priority_help')) : null,
      h('div', { class: 'opts', id: 'opts_' + q.id }, opts));
  });
  view.append(h('div', { class: 'wrap stack' }, sets, h('p', { id: 'missingNote', 'aria-live': 'polite' })));
  updateMissing();
}

/* =====================================================================
   CLIMATE — NASA POWER: embedded for the three reference points, live elsewhere
   ===================================================================== */
const POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const climateCache = new Map();
async function fetchPower(lat, lon) {
  const url = `${POWER_URL}?parameters=PRECTOTCORR,T2M_MIN,T2M,WS2M&community=AG&latitude=${lat}&longitude=${lon}&start=20010101&end=20251231&format=JSON`;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function percentile(values, p) {            // linear interpolation between ranked values
  const a = values.slice().sort((x, y) => x - y), i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
/* Turns a raw POWER daily response into the summary the app shows.
   Definitions are listed for reviewers under "How this works". */
function computeClimate(json) {
  const par = json && json.properties && json.properties.parameter;
  if (!par || !par.PRECTOTCORR || !par.T2M_MIN || !par.T2M || !par.WS2M) throw new Error('unexpected response');
  const fill = (json.header && typeof json.header.fill_value === 'number') ? json.header.fill_value : -999;
  const ok = v => typeof v === 'number' && isFinite(v) && v !== fill && v > -900;   // drop -999 fill values
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const doyOf = (y, m, d) => cum[m - 1] + d + (m > 2 && leap(y) ? 1 : 0);
  const Y = {}, yr = y => Y[y] || (Y[y] = { jja: 0, jjaN: 0, last: null, first: null, above: 0, tN: 0 });
  const july = [], wind = [];
  for (const k in par.PRECTOTCORR) { const m = +k.slice(4, 6), v = par.PRECTOTCORR[k]; if (m >= 6 && m <= 8 && ok(v)) { const o = yr(+k.slice(0, 4)); o.jja += v; o.jjaN++; } }
  for (const k in par.T2M_MIN) {
    const v = par.T2M_MIN[k]; if (!ok(v) || v > 0) continue;
    const y = +k.slice(0, 4), m = +k.slice(4, 6), doy = doyOf(y, m, +k.slice(6, 8)), o = yr(y);
    if (m <= 6) { if (o.last === null || doy > o.last) o.last = doy; } else if (o.first === null || doy < o.first) o.first = doy;
  }
  for (const k in par.T2M) { const v = par.T2M[k]; if (!ok(v)) continue; const o = yr(+k.slice(0, 4)); o.tN++; if (v > 0) o.above++; if (+k.slice(4, 6) === 7) july.push(v); }
  for (const k in par.WS2M) { const v = par.WS2M[k], m = +k.slice(4, 6); if (ok(v) && (m === 4 || m === 5)) wind.push(v); }
  const years = Object.keys(Y).map(Number);
  const totals = years.filter(y => Y[y].jjaN >= 85).map(y => Y[y].jja);          // a summer has 92 days
  const frostYears = years.filter(y => Y[y].last !== null && Y[y].first !== null);
  const fullYears = years.filter(y => Y[y].tN >= 358);
  if (totals.length < 10 || frostYears.length < 10 || !july.length || !wind.length) throw new Error('too little valid data');
  const md = doy => { let m = 11; while (m > 0 && cum[m] >= doy) m--; return { m: m + 1, d: Math.round(doy - cum[m]) }; };
  const elev = json.geometry && Array.isArray(json.geometry.coordinates) ? json.geometry.coordinates[2] : null;
  return {
    jjaMean: +mean(totals).toFixed(1), jjaP25: +percentile(totals, 0.25).toFixed(1),
    jjaMin: +Math.min(...totals).toFixed(1), jjaMax: +Math.max(...totals).toFixed(1),
    frostFree: Math.round(mean(frostYears.map(y => Y[y].first - Y[y].last))),
    daysAbove0: fullYears.length ? Math.round(mean(fullYears.map(y => Y[y].above))) : null,
    julyT: +mean(july).toFixed(1), springWind: +mean(wind).toFixed(2),
    elev: ok(elev) ? Math.round(elev) : null,
    lastFrost: md(Math.round(mean(frostYears.map(y => Y[y].last)))), firstFrost: md(Math.round(mean(frostYears.map(y => Y[y].first)))),
    years: totals.length
  };
}
function ensureClimate(slot, force) {
  const loc = slot === 'A' ? state.loc : state.locB; if (!loc) return;
  const cur = state.climate[slot];
  if (cur && !force) return;
  const pre = presetNear(loc);
  if (pre) { state.climate[slot] = { status: 'ok', kind: 'embedded', data: pre.data, site: pre }; return; }
  const key = fx(loc.lat, 3) + ',' + fx(loc.lon, 3);
  if (climateCache.has(key)) { state.climate[slot] = climateCache.get(key); return; }
  state.climate[slot] = { status: 'loading' };
  const same = () => (slot === 'A' ? state.loc : state.locB) === loc;
  fetchPower(loc.lat, loc.lon).then(json => {
    const rec = { status: 'ok', kind: 'live', data: computeClimate(json), date: today() };
    climateCache.set(key, rec); if (same()) state.climate[slot] = rec;
  }).catch(() => {
    const n = nearestOf(PRESETS, loc);     // live data unavailable: keep embedded values and say so plainly
    if (same()) state.climate[slot] = { status: 'ok', kind: 'fallback', data: n.p.data, site: n.p, km: Math.round(n.d) };
  }).finally(() => { if (same() && state.view === 'flow' && state.step >= 3) render(); });
}

/* SoilGrids: only real values are ever shown. HTTP 200 with all-null is treated as "not available". */
function ensureSoilGrids() {
  const loc = state.loc; if (!loc) return;
  const key = fx(loc.lat, 4) + ',' + fx(loc.lon, 4);
  if (state.sg && state.sg.key === key) return;
  state.sg = { key, status: 'loading' };
  const q = SOILGRIDS_PROPS.map(p => 'property=' + p.code).join('&');
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${loc.lon}&lat=${loc.lat}&${q}&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean`;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  fetch(url, { signal: ctl.signal }).then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }).then(json => {
    const layers = json && json.properties && json.properties.layers;
    if (!Array.isArray(layers)) throw new Error('unexpected response');
    const data = {}; let any = false;
    for (const layer of layers) {
      const def = SOILGRIDS_PROPS.find(p => p.code === layer.name); if (!def) continue;
      const div = (layer.unit_measure && Number(layer.unit_measure.d_factor)) || def.div;
      for (const dep of (layer.depths || [])) {
        const m = dep.values && dep.values.mean;
        if (typeof m === 'number' && isFinite(m)) { (data[def.code] = data[def.code] || {})[dep.label] = m / div; any = true; }   // null check, not just res.ok
      }
    }
    return any ? { key, status: 'ok', data } : { key, status: 'null' };
  }).catch(() => ({ key, status: 'error' })).then(rec => {
    clearTimeout(timer);
    if (state.sg && state.sg.key === key) { state.sg = rec; if (state.view === 'flow' && state.step >= 3) render(); }
  });
}

/* =====================================================================
   STEP 3 — conditions
   ===================================================================== */
const METRICS = [
  ['jjaMean', 1, 'u_mm'], ['jjaP25', 1, 'u_mm'], ['jjaMin', 1, 'u_mm'], ['jjaMax', 1, 'u_mm'],
  ['frostFree', 0, 'u_days'], ['daysAbove0', 0, 'u_days'], ['julyT', 1, 'u_c'], ['springWind', 2, 'u_ms'], ['elev', 0, 'u_m']
];
function val(data, [key, dec, unit]) {
  if (!data || data[key] == null) return '—';
  return (key === 'elev' ? '~' : '') + fx(data[key], dec) + ' ' + t(unit);
}
const frostDate = o => (state.lang === 'mn' ? `${o.m}-р сарын ${o.d}` : `${o.d} ${MONTHS_EN[o.m - 1]}`);
function climateNote(rec, loc) {
  if (rec.kind === 'embedded') return h('p', { class: 'small muted' }, t('embedded_note', { name: placeName(rec.site), lat: fx(rec.site.lat, 2), lon: fx(rec.site.lon, 2) }));
  if (rec.kind === 'live') return h('p', { class: 'small muted' }, t('live_note', { date: rec.date }));
  return h('div', { class: 'notice warn stack-s' },
    h('p', null, t('fallback_note', { name: placeName(rec.site), km: rec.km })),
    rec.km > 60 ? h('p', null, h('strong', null, t('fallback_far'))) : null,
    h('div', null, h('button', { type: 'button', class: 'btn quiet', onclick: () => { ensureClimate(loc === state.loc ? 'A' : 'B', true); render(); } }, t('retry'))));
}
function rainChart(rows) {
  const top = Math.ceil(Math.max(...rows.map(r => r.data.jjaMax)) / 100) * 100, W = 320, x = v => 12 + (v / top) * (W - 24);
  const rowH = 30, H = rows.length * rowH + 22;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('rain_chart_label') });
  for (let g = 0; g <= top; g += 100) {
    svg.append(s('line', { x1: x(g), x2: x(g), y1: 2, y2: H - 16, stroke: 'var(--line)', 'stroke-width': 1 }));
    svg.append(s('text', { x: x(g), y: H - 3, 'text-anchor': 'middle', class: 'cap' }, g));
  }
  rows.forEach((r, i) => {
    const y = 14 + i * rowH, d = r.data;
    svg.append(s('line', { x1: x(d.jjaMin), x2: x(d.jjaMax), y1: y, y2: y, stroke: 'var(--accent)', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.35 }));
    svg.append(s('line', { x1: x(d.jjaP25), x2: x(d.jjaP25), y1: y - 9, y2: y + 9, stroke: 'var(--estimated)', 'stroke-width': 4 }));
    svg.append(s('circle', { cx: x(d.jjaMean), cy: y, r: 7, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2 }));
    if (rows.length > 1) svg.append(s('text', { x: x(d.jjaMax) + 8 > W - 30 ? x(d.jjaMin) - 8 : x(d.jjaMax) + 8, y: y + 4, 'text-anchor': x(d.jjaMax) + 8 > W - 30 ? 'end' : 'start' }, r.short));
  });
  const d0 = rows[0].data;
  return h('div', { class: 'rainbar' }, h('span', { class: 'lbl small' }, t('rain_chart_label')), svg,
    h('div', { class: 'key num' },
      h('span', null, t('lbl_driest') + ' ' + fx(d0.jjaMin, 1)),
      h('span', null, h('i', { style: 'display:inline-block;width:4px;height:14px;background:var(--estimated)' }), t('lbl_dry') + ' ' + fx(d0.jjaP25, 1)),
      h('span', null, h('i', { style: 'display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--accent)' }), t('lbl_mean') + ' ' + fx(d0.jjaMean, 1)),
      h('span', null, t('lbl_wettest') + ' ' + fx(d0.jjaMax, 1))));
}
function climateTable(recA, recB, withAdvanced, withConf) {
  const head = h('tr', null, h('th', { scope: 'col' }, t('col_metric')),
    h('th', { scope: 'col' }, recB ? t('place_a') : t('col_value')), recB ? h('th', { scope: 'col' }, t('place_b')) : null);
  const rows = [];
  /* The confidence mark sits under the number rather than in its own column:
     a third column pushes the tag off a 360px screen. */
  const cell = (rec, m) => h('td', { class: 'v' }, h('span', null, val(rec.data, m)),
    withConf ? h('span', { class: 'tag modelled', style: 'margin-top:4px' }, t('c_modelled')) : null);
  for (const m of METRICS) {
    const adv = m[0] === 'daysAbove0';
    if (adv && !withAdvanced) continue;
    rows.push(h('tr', { class: adv ? 'adv' : null }, h('th', { scope: 'row' }, t('m_' + m[0])),
      cell(recA, m), recB ? cell(recB, m) : null));
    if (adv) rows.push(h('tr', { class: 'adv' }, h('td', { colspan: recB ? 3 : 2 }, t('days0_note'))));
  }
  return h('div', { class: 'tblwrap' }, h('table', null, h('thead', null, head), h('tbody', null, rows)));
}
function soilRefTable() {
  return h('div', { class: 'tblwrap' }, h('table', null,
    h('thead', null, h('tr', null, ['sr_depth', 'sr_ph', 'sr_caco3', 'sr_om', 'sr_p', 'sr_k'].map(k => h('th', { scope: 'col' }, t(k))))),
    h('tbody', null, SOIL_REF.map(r => h('tr', null, h('th', { scope: 'row' }, r.depth),
      [r.ph, r.caco3, r.om, r.p, r.k].map(v => h('td', { class: 'v' }, fx(v, 1))))))));
}
function soilCard() {
  const sg = state.sg || { status: 'loading' };
  let sgBody;
  if (sg.status === 'loading') sgBody = h('p', { class: 'row small' }, h('span', { class: 'spinner' }), t('sg_loading'));
  else if (sg.status === 'ok') {
    const depths = ['0-5cm', '5-15cm', '15-30cm'];
    sgBody = h('div', { class: 'stack-s' }, h('p', { class: 'small' }, confTag('modelled'), ' ', t('sg_ok')),
      h('div', { class: 'tblwrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, t('sg_depth')), depths.map(d => h('th', { scope: 'col' }, d.replace('cm', ' ' + t('u_cm')))))),
        h('tbody', null, SOILGRIDS_PROPS.filter(p => sg.data[p.code]).map(p => h('tr', null, h('th', { scope: 'row' }, p.code + ', ' + p.unit),
          depths.map(d => h('td', { class: 'v' }, sg.data[p.code][d] != null ? fx(sg.data[p.code][d], p.div === 100 ? 2 : 1) : '—'))))))));
  } else sgBody = h('p', { class: 'notice bad small' }, t(sg.status === 'null' ? 'sg_null' : 'sg_error'));
  return h('section', { class: 'card stack' },
    h('h2', null, t('soil_title')),
    h('p', { class: 'notice warn' }, h('strong', null, t('soil_orbit'))),
    h('p', null, t('soil_do')),
    h('div', { class: 'stack-s' }, h('h3', null, t('sg_title')), sgBody),
    h('div', { class: 'stack-s' },
      h('h3', null, t('soil_ref_title')),
      h('p', { class: 'small' }, confTag('measured'), ' ', t('soil_ref_text')),
      h('details', null, h('summary', null, t('soil_ref_show')),
        h('div', { class: 'stack-s' }, soilRefTable(), h('p', { class: 'small muted' }, t('soil_ref_units')), h('p', { class: 'srcline' }, t('src_line_soil'))))));
}
function step3(pre, view) {
  pre.append(stepHead(3, t('s3_title'), locLabel(state.loc) + ' · ' + t('s3_lead')));
  const A = state.climate.A, B = state.locB ? state.climate.B : null;
  const wrap = h('div', { class: 'wrap stack' }); view.append(wrap);
  const card = h('section', { class: 'card stack' }, h('h2', null, t('climate_title'))); wrap.append(card);
  if (!A || A.status === 'loading' || (B && B.status === 'loading')) {
    card.append(h('p', { class: 'row', role: 'status' }, h('span', { class: 'spinner' }), h('span', null, t('loading'))));
  } else {
    const d = A.data;
    card.append(climateNote(A, state.loc));
    card.append(h('div', { class: 'plain' }, h('ul', null,
      h('li', null, t('plain_rain', { mean: fx(d.jjaMean, 0) })),
      h('li', null, t('plain_dry', { p25: fx(d.jjaP25, 0) })),
      h('li', null, t('plain_range', { min: fx(d.jjaMin, 0), max: fx(d.jjaMax, 0), ratio: fx(d.jjaMax / d.jjaMin, 1) })),
      h('li', null, t('plain_frost', { ff: d.frostFree })),
      d.lastFrost ? h('li', null, t('plain_frost_dates', { d1: frostDate(d.lastFrost), d2: frostDate(d.firstFrost) })) : null,
      h('li', null, t('plain_july', { t: fx(d.julyT, 1) })),
      h('li', null, t('plain_wind', { w: fx(d.springWind, 1) })))));
    const rows = [{ data: d, short: 'A' }]; if (B) rows.push({ data: B.data, short: 'B' });
    card.append(rainChart(rows));
    card.append(h('p', { class: 'notice' }, t('grid_caveat')));
    if (B) {
      const dr = B.data.jjaMean - d.jjaMean, df = B.data.frostFree - d.frostFree, name = locLabel(state.locB);
      card.append(h('div', { class: 'stack-s' }, h('h3', null, t('compare_title')),
        h('p', { class: 'small muted' }, 'A: ' + locLabel(state.loc) + ' · B: ' + name),
        B.kind === 'fallback' ? climateNote(B, state.locB) : null,
        h('ul', { class: 'stack-s', style: 'margin:0;padding-left:1.2em' },
          Math.abs(dr) >= 0.5 ? h('li', null, t(dr > 0 ? 'cmp_rain_more' : 'cmp_rain_less', { b: name, x: fx(Math.abs(dr), 0) })) : null,
          df !== 0 ? h('li', null, t(df > 0 ? 'cmp_ff_longer' : 'cmp_ff_shorter', { b: name, x: Math.abs(df) })) : null)));
    }
    card.append(h('div', { class: 'stack-s' }, h('h3', null, t('numbers_title')), climateTable(A, B, state.advanced, true),
      h('p', { class: 'srcline' }, t('src_line_power', { period: CLIMATE_META.period, date: A.kind === 'live' ? A.date : CLIMATE_META.retrieved }))));
    card.append(confKey());
    card.append(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn quiet', id: 'advBtn', 'aria-pressed': String(state.advanced), onclick: () => { state.advanced = !state.advanced; render(); } }, t(state.advanced ? 'adv_hide' : 'adv_show')),
      state.locB
        ? h('button', { type: 'button', class: 'btn quiet', onclick: () => { state.locB = null; state.climate.B = null; drawSelection(false); render(); } }, t('compare_remove'))
        : h('button', { type: 'button', class: 'btn quiet', id: 'cmpBtn', onclick: () => { state.picking = 'B'; state.step = 1; render(); focusHeading(); } }, t('compare_add'))));
  }
  wrap.append(soilCard());
}

/* =====================================================================
   STEP 4 — AI analysis (prototype mechanism A: copy-paste bridge)
   ===================================================================== */
function buildPayload() {
  const rec = state.climate.A;
  return {
    lang: state.lang,
    location: { lat: state.loc.lat, lon: state.loc.lon, label: locLabel(state.loc) },
    climate: rec && rec.status === 'ok' ? { kind: rec.kind, data: rec.data, site: rec.site ? placeName(rec.site) : null, km: rec.km || null } : null,
    soilgrids: state.sg && state.sg.status === 'ok' ? state.sg.data : null,
    answers: QUESTIONS.filter(q => !q.rank).map(q => ({ question: qTitle(q), answer: answerText(q) })),
    priorities: state.priorities.map(v => optLabel(QUESTIONS.find(q => q.rank), v)),
    missing: missingList()
  };
}
function composePrompt(p) {
  const L = [], c = p.climate, d = c.data;
  L.push(t('p_role'), '');
  L.push(t('p_loc_h'), t('p_loc_place', { label: p.location.label, lat: fx(p.location.lat, 4), lon: fx(p.location.lon, 4) }));
  if (d.elev != null) L.push(t('p_loc_elev', { elev: d.elev }));
  L.push(t('p_loc_grid'), '');
  L.push(t('p_cli_h', { period: CLIMATE_META.period, kind: t('p_kind_' + c.kind, { name: c.site, km: c.km }) }));
  L.push(t('p_cli_mean', { years: d.years || CLIMATE_META.years, v: fx(d.jjaMean, 1) }), t('p_cli_p25', { v: fx(d.jjaP25, 1) }),
    t('p_cli_minmax', { min: fx(d.jjaMin, 1), max: fx(d.jjaMax, 1) }), t('p_cli_ff', { v: d.frostFree }));
  if (d.lastFrost) L.push(t('p_cli_dates', { d1: frostDate(d.lastFrost), d2: frostDate(d.firstFrost) }));
  L.push(t('p_cli_july', { v: fx(d.julyT, 1) }), t('p_cli_wind', { v: fx(d.springWind, 2) }), '');
  L.push(t('p_soil_h'), t('p_soil_none'), t('p_soil_ref'));
  if (p.soilgrids) {
    const list = SOILGRIDS_PROPS.filter(x => p.soilgrids[x.code] && p.soilgrids[x.code]['0-5cm'] != null).map(x => `${x.code} ${fx(p.soilgrids[x.code]['0-5cm'], x.div === 100 ? 2 : 1)} ${x.unit}`).join('; ');
    if (list) L.push(t('p_soil_sg', { list }));
  }
  L.push('', t('p_ans_h'));
  p.answers.forEach(a => L.push(`- ${a.question} ${a.answer}`));
  L.push(p.priorities.length ? t('p_pri', { list: p.priorities.map((x, i) => `${i + 1}) ${x}`).join('; ') }) : t('p_pri_none'));
  if (p.missing.length) L.push(t('p_missing', { list: p.missing.join('; ') }));
  L.push('', t('p_task_h'), t('p_task_1'), t('p_task_2'), t('p_task_3'), '', t('p_rules'), '', t('p_format_h'), PROMPT_SCHEMA);
  return L.join('\n');
}
/* The one function a real backend replaces. Today it only prepares the question
   (mechanism A). Later it can POST the payload to a server-side proxy that holds
   the API key and resolve with { mode: 'api', prompt, text }. No key lives in this file. */
async function generateAnalysis(payload) {
  return { mode: 'copy-paste', prompt: composePrompt(payload), text: null };
}

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
function parseAI(text) {
  const raw = String(text || '').trim(); if (!raw) return null;
  const cands = [], fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cands.push(fence[1]);
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}'); if (a >= 0 && b > a) cands.push(raw.slice(a, b + 1));
  for (const cand of cands) {
    for (const txt of [cand, cand.replace(/[“”]/g, '"')]) {
      try {
        const o = JSON.parse(txt);
        if (o && Array.isArray(o.actions) && o.actions.length) {
          return {
            actions: o.actions.slice(0, 12).map(x => ({ what: clip(x.what, 400), where: clip(x.where, 400), when: clip(x.when, 300), why: clip(x.why, 500), risk: clip(x.risk, 400) })),
            rotations: (Array.isArray(o.rotations) ? o.rotations : []).slice(0, 4).map(x => ({ name: clip(x.name, 120), sequence: clip(x.sequence, 300), fits: clip(x.fits, 400), tradeoffs: clip(x.tradeoffs, 500) })),
            fits: clip(o.fits_best, 500),
            unknowns: (Array.isArray(o.unknowns) ? o.unknowns : []).slice(0, 10).map(x => clip(x, 400)).filter(Boolean)
          };
        }
      } catch (e) { /* try the next candidate */ }
    }
  }
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));     // fallback: a markdown table
  const cells = l => l.replace(/^\||\|$/g, '').split('|').map(x => x.trim());
  const body = lines.filter(l => !/^\|[\s:|-]+\|?$/.test(l)).slice(1).map(cells).filter(r => r.length >= 4);
  if (body.length) return { actions: body.slice(0, 12).map(r => ({ what: clip(r[0], 400), where: clip(r[1], 400), when: clip(r[2], 300), why: clip(r[3], 500), risk: clip(r[4], 400) })), rotations: [], fits: '', unknowns: [] };
  return { raw: clip(raw, 6000) };
}
function fixedUnknowns() {
  const out = [t('unk_soil'), t('unk_grid'), t('unk_forecast')], miss = missingList(), rec = state.climate.A;
  if (miss.length) out.push(t('unk_missing', { list: miss.join(', ') }));
  if (rec && rec.kind === 'fallback') out.push(t('unk_fallback', { km: rec.km, name: placeName(rec.site) }));
  return out;
}
const ACT_COLS = [['where', 'col_where'], ['when', 'col_when'], ['why', 'col_why'], ['risk', 'col_risk']];
function adviceBlock(p) {
  if (p.raw) return h('div', { class: 'stack-s' }, h('p', { class: 'notice warn' }, t('parse_fail')), h('p', { class: 'rawtext small' }, p.raw));
  return h('div', { class: 'stack' },
    h('div', { class: 'acts' }, p.actions.map((x, i) => h('article', { class: 'act' }, h('h3', null, `${i + 1}. ${x.what}`),
      h('dl', null, ACT_COLS.filter(([k]) => x[k]).map(([k, lab]) => [h('dt', null, t(lab)), h('dd', null, x[k])]))))),
    p.rotations.length ? h('div', { class: 'stack-s' }, h('h3', null, t('rotations_title')),
      h('div', { class: 'acts' }, p.rotations.map(r => h('article', { class: 'act' }, h('h3', null, r.name),
        h('dl', null, [['sequence', 'rot_sequence'], ['fits', 'rot_fits'], ['tradeoffs', 'rot_tradeoffs']].filter(([k]) => r[k]).map(([k, lab]) => [h('dt', null, t(lab)), h('dd', null, r[k])])))))) : null,
    p.fits ? h('p', { class: 'notice' }, h('strong', null, t('fits_best') + ': '), p.fits) : null);
}
function copyText(text, sourceEl) {
  const done = () => toast(t('copied')), fail = () => {
    try { const r = document.createRange(); r.selectNodeContents(sourceEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); if (document.execCommand('copy')) return done(); } catch (e) { /* fall through */ }
    toast(t('copy_fail'));
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail); else fail();
}
const AI_TOOLS = [['Claude', 'https://claude.ai/new'], ['ChatGPT', 'https://chatgpt.com/'], ['Gemini', 'https://gemini.google.com/app']];
function step4(pre, view) {
  pre.append(stepHead(4, t('s4_title'), t('s4_lead')));
  const wrap = h('div', { class: 'wrap stack' }); view.append(wrap);
  wrap.append(h('p', { class: 'notice warn' }, h('strong', null, t('not_forecast'))));
  const rec = state.climate.A;
  if (!rec || rec.status !== 'ok') { wrap.append(h('p', { class: 'row card', role: 'status' }, h('span', { class: 'spinner' }), h('span', null, t('loading')))); return; }
  const promptEl = h('pre', { class: 'prompt', id: 'promptText', tabindex: '0', 'aria-label': t('prompt_label') });
  generateAnalysis(buildPayload()).then(res => { promptEl.textContent = res.prompt; });
  wrap.append(h('section', { class: 'card stack-s' }, h('h2', null, t('b1_title')), h('span', { class: 'lbl small muted' }, t('prompt_label')), promptEl,
    h('div', null, h('button', { type: 'button', class: 'btn primary', id: 'copyPrompt', onclick: () => copyText(promptEl.textContent, promptEl) }, t('b1_btn')))));
  wrap.append(h('section', { class: 'card stack-s' }, h('h2', null, t('b2_title')), h('p', { class: 'muted small' }, t('b2_help')),
    h('div', { class: 'row' }, AI_TOOLS.map(([name, url]) => h('a', { class: 'btn quiet', href: url, target: '_blank', rel: 'noopener noreferrer' }, name)))));
  wrap.append(h('section', { class: 'card stack-s' }, h('h2', null, t('b3_title')),
    h('label', { for: 'aiPaste', class: 'sr' }, t('paste_label')),
    h('textarea', { class: 'input', id: 'aiPaste', placeholder: t('paste_ph'), oninput: e => { state.ai.text = e.target.value; } }, state.ai.text),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', id: 'parseBtn', onclick: () => {
        if (!state.ai.text.trim()) { toast(t('paste_empty')); return; }
        state.ai.parsed = parseAI(state.ai.text); render(); const r = $('#result'); if (r) r.scrollIntoView({ block: 'start' });
      } }, t('b3_btn')),
      state.ai.text ? h('button', { type: 'button', class: 'btn quiet', onclick: () => { clearAI(); render(); } }, t('clear')) : null)));
  const res = h('section', { class: 'card stack', id: 'result' }); wrap.append(res);
  if (state.ai.parsed) {
    res.append(h('div', { class: 'row' }, h('h2', null, t('result_title')), h('span', { class: 'tag estimated' }, t('ai_badge'))),
      h('p', { class: 'small muted' }, t('ai_caveat')), adviceBlock(state.ai.parsed));
  } else res.append(h('p', { class: 'muted' }, t('no_ai_yet')));
  const aiUnknown = state.ai.parsed && state.ai.parsed.unknowns ? state.ai.parsed.unknowns : [];
  res.append(h('div', { class: 'stack-s' }, h('h3', null, t('unknowns_title')),
    h('ul', { style: 'margin:0;padding-left:1.2em' }, fixedUnknowns().map(x => h('li', null, x)), aiUnknown.map(x => h('li', null, x, ' ', h('span', { class: 'tag estimated' }, t('ai_badge')))))));
}

/* =====================================================================
   STEP 5 — the printed page
   ===================================================================== */
function buildReport() {
  const A = state.climate.A, B = state.locB ? state.climate.B : null, p = state.ai.parsed;
  const okA = A && A.status === 'ok', okB = B && B.status === 'ok';
  const srcNote = !okA ? '' : A.kind === 'embedded' ? t('embedded_note', { name: placeName(A.site), lat: fx(A.site.lat, 2), lon: fx(A.site.lon, 2) })
    : A.kind === 'live' ? t('live_note', { date: A.date }) : t('unk_fallback', { km: A.km, name: placeName(A.site) });
  const rep = h('article', { class: 'report', id: 'report' },
    h('div', { class: 'rhead' }, h('h2', null, t('r_title')), h('span', { class: 'num' }, t('r_date') + ': ' + today())),
    h('p', { class: 'fine' }, 'Field Shift · NASA Space Apps Challenge 2026'),
    h('h3', null, t('r_location')),
    h('p', null, h('strong', null, locLabel(state.loc)), ' · ', h('span', { class: 'num' }, locCoords(state.loc))),
    state.locB ? h('p', null, t('place_b') + ': ' + locLabel(state.locB) + ' · ' + locCoords(state.locB)) : null,
    h('h3', null, t('r_answers')),
    h('div', { class: 'two' }, QUESTIONS.map(q => h('div', null, h('span', { style: 'color:#485868' }, qTitle(q) + ' '), h('strong', null, answerText(q))))),
    h('h3', null, t('r_climate')),
    okA ? climateTable(A, okB ? B : null, false, false) : h('p', null, '—'),
    h('p', { class: 'fine' }, srcNote + ' ' + t('grid_caveat')),
    h('h3', null, t('r_soil')),
    h('p', null, t('soil_orbit')),
    h('h3', null, t('r_reco')));
  if (p && p.actions) {
    rep.append(h('div', { class: 'tblwrap' }, h('table', null,
      h('thead', null, h('tr', null, [['what', 'col_what']].concat(ACT_COLS).map(([, lab]) => h('th', { scope: 'col' }, t(lab))))),
      h('tbody', null, p.actions.map(x => h('tr', null, h('td', null, h('strong', null, x.what)), ACT_COLS.map(([k]) => h('td', null, x[k] || '—'))))))));
    if (p.rotations.length) rep.append(h('p', { style: 'margin-top:6px' }, h('strong', null, t('rotations_title') + ':')),
      h('ul', null, p.rotations.map(r => h('li', null, h('strong', null, r.name), [r.sequence, r.fits, r.tradeoffs].filter(Boolean).map(x => ' · ' + x)))));
    if (p.fits) rep.append(h('p', null, h('strong', null, t('fits_best') + ': '), p.fits));
  } else if (p && p.raw) rep.append(h('p', { class: 'rawtext' }, p.raw));
  else rep.append(h('p', null, t('r_no_reco')));
  rep.append(
    h('h3', null, t('unknowns_title')),
    h('ul', null, fixedUnknowns().map(x => h('li', null, x)), (p && p.unknowns ? p.unknowns : []).map(x => h('li', null, x))),
    h('h3', null, t('r_expert_notes')), h('div', { class: 'notes' }),
    h('p', { class: 'fine', style: 'margin-top:8px' }, h('strong', null, t('disclaimer_title') + ': '), t('disclaimer')),
    h('p', { class: 'fine' }, h('strong', null, t('r_sources') + ': '), t('r_sources_text')));
  return rep;
}
function summaryText() {
  const A = state.climate.A, p = state.ai.parsed, L = [t('share_title'), today(), '', t('r_location') + ': ' + locLabel(state.loc) + ' (' + locCoords(state.loc) + ')'];
  if (A && A.status === 'ok') METRICS.filter(m => m[0] !== 'daysAbove0' && m[0] !== 'elev').forEach(m => L.push('• ' + t('m_' + m[0]) + ': ' + val(A.data, m)));
  if (p && p.actions) { L.push('', t('r_reco') + ':'); p.actions.forEach((x, i) => L.push(`${i + 1}. ${x.what}${x.when ? ' — ' + x.when : ''}`)); }
  L.push('', t('soil_orbit'), '', t('disclaimer'));
  return L.join('\n');
}
function step5(pre, view) {
  pre.append(stepHead(5, t('s5_title'), t('s5_lead')));
  const text = summaryText(), holder = h('span', { class: 'sr', 'aria-hidden': 'true' }, text);
  const actions = h('div', { class: 'row no-print' },
    h('button', { type: 'button', class: 'btn primary', id: 'printBtn', onclick: () => { try { window.print(); } catch (e) { toast(t('print_blocked')); } } }, t('print_btn')),
    typeof navigator.share === 'function' ? h('button', { type: 'button', class: 'btn', onclick: () => { navigator.share({ title: t('share_title'), text }).catch(() => {}); } }, t('share_btn')) : null,
    h('a', { class: 'btn', href: 'https://wa.me/?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener noreferrer' }, t('whatsapp_btn')),
    h('button', { type: 'button', class: 'btn', onclick: () => copyText(text, holder) }, t('copy_summary_btn')), holder);
  view.append(h('div', { class: 'wrap stack' }, actions, buildReport()));
}

/* =====================================================================
   Secondary views: data & sources, reviewers
   ===================================================================== */
const backBtn = () => h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => { state.view = 'flow'; render(); focusHeading(); } }, '← ' + t('back_to_steps')));
function viewSources(view) {
  const item = (a, b) => h('section', { class: 'card stack-s' }, h('h2', null, t(a)), h('p', null, t(b)));
  view.append(h('div', { class: 'wrap stack' }, backBtn(), h('h1', { tabindex: '-1' }, t('src_title')),
    item('src_power_t', 'src_power_d'), item('src_soil_t', 'src_soil_d'), item('src_sg_t', 'src_sg_d'), item('src_map_t', 'src_map_d'), item('src_ai_t', 'src_ai_d'),
    h('section', { class: 'card stack-s' }, h('h2', null, t('src_offline_t')), h('p', null, t(state.swReady ? 'src_offline_on' : 'src_offline_off'))),
    h('p', { class: 'muted small' }, t('updated_line'))));
}
async function runVerify() {
  state.verify = { rows: [], msg: '' };
  for (const p of PRESETS) {
    state.verify.msg = t('rev_verify_run', { name: placeName(p) }); if (state.view === 'reviewers') render();
    try { state.verify.rows.push({ p, live: computeClimate(await fetchPower(p.lat, p.lon)) }); }
    catch (e) { state.verify.rows.push({ p, live: null }); }
  }
  state.verify.msg = ''; if (state.view === 'reviewers') render();
}
function viewReviewers(view) {
  const list = keys => h('ul', { class: 'stack-s', style: 'margin:0;padding-left:1.2em' }, keys.map(k => h('li', null, t(k))));
  const v = state.verify;
  const verifyOut = !v ? null : h('div', { class: 'stack-s' }, v.msg ? h('p', { class: 'row small', role: 'status' }, h('span', { class: 'spinner' }), v.msg) : null,
    v.rows.map(r => r.live
      ? h('div', { class: 'tblwrap' }, h('table', null, h('caption', { style: 'text-align:left;font-weight:700;padding:6px 0' }, placeName(r.p)),
          h('thead', null, h('tr', null, [t('col_metric'), t('rev_col_embedded'), t('rev_col_live'), t('rev_col_diff')].map(x => h('th', { scope: 'col' }, x)))),
          h('tbody', null, METRICS.map(m => h('tr', null, h('th', { scope: 'row' }, t('m_' + m[0])), h('td', { class: 'v' }, val(r.p.data, m)), h('td', { class: 'v' }, val(r.live, m)),
            h('td', { class: 'v' }, r.live[m[0]] == null ? '—' : fx(r.live[m[0]] - r.p.data[m[0]], m[1])))))))
      : h('p', { class: 'notice bad small' }, t('rev_verify_fail', { name: placeName(r.p) }))));
  view.append(h('div', { class: 'wrap stack' }, backBtn(), h('h1', { tabindex: '-1' }, t('rev_title')), h('p', { class: 'lead' }, t('rev_flow')),
    h('section', { class: 'card stack-s' }, h('h2', null, t('rev_calc_title')), list(['rev_c1', 'rev_c2', 'rev_c3', 'rev_c4', 'rev_c5', 'rev_c6', 'rev_c7'])),
    h('section', { class: 'card stack-s' }, h('h2', null, t('rev_verify_title')), h('p', { class: 'small muted' }, t('rev_verify_help')),
      h('div', null, h('button', { type: 'button', class: 'btn', id: 'verifyBtn', disabled: !!(v && v.msg), onclick: runVerify }, t('rev_verify_btn'))), verifyOut),
    h('section', { class: 'card stack-s' }, h('h2', null, t('rev_ai_title')), h('p', null, t('rev_ai')), h('p', null, t('rev_scoring'))),
    h('section', { class: 'card stack-s' }, h('h2', null, t('conf_title')), confKey()),
    h('section', { class: 'card stack-s' }, h('h2', null, t('soil_ref_title')), h('p', { class: 'small' }, t('soil_ref_text')), soilRefTable(), h('p', { class: 'small muted' }, t('soil_ref_units')), h('p', { class: 'srcline' }, t('src_line_soil'))),
    h('section', { class: 'card stack-s' }, h('h2', null, t('rev_sg_title')), h('p', { class: 'small muted' }, t('rev_sg_help')),
      h('div', { class: 'tblwrap' }, h('table', null, h('thead', null, h('tr', null, ['rev_sg_code', 'rev_sg_div', 'rev_sg_unit'].map(k => h('th', { scope: 'col' }, t(k))))),
        h('tbody', null, SOILGRIDS_PROPS.map(p => h('tr', null, h('th', { scope: 'row' }, p.code), h('td', { class: 'v' }, p.div), h('td', null, p.unit))))))),
    h('section', { class: 'card stack-s' }, h('h2', null, t('rev_limits_title')), list(['rev_l1', 'rev_l2', 'rev_l3', 'rev_l4']))));
}

/* ---------- start ---------- */
function start() {
  applyTheme(); render();
  /* Offline after first load: only possible on real hosting (https or localhost), not from file:// or a sandboxed preview. */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(() => { state.swReady = true; }).catch(() => {});
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
