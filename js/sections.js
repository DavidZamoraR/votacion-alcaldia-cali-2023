// js/sections.js
/* global d3, scroller, scrollerCali, stackedBarChart */

(function(){
  // Lista de funciones a activar por paso
  let activateFunctions = [];
  let lastIndex = -1;
  let activeIndex = 0;
  let plot = null;

  function setupSections(scrollViz) {
    // Orden de escenas (ajústalo a tus necesidades)
    activateFunctions = [
      () => { scrollViz.drawTitle(); },         // 0
      () => { scrollViz.showMap(true); },       // 1
      () => { scrollViz.choroplet(true); },     // 2
      () => { scrollViz.stackedBarsByComuna(); }, // 3
      () => { scrollViz.showCircles(true, false); }, // 4
      () => { scrollViz.drawTitle(); }          // 5 (conclusión placeholder)
    ];
  }

  function display(loaded) {
    const [puestos, caliGeo, comunasAgg] = loaded;

    // Instancia del motor con los datos
    plot = scrollerCali(puestos, caliGeo, comunasAgg);

    // Dibuja base en #vis
    d3.select("#vis")
      .datum([puestos, caliGeo, comunasAgg])
      .call(plot);

    setupSections(plot);

    // Util de scroll tipo John
    const scr = scroller().container(d3.select("#graphic"));
    scr(d3.selectAll(".step"));

    scr.on("active", function(index) {
      d3.selectAll(".step").classed("active", (d,i) => i === index);
      activeIndex = index;
      const sign = (activeIndex - lastIndex) < 0 ? -1 : 1;
      const scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);
      scrolledSections.forEach(i => {
        if (activateFunctions[i]) activateFunctions[i]();
      });
      lastIndex = activeIndex;
    });

    scr.on("progress", function(index, progress) {
      // en esta versión no usamos updates progresivos
    });

    // activa la primera
    if (activateFunctions[0]) activateFunctions[0]();
  }

  // Carga de datos (tus rutas)
  Promise.all([
    d3.csv("data/votos.csv", d => {
      // parse básico (puedes ampliar)
      d.TOTAL_VOTOS = +d.TOTAL_VOTOS || 0;
      d.territorio = d.territorio;
      return d;
    }),
    d3.json("geo/cali_polygon.geojson"),
    d3.csv("data/votos_comunas.csv", d => {
      d.TOTAL_VOTOS = +d.TOTAL_VOTOS || 0;
      return d;
    })
  ]).then(display)
    .catch(err => {
      console.error("Error cargando datos:", err);
      d3.select("#chart-container").html("<p>Error cargando datos.</p>");
    });

})();
