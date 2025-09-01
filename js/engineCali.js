// engineCali.js — Paso 3 (adaptado a PUESTOS)
// Flujo: Choropleth (comunas) ↔ Contornos ↔ Overlay de puntos (puestos) ↔ Burbujas por puesto con fuerzas
// JOIN burbujas: /geo/puestos.geojson (properties.ID_PUESTO) ↔ /data/votos_puestos.csv (id_puesto)

const width = 900, height = 640;
const svg = d3.select("#vis").append("svg").attr("viewBox", [0,0,width,height]);

const gMap  = svg.append("g").attr("class", "map");                       // comunas
const gPts  = svg.append("g").attr("class", "points").style("pointer-events","none"); // overlay de puntos (puestos)
const gBubs = svg.append("g").attr("class", "bubbles").style("display","none");       // burbujas por puesto
const gUI   = svg.append("g").attr("class", "ui");

const PATHS = {
  geoComunas: "geo/cali_polygon.geojson",
  csvComunas: "data/votos_comunas.csv",
  puestosGeo: "geo/puestos.geojson",
  puestosCsv: "data/votos_puestos.csv"
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

// -------- util --------
const normalizeTxt = s => (s||"")
  .toString()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toUpperCase().replace(/[\.\-]/g," ")
  .replace(/\s+/g," ").trim();

const normalizeId = x => String(x == null ? "" : x).trim();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// estilos/opacidades
const partyColor = d3.scaleOrdinal().domain(CANDS).range(d3.schemeCategory10);
const opacityByMargin = m => clamp(0.35 + (m||0)*0.9, 0.35, 1);

// puntos overlay (puestos) más grandes por defecto
const PTS_R_DEFAULT = 3.8;

// -------- estado global --------
let projection, path;
// comunas
let geoComunas, csvComunasMap;
// puestos (overlay)
let puestosGeoFeatures = null;     // features del geo de puestos
let puestosCoordMap = new Map();   // ID_PUESTO -> [x,y]
let puntosLoaded = false;
// burbujas por puesto
let puestosCsvMap = null;          // id_puesto -> row
let nodes = [];                    // nodos burbujas
let rScale, simulation;

// ====== INIT ======
export async function init(){
  const [geojson, rows] = await Promise.all([
    d3.json(PATHS.geoComunas),
    d3.csv(PATHS.csvComunas)
  ]);
  geoComunas = geojson;

  // Indexar CSV comunas (para choropleth de fondo)
  csvComunasMap = new Map(rows.map(r => [normalizeTxt(r["Nombre Comuna"]), r]));

  // Enlazar métricas a comunas
  geoComunas.features.forEach(f => {
    const key = normalizeTxt(f.properties.id);  // ajusta si tu GEO usa otro campo
    const row = csvComunasMap.get(key);
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

  // Proyección global (sobre comunas)
  projection = d3.geoMercator().fitSize([width, height], geoComunas);
  path = d3.geoPath(projection);

  drawChoropleth();  // estado inicial (mapa coloreado)
  drawLegend();      // leyenda de ganadores
}

// ====== CHOROPLETH DE COMUNAS ======
function drawChoropleth(){
  const feat = gMap.selectAll("path").data(geoComunas.features, d => d.properties.id);

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

  enter.append("title").text(d => {
    const m = d.properties.metrics || {};
    const pct = (m.margin*100||0).toFixed(1)+"%";
    return `${d.properties.id}
Ganador: ${m.winner||"NA"}
Margen: ${pct}
Total votos: ${m.total||0}`;
  });

  feat.exit().remove();
}

// ====== MAPA A CONTORNOS / VOLVER A CHOROPLETH ======
export function toOutline(){
  gMap.selectAll("path")
    .transition().duration(500)
    .attr("fill", "none")
    .attr("fill-opacity", 1)
    .attr("stroke", "#aaa");
}

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
  hidePoints();
  hideBubbles();
}

// ====== OVERLAY DE PUNTOS (PUESTOS) ======
async function ensurePuestosGeo(){
  if (puntosLoaded) return;

  const gj = await d3.json(PATHS.puestosGeo);
  puestosGeoFeatures = gj.features || [];

  puestosCoordMap.clear();
  puestosGeoFeatures.forEach(f => {
    if (!f.geometry) return;
    const id = normalizeId(f.properties && f.properties.ID_PUESTO);
    if (!id) return;

    if (f.geometry.type === "Point"){
      puestosCoordMap.set(id, projection(f.geometry.coordinates));
    } else if (f.geometry.type === "MultiPoint" && f.geometry.coordinates?.length){
      puestosCoordMap.set(id, projection(f.geometry.coordinates[0])); // tomamos el primero
    }
    // otros tipos se ignoran en esta capa
  });

  puntosLoaded = true;
}

export async function showPoints(){
  await ensurePuestosGeo();
  const coords = Array.from(puestosCoordMap.values());

  const sel = gPts.selectAll("circle").data(coords);
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

// ====== BURBUJAS CON FUERZAS (PUESTOS) ======
async function ensurePuestosCsv(){
  if (puestosCsvMap) return;
  const rows = await d3.csv(PATHS.puestosCsv, d3.autoType);
  puestosCsvMap = new Map(rows.map(r => [normalizeId(r.id_puesto), r]));
}

function computeMetricsFromRow(row){
  // total y margen a partir de columnas de candidatos
  const pairs = CANDS.map(c => [c, +row[c] || 0]).sort((a,b) => d3.descending(a[1], b[1]));
  const t1 = pairs[0] || [null,0];
  const t2 = pairs[1] || [null,0];

  // Si TOTAL_VOTOS existe, úsalo; de lo contrario, suma candidatos + blancos/nulos/no marcados
  const blancos = +row["VOTOS EN BLANCO"]   || 0;
  const nulos   = +row["VOTOS NULOS"]       || 0;
  const nomarc  = +row["VOTOS NO MARCADOS"] || 0;
  const totalCalc = d3.sum(pairs, d => d[1]) + blancos + nulos + nomarc;
  const total = +row.TOTAL_VOTOS > 0 ? +row.TOTAL_VOTOS : totalCalc;

  const winner = row.gana || t1[0];
  const margin = total ? (t1[1] - t2[1]) / total : 0;

  return { total, winner, margin };
}

async function buildPuestosBubbles(){
  await ensurePuestosGeo();
  await ensurePuestosCsv();

  // Crear nodos por puesto (solo los que hacen match en CSV y GEO)
  nodes = [];
  puestosGeoFeatures.forEach(f => {
    const id = normalizeId(f.properties && f.properties.ID_PUESTO);
    if (!id) return;
    const row = puestosCsvMap.get(id);
    const xy = puestosCoordMap.get(id);
    if (!row || !xy) return;

    const { total, winner, margin } = computeMetricsFromRow(row);
    nodes.push({
      id_puesto: id,
      nom_puesto: row.nom_puesto || "",
      territorio: row.territorio || "",
      total, winner, margin,
      x: xy[0], y: xy[1]
    });
  });

  // Escala de radio (√) — ajusta el máximo si necesitas más/menos separaciones
  rScale = d3.scaleSqrt()
    .domain([0, d3.max(nodes, d => d.total) || 1])
    .range([5.5, 26]); // min/max radio

  // Enlazar círculos
  const sel = gBubs.selectAll("circle").data(nodes, d => d.id_puesto);
  sel.enter().append("circle")
    .attr("r", d => rScale(d.total))
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("fill", d => partyColor(d.winner))
    .attr("fill-opacity", d => opacityByMargin(d.margin))
    .attr("stroke", "#333").attr("stroke-width", 0.6)
    .append("title")
    .text(d =>
      `${d.nom_puesto || d.id_puesto}
Ganador: ${d.winner}
Margen: ${(d.margin*100).toFixed(1)}%
Total votos: ${d.total}`
    );

  // Simulación (parada por defecto)
  simulation = d3.forceSimulation(nodes)
    .force("collide", d3.forceCollide(d => rScale(d.total) + 1.5))
    .force("x", d3.forceX(width/2).strength(0.06))
    .force("y", d3.forceY(height/2).strength(0.06))
    .alpha(0)
    .on("tick", () => {
      gBubs.selectAll("circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    })
    .stop();
}

export async function toBubbles(){
  // Ocultar puntos overlay y atenuar a contornos
  hidePoints();
  toOutline();

  if (!simulation) {
    await buildPuestosBubbles();
  }
  gBubs.style("display", null);
  simulation.alpha(0.9).restart();
}

export function hideBubbles(){
  if (simulation) simulation.alphaTarget(0).stop();
  gBubs.style("display", "none");
}

// Reordenamientos narrativos (PUESTOS)
export function reorderByMargin(){
  if (!nodes?.length) return;
  const minM = d3.min(nodes, d => d.margin) || 0;
  const maxM = d3.max(nodes, d => d.margin) || 1e-6;
  const x = d3.scaleLinear().domain([minM, maxM]).range([80, width-80]);
  simulation
    .force("x", d3.forceX(d => x(d.margin)).strength(0.25))
    .force("y", d3.forceY(height/2).strength(0.04))
    .alpha(0.8).restart();
}

export function reorderByTotal(){
  if (!nodes?.length) return;
  const maxT = d3.max(nodes, d => d.total) || 1;
  const y = d3.scaleSqrt().domain([0, maxT]).range([height-60, 80]);
  simulation
    .force("y", d3.forceY(d => y(d.total)).strength(0.28))
    .force("x", d3.forceX(width/2).strength(0.06))
    .alpha(0.8).restart();
}

export function clusterByWinner(){
  if (!nodes?.length) return;
  const winners = Array.from(new Set(nodes.map(d => d.winner)));
  const x = d3.scaleBand().domain(winners).range([80, width-80]).padding(0.25);
  const centers = new Map(winners.map(w => [w, x(w) + x.bandwidth()/2]));
  simulation
    .force("x", d3.forceX(d => centers.get(d.winner) || width/2).strength(0.28))
    .force("y", d3.forceY(height/2).strength(0.05))
    .alpha(0.8).restart();
}

export function clusterByTerritorio(order = null){
  if (!nodes?.length) return;

  // Dominios de territorio: usa el orden dado o, por defecto, orden alfabético
  const domain = (order && order.length)
    ? order
    : Array.from(new Set(nodes.map(d => d.territorio || "SIN TERRITORIO"))).sort(d3.ascending);

  // Bandas/centros por territorio
  const x = d3.scaleBand().domain(domain).range([80, width - 80]).padding(0.25);
  const centers = new Map(domain.map(t => [t, x(t) + x.bandwidth() / 2]));

  // Aplica fuerzas hacia el centro de cada territorio
  simulation
    .force("x", d3.forceX(d => centers.get(d.territorio || "SIN TERRITORIO") || width/2).strength(0.28))
    .force("y", d3.forceY(height/2).strength(0.05))
    .alpha(0.8)
    .restart();
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

  // muestra de puntos overlay
  const pointsLegend = wrap.append("g")
    .attr("transform", `translate(0, ${(CANDS.length*(size+pad))+20})`);
  pointsLegend.append("circle")
    .attr("r", 4).attr("cx", size/2).attr("cy", size/2)
    .attr("fill", "#111827").attr("fill-opacity", 0.85)
    .attr("stroke", "#fff").attr("stroke-width", 0.6);
  pointsLegend.append("text")
    .attr("x", size + 6).attr("y", size/2)
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .text("Puestos electorales");
}
