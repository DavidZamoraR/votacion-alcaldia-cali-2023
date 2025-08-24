// sections.js
// Aquí defines qué pasa en cada sección del storytelling
function activateSection(index) {
  console.clear(); // limpiar consola para ver solo la última acción
  console.log(`👉 Se activó la sección ${index}`);

  switch (index) {
    case 0:
      showIntro();
      break;
    case 1:
      showMapaComunas();
      break;
    case 2:
      showColoresPorCandidato();
      break;
    case 3:
      showResultadosPorPuesto();
      break;
    case 4:
      showCirculosPorPuesto();
      break;
    case 5:
      showComparacionesComunas();
      break;
    case 6:
      showConclusiones();
      break;
    default:
      console.log("Sección no definida");
  }
}

// 📌 Funciones placeholder: aquí luego meterás gráficos D3

function showIntro() {
  console.log("📊 Intro: texto general de las elecciones en Cali");
}

function showMapaComunas() {
  console.log("🗺️ Mostrar mapa de Cali por comunas");
}

function showColoresPorCandidato() {
  console.log("🎨 Colorear comunas según candidato ganador");
}

function showResultadosPorPuesto() {
  d3.select("#vis").html(""); 

  const width = 800;
  const barHeight = 25;

  d3.csv("data/votos.csv").then(data => {
    console.log("Ejemplo de fila:", data[0]); // 👀 para debug

    data.forEach(d => {
      d.TOTAL_VOTOS = +d["TOTAL_VOTOS"];   // asegurar acceso con []
    });

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.TOTAL_VOTOS)])
      .range([0, width - 200]);

    const svg = d3.select("#vis")
      .append("svg")
      .attr("width", width)
      .attr("height", barHeight * data.length + 40);

    svg.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", 150)
      .attr("y", (d, i) => i * barHeight)
      .attr("width", d => x(d.TOTAL_VOTOS))
      .attr("height", barHeight - 4)
      .attr("fill", "steelblue");

    svg.selectAll("text.label")
      .data(data)
      .enter()
      .append("text")
      .attr("x", 145)
      .attr("y", (d, i) => i * barHeight + barHeight / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .text(d => d["nom_puesto"]);  // 👈 usar []

    svg.selectAll("text.value")
      .data(data)
      .enter()
      .append("text")
      .attr("x", d => 150 + x(d.TOTAL_VOTOS) + 5)
      .attr("y", (d, i) => i * barHeight + barHeight / 2)
      .attr("dy", ".35em")
      .text(d => d.TOTAL_VOTOS);
  });
}





function showCirculosPorPuesto() {
  console.log("⚪ Círculos representando puestos (tamaño = votantes)");
}

function showComparacionesComunas() {
  console.log("📊 Comparaciones entre comunas");
}

function showConclusiones() {
  console.log("✅ Conclusiones finales");
}
