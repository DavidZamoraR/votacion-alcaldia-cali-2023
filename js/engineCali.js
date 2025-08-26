// js/engineCali.js
function scrollerCali(puestos, caliGeo, comunasAgg) {
  // estados internos
  let width = 700, height = 520;
  let margin = { top: 20, right: 20, bottom: 20, left: 20 };
  let container = null; // selección d3 del #vis (o chart-container)
  let svg = null;

  // datos
  const dataPuestos = puestos;     // filas de data/votos.csv
  const dataComunas = comunasAgg;  // filas de data/votos_comunas.csv (agregado)
  const geoCali = caliGeo;         // GeoJSON: polígonos comunas

  // mapas de ayuda
  // normalizar nombres de comuna (asume columna 'territorio' en comunasAgg)
  const ganadorPorComuna = (function(){
    const map = new Map();
    dataComunas.forEach(d => {
      const eder = +d["ALVARO ALEJANDRO EDER GARCES"] || 0;
      const ortiz = +d["ROBERTO ORTIZ URUEÑA"] || 0;
      const renteria = +d["DANIS ANTONIO RENTERIA CHALA"] || 0;
      const resto = Math.max( (+d.TOTAL_VOTOS || 0) - (eder+ortiz+renteria), 0 );
      const ganador = (eder>=ortiz) ? "EDER" : "ORTIZ";
      map.set((d.territorio || d.comuna || "").toUpperCase(), { ganador, eder, ortiz, renteria, resto, total:+d.TOTAL_VOTOS||0 });
    });
    return map;
  })();

  // helpers
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
    // intenta varios nombres de propiedad típicos
    return (f.properties?.territorio || f.properties?.COMUNA || f.properties?.NOMBRE || f.properties?.name || '').toString().toUpperCase();
  }

  function colorGanador(info) {
    if (!info) return '#e0e0e0';
    return info.ganador === 'EDER' ? '#FFD700' : '#FF0000';
  }

  // Métodos públicos llamados por sections.js
  function chart(selection) {
    selection.each(function() {
      // contenedor/base donde dibujar
      container = d3.select(this).select('#chart-container').empty()
        ? d3.select(this).append('div').attr('id','chart-container')
        : d3.select(this).select('#chart-container');
      // arranca con nada; sections.js decidirá qué mostrar
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

    // proyección y path
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

  function choroplet(flag=true) {
    clear();
    if (!flag) return;
    const svg = ensureSVG();
    const projection = d3.geoMercator().fitSize([width - margin.left - margin.right, height - margin.top - margin-bottom], geoCali);
    const path = d3.geoPath(projection);

    svg.append('g')
      .selectAll('path')
      .data(geoCali.features || [])
      .join('path')
      .attr('d', path)
      .attr('fill', f => {
        const name = featureName(f);
        const info = ganadorPorComuna.get(name);
        return colorGanador(info);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.7)
      .append('title')
      .text(f => {
        const name = featureName(f);
        const info = ganadorPorComuna.get(name);
        if (!info) return name;
        const pctE = info.total ? (100*info.eder/info.total).toFixed(1) : '0.0';
        const pctO = info.total ? (100*info.ortiz/info.total).toFixed(1) : '0.0';
        return `${name}\nGanador: ${info.ganador}\nEder: ${pctE}%\nOrtiz: ${pctO}%\nTotal: ${d3.format(',')(info.total)}`;
      });

    svg.append('text')
      .attr('x', width/2)
      .attr('y', 24)
      .attr('text-anchor','middle')
      .style('font-size','16px')
      .text('Choropleth por ganador de la comuna');
  }

  function stackedBarsByComuna() {
    clear();
    const containerDiv = d3.select('#chart-container');

    // Prepara datos: una fila por comuna con columnas numéricas para las keys del stacked
    const rows = [];
    ganadorPorComuna.forEach((v, k) => {
      rows.push({
        comuna: k,
        eder: v.eder,
        ortiz: v.ortiz,
        renteria: v.renteria,
        resto: v.resto,
        totalVotos: v.total
      });
    });

    // ordenar por total de votos desc
    rows.sort((a,b) => b.totalVotos - a.totalVotos);

    // Convertir parciales a acumulados (para que el apilado sea correcto con el eje x absoluto)
    // El stackedBarChart que definimos ya consume valores absolutos (no proporciones).
    const chart = stackedBarChart().size(700, 520);
    containerDiv.call(chart, rows); // truco: nuestro chart ignora segundo arg si se usa .call

    // el chart está diseñado para selection.each(data) → así que mejor:
    // containerDiv.datum(rows).call(chart);
    containerDiv.selectAll('*').remove(); // limpiar el div extra
    containerDiv.datum(rows).call(chart);
  }

  // Placeholders (siguen la API de John para poder activarlos desde sections.js)
  function byCities(flag){ /* en nuestro caso no aplica, lo dejamos no-op */ }
  function showCircles(flag, scramble){ 
    clear();
    d3.select('#chart-container').append('div')
      .style('padding','20px')
      .html(`<h4>Puestos de votación</h4><p>(Placeholder) Falta integrar coordenadas para plotear puntos.</p>`);
  }
  function collision(flag){ /* no-op por ahora */ }
  function useSize(flag){ /* no-op por ahora */ }
  function circlesByGeo(flag){ /* no-op hasta tener coords */ }
  function xToCenter(flag){ /* no-op */ }
  function yToCenter(flag){ /* no-op */ }
  function yByPopulation(flag){ /* no-op */ }

  // API pública que sections.js invocará
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
