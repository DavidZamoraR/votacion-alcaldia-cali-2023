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

function showResultadosPorPuesto() {
  d3.select("#vis").html(""); // limpiar antes de dibujar

  const width = 800;
  const barHeight = 25;

  d3.csv("data/votos.csv").then(data => {
    // convertir a número
    data.forEach(d => {
      d.eder = +d["ALVARO ALEJANDRO EDER GARCES"];
      d.ortiz = +d["ROBERTO ORTIZ URUEÑA"];
      d.renteria = +d["DANIS ANTONIO RENTERIA CHALA"];
      d.resto = +d["TOTAL_VOTOS"] - (d.eder + d.ortiz + d.renteria);
    });

    // claves para la pila
    const keys = ["eder", "ortiz", "renteria", "resto"];

    // colores
    const color = d3.scaleOrdinal()
      .domain(keys)
      .range([
        "#FFD700", // Eder
        "#FF0000", // Ortiz
        "#800080", // Rentería
        "#A9A9A9"  // Otros
      ]);

    // crear pila
    const stack = d3.stack().keys(keys);
    const series = stack(data);

    // escala horizontal proporcional a votos
    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d["TOTAL_VOTOS"])])
      .range([0, width - 200]);

    // crear SVG
    const svg = d3.select("#vis")
      .append("svg")
      .attr("width", width)
      .attr("height", barHeight * data.length + 80);

    // dibujar capas apiladas
    svg.selectAll("g.layer")
      .data(series)
      .enter()
      .append("g")
      .attr("fill", d => color(d.key))
      .selectAll("rect")
      .data(d => d)
      .enter()
      .append("rect")
      .attr("x", d => 150 + x(d[0]))            // inicio acumulado
      .attr("y", (d, i) => i * barHeight)
      .attr("width", d => x(d[1]) - x(d[0]))    // diferencia acumulada
      .attr("height", barHeight - 4);

    // etiquetas de puestos
    svg.selectAll("text.label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", 145)
      .attr("y", (d, i) => i * barHeight + barHeight / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .text(d => d["nom_puesto"]);

    // leyenda
    const legend = svg.append("g")
      .attr("transform", `translate(0, ${barHeight * data.length + 20})`);

    const legendData = [
      { key: "eder", label: "Eder", color: "#FFD700" },
      { key: "ortiz", label: "Ortiz", color: "#FF0000" },
      { key: "renteria", label: "Rentería", color: "#800080" },
      { key: "resto", label: "Otros", color: "#A9A9A9" }
    ];

    legendData.forEach((d, i) => {
      const g = legend.append("g").attr("transform", `translate(${i * 120},0)`);

      g.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("fill", d.color);

      g.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .attr("font-size", "12px")
        .text(d.label);
    });
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
