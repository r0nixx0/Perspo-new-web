# Field Shift

**NASA Space Apps Challenge 2026 — "Field Shift: Adapting Farms with NASA Data"**
A soil and crop-rotation advisor for farmers and herders in Mongolia. Бүх текст монгол, англи хоёр хэлээр.

The live site is `index.html` at the root of this repository. It is one self-contained
file — no build step, no server, no API keys. Open it by double-click, or let GitHub Pages
serve it.

## What it does

One guided flow, one step at a time:

1. **Where is your field?** — tap the map of Mongolia, search a place name, or type coordinates.
2. **Tell us about the field** — seven multiple-choice questions, no typing, every one skippable.
3. **Here are your conditions** — plain language first, numbers second, with the limits stated.
4. **Here is what to consider** — the app writes the prompt, you paste it into a free AI tool
   and paste the answer back, and it becomes a table.
5. **Take it to an expert** — one A4 page to print, or text to send by Messenger or WhatsApp.

Mongolian is the default language. МОН / ENG is reachable from every step. Dark and light
themes both meet WCAG AA contrast, for use outdoors.

## Turning on the website (one time)

**Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**

After a minute the site is live at `https://r0nixx0.github.io/Perspo-new-web/`.
Nothing else is needed: there is no build to run and no workflow to configure.

## Where the data comes from

| | Source | Status |
|---|---|---|
| Climate | NASA POWER, daily, 2001–2025, community AG, `PRECTOTCORR` `T2M_MIN` `T2M` `WS2M` | Modelled |
| Soil chemistry | Tserengunsen et al. (2022), MJGG 43, DOI 10.5564/mjgg.v59i43.2513 | Measured, regional reference only |
| Soil maps | SoilGrids (ISRIC), queried live | Modelled, shown only when real values return |
| Map | Leaflet 1.9.4, © OpenStreetMap; border from Natural Earth; towns from GeoNames | — |

Three reference points (Zuunkharaa area, Darkhan, Bulgan) are embedded, so the app works with
no internet. Any other point is fetched live from NASA POWER and computed in the browser.

**No number in this app is invented.** Where data is missing it says so instead of guessing.
Every figure is marked *measured*, *modelled* or *estimated*.

## Limits, stated on the site itself

- Satellite data describes an area of roughly 55 × 46 km, not your field.
- Soil pH, nitrogen, phosphorus and potassium cannot be measured from space. A soil test on
  your own field is still required.
- This is not a yield forecast and not a price forecast.
- No option is ever called "best" — only "fits your answers best", with the trade-offs shown.
- The tool supports local farmer judgment and agronomic expertise. It does not replace them.

## Editing the code

`index.html` at the root is generated. Edit the files in `src/`, then rebuild:

```bash
npm install
npm run build      # writes dist/index.html
cp dist/index.html index.html
```

- `src/app.js` — all logic: map, questions, NASA POWER maths, AI bridge, report
- `src/i18n.js` — every visible string, Mongolian and English. No text is hardcoded in markup
- `src/prompt.js` — the question sent to the AI
- `src/data.js` — embedded climate values, the soil table, the place list, the questions
- `src/styles.css` — all colour through CSS custom properties

`NOTES.md` has the build notes: what was tested, what is still open, and what the team
needs to supply.

## AI use

The advice table is written by a general-purpose AI tool that the user chooses; the app shows
the exact prompt it prepared and marks the result as an AI suggestion. The code was written
with Claude. Both are disclosed in the Space Apps submission.
