/* ------------------------------------------------------------------
   Field Shift — the text of the question sent to the AI, in both
   languages. Kept apart from the UI strings so the team can tune it.
   ------------------------------------------------------------------ */
Object.assign(I18N.en, {
  p_role: 'You are helping a farmer in Mongolia think about crop rotation. Use ONLY the data below. Do not invent numbers. If something is not in the data, say that it is unknown.',
  p_loc_h: 'LOCATION',
  p_loc_place: '- Point: {label} (latitude {lat}, longitude {lon})',
  p_loc_elev: '- Grid-cell elevation: about {elev} m',
  p_loc_grid: '- The climate data describes an area of about 55 x 46 km (one NASA POWER grid cell), not a single field.',
  p_cli_h: 'CLIMATE (NASA POWER, daily data {period}; {kind})',
  p_kind_embedded: 'stored values for this reference point',
  p_kind_live: 'fetched live for this point',
  p_kind_fallback: 'live data was unavailable, so these are values for the nearest reference point, {name}, {km} km away; treat them with extra caution',
  p_cli_mean: '- Summer rain (June + July + August), mean of {years} years: {v} mm',
  p_cli_p25: '- Dry year (25th percentile; one summer in four is at or below this): {v} mm',
  p_cli_minmax: '- Driest summer on record: {min} mm. Wettest: {max} mm',
  p_cli_ff: '- Frost-free season (last spring frost to first autumn frost), mean: {v} days. Use this for any sowing-window reasoning.',
  p_cli_dates: '- Mean date of last spring frost: {d1}. Mean date of first autumn frost: {d2}',
  p_cli_july: '- July mean air temperature: {v} °C',
  p_cli_wind: '- Spring wind (April-May mean at 2 m): {v} m/s',
  p_soil_h: 'SOIL',
  p_soil_none: '- There is NO soil measurement for this field. Soil pH, nitrogen, phosphorus and potassium cannot be measured from space.',
  p_soil_ref: '- Regional reference only, NOT this field (laboratory means from Khuvsgul, Khangai, Mongolian-Altai and Gobi-Altai; Tserengunsen et al. 2022): 0-5 cm pH 7.2, CaCO3 2.6 %, organic matter 4.3 %; 5-15 cm pH 7.3, CaCO3 4.3 %, organic matter 3.0 %; 15-30 cm pH 7.5, CaCO3 7.4 %, organic matter 1.8 %.',
  p_soil_sg: '- SoilGrids modelled values for this point (250 m grid, not measured), 0-5 cm: {list}',
  p_ans_h: 'THE FARMER’S ANSWERS',
  p_pri: '- Priorities this year, most important first: {list}',
  p_pri_none: '- Priorities this year: not answered',
  p_missing: '- Not answered: {list}. Treat these as unknown and say how that weakens the advice.',
  p_task_h: 'TASK',
  p_task_1: '1. Give 4 to 7 practical actions. For each: what to do, where on the field, when, why (name the figure above that supports it), and the risk if ignored.',
  p_task_2: '2. Give 2 or 3 crop rotation options over 3 to 4 years, each with its trade-offs. Never call any option "best". Say which one "fits your answers best" and why.',
  p_task_3: '3. List what we do not know. Always include: no soil test for this field, the 55 x 46 km grid, and any question the farmer skipped.',
  p_rules: 'RULES: This is not a yield forecast and not a price forecast, so give neither. Flag uncertainty plainly. Tell the farmer to check with a local agronomist before changing the rotation. Write for a farmer: plain English, short sentences.',
  p_format_h: 'ANSWER FORMAT: return ONLY this JSON and no other text. Keep the keys in English.'
});

Object.assign(I18N.mn, {
  p_role: 'Та Монголын тариаланчид тариалангийн сэлгээгээ бодож үзэхэд нь тусалж байна. ЗӨВХӨН доорх өгөгдлийг ашигла. Тоо зохиож болохгүй. Өгөгдөлд байхгүй зүйлийг «мэдэгдэхгүй» гэж хэл.',
  p_loc_h: 'БАЙРШИЛ',
  p_loc_place: '- Цэг: {label} (өргөрөг {lat}, уртраг {lon})',
  p_loc_elev: '- Өгөгдлийн нүдний өндөр: ойролцоогоор {elev} м',
  p_loc_grid: '- Цаг уурын өгөгдөл нэг талбайг биш, ойролцоогоор 55 x 46 км газрыг (NASA POWER-ийн нэг нүд) дүрсэлнэ.',
  p_cli_h: 'ЦАГ УУР (NASA POWER, өдөр тутмын өгөгдөл {period}; {kind})',
  p_kind_embedded: 'энэ лавлах цэгийн хадгалсан утга',
  p_kind_live: 'энэ цэгт шууд татсан',
  p_kind_fallback: 'шууд өгөгдөл татаж чадаагүй тул эдгээр нь {km} км зайтай хамгийн ойрын лавлах цэг болох {name}-ийн утга; болгоомжтой хандах',
  p_cli_mean: '- Зуны бороо (6+7+8-р сар), {years} жилийн дундаж: {v} мм',
  p_cli_p25: '- Хуурай жил (25-р процентиль; дөрвөн зун тутмын нэг нь үүнээс бага буюу тэнцүү): {v} мм',
  p_cli_minmax: '- Бүртгэгдсэн хамгийн хуурай зун: {min} мм. Хамгийн чийглэг: {max} мм',
  p_cli_ff: '- Хүйтрэлгүй хугацаа (хаврын сүүлчийн хүйтрэлээс намрын анхны хүйтрэл хүртэл), дундаж: {v} хоног. Тариалах хугацааны бүх тооцоонд үүнийг ашигла.',
  p_cli_dates: '- Хаврын сүүлчийн хүйтрэлийн дундаж огноо: {d1}. Намрын анхны хүйтрэлийн дундаж огноо: {d2}',
  p_cli_july: '- 7-р сарын агаарын дундаж температур: {v} °C',
  p_cli_wind: '- Хаврын салхи (4–5-р сарын дундаж, 2 м өндөрт): {v} м/с',
  p_soil_h: 'ХӨРС',
  p_soil_none: '- Энэ талбайн хөрсний хэмжилт БАЙХГҮЙ. Хөрсний pH, азот, фосфор, калийг сансраас хэмжих боломжгүй.',
  p_soil_ref: '- Зөвхөн бүс нутгийн лавлах утга, энэ талбайнх БИШ (Хөвсгөл, Хангай, Монгол Алтай, Говь-Алтайн лабораторийн дундаж; Цэрэнгүнсэн нар 2022): 0–5 см pH 7.2, CaCO3 2.6 %, ялзмаг 4.3 %; 5–15 см pH 7.3, CaCO3 4.3 %, ялзмаг 3.0 %; 15–30 см pH 7.5, CaCO3 7.4 %, ялзмаг 1.8 %.',
  p_soil_sg: '- Энэ цэгийн SoilGrids-ийн загварчилсан утга (250 м-ийн тор, хэмжилт биш), 0–5 см: {list}',
  p_ans_h: 'ТАРИАЛАНЧИЙН ХАРИУЛТ',
  p_pri: '- Энэ жилийн зорилго, чухлаас нь эхлэн: {list}',
  p_pri_none: '- Энэ жилийн зорилго: хариулаагүй',
  p_missing: '- Хариулаагүй: {list}. Эдгээрийг мэдэгдэхгүй гэж үзээд, зөвлөмжийг хэрхэн сулруулж байгааг хэл.',
  p_task_h: 'ДААЛГАВАР',
  p_task_1: '1. 4–7 бодит ажил санал болго. Тус бүрд: юу хийх, талбайн аль хэсэгт, хэзээ, яагаад (дээрх аль тоо үүнийг баталж байгааг нэрлэ), үл тоовол гарах эрсдэл.',
  p_task_2: '2. 3–4 жилийн сэлгээний 2–3 хувилбар гарга, тус бүрийн давуу ба сул талыг бич. Аль ч хувилбарыг «хамгийн сайн» гэж бүү нэрлэ. Аль нь «таны хариултад хамгийн сайн тохирох»-ыг, яагаад гэдгийг хэл.',
  p_task_3: '3. Бидний мэдэхгүй зүйлийг жагсаа. Заавал оруулах: энэ талбайн хөрсний шинжилгээ байхгүй, 55 x 46 км-ийн тор, тариаланчийн алгассан асуулт бүр.',
  p_rules: 'ДҮРЭМ: Энэ бол ургацын таамаг ч биш, үнийн таамаг ч биш тул аль алиныг нь бүү өг. Эргэлзээтэй зүйлийг шууд хэл. Сэлгээгээ өөрчлөхөөс өмнө орон нутгийн агрономчтой зөвлөлдөхийг сануул. Тариаланчид зориулж бич: энгийн монгол хэл, кирилл үсэг, богино өгүүлбэр.',
  p_format_h: 'ХАРИУЛТЫН ХЭЛБЭР: ЗӨВХӨН доорх JSON-ыг буцаа, өөр текст бүү нэм. Түлхүүр үгсийг англиар нь үлдээ.'
});

/* The JSON shape is the same in both languages. */
const PROMPT_SCHEMA = '{"actions":[{"what":"","where":"","when":"","why":"","risk":""}],"rotations":[{"name":"","sequence":"","fits":"","tradeoffs":""}],"fits_best":"","unknowns":[""]}';
