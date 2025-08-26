// js/engineCali.js
function scrollerCali(puestos, caliGeo, comunasAgg) {
  let width = 700, height = 520;
  let margin = { top: 20, right: 20, bottom: 20, left: 20 };
  let container = null;
  let svg = null;

  // datos
  const dataPuestos = puestos;
  const dataComunas = comunasAgg;
  const geoCali = caliGeo;

  // tooltip compartido
  const tooltip = d3.select("body")
    .append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255,255,255,0.9)")
    .style("padding", "6px 10px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("pointer-events", "none")
    .style("font-size", "12px")
    .style("opacity", 0);

  // mapear comunas → ganador
  const ganadorPorComuna = new Map();
  comunasAgg.forEach(d => {
    const key = (d["Nombre Comuna"] || "").toString().trim().toUpperCase();
    const eder = +d["%_Eder"] || 0;
    const ortiz = +d["%_Ortiz"] || 0;
    const ganador = eder >= ortiz ? "EDER" : "ORTIZ";
    ganadorPorComuna.set(key, { ...d, ganador });
  });

  function clear() {
    if (!container) return;
    container.selectAll('*').remove();
  }

  function ensureSVG() {
    clear();
    svg = container.append('svg')
      .attr('width', width)
      .attr('height', height);
    return svg;
  }

  function featureName(f) {
    return (f.properties?.territorio || f.properties?.COMUNA || f.properties?.NOMBRE || f.properties?.name || '').toString().toUpperCase();
  }

  function colorGanador(info) {
    if (!info) return '#e0e0e0';
    return info.ganador === 'EDER' ? '#FFD700' : '#FF0000';
  }

  function chart(selection) {
    selection.each(function() {
      container = d3.select(this).select('#chart-container').empty()
        ? d3.select(this).append('div').attr('id','chart-container')
        : d3.select(this).select('#chart-container');
    });
  }

  function drawTitle() {
    clear();
    d3.select('#chart-container')
      .append('div')
      .style('text-align','center')
      .style('padding','40px')
      .html(`<h3>Análisis de votación – Cali 2023</h3>
             <p>Scrollea para ver mapa, choropleth y barras apiladas por comuna.</p>`);
  }

  function showMap(flag=true) {
    clear();
    if (!flag) return;
    const svg = ensureSVG();
    const projection = d3.geoMercator().fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], geoCali);
    const path = d3.geoPath(projection);

    svg.append('g')
      .selectAll('path')
      .data(geoCali.features || [])
      .join('path')
      .attr('d', path)
      .attr('fill', '#f5f5f5')
      .attr('stroke', '#666')
      .attr('stroke-width', 0.5);

    svg.append('text')
      .attr('x', width/2)
      .attr('y', 24)
      .attr('text-anchor','middle')
      .style('font-size','16px')
      .text('Mapa de Cali (comunas)');
  }

  function choroplet(flag = true) {
    clear();
    if (!flag) return;
    const svg = ensureSVG();
    const projection = d3.geoMercator()
      .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], caliGeo);
    const path = d3.geoPath(projection);

    const features = caliGeo.features || [];

    svg.append('g')
      .selectAll('path')
      .data(features)
      .join('path')
      .attr('d', path)
      .attr('fill', f => {
        const id = (f.properties.id || "").toString().trim().toUpperCase();
        const info = ganadorPorComuna.get(id);
        return colorGanador(info);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.7)
      .on("mouseover", function(event, f) {
        d3.select(this).transition().duration(200).attr("stroke-width", 2);
        const id = (f.properties.id || "").toString().trim().toUpperCase();
        const info = ganadorPorComuna.get(id);
        if (info) {
          tooltip.style("opacity", 1).html(`
            <strong>${id}</strong><br>
            Ganador: ${info.ganador}<br>
            Eder: ${info["%_Eder"]}%<br>
            Ortiz: ${info["%_Ortiz"]}%<br>
            Renteria: ${info["%_Renteria"]}%
          `);
        }
      })
      .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", function() {
        d3.select(this).transition().duration(200).attr("stroke-width", 0.7);
        tooltip.style("opacity", 0);
      });

    const legend = svg.append("g")
      .attr("transform", `translate(${width - 150},${height - 80})`);
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 14).attr("height", 14).attr("fill", "#FFD700");
    legend.append("text").attr("x", 20).attr("y", 12).text("Eder").style("font-size","12px");
    legend.append("rect").attr("x", 0).attr("y", 20).attr("width", 14).attr("height", 14).attr("fill", "#FF0000");
    legend.append("text").attr("x", 20).attr("y", 32).text("Ortiz").style("font-size","12px");
  }

  function stackedBarsByComuna() {
    clear();
    const containerDiv = d3.select('#chart-container');

    const rows = [];
    comunasAgg.forEach(d => {
      let base = {
        comuna: d["Nombre Comuna"],
        "%_Eder": +d["%_Eder"] || 0,
        "%_Renteria": +d["%_Renteria"] || 0,
        "%_Ortiz": +d["%_Ortiz"] || 0,
        "%_Vot_Blanco": +d["%_Vot_Blanco"] || 0,
        "%_Miyer_Torres": +d["%_Miyer_Torres"] || 0,
        "%_Vot_NM": +d["%_Vot_NM"] || 0,
        "%_Vot_Nulos": +d["%_Vot_Nulos"] || 0
      };
      base["%_otros"] = Math.max(0, 100 - (
        base["%_Eder"] + base["%_Renteria"] + base["%_Ortiz"] +
        base["%_Vot_Blanco"] + base["%_Miyer_Torres"] +
        base["%_Vot_NM"] + base["%_Vot_Nulos"]
      ));
      rows.push(base);
    });

    const chart = stackedBarChart()
      .keys(["%_Eder","%_Renteria","%_Ortiz","%_Vot_Blanco","%_Miyer_Torres","%_Vot_NM","%_Vot_Nulos","%_otros"])
      .size(700, 520);

    containerDiv.datum(rows).call(chart);
  }

  // placeholders
  function byCities(flag){}
  function showCircles(flag, scramble){
    clear();
    d3.select('#chart-container').append('div')
      .style('padding','20px')
      .html(`<h4>Puestos de votación</h4><p>(Placeholder: integrar coords).</p>`);
  }
  function collision(flag){}
  function useSize(flag){}
  function circlesByGeo(flag){}
  function xToCenter(flag){}
  function yToCenter(flag){}
  function yByPopulation(flag){}

  chart.drawTitle = drawTitle;
  chart.showMap = showMap;
  chart.choroplet = choroplet;
  chart.byCities = byCities;
  chart.showCircles = showCircles;
  chart.collision = collision;
  chart.useSize = useSize;
  chart.circlesByGeo = circlesByGeo;
  chart.xToCenter = xToCenter;
  chart.yToCenter = yToCenter;
  chart.yByPopulation = yByPopulation;
  chart.stackedBarsByComuna = stackedBarsByComuna;

  return chart;
}
