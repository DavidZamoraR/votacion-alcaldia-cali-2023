// sections.js

console.log("✅ sections.js cargado");

// --- Funciones por sección --- //

function showIntro() {
  console.log("👉 Intro (sección 0) activada");
  d3.select("#vis").html("<p style='padding:20px'>Bienvenido al análisis de resultados.</p>");
}

function showMapaComunas() {
  console.log("🗺️ Mapa comunas (sección 1)");
  d3.select("#vis").html("<p style='padding:20px'>Aquí iría un mapa de comunas (pendiente).</p>");
}

function showColorearComunas() {
  console.log("🎨 Colorear comunas (sección 2)");
  d3.select("#vis").html("<p style='padding:20px'>Aquí iría la versión coloreada por candidato.</p>");
}

// --- Ya existente: resultados por puesto --- //
function showResultadosPorPuesto() {
  console.log("📊 Mostrando resultados por puesto");

  d3.csv("data/votos.csv").then(data => {
    d3.select("#vis").html(""); // limpiar

    const width = 800;
    const barHeight = 20;

    data.forEach(d => {
      d.eder = +d["ALVARO ALEJANDRO EDER GARCES"];
      d.ortiz = +d["ROBERTO ORTIZ URUEÑA"];
      d.renteria = +d["DANIS ANTONIO RENTERIA CHALA"];
      d.resto = +d["TOTAL_VOTOS"] - (d.eder + d.ortiz + d.renteria);
    });

    const keys = ["eder", "ortiz", "renteria", "resto"];

    const color = d3.scaleOrdinal()
      .domain(keys)
      .range(["#FFD700", "#FF0000", "#800080", "#A9A9A9"]);

    const stack = d3.stack().keys(keys);
    const series = stack(data);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d["TOTAL_VOTOS"])])
      .range([0, width - 200]);

    const svg = d3.select("#vis")
      .append("svg")
      .attr("width", width)
      .attr("height", barHeight * data.length + 100);

    svg.selectAll("g.layer")
      .data(series)
      .enter()
      .append("g")
      .attr("fill", d => color(d.key))
      .selectAll("rect")
      .data(d => d)
      .enter()
      .append("rect")
      .attr("x", d => 150 + x(d[0]))
      .attr("y", (d, i) => i * barHeight)
      .attr("width", d => x(d[1]) - x(d[0]))
      .attr("height", barHeight - 2);

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
  });
}

// --- NUEVO: resultados agregados por comuna --- //
function showResultadosPorComuna() {
  console.log("📊 Mostrando votos totales por comuna (territorio)");

  d3.csv("data/votos.csv").then(data => {
    d3.select("#vis").html(""); // limpiar

    const candidatos = [
      "ALVARO ALEJANDRO EDER GARCES",
      "ROBERTO ORTIZ URUEÑA",
      "DANIS ANTONIO RENTERIA CHALA",
      "DIANA CAROLINA ROJAS ATEHORTUA",
      "EDILSON HUERFANO ORDOÑEZ",
      "HERIBERTO ESCOBAR GONZALEZ",
      "MIYERLANDI TORRES AGREDO",
      "WILFREDO PARDO HERRERA",
      "WILSON RUIZ OREJUELA",
      "VOTOS EN BLANCO",
      "VOTOS NO MARCADOS",
      "VOTOS NULOS"
    ];

    // Agrupar por territorio
    const votosPorComuna = d3.rollups(
      data,
      v => {
        let totales = {};
        candidatos.forEach(c => (totales[c] = d3.sum(v, d => +d[c])));
        totales["TOTAL_VOTOS"] = d3.sum(v, d => +d.TOTAL_VOTOS);

        // definir ganador de la comuna
        const ganador = Object.entries(totales)
          .filter(([k]) => candidatos.includes(k))
          .sort((a, b) => d3.descending(a[1], b[1]))[0][0];

        return { ...totales, gana_comuna: ganador };
      },
      d => d.territorio
    ).map(([territorio, valores]) => ({ territorio, ...valores }));

    // Configuración gráfica
    const width = 800;
    const height = 500;
    const margin = { top: 40, right: 20, bottom: 100, left: 80 };

    const svg = d3.select("#vis")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const x = d3.scaleBand()
      .domain(votosPorComuna.map(d => d.territorio))
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(votosPorComuna, d => d.TOTAL_VOTOS)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const colorGanador = d3.scaleOrdinal()
      .domain(["ALVARO ALEJANDRO EDER GARCES", "ROBERTO ORTIZ URUEÑA"])
      .range(["#FFD700", "#FF0000"]);

    // Dibujar barras
    svg.selectAll(".bar")
      .data(votosPorComuna)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.territorio))
      .attr("y", d => y(d.TOTAL_VOTOS))
      .attr("width", x.bandwidth())
      .attr("height", d => y(0) - y(d.TOTAL_VOTOS))
      .attr("fill", d => colorGanador(d.gana_comuna) || "#A9A9A9");

    // Ejes
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));
  });
}

// --- Controlador de secciones --- //
function activateSection(index) {
  console.log("👉 Se activó la sección " + index);

  switch (index) {
    case 0: showIntro(); break;
    case 1: showMapaComunas(); break;
    case 2: showColorearComunas(); break;
    case 3: showResultadosPorPuesto(); break;
    case 4: showResultadosPorComuna(); break;
    default:
      console.log("Sección sin función aún");
  }
}
