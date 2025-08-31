// engineCali.js — Paso 3: choropleth ↔ contornos ↔ puntos ↔ burbujas con fuerzas
// - JOIN: "Nombre Comuna" (CSV) ↔ properties.id (GeoJSON)  [ajusta si tu GEO usa otra propiedad]
// - Puntos (puestos.geojson) con radio más grande por defecto
// - Burbujas: 1 círculo por comuna, radio ∝ total votos, color por ganador, opacidad ∝ margen
// - Fuerzas: collide + reordenamientos (por margen, por total, por ganador)

const width = 900, height = 640;
const svg = d3.select("#vis").append("svg").attr("viewBox", [0,0,width,height]);

const gMap  = svg.append("g").attr("class", "map");
const gPts  = svg.append("g").attr("class", "points").style("pointer-events","none");
const gBubs = svg.append("g").attr("class", "bubbles").style("display","none");
const gUI   = svg.append("g").attr("class", "ui");

const PATHS = {
  geo:     "geo/cali_polygon.geojson",
  csv:     "data/votos_comunas.csv",
  puestos: "geo/puestos.geojson"
};

// Candidatos (cabeceras del CSV)
const CANDS = [
  "ALVARO ALEJANDRO EDER GARCES",
  "DANIS ANTONIO RENTERIA CHALA",
  "DENINSON MENDOZA RAMOS",
  "DIANA CAROLINA ROJAS ATEHORTUA",
  "EDILSON HUERFANO ORDOÑEZ",
  "HERIBERTO ESCOBAR GONZALEZ",
  "MIYERLANDI TORRES AGREDO",
  "ROBERTO ORTIZ URUEÑA",
  "WILFREDO PARDO HERRERA",
  "WILSON RUIZ OREJUELA"
];

const normalize = s => (s||"")
  .toString()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toUpperCase()
  .replace(/[\.\-]/g," ")
  .replace(/\s+/g," ")
  .trim();

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const partyColor = d3.scaleOrdinal().domain(CANDS).range(d3.schemeCategory10);
const opacityByMargin = m => clamp(0.35 + m*0.9, 0.35, 1);

// Puntos (puestos) más grandes por defecto
const PTS_R_DEFAULT = 3.4;

let projection, path, geo, csvMap;
let puntosLoaded = false, puntosCache = [];
let nodes = [], rScale, simulation;

// ====== INIT ======
export async function init(){
  const [geojson, rows] = await Promise.all([
    d3.json(PATHS.geo),
    d3.csv(PATHS.csv)
  ]);
  geo = geojson;

  // Indexar CSV
  csvMap = new Map(rows.map(r => [normalize(r["Nombre Comuna"]), r]));

  // Enlazar métricas al GEO
  geo.features.forEach(f => {
    const key = normalize(f.properties.id); // <- ajusta si tu GEO usa otra propiedad
    const row = csvMap.get(key);
    f.properties._row = row || null;

    if (row){
      const candPairs = CANDS.map(c => [c, +row[c] || 0]).sort((a,b) => d3.descending(a[1], b[1]));
      const top1 = candPairs[0] || [null,0];
      const top2 = candPairs[1] || [null,0];

      const blancos = +row["VOTOS EN BLANCO"]    || 0;
      const nulos   = +row["VOTOS NULOS"]        || 0;
      const nomarc  = +row["VOTOS NO MARCADOS"]  || 0;
      const total   = d3.sum(candPairs, d=>d[1]) + blancos + nulos + nomarc;

      const winner  = row.gana || top1[0];
      const margin  = total ? (top1[1]-top2[1]) / total : 0;

      f.properties.metrics = { total, winner, margin };
    }
  });

  // Proyección y path
  projection = d3.geoMercator().fitSize([width, height], geo);
  path = d3.geoPath(projection);

  drawChoropleth();
  drawLegend();
  buildBubbles(); // prepara nodos/círculos (se mostrarán cuando se pida)
}

// ====== CHOROPLETH ======
function drawChoropleth(){
  const feat = gMap.selectAll("path").data(geo.features, d => d.properties.id);

  const enter = feat.enter().append("path")
    .attr("d", path)
    .attr("stroke", "#999")
    .attr("fill", d => {
      const m = d.properties.metrics;
      return m ? partyColor(m.winner) : "#eee";
    })
    .attr("fill-opacity", d => {
      const m = d.properties.metrics;
      return m ? opacityByMargin(m.margin) : 1;
    });

  enter.append("title").text(titleText);
  feat.exit().remove();
}

function titleText(d){
  const m = d.properties.metrics || {};
  const pct = (m.margin*100||0).toFixed(1)+"%";
  return `${d.properties.id}
Ganador: ${m.winner||"NA"}
Margen: ${pct}
Total votos: ${m.total||0}`;
}

// ====== MAPA A CONTORNOS ======
export function toOutline(){
  gMap.selectAll("path")
    .transition().duration(500)
    .attr("fill", "none")
    .attr("fill-opacity", 1)
    .attr("stroke", "#aaa");
}

// ====== VOLVER A CHOROPLETH ======
export function toChoropleth(){
  gMap.selectAll("path")
    .transition().duration(500)
    .attr("fill", d => {
      const m = d.properties.metrics;
      return m ? partyColor(m.winner) : "#eee";
    })
    .attr("fill-opacity", d => {
      const m = d.properties.metrics;
      return m ? opacityByMargin(m.margin) : 1;
    })
    .attr("stroke", "#999");
  hidePoints(); // si había puntos visibles, ocultarlos
  hideBubbles(); // si había burbujas visibles, ocultarlas
}

// ====== OVERLAY DE PUNTOS (PUESTOS) ======
async function ensurePuntos(){
  if (puntosLoaded) return;
  const gj = await d3.json(PATHS.puestos);
  puntosCache = gj.features.flatMap(f => {
    if (!f.geometry) return [];
    const g = f.geometry;
    if (g.type === "Point")      return [ projection(g.coordinates) ];
    if (g.type === "MultiPoint") return g.coordinates.map(c => projection(c));
    return [];
  }).filter(Boolean);
  puntosLoaded = true;
}

export async function showPoints(){
  await ensurePuntos();
  const sel = gPts.selectAll("circle").data(puntosCache);

  sel.enter().append("circle")
    .attr("r", 0)
    .attr("cx", d => d[0])
    .attr("cy", d => d[1])
    .attr("fill", "#111827")
    .attr("fill-opacity", 0.85)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.6)
    .transition().duration(350)
    .attr("r", PTS_R_DEFAULT);

  sel.transition().duration(250).attr("opacity", 1);
}

export function hidePoints(hard=true){
  const t = gPts.selectAll("circle").transition().duration(250).attr("opacity", 0);
  if (hard) t.on("end", function(){ d3.select(this).remove(); });
}

// ====== BURBUJAS (NODOS POR COMUNA + FUERZAS) ======
function buildBubbles(){
  const feats = geo.features.filter(f => f.properties?.metrics);
  const cent  = d => path.centroid(d); // centroid en pixeles (proyección aplicada)

  nodes = feats.map(f => {
    const m = f.properties.metrics;
    const [cx, cy] = cent(f);
    return {
      id: f.properties.id,
      winner: m.winner,
      total: m.total,
      margin: m.margin,
      x: cx, y: cy
    };
  });

  rScale = d3.scaleSqrt()
    .domain([0, d3.max(nodes, d => d.total)||1])
    .range([6, 42]); // radio mínimo/máximo de las burbujas

  // Dibuja círculos (inicialmente ocultos)
  const sel = gBubs.selectAll("circle").data(nodes, d => d.id);
  sel.enter().append("circle")
    .attr("r", d => rScale(d.total))
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("fill", d => partyColor(d.winner))
    .attr("fill-opacity", d => opacityByMargin(d.margin))
    .attr("stroke", "#333")
    .attr("stroke-width", 0.6)
    .append("title")
    .text(d => `${d.id}\nGanador: ${d.winner}\nMargen: ${(d.margin*100).toFixed(1)}%\nTotal votos: ${d.total}`);

  // Simulación, parada por defecto (se activa cuando se pidan burbujas)
  simulation = d3.forceSimulation(nodes)
    .force("collide", d3.forceCollide(d => rScale(d.total) + 1.5))
    .force("x", d3.forceX(width/2).strength(0.05))
    .force("y", d3.forceY(height/2).strength(0.05))
    .alpha(0) // quieta por ahora
    .on("tick", () => {
      gBubs.selectAll("circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    })
    .stop();
}

export function toBubbles(){
  // atenuar mapa a contornos y ocultar puntos
  toOutline();
  hidePoints(false);

  gBubs.style("display", null);
  simulation.alpha(0.9).restart();
}

export function hideBubbles(){
  gBubs.style("display", "none");
  if (simulation) simulation.alphaTarget(0).stop();
}

// Reordenamientos narrativos
export function reorderByMargin(){
  if (!nodes?.length) return;
  const minM = d3.min(nodes, d => d.margin) || 0;
  const maxM = d3.max(nodes, d => d.margin) || 1e-6;
  const x = d3.scaleLinear().domain([minM, maxM]).range([80, width-80]);
  simulation
    .force("x", d3.forceX(d => x(d.margin)).strength(0.2))
    .force("y", d3.forceY(height/2).strength(0.03))
    .alpha(0.8).restart();
}

export function reorderByTotal(){
  if (!nodes?.length) return;
  const maxT = d3.max(nodes, d => d.total) || 1;
  const y = d3.scaleSqrt().domain([0, maxT]).range([height-60, 80]);
  simulation
    .force("y", d3.forceY(d => y(d.total)).strength(0.25))
    .force("x", d3.forceX(width/2).strength(0.05))
    .alpha(0.8).restart();
}

export function clusterByWinner(){
  if (!nodes?.length) return;
  const winners = Array.from(new Set(nodes.map(d => d.winner)));
  const x = d3.scaleBand().domain(winners).range([80, width-80]).padding(0.25);
  const centers = new Map(winners.map(w => [w, x(w) + x.bandwidth()/2]));
  simulation
    .force("x", d3.forceX(d => centers.get(d.winner) || width/2).strength(0.25))
    .force("y", d3.forceY(height/2).strength(0.05))
    .alpha(0.8).restart();
}

// ====== LEYENDA ======
function drawLegend(){
  const size = 12, pad = 6;
  const wrap = gUI.append("g").attr("transform", `translate(14,14)`);

  wrap.append("text")
    .attr("x", 0).attr("y", 0).attr("dy", "-0.4em")
    .attr("font-size", 12).attr("fill", "#374151")
    .text("Ganador por comuna");

  const item = wrap.selectAll("g.lg").data(CANDS).enter().append("g")
    .attr("class", "lg")
    .attr("transform", (_,i) => `translate(0, ${i*(size+pad)+6})`);

  item.append("rect")
    .attr("width", size).attr("height", size)
    .attr("fill", d => partyColor(d))
    .attr("stroke", "#333").attr("stroke-width", 0.3);

  item.append("text")
    .attr("x", size + 6).attr("y", size/2)
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .text(d => d);

  // Muestra de puntos
  const pointsLegend = wrap.append("g")
    .attr("transform", `translate(0, ${(CANDS.length*(size+pad))+20})`);
  pointsLegend.append("circle")
    .attr("r", 3.6).attr("cx", size/2).attr("cy", size/2)
    .attr("fill", "#111827").attr("fill-opacity", 0.85)
    .attr("stroke", "#fff").attr("stroke-width", 0.6);
  pointsLegend.append("text")
    .attr("x", size + 6).attr("y", size/2)
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .text("Puestos electorales");
}
