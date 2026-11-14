/* ------------------------------------------------------------------
   Field Shift — embedded data. Nothing in this file is invented.
   Every block names its source. Do not edit numbers without re-sourcing.
   ------------------------------------------------------------------ */

/* Mongolia border ring [lat, lon] — Natural Earth 1:10m admin-0 (public domain).
   Filled in by build.mjs from tools/mn_ring.json. */
const MN_RING = /*MN_RING*/[];

const MN_BOUNDS = [[41.5, 87.7], [52.2, 119.9]];

/* NASA POWER grid cell (MERRA-2): 0.5 deg lat x 0.625 deg lon. */
const CELL = { dLat: 0.5, dLon: 0.625, kmNS: 55, kmEW: 46 };

/* Climate reference points.
   Source: NASA POWER daily API, community AG, PRECTOTCORR / T2M_MIN / T2M / WS2M,
   2001-01-01 .. 2025-12-31 (25 complete years), retrieved 2026-11-14 by the team.
   Values are embedded exactly as supplied in the project brief. */
const CLIMATE_META = { period: '2001–2025', years: 25, retrieved: '2026-11-14' };
const PRESETS = [
  { id: 'zuunkharaa', mn: 'Зүүнхараа орчим', en: 'Zuunkharaa area', lat: 48.88, lon: 106.82,
    data: { jjaMean: 221.0, jjaP25: 173.8, jjaMin: 76.6, jjaMax: 363.5, frostFree: 104, daysAbove0: 132, julyT: 18.1, springWind: 2.16, elev: 1229 } },
  { id: 'darkhan', mn: 'Дархан', en: 'Darkhan', lat: 49.49, lon: 105.95,
    data: { jjaMean: 212.0, jjaP25: 158.4, jjaMin: 99.1, jjaMax: 349.4, frostFree: 113, daysAbove0: 142, julyT: 19.9, springWind: 2.92, elev: 912 } },
  { id: 'bulgan', mn: 'Булган', en: 'Bulgan', lat: 48.81, lon: 103.53,
    data: { jjaMean: 247.4, jjaP25: 195.0, jjaMin: 106.5, jjaMax: 378.9, frostFree: 105, daysAbove0: 133, julyT: 17.8, springWind: 2.99, elev: 1340 } }
];

/* Laboratory reference soil data (measured, NOT modelled, NOT site-specific).
   Tserengunsen P. et al. (2022). Soil properties of the permafrost zone and differences
   among regions of Mongolia. Mongolian Journal of Geography and Geoecology 43.
   DOI 10.5564/mjgg.v59i43.2513. 41 profiles, 164 samples.
   Regions sampled: Khuvsgul, Khangai, Mongolian-Altai, Gobi-Altai.
   Units for P2O5 / K2O are not stated in the source table, so none is shown. */
const SOIL_REF = [
  { depth: '0–5',   ph: 7.2, caco3: 2.6, om: 4.3, p: 3.1, k: 47.3 },
  { depth: '5–15',  ph: 7.3, caco3: 4.3, om: 3.0, p: 1.8, k: 21.3 },
  { depth: '15–30', ph: 7.5, caco3: 7.4, om: 1.8, p: 1.3, k: 15.7 },
  { depth: '30–60', ph: 7.7, caco3: 6.7, om: 0.9, p: 1.6, k: 11.7 }
];

/* SoilGrids integer -> real unit conversion (ISRIC documentation). */
const SOILGRIDS_PROPS = [
  { code: 'phh2o',    div: 10,  unit: 'pH' },
  { code: 'soc',      div: 10,  unit: 'g/kg' },
  { code: 'nitrogen', div: 100, unit: 'g/kg' },
  { code: 'cec',      div: 10,  unit: 'cmol(c)/kg' },
  { code: 'clay',     div: 10,  unit: '%' },
  { code: 'sand',     div: 10,  unit: '%' },
  { code: 'silt',     div: 10,  unit: '%' },
  { code: 'bdod',     div: 100, unit: 'kg/dm³' }
];

/* Built-in place list. Coordinates: GeoNames (CC BY 4.0). Names typed by hand.
   a = aimag (shown as context and searchable), c = true for aimag centres. */
const PLACES = [
  { mn: 'Улаанбаатар', en: 'Ulaanbaatar', lat: 47.9077, lon: 106.8832, aMn: 'Нийслэл', aEn: 'Capital city', alt: 'ulan bator ub уб' },
  { mn: 'Цэцэрлэг', en: 'Tsetserleg', lat: 47.4750, lon: 101.4542, aMn: 'Архангай', aEn: 'Arkhangai', c: true },
  { mn: 'Өлгий', en: 'Ulgii', lat: 48.9683, lon: 89.9625, aMn: 'Баян-Өлгий', aEn: 'Bayan-Ulgii', c: true, alt: 'olgii ölgii bayan-olgii' },
  { mn: 'Баянхонгор', en: 'Bayankhongor', lat: 46.1944, lon: 100.7181, aMn: 'Баянхонгор', aEn: 'Bayankhongor', c: true },
  { mn: 'Булган', en: 'Bulgan', lat: 48.8125, lon: 103.5347, aMn: 'Булган', aEn: 'Bulgan', c: true },
  { mn: 'Алтай', en: 'Altai', lat: 46.3722, lon: 96.2583, aMn: 'Говь-Алтай', aEn: 'Govi-Altai', c: true, alt: 'gobi-altai' },
  { mn: 'Чойр', en: 'Choir', lat: 46.3611, lon: 108.3611, aMn: 'Говьсүмбэр', aEn: 'Govisumber', c: true },
  { mn: 'Дархан', en: 'Darkhan', lat: 49.4867, lon: 105.9228, aMn: 'Дархан-Уул', aEn: 'Darkhan-Uul', c: true, alt: 'darhan' },
  { mn: 'Чойбалсан', en: 'Choibalsan', lat: 48.0726, lon: 114.5326, aMn: 'Дорнод', aEn: 'Dornod', c: true },
  { mn: 'Сайншанд', en: 'Sainshand', lat: 44.8824, lon: 110.1163, aMn: 'Дорноговь', aEn: 'Dornogovi', c: true },
  { mn: 'Мандалговь', en: 'Mandalgovi', lat: 45.7625, lon: 106.2708, aMn: 'Дундговь', aEn: 'Dundgovi', c: true },
  { mn: 'Улиастай', en: 'Uliastai', lat: 47.7417, lon: 96.8444, aMn: 'Завхан', aEn: 'Zavkhan', c: true },
  { mn: 'Эрдэнэт', en: 'Erdenet', lat: 49.0333, lon: 104.0833, aMn: 'Орхон', aEn: 'Orkhon', c: true },
  { mn: 'Арвайхээр', en: 'Arvaikheer', lat: 46.2639, lon: 102.7750, aMn: 'Өвөрхангай', aEn: 'Uvurkhangai', c: true, alt: 'ovorkhangai övörkhangai' },
  { mn: 'Даланзадгад', en: 'Dalanzadgad', lat: 43.5708, lon: 104.4250, aMn: 'Өмнөговь', aEn: 'Umnugovi', c: true, alt: 'omnogovi ömnögovi' },
  { mn: 'Баруун-Урт', en: 'Baruun-Urt', lat: 46.6806, lon: 113.2792, aMn: 'Сүхбаатар', aEn: 'Sukhbaatar', c: true },
  { mn: 'Сүхбаатар', en: 'Sukhbaatar', lat: 50.2314, lon: 106.2078, aMn: 'Сэлэнгэ', aEn: 'Selenge', c: true, alt: 'suhbaatar sükhbaatar' },
  { mn: 'Зуунмод', en: 'Zuunmod', lat: 47.7069, lon: 106.9528, aMn: 'Төв', aEn: 'Tuv', c: true, alt: 'tov töv' },
  { mn: 'Улаангом', en: 'Ulaangom', lat: 49.9811, lon: 92.0667, aMn: 'Увс', aEn: 'Uvs', c: true },
  { mn: 'Ховд', en: 'Khovd', lat: 48.0056, lon: 91.6419, aMn: 'Ховд', aEn: 'Khovd', c: true, alt: 'hovd' },
  { mn: 'Мөрөн', en: 'Murun', lat: 49.6342, lon: 100.1625, aMn: 'Хөвсгөл', aEn: 'Khuvsgul', c: true, alt: 'moron mörön khovsgol khövsgöl' },
  { mn: 'Чингис (Өндөрхаан)', en: 'Chinggis (Undurkhaan)', lat: 47.3194, lon: 110.6556, aMn: 'Хэнтий', aEn: 'Khentii', c: true, alt: 'ondorkhaan öndörkhaan' },
  { mn: 'Зүүнхараа', en: 'Zuunkharaa', lat: 48.8523, lon: 106.4579, aMn: 'Сэлэнгэ', aEn: 'Selenge', alt: 'мандал mandal züünkharaa dzuunharaa' },
  { mn: 'Алтанбулаг', en: 'Altanbulag', lat: 50.3156, lon: 106.4986, aMn: 'Сэлэнгэ', aEn: 'Selenge' },
  { mn: 'Орхонтуул', en: 'Orkhontuul', lat: 48.9497, lon: 104.9758, aMn: 'Сэлэнгэ', aEn: 'Selenge' },
  { mn: 'Хушаат', en: 'Khushaat', lat: 49.5000, lon: 105.6167, aMn: 'Сэлэнгэ', aEn: 'Selenge' },
  { mn: 'Шарын гол', en: 'Sharyngol', lat: 49.2373, lon: 106.4301, aMn: 'Дархан-Уул', aEn: 'Darkhan-Uul' },
  { mn: 'Хонгор', en: 'Khongor', lat: 49.2301, lon: 105.8967, aMn: 'Дархан-Уул', aEn: 'Darkhan-Uul' },
  { mn: 'Орхон сум', en: 'Orkhon sum', lat: 49.8325, lon: 106.1364, aMn: 'Дархан-Уул', aEn: 'Darkhan-Uul' },
  { mn: 'Борнуур', en: 'Bornuur', lat: 48.4667, lon: 106.2667, aMn: 'Төв', aEn: 'Tuv' },
  { mn: 'Жаргалант', en: 'Jargalant', lat: 48.5206, lon: 105.8683, aMn: 'Төв', aEn: 'Tuv' },
  { mn: 'Хутаг-Өндөр', en: 'Khutag-Undur', lat: 49.3950, lon: 102.6933, aMn: 'Булган', aEn: 'Bulgan', alt: 'hutag' },
  { mn: 'Тэшиг', en: 'Teshig', lat: 49.9467, lon: 102.6612, aMn: 'Булган', aEn: 'Bulgan' },
  { mn: 'Хархорин', en: 'Kharkhorin', lat: 47.1925, lon: 102.8135, aMn: 'Өвөрхангай', aEn: 'Uvurkhangai' },
  { mn: 'Тосонцэнгэл', en: 'Tosontsengel', lat: 48.7567, lon: 98.2839, aMn: 'Завхан', aEn: 'Zavkhan' }
];

/* Step 2 questions. Icons are plain emoji (no image files); "sq" / "slope" are drawn in CSS/SVG. */
const QUESTIONS = [
  { id: 'crop', opts: [
    ['wheat', '🌾'], ['barley', '🌿'], ['oat', '🌱'], ['potato', '🥔'], ['rapeseed', '🌼'],
    ['peas', '🟢'], ['hay', '🐄'], ['fallow', '🟫'], ['pasture', '🐑'] ] },
  { id: 'size', opts: [ ['s1', 'sq1'], ['s2', 'sq2'], ['s3', 'sq3'], ['s4', 'sq4'], ['s5', 'sq5'] ] },
  { id: 'land', opts: [ ['flat', 'slope0'], ['gentle', 'slope1'], ['steep', 'slope2'], ['valley', '🏞️'], ['steppe', '🐎'] ] },
  { id: 'water', opts: [ ['rain', '🌧️'], ['river', '🌊'], ['well', '🚰'], ['irrigation', '💦'] ] },
  { id: 'livestock', opts: [ ['none', '🚫'], ['few', '🐐'], ['herd', '🐑🐄'] ] },
  { id: 'priority', rank: true, opts: [ ['water', '💧'], ['soil', '🛡️'], ['feed', '🐄'], ['income', '💰'] ] },
  { id: 'equip', opts: [ ['hand', '⚒️'], ['small', '🚜'], ['full', '🚜🚛'], ['hire', '🤝'] ] }
];
