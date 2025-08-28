/* engineCali.js
   Motor gráfico modular para storytelling electoral Cali 2023
   - Mapa base y choropleth por ganador
   - Barras apiladas por comuna (vía stackedBar.js)
   - Placeholder para círculos (puestos de votación)
   Requiere D3 v7
*/

(function () {
  window.scrollerCali = function scrollerCali(opts = {}) {
    const cfg = {
      svgSelector: opts.svgSelector || "#map-svg",
      barsSelector: opts.barsSelector || "#bars-container",
      legendSelector: opts.legendSelector || "#legend",
      tooltipSelector: opts.tooltipSelector || "#tooltip",
      comunaKey: opts.comunaKey || "Nombre Comuna",
      geoIdKey: opts.geoIdKey || "id",
      colorEder: "#FFD700",
      colorOrtiz: "#FF0000",
      othersPalette: d3.schemeTableau10,
      tFast: 350,
      tNorm: 650,
      tSlow: 900,
      intensityDomain: [10, 35],  // % en el que queremos que empiece a verse y sature
      intensityGamma: 0.1,        // curva ( <1 = más contraste en bajos )
      startTint: 0.25             // cuánto del color base usamos como punto de partida (no blanco)

    };

    const state = {
      root: d3.select(cfg.svgSelector),
      bars: d3.select(cfg.barsSelector),
      legend: d3.select(cfg.legendSelector),
      tooltip: d3.select(cfg.tooltipSelector),
      width: 0,
      height: 0,
      projection: null,
      path: null,
      geo: null,
      puestos: null,
      comunas: null,
      comunasByName: new Map(),
      keysPct: [],
      candidateColors: new Map(),
      joinedFeatures: null,
      layers: {}
    };

    // ---------- Helpers ----------
    function sizeFromContainer() {
      const node = state.root.node();
      if (!node) return { w: 800, h: 600 };
      const bbox = node.getBoundingClientRect();
      return { w: Math.max(320, bbox.width | 0), h: Math.max(280, bbox.height | 0) };
    }
    function fmtPct(v) { return (v == null || isNaN(v)) ? "–" : `${d3.format(".1f")(v)}%`; }
    function showTooltip(html, [x, y]) {
      state.tooltip.html(html)
        .style("left", `${x + 12}px`)
        .style("top", `${y + 12}px`)
        .classed("visible", true)
        .attr("aria-hidden", "false");
    }
    function hideTooltip() { state.tooltip.classed("visible", false).attr("aria-hidden", "true"); }
    function sanitizeCandidateKey(k) { return k.replace(/^%_/, "").replace(/_/g, " ").trim(); }
    function computeCandidateColors(keys) {
      const out = new Map();
      keys.forEach((k, i) => {
        const name = sanitizeCandidateKey(k);
        if (/^Eder/i.test(name)) out.set(name, cfg.colorEder);
        else if (/^Ortiz/i.test(name)) out.set(name, cfg.colorOrtiz);
        else out.set(name, cfg.othersPalette[i % cfg.othersPalette.length]);
      });
      return out;
    }
    function winnerForRow(row) {
      let bestKey = null, bestVal = -Infinity, secondKey = null, secondVal = -Infinity;
      state.keysPct.forEach(k => {
        const v = +row[k] || 0;
        if (v > bestVal) { secondVal = bestVal; secondKey = bestKey; bestVal = v; bestKey = k; }
        else if (v > secondVal) { secondVal = v; secondKey = k; }
      });
      return {
        winnerKey: bestKey,
        winner: bestKey ? sanitizeCandidateKey(bestKey) : null,
        winnerPct: bestVal,
        second: secondKey ? sanitizeCandidateKey(secondKey) : null,
        secondPct: secondVal,
        margin: bestVal - secondVal
      };
    }
    function fitProjection() {
      state.projection = d3.geoMercator();
      state.path = d3.geoPath().projection(state.projection);
      if (state.geo) state.projection.fitSize([state.width, state.height], state.geo);
    }
    function intensityFromPct(pct) {
      // Reescala porcentaje al rango [0..1] usando un dominio ajustable
      const [lo, hi] = cfg.intensityDomain;
      const t = Math.max(0, Math.min(1, (pct - lo) / (hi - lo)));
      // Curva gamma para levantar los tonos bajos
      return Math.pow(t, cfg.intensityGamma);
    }

    function intensityColor(baseHex, pct) {
      // Punto de partida: un tinte del color (no blanco) para que ya “tenga” hue
      const start = d3.interpolateLab("#ffffff", baseHex)(cfg.startTint);
      const t = intensityFromPct(pct);
      return d3.interpolateLab(start, baseHex)(t);
    }

    function ensureLayers() {
      if (state.layers.root) return;
      const svg = state.root;
      svg.selectAll("*").remove();
      state.layers.root = svg.append("g").attr("class", "root");
      state.layers.map = state.layers.root.append("g").attr("class", "layer-map");
      // Quitamos borders mesh (no necesario con GeoJSON)
      state.layers.points = state.layers.root.append("g").attr("class", "layer-points");
      state.layers.labels = state.layers.root.append("g").attr("class", "layer-labels");
    }
    function showLegendChoropleth() {
      const names = Array.from(new Set(
        (state.joinedFeatures || []).map(f => f.properties.__winner?.winner).filter(Boolean)
      ));
      state.legend.style("display", "block").html("");
      state.legend.append("h4").text("Ganador por comuna");
      names.forEach(name => {
        const row = state.legend.append("div").attr("class", "row");
        row.append("span").attr("class", "swatch").style("background", state.candidateColors.get(name) || "#999");
        row.append("span").text(name);
      });
      const grad = state.legend.append("div").attr("class", "row").style("margin-top", "6px");
      grad.append("span").style("font-size", "12px").style("color", "#555").text("Menor %");
      grad.append("div")
        .style("flex", "1").style("height", "10px").style("margin", "0 8px")
        .style("background", `linear-gradient(90deg, #fff 0%, #ddd 100%)`)
        .style("border", "1px solid #e5e7eb").style("border-radius", "6px");
      grad.append("span").style("font-size", "12px").style("color", "#555").text("Mayor %");
    }
    function showLegendBars(keys) {
      state.legend.style("display", "block").html("");
      state.legend.append("h4").text("Distribución por comuna");
      keys.forEach(k => {
        const name = sanitizeCandidateKey(k);
        const row = state.legend.append("div").attr("class", "row");
        row.append("span").attr("class", "swatch").style("background", state.candidateColors.get(name) || "#999");
        row.append("span").text(name);
      });
    }
    function hideLegend() { state.legend.style("display", "none").html(""); }

    // ---------- Join de datos ----------
    function prepareData(puestos, geo, comunasAgg) {
      state.puestos = puestos || [];
      state.geo = geo;
      state.comunas = comunasAgg || [];

      const sample = state.comunas[0] || {};
      state.keysPct = Object.keys(sample).filter(k => /^%_/.test(k))
        .sort((a, b) => (a === "%_otros") - (b === "%_otros") || a.localeCompare(b));
      state.candidateColors = computeCandidateColors(state.keysPct);

      state.comunasByName = new Map(state.comunas.map(d => [String(d[cfg.comunaKey]).trim(), d]));

      state.joinedFeatures = (state.geo.features || []).map(f => {
        const id = String(f.properties[cfg.geoIdKey]).trim();
        const row = state.comunasByName.get(id);
        if (row) {
          f.properties.__data = row;
          f.properties.__winner = winnerForRow(row);
        } else {
          f.properties.__data = null;
          f.properties.__winner = null;
        }
        return f;
      });
    }

    // ---------- Render base ----------
    function renderBaseMap() {
  ensureLayers();
  fitProjection();

  state.layers.map
    .selectAll("path.comuna")
    .data(state.joinedFeatures || [], d => d.properties[cfg.geoIdKey])
    .join(
      enter => enter.append("path")
        .attr("class", "comuna")
        .attr("d", state.path)
        .style("fill", "#f5f5f5")        // fill inicial desde JS
        .attr("opacity", 0)
        .on("mousemove", function (event, d) {
          const name = d.properties[cfg.geoIdKey];
          showTooltip(`<strong>${name}</strong>`, d3.pointer(event, document.body));
          d3.select(this).classed("hovered", true);
        })
        .on("mouseout", function () {
          hideTooltip();
          d3.select(this).classed("hovered", false);
        })
        .call(sel => sel.transition().duration(cfg.tNorm).attr("opacity", 1)),
      update => update
        .on("mousemove", null)
        .on("mouseout", null)
        .call(sel => sel.transition().duration(cfg.tNorm).attr("d", state.path)),
      exit => exit.call(sel => sel.transition().duration(cfg.tFast).attr("opacity", 0).remove())
    );
}


    // ---------- Choropleth ----------
    function renderChoropleth() {
        ensureLayers();
        fitProjection();

  const areasSel = state.layers.map
    .selectAll("path.comuna")
    .data(state.joinedFeatures || [], d => d.properties[cfg.geoIdKey])
    .join(
      enter => enter.append("path")
        .attr("class", "comuna")
        .attr("d", state.path)
        .style("fill", "#f5f5f5")
        .attr("opacity", 0)
        .on("mousemove", onMoveChoro)
        .on("mouseout", onOutChoro)
        .call(sel => sel.transition().duration(cfg.tNorm).attr("opacity", 1)),
      update => update
        .on("mousemove", onMoveChoro)
        .on("mouseout", onOutChoro)
        .call(sel => sel.transition().duration(cfg.tNorm).attr("d", state.path)),
      exit => exit.call(sel => sel.transition().duration(cfg.tFast).attr("opacity", 0).remove())
    );

  areasSel.transition().duration(cfg.tSlow)
  .style("fill", d => {
    const w = d.properties.__winner;
    if (!w || !w.winner) return "#f0f0f0";
    const baseColor = state.candidateColors.get(w.winner) || "#bbb";
    // Tus columnas ya están en 0–100, usamos ese valor directo
    const pct = +w.winnerPct || 0;
    return intensityColor(baseColor, pct);
  });


  function onMoveChoro(event, d) {
    const id = d.properties[cfg.geoIdKey];
    const w = d.properties.__winner || {};
    const html = `
      <div><strong>${id}</strong></div>
      <div>Ganador: <strong>${w.winner || "s/i"}</strong> (${fmtPct(w.winnerPct)})</div>
      <div>Segundo: ${w.second || "s/i"} (${fmtPct(w.secondPct)})</div>
      <div>Margen: ${fmtPct(w.margin)}</div>
    `;
    showTooltip(html, d3.pointer(event, document.body));
    d3.select(this).classed("hovered", true);
  }

  function onOutChoro() {
    hideTooltip();
    d3.select(this).classed("hovered", false);
  }
}


    // ---------- Barras apiladas ----------
    function renderStackedBars() {
  state.bars.style("display", "block");
  state.root.style("pointer-events", "none");

  if (typeof window.stackedBarChart === "function") {
    const data = state.comunas.slice();
    const keys = state.keysPct.slice();
    showLegendBars(keys);

    const width = state.width - 16;
    const height = state.height - 16;

    const colorScale = d3.scaleOrdinal()
      .domain(keys.map(sanitizeCandidateKey))
      .range(keys.map(k => state.candidateColors.get(sanitizeCandidateKey(k))));

    state.bars.selectAll("*").remove();

    const chart = window.stackedBarChart()
      .width(width)
      .height(height)
      .keys(keys)
      .xKey(cfg.comunaKey)
      .valueFormat(v => `${d3.format(".1f")(v)}%`)
      .colors(colorScale)
      .onHover((d) => {
        const html = `
          <div><strong>${d.data[cfg.comunaKey]}</strong></div>
          <div>${sanitizeCandidateKey(d.key)}: <strong>${fmtPct(d.value)}</strong></div>
        `;
        showTooltip(html, [d.x, d.y]);
      })
      .onLeave(() => hideTooltip());

    // 👇 IMPORTANTE: pasar data al componente
    state.bars.call(chart, data);
  } else {
    state.bars
      .style("display", "block")
      .style("color", "#555")
      .html("<em>Componente de barras apiladas no disponible (stackedBar.js).</em>");
    showLegendBars(state.keysPct);
  }
}

    // ---------- Círculos (puestos) ----------
    function renderCircles() {
      ensureLayers();
      fitProjection();

      const sample = state.puestos[0] || {};
      const latKey = ["lat", "latitude", "LAT", "Latitud", "latitud"].find(k => k in sample) || null;
      const lonKey = ["lon", "lng", "long", "longitude", "LON", "Longitud", "longitud"].find(k => k in sample) || null;

      state.layers.points.selectAll("circle.point").remove();
      if (!latKey || !lonKey) { console.warn("No se encontraron columnas lat/lon en votos.csv"); return; }

      const pts = state.layers.points
        .selectAll("circle.point")
        .data(state.puestos, (d, i) => i);

      pts.enter()
        .append("circle")
        .attr("class", "point")
        .attr("r", 0)
        .attr("fill", "rgba(0,0,0,0.35)")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.8)
        .attr("transform", d => {
          const p = state.projection([+d[lonKey], +d[latKey]]);
          return p ? `translate(${p[0]},${p[1]})` : null;
        })
        .on("mousemove", function (event, d) {
          const html = `<div><strong>Puesto</strong></div>
                        <div>${latKey}: ${(+d[latKey]).toFixed(5)}, ${lonKey}: ${(+d[lonKey]).toFixed(5)}</div>`;
          showTooltip(html, d3.pointer(event, document.body));
          d3.select(this).classed("hovered", true);
        })
        .on("mouseout", function () { hideTooltip(); d3.select(this).classed("hovered", false); })
        .transition().duration(cfg.tNorm).attr("r", 2.8);

      pts.transition().duration(cfg.tNorm)
        .attr("transform", d => {
          const p = state.projection([+d[lonKey], +d[latKey]]);
          return p ? `translate(${p[0]},${p[1]})` : null;
        });

      pts.exit().transition().duration(cfg.tFast).attr("r", 0).remove();
    }

    // ---------- API escenas ----------
    function drawTitle() {
      hideLegend(); hideTooltip();
      renderBaseMap();
      state.bars.style("display", "none").selectAll("*").remove();
      state.root.style("pointer-events", "auto");
      d3.select("#legend").style("display", "none");
    }
    function showMap() {
      hideLegend(); hideTooltip(); renderBaseMap();
      state.bars.style("display", "none").selectAll("*").remove();
      state.root.style("pointer-events", "auto");
    }
    function choroplethScene() {
      state.bars.style("display", "none").selectAll("*").remove();
      state.root.style("pointer-events", "auto");
      renderChoropleth();
      showLegendChoropleth();
    }
    function stackedBarsScene() { renderStackedBars(); }
    function circlesScene() {
      hideLegend();
      state.bars.style("display", "none").selectAll("*").remove();
      state.root.style("pointer-events", "auto");
      renderBaseMap(); renderCircles();
    }
    const choropletScene = choroplethScene; // alias

    // ---------- Redimensionado ----------
    function updateSize() {
  const { w, h } = sizeFromContainer();
  state.width = w; state.height = h;
  state.root.attr("viewBox", `0 0 ${w} ${h}`);

  fitProjection();

  // Recalcular paths del mapa
  state.layers.map?.selectAll("path.comuna").attr("d", state.path);

  // Reposicionar puntos (si existen)
  state.layers.points?.selectAll("circle.point")
    .attr("transform", d => {
      const latKey = ["lat", "latitude", "LAT", "Latitud", "latitud"].find(k => k in d) || null;
      const lonKey = ["lon", "lng", "long", "longitude", "LON", "Longitud", "longitud"].find(k => k in d) || null;
      if (!latKey || !lonKey) return null;
      const p = state.projection([+d[lonKey], +d[latKey]]);
      return p ? `translate(${p[0]},${p[1]})` : null;
    });

  // Si hay barras ya montadas, re-render con el nuevo tamaño
  const hasBars = !state.bars.selectAll("*").empty();
  if (hasBars && typeof window.stackedBarChart === "function") {
    const keys = state.keysPct.slice();
    const data = state.comunas.slice();
    const width = state.width - 16;
    const height = state.height - 16;

    const colorScale = d3.scaleOrdinal()
      .domain(keys.map(sanitizeCandidateKey))
      .range(keys.map(k => state.candidateColors.get(sanitizeCandidateKey(k))));

    state.bars.selectAll("*").remove();

    const chart = window.stackedBarChart()
      .width(width).height(height)
      .keys(keys).xKey(cfg.comunaKey)
      .valueFormat(v => `${d3.format(".1f")(v)}%`)
      .colors(colorScale)
      .onHover(d => showTooltip(
        `<div><strong>${d.data[cfg.comunaKey]}</strong></div>
         <div>${sanitizeCandidateKey(d.key)}: <strong>${fmtPct(d.value)}</strong></div>`,
        [d.x, d.y]
      ))
      .onLeave(hideTooltip);

    // 👇 IMPORTANTE: pasar data al componente
    state.bars.call(chart, data);
  }
}


    // ---------- Inicialización ----------
    function init(puestos, geo, comunasAgg) {
      const { w, h } = sizeFromContainer();
      state.width = w; state.height = h;
      state.root.attr("viewBox", `0 0 ${w} ${h}`);
      prepareData(puestos, geo, comunasAgg);
      renderBaseMap();
    }

    return {
      init,
      updateSize,
      drawTitle,
      showMap,
      choropleth: choroplethScene,
      choroplet: choropletScene,
      stackedBarsByComuna: stackedBarsScene,
      showCircles: circlesScene,
      _state: state,
      _cfg: cfg
    };
  };
})();
