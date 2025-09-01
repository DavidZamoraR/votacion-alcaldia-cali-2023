// engineCali.js — Steps 0..7 (con fixes de opacidad y orden de capas)
// 0: hero con fotos
// 1: contornos comunas
// 2: choropleth ganador (Eder/Ortiz)
// 3: choropleth ganador + opacidad por margen
// 4: contornos + PUNTOS por puesto (color ganador, JOIN robusto geo↔csv)
// 5: puntos con FUERZA de colisión (anclados a su posición geográfica)
// 6: BURBUJAS (radio ∝ TOTAL_VOTOS, color por margen)
// 7: todas las burbujas al CENTRO (sin mapa), con colisión

const width = 900, height = 640;
const svg = d3.select("#vis").append("svg").attr("viewBox", [0,0,width,height]);

// Capas (orden inicial: hero abajo del UI; mapa debajo de puntos)
const gHero = svg.append("g").attr("class", "hero");
const gMap  = svg.append("g").attr("class", "map");
const gPts  = svg.append("g").attr("class", "points").style("pointer-events","none");
const gUI   = svg.append("g").attr("class", "ui");

const PATHS = {
  geoComunas: "geo/cali_polygon.geojson",
  csvComunas: "data/votos_comunas.csv",
  puestosGeo: "geo/puestos.geojson",
  puestosCsv: "data/votos_puestos.csv",
  imgEder:  "img/eder.jpeg",
  imgOrtiz: "img/ortiz.jpeg"
};

// Candidatos (cabeceras comunes)
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
  "WILSON RUIZ OREJUELA", "WILSON RUIZ ORUEJUELA"
];

// Paleta base
const COLOR_EDER  = "#f6d32b"; // amarillo
const COLOR_ORTIZ = "#d94841"; // rojo

// Utilidades básicas
const normalizeTxt = s => (s||"").toString()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toUpperCase().replace(/[\.\-]/g," ").replace(/\s+/g," ").trim();

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const opacityByMargin = m => clamp(0.35 + (m||0)*0.9, 0.35, 1);

// Mezclas para margen
const mixEder  = d3.interpolateRgb("#fff6bf", COLOR_EDER);
const mixOrtiz = d3.interpolateRgb("#ffd9d5", COLOR_ORTIZ);

// ---- Helpers robustos para JOIN ----
function pickKey(obj, candidates){
  for (const k of candidates){
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null){
      const v = String(obj[k]).trim();
      if (v !== "") return k;
    }
  }
  return null;
}
// Normaliza ids tolerando ceros a la izquierda:
// si es puramente numérico -> quita ceros a la izquierda; si tiene letras, deja el texto (solo trim).
function normalizeIdLZ(val){
  const s = String(val == null ? "" : val).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return s.replace(/^0+/, "") || "0";
  return s;
}
function getVal(obj, candidates){
  const k = pickKey(obj, candidates);
  return k ? obj[k] : null;
}

// ---- Estado global ----
let projection, path, geoComunas, csvComunasMap;

// Puestos (steps 4..7)
let puestosGeoFeatures = null;
let puestosCsvMap = null;
let nodes = [];                 // nodos por puesto
let rScale = null;              // radio √ por TOTAL_VOTOS (step 6+)
let simulation = null;          // simulación de fuerzas (step 5+)
const PTS_R_STEP4 = 4.2;        // radio visible step 4
const COLL_PAD    = 1.2;        // padding para colisión

/* ===========================
   INIT (steps 0..3)
=========================== */
export async function init(){
  const [geojson, rows] = await Promise.all([
    d3.json(PATHS.geoComunas),
    d3.csv(PATHS.csvComunas)
  ]);

  geoComunas = geojson;
  csvComunasMap = new Map(rows.map(r => [normalizeTxt(r["Nombre Comuna"]), r]));

  // Enlazar métricas a comunas
  geoComunas.features.forEach(f => {
    const key = normalizeTxt(f.properties.id);
    const row = csvComunasMap.get(key);
    f.properties._row = row || null;

    if (row){
      const candPairs = CANDS.map(c => [c, +row[c] || 0]).sort((a,b) => d3.descending(a[1], b[1]));
      const t1 = candPairs[0] || [null,0];
      const t2 = candPairs[1] || [null,0];

      const blancos = +row["VOTOS EN BLANCO"]   || 0;
      const nulos   = +row["VOTOS NULOS"]       || 0;
      const nomarc  = +row["VOTOS NO MARCADOS"] || 0;
      const total   = d3.sum(candPairs, d=>d[1]) + blancos + nulos + nomarc;

      const winner  = row.gana || t1[0];
      const margin  = total ? (t1[1] - t2[1]) / total : 0;

      f.properties.metrics = { total, winner, margin };
    }
  });

  // Proyección
  projection = d3.geoMercator().fitSize([width, height], geoComunas);
  path = d3.geoPath(projection);

  // Dibujo base
  drawHero();
  drawMapSkeleton();
  drawLegend();
  gUI.style("display","none"); // oculto en step 0
}

/* ===========================
   HERO (Step 0)
=========================== */
function drawHero(){
  gHero.style("display", null).attr("opacity", 1);

  const r = Math.min(width, height) * 0.22;
  const cx1 = width * 0.36, cy = height * 0.52;
  const cx2 = width * 0.64;

  const defs = gHero.append("defs");
  defs.append("clipPath").attr("id","clipEder")
    .append("circle").attr("r", r).attr("cx", cx1).attr("cy", cy);
  defs.append("clipPath").attr("id","clipOrtiz")
    .append("circle").attr("r", r).attr("cx", cx2).attr("cy", cy);

  gHero.append("circle").attr("cx", cx1).attr("cy", cy).attr("r", r)
    .attr("fill","none").attr("stroke", COLOR_EDER).attr("stroke-width", 8);

  gHero.append("circle").attr("cx", cx2).attr("cy", cy).attr("r", r)
    .attr("fill","none").attr("stroke", COLOR_ORTIZ).attr("stroke-width", 8);

  gHero.append("image")
    .attr("href", PATHS.imgEder).attr("x", cx1-r).attr("y", cy-r)
    .attr("width", r*2).attr("height", r*2).attr("clip-path","url(#clipEder)");

  gHero.append("image")
    .attr("href", PATHS.imgOrtiz).attr("x", cx2-r).attr("y", cy-r)
    .attr("width", r*2).attr("height", r*2).attr("clip-path","url(#clipOrtiz)");
}

/* ===========================
   MAPA (Steps 1..3)
=========================== */
function drawMapSkeleton(){
  const feat = gMap.selectAll("path").data(geoComunas.features, d => d.properties.id);
  feat.enter().append("path")
    .attr("d", path)
    .attr("stroke", "#999")
    .attr("fill", "none");
}

function winnerColorOnlyEderOrtiz(winner){
  const w = normalizeTxt(winner);
  if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return COLOR_EDER;
  if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA")) return COLOR_ORTIZ;
  return "#d1d5db"; // gris para otros
}

export function toHero(){
  gHero.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.transition().duration(300).attr("opacity", 0.08);
  gPts.transition().duration(300).attr("opacity", 0);
  gUI.style("display","none");
}

export function toOutline(){
  gHero.transition().duration(300).attr("opacity", 0).on("end", ()=> gHero.style("display","none"));
  gMap.style("display", null).transition().duration(500).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(500).attr("fill","none").attr("stroke","#aaa");
  gPts.transition().duration(250).attr("opacity", 0);
  gUI.style("display","none");
}

export function toChoroplethSimple(){
  gMap.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(500)
    .attr("stroke","#999")
    .attr("fill", d => {
      const m = d.properties.metrics;
      return m ? winnerColorOnlyEderOrtiz(m.winner) : "#eee";
    })
    .attr("fill-opacity", 1);
  gUI.style("display", null);
}

export function toChoroplethMargin(){
  gMap.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(600)
    .attr("stroke","#999")
    .attr("fill", d => {
      const m = d.properties.metrics;
      return m ? winnerColorOnlyEderOrtiz(m.winner) : "#eee";
    })
    .attr("fill-opacity", d => {
      const m = d.properties.metrics || {};
      return opacityByMargin(m.margin || 0);
    });
  gUI.style("display", null);
}

/* ===========================
   PUESTOS (Steps 4..7)
=========================== */
async function ensurePuestosData(){
  if (puestosGeoFeatures && puestosCsvMap) return;

  const [gj, rows] = await Promise.all([
    d3.json(PATHS.puestosGeo),
    d3.csv(PATHS.puestosCsv, d3.autoType)
  ]);

  // --- CSV: detectar columna ID (id | id_puesto | ID_PUESTO) y normalizar con ceros a izq. ---
  const csvIdCandidates = ["id", "id_puesto", "ID_PUESTO"];
  const sampleRow = rows && rows[0] ? rows[0] : {};
  const csvIdKey = pickKey(sampleRow, csvIdCandidates) || "id";

  puestosCsvMap = new Map();
  for (const r of rows){
    const key = normalizeIdLZ(r[csvIdKey]);
    if (!key) continue;
    puestosCsvMap.set(key, r);
  }

  // --- GEO: detectar columna ID (ID_PUESTO | id | Id | Id_Puesto | ID) ---
  puestosGeoFeatures = (gj && gj.features) ? gj.features : [];

  nodes = [];
  const geoIdCandidates = ["ID_PUESTO", "id", "Id", "Id_Puesto", "ID"];

  puestosGeoFeatures.forEach(f => {
    if (!f || !f.geometry) return;
    const props = f.properties || {};
    const gidRaw = getVal(props, geoIdCandidates);
    const gid = normalizeIdLZ(gidRaw);
    if (!gid) return;

    const row = puestosCsvMap.get(gid);
    if (!row) return;

    // proyectar punto
    let xy = null;
    if (f.geometry.type === "Point") {
      xy = projection(f.geometry.coordinates);
    } else if (f.geometry.type === "MultiPoint" && f.geometry.coordinates?.length){
      xy = projection(f.geometry.coordinates[0]);
    }
    if (!xy || !isFinite(xy[0]) || !isFinite(xy[1])) return;

    // métricas desde CSV
    const pairs = CANDS.map(c => [c, +row[c] || 0]).sort((a,b) => d3.descending(a[1], b[1]));
    const t1 = pairs[0] || [null,0];
    const t2 = pairs[1] || [null,0];

    const blancos = +row["VOTOS EN BLANCO"]   || 0;
    const nulos   = +row["VOTOS NULOS"]       || 0;
    const nomarc  = +row["VOTOS NO MARCADOS"] || 0;

    const totalCalc = d3.sum(pairs, d => d[1]) + blancos + nulos + nomarc;
    const total = +row.TOTAL_VOTOS > 0 ? +row.TOTAL_VOTOS : totalCalc;

    const winner = row.gana || t1[0];
    const margin = total ? (t1[1] - t2[1]) / total : 0;

    nodes.push({
      id: gid,
      nom_puesto: row.nom_puesto || "",
      territorio: row.territorio || "",
      total, winner, margin,
      x: xy[0], y: xy[1],    // posición actual
      x0: xy[0], y0: xy[1]   // ancla geográfica
    });
  });

  // Escala y simulación
  rScale = d3.scaleSqrt()
    .domain([0, d3.max(nodes, d => d.total)||1])
    .range([5.5, 28]);

  simulation = d3.forceSimulation(nodes)
    .force("collide", d3.forceCollide(() => PTS_R_STEP4 + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.12))
    .force("y", d3.forceY(d => d.y0).strength(0.12))
    .alpha(0)
    .on("tick", () => {
      gPts.selectAll("circle").attr("cx", d => d.x).attr("cy", d => d.y);
    })
    .stop();

  console.log("[puestos] CSV:", rows.length, "idKey:", csvIdKey,
              "| GEO feats:", puestosGeoFeatures.length,
              "| nodos:", nodes.length);
}

function colorWinner(d){
  const w = normalizeTxt(d.winner);
  if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return COLOR_EDER;
  if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA")) return COLOR_ORTIZ;
  return "#9aa1a9";
}
function colorByMargin(d){
  const w = normalizeTxt(d.winner);
  const m = clamp(d.margin || 0, 0, 1);
  if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return mixEder(m);
  if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA"))       return mixOrtiz(m);
  return d3.interpolateRgb("#e9e5fb", "#5b5bd7")(m*0.9 + 0.1);
}

// ======= STEPS 4..7 =======

// Step 4: puntos por puesto (color ganador)
export async function showPointsStep4(){
  await ensurePuestosData();

  // Asegurar visibilidad y orden de capas
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();
  gMap.lower(); // el mapa queda debajo

  // mapa en contornos
  gMap.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(400).attr("fill","none").attr("stroke","#bbb");

  const sel = gPts.selectAll("circle").data(nodes, d => d.id);
  sel.enter().append("circle")
    .attr("r", 0)
    .attr("cx", d => d.x0).attr("cy", d => d.y0)
    .attr("fill", d => colorWinner(d))
    .attr("stroke", "#fff").attr("stroke-width", 0.7)
    .attr("fill-opacity", 0.95)
    .transition().duration(350)
    .attr("r", PTS_R_STEP4);
  sel.transition().duration(250).attr("opacity", 1);

  gUI.style("display","none");
}

// Step 5: colisión (manteniendo ancla)
export function forceSeparateStep5(){
  if (!simulation) return;
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();

  simulation
    .force("collide", d3.forceCollide(PTS_R_STEP4 + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.25))
    .force("y", d3.forceY(d => d.y0).strength(0.25))
    .alpha(0.9).restart();
}

// Step 6: radio ∝ TOTAL_VOTOS + color por margen
export function bubblesByTotalAndMarginStep6(){
  if (!simulation || !rScale) return;
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();

  gPts.selectAll("circle")
    .transition().duration(500)
    .attr("r", d => rScale(d.total))
    .attr("fill", d => colorByMargin(d))
    .attr("fill-opacity", 0.95);

  simulation
    .force("collide", d3.forceCollide(d => rScale(d.total) + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.18))
    .force("y", d3.forceY(d => d.y0).strength(0.18))
    .alpha(0.7).restart();
}

// Step 7: todo al centro (quitamos mapa)
export function centerAllStep7(){
  if (!simulation) return;

  // ocultar mapa y asegurar puntos visibles arriba
  gMap.transition().duration(500).attr("opacity", 0)
      .on("end", () => gMap.style("display","none"));
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();

  simulation
    .force("x", d3.forceX(width/2).strength(0.20))
    .force("y", d3.forceY(height/2).strength(0.20))
    .alpha(0.8).restart();
}

/* ===========================
   Leyenda mínima para choropleth
=========================== */
function drawLegend(){
  const size = 12, pad = 6;
  const wrap = gUI.append("g").attr("transform", `translate(14,14)`);
  wrap.append("text").attr("x",0).attr("y",0).attr("dy","-0.4em")
    .attr("font-size",12).attr("fill","#374151").text("Ganador por comuna (Eder/Ortiz)");

  const items = [
    {label:"Eder",  color: COLOR_EDER},
    {label:"Ortiz", color: COLOR_ORTIZ},
    {label:"Otros", color: "#d1d5db"}
  ];
  const g = wrap.selectAll("g.lg").data(items).enter().append("g")
    .attr("class","lg").attr("transform",(_,i)=>`translate(0, ${i*(size+pad)+6})`);
  g.append("rect").attr("width",size).attr("height",size)
    .attr("fill",d=>d.color).attr("stroke","#333").attr("stroke-width",0.3);
  g.append("text").attr("x",size+6).attr("y",size/2)
    .attr("dominant-baseline","middle").attr("font-size",12).text(d=>d.label);
}
