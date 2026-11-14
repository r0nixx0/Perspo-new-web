# Field Shift — build notes

`dist/index.html` is the whole app: one file, no build step, no backend, no keys.
Open it by double-click, or drop it on Netlify / Vercel / GitHub Pages.
`dist/sw.js` is optional; it only does anything on real hosting (https).

## 1. Stack, and why

Plain HTML + CSS + JS in a single file, with **Leaflet 1.9.4 inlined** (not from a CDN).

- Opens from `file://`, so it works on a judge's laptop with no internet and no install.
- 309 KB total, which matters on a cheap Android phone on a rural connection. React + Vite +
  Tailwind would have added a build step and a bigger bundle for no gain at this size.
- Source lives in `src/` and is assembled by `node build.mjs`. Edit `src/*`, run the build,
  ship `dist/`.
- Leaflet markers are `L.circleMarker`, so no marker images are needed — the brief's warning
  about broken default icons does not apply.

## 2. AI integration: option (A), the copy-paste bridge

As instructed, (A) is the default and the only mechanism built. No API key exists anywhere in
the code. Step 4 composes the full prompt from the real figures and the farmer's answers,
shows it in full, copies it, links out to a free AI tool, and parses the answer back into the
table. The parser accepts JSON (fenced or bare), falls back to a markdown table, and if both
fail it shows the raw text and says so instead of pretending.

`generateAnalysis(payload)` is the single swap point. It returns
`{ mode, prompt, text }`; a later (B) or (C) only has to resolve `text` from a proxy.
All AI output is rendered as text nodes, never as HTML, and is capped per field.

## 3. Which numbers are real, and which are not

**Real and sourced — do not edit without re-sourcing:**

- The three climate reference points (Zuunkharaa area, Darkhan, Bulgan). Embedded exactly as
  you supplied them, in `src/data.js`. Not rounded, not recomputed.
- Any other point: fetched live from NASA POWER, 2001–2025, and computed in the browser.
  `-999` fill values are dropped; a summer missing more than 7 days is excluded.
- The soil table: Tserengunsen et al. (2022), MJGG 43, DOI 10.5564/mjgg.v59i43.2513. I checked
  these against the published paper — pH, CaCO₃, organic matter, P₂O₅ and K₂O all match at all
  four depths. Labelled throughout as regional reference values, never as "your field".
- SoilGrids: queried live, with a null check as well as `res.ok`. If values come back empty —
  which is what ISRIC's paused service does today — the app says "not available" and shows
  nothing. No SoilGrids numbers are embedded.
- Town coordinates: GeoNames. National border: Natural Earth 1:10m.

**There are no placeholder numbers in this build.** Nothing is invented anywhere. Where data
is missing the app shows an honest empty state.

**Not a number, but needs your eye:** the seasonal "what to do now" banner is a general
calendar I wrote, not derived from data. It is tagged *Estimated*. Have an agronomist check it.

## 4. What I need from you

1. **Zuunkharaa coordinates.** You gave 48.88, 106.82. The town is at about 48.85, 106.46 —
   roughly 26 km west, likely a different POWER grid cell. I embedded your numbers unchanged
   and labelled the point "Zuunkharaa area (48.88, 106.82)". Confirm which point you queried.
2. **P₂O₅ and K₂O units.** The paper's table gives the values you listed but states no units
   for available P and K. I show them without units and name the methods (Machigin; flame
   photometry). Supply the units and I will add them.
3. **Mongolian wording.** Three terms are marked `TODO_MN` in `src/i18n.js`: "зусах буудай"
   for spring wheat, and "хүйтрэлгүй хугацаа" / "хүйтрэл" for frost-free season and frost.
   The rest is written as plain Mongolian, but a native agronomist should read it once.
4. **Scoring formulas.** The old weighted score is gone from the farmer's path, as asked. I did
   not rebuild it behind the advanced toggle because you did not send its coefficients, and I
   was not going to invent them. Send them if you want it back for judges.
5. **Live-API check on real hosting.** The build sandbox blocks outbound network, so live
   NASA POWER, SoilGrids and Nominatim calls were tested against mocked responses, not the real
   endpoints. Open the hosted page once and click a point away from the three presets to
   confirm the live path end to end.

## What was tested

- Climate maths against synthetic daily data with known answers: summer-rain mean and 25th
  percentile, frost-free season, the day count above 0 °C, July mean, spring wind, and `-999`
  handling. All exact.
- Border test: Ulaanbaatar, Darkhan, Altanbulag, Ölgii and Zamyn-Üüd inside; Irkutsk, Erenhot
  and Hohhot rejected; Kyakhta flagged as border-adjacent.
- Full click-through of all five steps at 360 px, in Mongolian and English, light and dark.
- WCAG AA contrast on every text node in both themes, across all five steps and both
  secondary views: no failures.
- Every touch target measured: none under 44 × 44 px.
- No horizontal page scroll at 360 px.
- The printed report fits on exactly one A4 page.
- Mocked-network tests of the live POWER path, the SoilGrids all-null trap, and a normal
  SoilGrids response (pH 72 → 7.2; nitrogen ÷100; bulk density ÷100).

## Two bugs that testing caught

- Every "I don't know / skip" option was being positioned 999 px off-screen, because the
  option's `.skip` class collided with the skip-to-content link's rule. The farmer could not
  skip a question at all. The link is now `.skiplink`.
- `replaceChildren(null)` was printing the literal word "null" in the location bar.

## Space Apps submission facts

NASA POWER, Agroclimatology community, parameters `PRECTOTCORR`, `T2M_MIN`, `T2M`, `WS2M`,
2001–2025, endpoint `power.larc.nasa.gov/api/temporal/daily/point`.
AI tool use: this app asks a general-purpose LLM to write the advice table, and the code was
written with Claude. Disclose both in the SI field.
Remember the limits: 30 s video **or** 7 slides, every link public with no login, nobody under
18 on camera.
