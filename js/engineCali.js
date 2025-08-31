/* engineCali.js
   Motor modular para storytelling electoral Cali 2023
   - Mapa base y choropleth por ganador (intensidad = margen Eder–Ortiz)
   - Barras apiladas por comuna (via stackedBar.js)
   - Puntos de puestos (cuando haya lat/lon)
   Requiere D3 v7
*/
(function () {
  // Exponer fábrica en window
  window.scrollerCali = function scrollerCali(opts = {}) {
    // ---------- Config ----------
    const cfg = {
      svgSelector: opts.svgSelector || "#map-svg",
      barsSelector: opts.barsSelector || "#bars-container",
      legendSelector: opts.legendSelector || "#legend",
      tooltipSelector: opts.tooltipSelector || "#tooltip",
      comunaKey: opts.comunaKey || "Nombre Comuna", // CSV
      geoIdKey: opts.geoIdKey || "id",              // GeoJSON
      colorEder: "#FFD700", // Amarillo
      colorOrtiz: "#FF0000", // Rojo
      othersPalette: d3.schemeTableau10,
      tFast: 300,
      tNorm: 600,
      tSlow: 900,
      // Intensidad basada en margen Eder–Ortiz (curva sqrt + tinte inicial)
      marginGamma: 0.5,  // <1 para levantar contraste en bajos
      startTint: 0.25    // 0..1: inicio ya teñido (no blanco)
    };

    // ---------- Estado ----------
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
      joinedFeatures: [],
      layers: {},
      marginMax: 0 // máximo |%_Eder - %_Ortiz| para escalar intensidad
    };

    // ---------- Utils ----------
    function sizeFromContainer() {
      const node = state.root.node();
      if (!node) return { w: 800, h: 600 };
      const b = node.getBoundingClientRect();
      return { w: Math.max(320, b.width | 0), h: Math.max(280, b.height | 0) };
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

    function sanitizeCandidateKey(k) { return String(k || "").replace(/^%_/, "").replace(/_/g, " ").trim(); }

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

    // ----- Intensidad por margen Eder–Ortiz (al estilo John) -----
    function intensityFromMargin(m) {
      if (!(state.marginMax > 0)) return 0;
      const r = Math.max(0, Math.min(1, m / state.marginMax));
      // curva tipo gamma (sqrt por defecto) para dar más contraste en bajos
      return Math.pow(r, cfg.marginGamma);
    }
    function colorFromWinnerAndMargin(winnerName, margin) {
      const base = state.candidateColors.get(winnerName) || "#bbb";
      const start = d3.interpolateLab("#ffffff", base)(cfg.startTint);
      const t = intensityFromMargin(margin);
      return d3.interpolateLab(start, base)(t);
    }

    // ---------- Leyendas ----------
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
      grad.append("span").style("font-size", "12px").style("color", "#555").text("Menor margen");
      grad.append("div")
        .style("flex", "1").style("height", "10px").style("margin", "0 8px")
        .style("background", `linear-gradient(90deg, #fff 0%, #ddd 100%)`)
        .style("border", "1px solid #e5e7eb").style("border-radius", "6px");
      grad.append("span").style("font-size", "12px").style("color", "#555").text("Mayor margen");
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

      // detectar columnas %_
      const sample = state.comunas[0] || {};
      state.keysPct = Object.keys(sample)
        .filter(k => /^%_/.test(k))
        .sort((a, b) => (a === "%_otros") - (b === "%_otros") || a.localeCompare(b));

      // colores por candidato
      state.candidateColors = computeCandidateColors(state.keysPct);

      // map comunas by name
      state.comunasByName = new Map(state.comunas.map(d => [String(d[cfg.comunaKey]).trim(), d]));

      // join + margen Eder–Ortiz
      state.marginMax = 0;
      state.joinedFeatures = (state.geo.features || []).map(f => {
        const id = String(f.properties[cfg.geoIdKey]).trim();
        const row = state.comunasByName.get(id);

        if (row) {
          const w = winnerForRow(row);
          f.properties.__data = row;
          f.properties.__winner = w;

          const eder  = +row["%_Eder"]  || 0;
          const ortiz = +row["%_Ortiz"] || 0;
          const m = Math.abs(eder - ortiz);
          f.properties.__marginEO = m;
          if (m > state.marginMax) state.marginMax = m;
        } else {
          f.properties.__data = null;
          f.properties.__winner = null;
          f.properties.__marginEO = 0;
        }
        return f;
      });
    }

    // ---------- Layers ----------
    function ensureLayers() {
      if (state.layers.root) return;
      const svg = state.root;
      svg.selectAll("*").remove();
      state.layers.root = svg.append("g").attr("class", "root");
      state.layers.map = state.layers.root.append("g").attr("class", "layer-map");
      state.layers.points = state.layers.root.append("g").attr("class", "layer-points");
      state.layers.labels = state.layers.root.append("g").attr("class", "layer-labels");
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
            .style("fill", "#f5f5f5") // inicial
            .attr("opacity", 0)
            .on("mousemove", function (event, d) {
              const name = d.properties[cfg.geoIdKey];
              showTooltip(`<strong>${name}</strong>`, d3.pointer(event, document.body));
              d3.select(this).classed("hovered", true);
            })
            .on("mouseout", function () { hideTooltip(); d3.select(this).classed("hovered", false); })
            .call(sel => sel.transition().duration(cfg.tNorm).attr("opacity", 1)),
          update => update.call(sel => sel.transition().duration(cfg.tNorm).attr("d", state.path)),
          exit => exit.call(sel => sel.transition().duration(cfg.tFast).attr("opacity", 0).remove())
        );
    }

    // ---------- Choropleth (por margen EO) ----------
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
          const m = d.properties.__marginEO || 0;
          if (!w || !w.winner) return "#f0f0f0";
          return colorFromWinnerAndMargin(w.winner, m);
        });

      function onMoveChoro(event, d) {
        const id = d.properties[cfg.geoIdKey];
        const w = d.properties.__winner || {};
        const row = d.properties.__data || {};
        const eder  = +row["%_Eder"]  || 0;
        const ortiz = +row["%_Ortiz"] || 0;
        const marginEO = Math.abs(eder - ortiz);

        const html = `
          <div><strong>${id}</strong></div>
          <div>Ganador: <strong>${w.winner || "s/i"}</strong> (${fmtPct(w.winnerPct)})</div>
          <div>Segundo: ${w.second || "s/i"} (${fmtPct(w.secondPct)})</div>
          <div>Margen ganador–segundo: ${fmtPct(w.margin)}</div>
          <div>Margen Eder–Ortiz: <strong>${fmtPct(marginEO)}</strong></div>
        `;
        showTooltip(html, d3.pointer(event, document.body));
        d3.select(this).classed("hovered", true);
      }
      function onOutChoro() { hideTooltip(); d3.select(this).classed("hovered", false); }
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
          .width(width).height(height)
          .keys(keys).xKey(cfg.comunaKey)
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

        // IMPORTANTE: pasar data al componente
        state.bars.call(chart, data);
      } else {
        state.bars
          .style("display", "block")
          .style("color", "#555")
          .html("<em>Componente de barras apiladas no disponible (stackedBar.js).</em>");
        showLegendBars(state.keysPct);
      }
    }

    // ---------- Puntos (puestos) ----------
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

    // ---------- Escenas públicas ----------
    function drawTitle() {
      hideLegend(); hideTooltip();
      renderBaseMap();
      state.bars.style("display", "none").selectAll("*").remove();
      state.root.style("pointer-events", "auto");
      d3.select("#legend").style("display", "none");
    }
    function showMap() {
      hideLegend(); hideTooltip();
      renderBaseMap();
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

    // ---------- Resize ----------
    function updateSize() {
      const { w, h } = sizeFromContainer();
      state.width = w; state.height = h;
      state.root.attr("viewBox", `0 0 ${w} ${h}`);
      fitProjection();

      // Redibuja paths del mapa
      state.layers.map?.selectAll("path.comuna").attr("d", state.path);

      // Reposiciona puntos
      state.layers.points?.selectAll("circle.point")
        .attr("transform", d => {
          const latKey = ["lat", "latitude", "LAT", "Latitud", "latitud"].find(k => k in d) || null;
          const lonKey = ["lon", "lng", "long", "longitude", "LON", "Longitud", "longitud"].find(k => k in d) || null;
          if (!latKey || !lonKey) return null;
          const p = state.projection([+d[lonKey], +d[latKey]]);
          return p ? `translate(${p[0]},${p[1]})` : null;
        });

      // Si hay barras montadas, re-render
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

        state.bars.call(chart, data);
      }
    }

    // ---------- Init ----------
    function init(puestos, geo, comunasAgg) {
      const { w, h } = sizeFromContainer();
      state.width = w; state.height = h;
      state.root.attr("viewBox", `0 0 ${w} ${h}`);
      prepareData(puestos, geo, comunasAgg);
      renderBaseMap();
    }

    // ---------- API ----------
    return {
      init,
      updateSize,
      drawTitle,
      showMap,
      choropleth: choroplethScene,
      choroplet: choropletScene, // alias
      stackedBarsByComuna: stackedBarsScene,
      showCircles: circlesScene,
      _state: state,
      _cfg: cfg
    };
  };
})();
