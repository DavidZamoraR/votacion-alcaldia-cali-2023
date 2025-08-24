// sections.js
// Aquí defines qué pasa en cada sección del storytelling
console.log("✅ sections.js cargado correctamente");

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
  d3.select("#vis").html(""); // limpiar antes de dibujar algo nuevo

  d3.csv("data/votos.csv").then(data => {
    console.log("📊 Datos cargados:", data);

    // Mostrar en pantalla los nombres de los puestos
    const container = d3.select("#vis")
      .append("div")
      .attr("class", "puestos");

    container.selectAll("p")
      .data(data)
      .enter()
      .append("p")
      .text(d => `Comuna ${d.comuna} - ${d.puesto}: ${d.total_votantes} votantes`);
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
