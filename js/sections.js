/* sections.js
   Conecta datos → motor (engineCali) → scroller
   Escenas 0–5: 0 Título → 1 Mapa → 2 Choropleth → 3 Barras → 4 Puestos → 5 Conclusión
*/

(function () {
  // ------------------- Utils -------------------
  const norm = (s) => String(s ?? "").trim();

  // Normaliza texto para join: quita tildes, pasa a MAYÚSCULAS y colapsa espacios
  function normalizeName(s) {
    return norm(s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // sin diacríticos
      .toUpperCase()
      .replace(/\s+/g, " ");
  }

  function debounce(fn, wait = 150) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // Asegura numéricos en %_* y calcula %_otros si faltara (ya vienes 0–100)
  function ensureOtrosAndNumbers(rows) {
    if (!rows || !rows.length) return rows || [];
    const sample = rows[0];
    const pctCols = Object.keys(sample).filter(k => /^%_/.test(k));
    const hasOtros = pctCols.includes("%_otros");
    const coreCols = pctCols.filter(k => k !== "%_otros");

    return rows.map(d => {
      const x = { ...d };
      if ("Nombre Comuna" in x) x["Nombre Comuna"] = normalizeName(x["Nombre Comuna"]);
      Object.keys(x).forEach(k => { if (/^%_/.test(k)) x[k] = +x[k] || 0; });
      if (!hasOtros) {
        const sum = coreCols.reduce((acc, k) => acc + (+x[k] || 0), 0);
        x["%_otros"] = Math.max(0, Math.min(100, 100 - sum));
      }
      return x;
    });
  }

  function warnJoinIssues(geo, comunasAgg) {
    try {
      const csvSet = new Set(comunasAgg.map(d => normalizeName(d["Nombre Comuna"])));
      const missingInCSV = [];
      (geo.features || []).forEach(f => {
        const id = normalizeName(f.properties.id);
        if (!csvSet.has(id)) missingInCSV.push(f.properties.id);
      });
      if (missingInCSV.length) {
        console.warn("[sections] Comunas en GeoJSON sin fila en CSV:", missingInCSV);
      }
    } catch { /* noop */ }
  }

  // (Opcional) Escenas via helper — no es obligatorio usarlo
  function makeScenes(engine) {
    return [
      () => engine.drawTitle(),
      () => engine.showMap(),
      () => engine.choroplet(),           // alias soportado por el motor
      () => engine.stackedBarsByComuna(),
      () => engine.showCircles(),
      () => engine.drawTitle()
    ];
  }

  // Atajos J/K o flechas
  function enableKeyboardNav() {
    const steps = Array.from(document.querySelectorAll("#sections .step"));
    function goto(i) { if (i >= 0 && i < steps.length) steps[i].scrollIntoView({ behavior: "smooth", block: "center" }); }
    function handler(e) {
      const active = document.querySelector("#sections .step.active");
      const idx = steps.indexOf(active);
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") goto(Math.min(steps.length - 1, (idx >= 0 ? idx + 1 : 0)));
      else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") goto(Math.max(0, (idx >= 0 ? idx - 1 : 0)));
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }

  // ------------------- Punto de entrada público -------------------
  function initSections(puestos, caliGeo, comunasAggRaw) {
    // 1) CSV: normalizar nombres/porcentajes y quitar fila 'NACIONAL' (no tiene polígono)
    let comunas = ensureOtrosAndNumbers(comunasAggRaw)
      .filter(d => d["Nombre Comuna"] !== "NACIONAL");

    // 2) GeoJSON: normalizar 'id' para que matchee con CSV
    (caliGeo.features || []).forEach(f => {
      f.properties.id = normalizeName(f.properties.id);
    });

    // 3) Aliases puntuales (por si algún nombre alterno aparece en el futuro)
    const aliasMap = new Map([
      ["AREA EXPANSION", "AREA DE EXPANSION"]  // ajusta según tu CSV si llegara a cambiar
    ]);
    comunas = comunas.map(d => {
      const k = d["Nombre Comuna"];
      const k2 = aliasMap.get(k) || k;
      return { ...d, "Nombre Comuna": k2 };
    });

    // (Debug opcional)
    warnJoinIssues(caliGeo, comunas);

    // 4) Motor con llaves de join correctas
    const engine = window.scrollerCali({
      comunaKey: "Nombre Comuna", // CSV
      geoIdKey: "id"              // GeoJSON
    });

    // 5) Inicializar motor con datos ya normalizados
    engine.init(puestos, caliGeo, comunas);

    // 6) Escenas + scroller
    const scenes = makeScenes(engine);
    const story = window.makeStoryScroller({ engine, scenes }).start();

    // 7) Responsivo mínimo (complementa responsive.js)
    const onResize = debounce(() => {
      if (story && typeof story.updateSize === "function") story.updateSize();
    }, 150);
    window.addEventListener("resize", onResize);

    // 8) Atajos de teclado
    const undoKeys = enableKeyboardNav();

    // 9) Exponer
    window._story = story;
    window._engine = engine;
    window._cleanupSections = () => {
      window.removeEventListener("resize", onResize);
      undoKeys();
      story.destroy();
    };
  }

  window.initSections = initSections;
})();
