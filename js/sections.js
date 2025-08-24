// sections.js
// Contiene las funciones de visualización

function showIntro() {
  const chartContainer = d3.select("#chart-container");
  
  chartContainer.html(`
    <div class="text-center py-5">
      <h3>Análisis de votación en Cali 2023</h3>
      <p class="lead">Explora cómo votaron los caleños en las elecciones de alcaldía</p>
      <div class="mt-4">
        <span class="badge bg-warning me-2">Eder Garcés</span>
        <span class="badge bg-danger">Roberto Ortiz</span>
      </div>
      <p class="mt-3">Desplázate hacia abajo para ver el análisis completo</p>
    </div>
  `);
}

function showMapaComunas() {
  const chartContainer = d3.select("#chart-container");
  
  chartContainer.html(`
    <div class="text-center py-4">
      <h4>Mapa de Cali por comunas</h4>
      <div class="mt-3 p-3 bg-light rounded">
        <p>🛠️ Visualización en desarrollo</p>
        <p>Aquí se mostrará un mapa de Cali con las comunas coloreadas según los resultados</p>
      </div>
    </div>
  `);
}

function showColoresPorCandidato() {
  const chartContainer = d3.select("#chart-container");
  
  chartContainer.html(`
    <div class="text-center py-4">
      <h4>Colores por candidato ganador</h4>
      <div class="mt-3 p-3 bg-light rounded">
        <p>🛠️ Visualización en desarrollo</p>
        <p>Aquí se mostrarán las comunas coloreadas según el candidato ganador</p>
      </div>
    </div>
  `);
}

function showResultadosPorPuesto() {
  const chartContainer = d3.select("#chart-container");
  chartContainer.html("");
  
  // Verificar que los datos estén cargados
  if (!electionData || electionData.length === 0) {
    chartContainer.html(`
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando datos...</span>
        </div>
        <p class="mt-2">Cargando datos electorales...</p>
      </div>
    `);
    return;
  }

  // Obtener dimensiones responsivas
  const dim = getResponsiveDimensions();
  const width = dim.width;
  const height = dim.height;
  const margin = dim.margin;

  const svg = chartContainer.append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("class", "img-fluid")
    .attr("viewBox", `0 0 ${width} ${height}`) // Hacer SVG responsive
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Agrupar por comuna
  const dataByComuna = d3.group(electionData, d => d.comuna);
  const comunaSummaries = Array.from(dataByComuna, ([key, values]) => {
    const totalVotos = d3.sum(values, d => d.totalVotos);
    const totalEder = d3.sum(values, d => d.eder);
    const totalOrtiz = d3.sum(values, d => d.ortiz);
    const porcentajeEder = (totalEder / totalVotos) * 100;
    const porcentajeOrtiz = (totalOrtiz / totalVotos) * 100;
    const ganador = porcentajeEder > porcentajeOrtiz ? 
      "ALVARO ALEJANDRO EDER GARCES" : "ROBERTO ORTIZ URUEÑA";
      
    return {
      comuna: key,
      totalVotos,
      ganador,
      totalEder,
      totalOrtiz,
      porcentajeEder: porcentajeEder.toFixed(1),
      porcentajeOrtiz: porcentajeOrtiz.toFixed(1)
    };
  });

  // Ordenar por total de votos
  comunaSummaries.sort((a, b) => b.totalVotos - a.totalVotos);

  // Escalas
  const x = d3.scaleLinear()
    .domain([0, d3.max(comunaSummaries, d => d.totalVotos)])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(comunaSummaries.map(d => d.comuna))
    .range([margin.top, height - margin.bottom])
    .padding(0.2);

  // Escala de colores
  const colorScale = d3.scaleOrdinal()
    .domain(["ALVARO ALEJANDRO EDER GARCES", "ROBERTO ORTIZ URUEÑA"])
    .range(["#FFD700", "#FF0000"]);

  // Dibujar barras
  svg.selectAll(".bar")
    .data(comunaSummaries)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", margin.left)
    .attr("y", d => y(d.comuna))
    .attr("width", d => x(d.totalVotos) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", d => colorScale(d.ganador))
    .attr("rx", 3) // Bordes redondeados
    .attr("ry", 3);

  // Eje Y - Ajustar para móviles
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", isMobileDevice() ? "10px" : "11px")
    .call(wrapText, margin.left - 10); // Ajustar texto largo

  // Eje X
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(isMobileDevice() ? 4 : 5).tickFormat(d3.format(",")))
    .selectAll("text")
    .style("font-size", isMobileDevice() ? "10px" : "11px")
    .attr("transform", isMobileDevice() ? "rotate(-45)" : ""); // Rotar texto en móviles

  // Título - más pequeño en móviles
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", isMobileDevice() ? 15 : 20)
    .attr("text-anchor", "middle")
    .style("font-size", isMobileDevice() ? "14px" : "16px")
    .style("font-weight", "bold")
    .text("Total de votos por comuna");

  // Título
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Total de votos por comuna");

  // Leyenda - reposicionar para móviles
  const legendX = isMobileDevice() ? width / 2 - 75 : width - margin.right + 20;
  const legendY = isMobileDevice() ? height - 60 : margin.top;
  
  const legend = svg.append("g")
    .attr("transform", `translate(${legendX}, ${legendY})`);
  

  const candidates = [
    { name: "Eder Garcés", color: "#FFD700" },
    { name: "Roberto Ortiz", color: "#FF0000" }
  ];

  candidates.forEach((candidate, i) => {
    const legendRow = legend.append("g")
      .attr("transform", `translate(0, ${i * 25})`);

    legendRow.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", candidate.color)
      .attr("rx", 3)
      .attr("ry", 3);

    legendRow.append("text")
      .attr("x", 25)
      .attr("y", 12)
      .text(candidate.name)
      .style("font-size", "12px");
  });

  // Añadir tooltips interactivos
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  svg.selectAll(".bar")
    .on("mouseover", function(event, d) {
      tooltip.transition()
        .duration(200)
        .style("opacity", .9);
      tooltip.html(`
        <strong>${d.comuna}</strong><br>
        Total votos: ${d3.format(",")(d.totalVotos)}<br>
        Eder: ${d.porcentajeEder}% (${d3.format(",")(d.totalEder)})<br>
        Ortiz: ${d.porcentajeOrtiz}% (${d3.format(",")(d.totalOrtiz)})<br>
        Ganador: ${d.ganador.split(' ')[1]}
      `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(d) {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    });
}

// Otras funciones de visualización (mantén las existentes)
function showCirculosPorPuesto() {
  const chartContainer = d3.select("#chart-container");
  
  chartContainer.html(`
    <div class="text-center py-4">
      <h4>Círculos por puesto de votación</h4>
      <div class="mt-3 p-3 bg-light rounded">
        <p>🛠️ Visualización en desarrollo</p>
        <p>Aquí se mostrarán círculos representando cada puesto, con tamaño proporcional a los votos</p>
      </div>
    </div>
  `);
}

function showComparacionesComunas() {
  const chartContainer = d3.select("#chart-container");
  
  chartContainer.html(`
    <div class="text-center py-4">
      <h4>Comparaciones entre comunas</h4>
      <div class="mt-3 p-3 bg-light rounded">
        <p>🛠️ Visualización en desarrollo</p>
        <p>Aquí se compararán los patrones de votación entre diferentes comunas</p>
      </div>
    </div>
  `);
}

function showConclusiones() {
  const chartContainer = d3.select("#chart-container");
  
  // Calcular totales
  const totalVotos = d3.sum(electionData, d => d.totalVotos);
  const totalEder = d3.sum(electionData, d => d.eder);
  const totalOrtiz = d3.sum(electionData, d => d.ortiz);
  const porcentajeEder = ((totalEder / totalVotos) * 100).toFixed(1);
  const porcentajeOrtiz = ((totalOrtiz / totalVotos) * 100).toFixed(1);
  const ganador = totalEder > totalOrtiz ? "Eder Garcés" : "Roberto Ortiz";
  const colorGanador = totalEder > totalOrtiz ? "#FFD700" : "#FF0000";
  
  chartContainer.html(`
    <div class="text-center py-4">
      <h4>Resumen de resultados</h4>
      
      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card border-warning mb-3">
            <div class="card-header bg-warning text-dark">Eder Garcés</div>
            <div class="card-body">
              <h5 class="card-title">${porcentajeEder}%</h5>
              <p class="card-text">${d3.format(",")(totalEder)} votos</p>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card border-danger mb-3">
            <div class="card-header bg-danger text-white">Roberto Ortiz</div>
            <div class="card-body">
              <h5 class="card-title">${porcentajeOrtiz}%</h5>
              <p class="card-text">${d3.format(",")(totalOrtiz)} votos</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="alert alert-success mt-4">
        <h5 class="alert-heading">Ganador: <span style="color: ${colorGanador}">${ganador}</span></h5>
        <p class="mb-0">Total de votos: ${d3.format(",")(totalVotos)}</p>
      </div>
      
      <div class="mt-4">
        <p>Esta visualización muestra cómo se distribuyeron los votos en las elecciones de alcaldía de Cali 2023.</p>
      </div>
    </div>
  `);
}

function wrapText(texts, width) {
  texts.each(function() {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
    const y = text.attr("y");
    const dy = parseFloat(text.attr("dy"));
    let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
    
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
      }
    }
  });
}