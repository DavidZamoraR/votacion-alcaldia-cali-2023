// js/sections.js
function initSections(puestos, caliGeo, comunasAgg) {
  // motor gráfico
  const chart = scrollerCali(puestos, caliGeo, comunasAgg);

  // conectar al scroller util
  const scroll = scrollerUtil()
    .container(d3.select('#graphic'))
    .sections(d3.selectAll('.step'))
    .on('active', function(index) {
      console.log("👉 Se activó la sección", index);

      // "reset" sencillo: limpiar vis
      d3.select('#chart-container').selectAll("*").remove();

      // escenas
      if (index === 0) chart.drawTitle();
      else if (index === 1) chart.showMap(true);
      else if (index === 2) chart.choroplet(true);
      else if (index === 3) chart.stackedBarsByComuna();
      else if (index === 4) chart.showCircles(true);
      else if (index === 5) {
        d3.select('#chart-container').append("div")
          .style("padding","40px")
          .html(`<h3>Conclusiones</h3><p>Aquí iría el análisis narrativo final.</p>`);
      }
    });

  return scroll;
}
