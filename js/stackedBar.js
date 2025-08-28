/* stackedBar.js
   Componente reutilizable de barras apiladas (por comuna)
   - D3 v7
   - Uso:
       const chart = stackedBarChart()
         .width(w).height(h)
         .keys(keys)            // array de columnas (%_Eder, %_Ortiz, ...)
         .xKey("Nombre Comuna") // llave categórica del eje X
         .colors(colorScale)    // escala ordinal (clave candidata → color)
         .valueFormat(v => `${d3.format(".1f")(v)}%`)
         .onHover(d => { ... }) // d = { key, value, data, x, y }
         .onLeave(() => { ... });
       d3.select("#bars-container").call(chart, data);
*/

(function () {

  function sanitizeKey(k) {
    return String(k || "").replace(/^%_/, "").replace(/_/g, " ").trim();
  }

  window.stackedBarChart = function stackedBarChart() {
    // ------------------ Config por defecto ------------------
    let width = 800;
    let height = 500;
    let margin = { top: 24, right: 16, bottom: 56, left: 56 };
    let keys = [];                 // columnas apiladas
    let xKey = "Nombre Comuna";    // llave categórica
    let colors = d3.scaleOrdinal(d3.schemeTableau10);
    let valueFormat = v => `${d3.format(".1f")(+v || 0)}%`;
    let onHover = () => {};
    let onLeave = () => {};
    let barPadding = 0.2;

    // ------------------ Render principal ------------------
    function chart(selection) {
      selection.each(function (rawData) {
        if (!rawData || !rawData.length) {
          d3.select(this).html("<em>No hay datos para mostrar</em>");
          return;
        }

        // Asegurar números
        const data = rawData.map(d => {
          const o = { ...d };
          keys.forEach(k => { o[k] = +o[k] || 0; });
          return o;
        });

        // Dominio X y Y
        const xDomain = data.map(d => d[xKey]);
        const yMaxData = d3.max(data, d => d3.sum(keys, k => +d[k] || 0)) || 100;
        const yMax = Math.max(100, Math.ceil(yMaxData)); // asegurar hasta 100

        const innerW = Math.max(10, width - margin.left - margin.right);
        const innerH = Math.max(10, height - margin.top - margin.bottom);

        const x = d3.scaleBand()
          .domain(xDomain)
          .range([margin.left, margin.left + innerW])
          .padding(barPadding);

        const y = d3.scaleLinear()
          .domain([0, yMax])
          .nice()
          .range([margin.top + innerH, margin.top]);

        const colorOf = (k) => {
          const s = sanitizeKey(k);
          // Intentar con la clave saneada; si el ordinal no tiene dominio, igual asigna
          return colors(s);
        };

        // Stack
        const stack = d3.stack().keys(keys).order(d3.stackOrderNone).offset(d3.stackOffsetNone);
        const series = stack(data); // [ [ [y0,y1], ... ] por key ]

        // ---------- JOIN SVG ----------
        const root = d3.select(this);
        let svg = root.selectAll("svg.stackedbars-svg").data([null]);
        svg = svg.join("svg")
          .attr("class", "stackedbars-svg")
          .attr("viewBox", `0 0 ${width} ${height}`)
          .attr("role", "img")
          .attr("aria-label", "Barras apiladas por comuna");

        // Grupos base
        const gGrid = svg.selectAll("g.grid").data([null]).join("g").attr("class", "grid");
        const gBars = svg.selectAll("g.bars").data([null]).join("g").attr("class", "bars");
        const gAxes = svg.selectAll("g.axes").data([null]).join("g").attr("class", "axes");

        // ---------- Grid horizontal ----------
        const gridAxis = d3.axisLeft(y)
          .ticks(5)
          .tickSize(-(innerW))
          .tickFormat("");

        gGrid
          .attr("transform", `translate(${margin.left},0)`)
          .call(gridAxis);

        // ---------- Barras apiladas ----------
        // Un <g> por key (serie apilada)
        const layer = gBars.selectAll("g.layer")
          .data(series, s => s.key);

        const layerEnter = layer.enter()
          .append("g")
          .attr("class", d => `layer key-${d.key.replace(/[^a-z0-9]+/gi, "-")}`)
          .attr("data-key", d => d.key)
          .attr("fill", d => colorOf(d.key));

        const layerAll = layerEnter.merge(layer);

        // Rects por categoría (comuna)
        const rects = layerAll.selectAll("rect.bar-segment")
          .data(s => s.map((dSeg, i) => ({
            key: s.key,
            y0: dSeg[0],
            y1: dSeg[1],
            value: +data[i][s.key] || 0,
            data: data[i]
          })), d => d.data?.[xKey] + "|" + d.key);

        const rectsEnter = rects.enter().append("rect")
          .attr("class", "bar-segment")
          .attr("x", d => x(d.data[xKey]) || 0)
          .attr("y", y(0))
          .attr("width", x.bandwidth())
          .attr("height", 0)
          .attr("rx", 2);

        rectsEnter.merge(rects)
          .transition().duration(650)
          .attr("x", d => x(d.data[xKey]) || 0)
          .attr("y", d => y(d.y1))
          .attr("height", d => Math.max(0, y(d.y0) - y(d.y1)))
          .attr("width", x.bandwidth());

        rects.exit()
          .transition().duration(250)
          .attr("height", 0)
          .attr("y", y(0))
          .remove();

        // Interacciones
        layerAll.selectAll("rect.bar-segment")
          .on("mousemove", function (event, d) {
            const [px, py] = d3.pointer(event, document.body);
            // Highlight del segmento y atenuación de los demás
            gBars.selectAll("rect.bar-segment").classed("dimmed", true);
            d3.select(this).classed("dimmed", false);

            onHover({
              key: d.key,
              value: d.value,
              data: d.data,
              x: px,
              y: py
            });
          })
          .on("mouseleave", function () {
            gBars.selectAll("rect.bar-segment").classed("dimmed", false);
            onLeave();
          });

        // ---------- Ejes ----------
        const xAxis = d3.axisBottom(x).tickSize(0);
        const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`);

        gAxes.selectAll("g.x-axis")
          .data([null])
          .join("g")
          .attr("class", "x-axis axis")
          .attr("transform", `translate(0,${margin.top + innerH})`)
          .call(xAxis)
          .selectAll("text")
          .attr("dy", "1.0em")
          .attr("font-size", 11)
          .each(function () {
            // rotación condicional si hay muchas comunas o el ancho es pequeño
            const tooMany = xDomain.length > 12 || x.bandwidth() < 28;
            d3.select(this)
              .attr("text-anchor", tooMany ? "end" : "middle")
              .attr("transform", tooMany ? "rotate(-35)" : null)
              .attr("dx", tooMany ? "-0.6em" : "0");
          });

        gAxes.selectAll("g.y-axis")
          .data([null])
          .join("g")
          .attr("class", "y-axis axis")
          .attr("transform", `translate(${margin.left},0)`)
          .call(yAxis)
          .call(g => g.selectAll(".domain").attr("opacity", 0.6));

      }); // end selection.each
    }

    // ------------------ Setters encadenables ------------------
    chart.width = function (v) {
      if (!arguments.length) return width;
      width = +v; return chart;
    };

    chart.height = function (v) {
      if (!arguments.length) return height;
      height = +v; return chart;
    };

    chart.margin = function (v) {
      if (!arguments.length) return margin;
      margin = { ...margin, ...v };
      return chart;
    };

    chart.keys = function (arr) {
      if (!arguments.length) return keys;
      keys = Array.isArray(arr) ? arr.slice() : [];
      return chart;
    };

    chart.xKey = function (k) {
      if (!arguments.length) return xKey;
      xKey = k; return chart;
    };

    chart.colors = function (scale) {
      if (!arguments.length) return colors;
      colors = scale; return chart;
    };

    chart.valueFormat = function (fn) {
      if (!arguments.length) return valueFormat;
      valueFormat = fn; return chart;
    };

    chart.onHover = function (fn) {
      if (!arguments.length) return onHover;
      onHover = typeof fn === "function" ? fn : onHover;
      return chart;
    };

    chart.onLeave = function (fn) {
      if (!arguments.length) return onLeave;
      onLeave = typeof fn === "function" ? fn : onLeave;
      return chart;
    };

    chart.barPadding = function (v) {
      if (!arguments.length) return barPadding;
      barPadding = +v; return chart;
    };

    return chart;
  };

})();
