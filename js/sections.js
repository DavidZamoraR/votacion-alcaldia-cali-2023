// Datos globales
let electionData = [];

// Cargar datos
d3.csv("data/votos.csv").then(function(data) {
  electionData = data.map(d => {
    return {
      id: d.id_puesto,
      puesto: d.nom_puesto,
      comuna: d.territorio,
      totalVotos: +d.TOTAL_VOTOS,
      eder: +d["ALVARO ALEJANDRO EDER GARCES"],
      ortiz: +d["ROBERTO ORTIZ URUEÑA"],
      ganador: d.gana
    };
  });

  console.log("✅ Datos cargados:", electionData.length, "puestos");
}).catch(function(error) {
  console.error("❌ Error al cargar los datos:", error);
});

// Funciones de visualización
function showIntro() {
  d3.select("#chart-container").html(`
    <h3>Análisis de votación</h3>
    <p>Explora cómo votó Cali en las elecciones de alcaldía 2023.</p>
  `);
}

function showMapaComunas() {
  d3.select("#chart-container").html(`
    <h4>Mapa de Cali por comunas</h4>
    <p>Visualización en desarrollo.</p>
  `);
}

function showColoresPorCandidato() {
  d3.select("#chart-container").html(`
    <h4>Colores por candidato ganador</h4>
    <p>Aquí se mostrarán las comunas coloreadas según el ganador.</p>
  `);
}

function showResultadosPorPuesto() {
  const chartContainer = d3.select("#chart-container");
  chartContainer.html("");

  const width = 700;
  const height = 500;
  const margin = { top: 40, right: 150, bottom: 100, left: 200 };

  const svg = chartContainer.append("svg")
    .attr("width", width)
    .attr("height", height);

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
      ganador
    };
  });

  comunaSummaries.sort((a, b) => b.totalVotos - a.totalVotos);

  const x = d3.scaleLinear()
    .domain([0, d3.max(comunaSummaries, d => d.totalVotos)])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(comunaSummaries.map(d => d.comuna))
    .range([margin.top, height - margin.bottom])
    .padding(0.2);

  const colorScale = d3.scaleOrdinal()
    .domain(["ALVARO ALEJANDRO EDER GARCES", "ROBERTO ORTIZ URUEÑA"])
    .range(["#FFD700", "#FF0000"]);

  svg.selectAll(".bar")
    .data(comunaSummaries)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", margin.left)
    .attr("y", d => y(d.comuna))
    .attr("width", d => x(d.totalVotos) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", d => colorScale(d.ganador));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(",")));
}

function showCirculosPorPuesto() {
  d3.select("#chart-container").html(`
    <h4>Círculos por puesto</h4>
    <p>Visualización en desarrollo.</p>
  `);
}

function showComparacionesComunas() {
  d3.select("#chart-container").html(`
    <h4>Comparaciones entre comunas</h4>
    <p>Visualización en desarrollo.</p>
  `);
}

function showConclusiones() {
  d3.select("#chart-container").html(`
    <h4>Conclusiones</h4>
    <p>Resumen de los resultados.</p>
  `);
}
