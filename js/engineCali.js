// engineCali.js — flujo Steps 0..10 + leyendas discretas + tooltips
// - 0: Hero con fotos
// - 1: Mapa contornos
// - 2: Choropleth ganador (Eder/Ortiz)
// - 3: Choropleth ganador + opacidad por margen (leyenda discreta)
// - 4: Contornos + puntos por puesto (JOIN robusto)
// - 5: Fuerza de colisión (no se superponen)
// - 6: Burbujas (radio ∝ TOTAL_VOTOS, color por margen)
// - 7: Todas al centro (sin mapa)
// - 8: Reordenar X por margen
// - 9: Reordenar Y por total
// - 10: Clusters por ganador (Eder / Ortiz / Otros) con etiquetas

// --------------------------- Base SVG y capas
const width = 900, height = 640;
const svg = d3.select("#vis").append("svg").attr("viewBox", [0,0,width,height]);

const gHero = svg.append("g").attr("class", "hero");
const gMap  = svg.append("g").attr("class", "map");
const gPts  = svg.append("g").attr("class", "points").style("pointer-events","auto");
const gUI   = svg.append("g").attr("class", "ui");

// --------------------------- Rutas
const PATHS = {
  geoComunas: "geo/cali_polygon.geojson",
  csvComunas: "data/votos_comunas.csv",
  puestosGeo: "geo/puestos.geojson",
  puestosCsv: "data/votos_puestos.csv",
  imgEder:  "img/eder.jpeg",
  imgOrtiz: "img/ortiz.jpeg"
};

// --------------------------- Candidatos (cabeceras CSV)
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
  "WILSON RUIZ ORUEJUELA"
];

// --------------------------- Colores
const COLOR_EDER  = "#e6b800"; // más “oro”
const COLOR_ORTIZ = "#c4372f"; // rojo más profundo

// --------------------------- Utilidades
const normalizeTxt = s => (s||"").toString()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toUpperCase().replace(/[\.\-]/g," ").replace(/\s+/g," ").trim();

let selectedTerritory = null;

function applyTerritoryFilter(){
  const on = !!selectedTerritory;
  gPts.selectAll("circle")
    .transition().duration(200)
    .attr("opacity", d => !on || d.territorio === selectedTerritory ? 1 : 0.18)
    .attr("stroke-width", d => !on || d.territorio === selectedTerritory ? 1.4 : 0.6);
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const opacityByMargin = m => clamp(0.55 + (m||0)*0.7, 0.55, 1);
const mixEder  = d3.interpolateRgb("#f9e093", COLOR_EDER);
const mixOrtiz = d3.interpolateRgb("#f5b3ae", COLOR_ORTIZ);

// Discretizador de márgenes (0–10–20–40–60–80–100)
const marginBins = d3.scaleThreshold()
  .domain([0.10, 0.20, 0.40, 0.60, 0.80])            // márgenes en proporción
  .range([0.05, 0.15, 0.30, 0.50, 0.70, 0.90]);      // intensidades (0..1)

// fuerza de caja para mantener nodos dentro del SVG
function forceBox(pad = 24){
  return function boxForce(){
    for (const d of nodes){
      d.x = clamp(d.x, pad, width - pad);
      d.y = clamp(d.y, pad, height - pad);
    }
  };
}

// Bloquea cada nodo al "lado correcto" del 0% según el ganador.
// xZero: posición del 0% en píxeles. pad: pequeño margen para que no queden pegados.
function forceSideLockFactory(xZero, pad = 6){
  const wE = normalizeTxt("ALVARO ALEJANDRO EDER GARCES");
  const wO = normalizeTxt("ROBERTO ORTIZ URUEÑA");
  return function sideLock(){
    for (const d of nodes){
      const w = normalizeTxt(d.winner);
      if (w === wE && d.x < xZero + pad) d.x = xZero + pad;
      else if (w === wO && d.x > xZero - pad) d.x = xZero - pad;
    }
  };
}




// helpers join
function pickKey(obj, candidates){
  for (const k of candidates){
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null){
      const v = String(obj[k]).trim();
      if (v !== "") return k;
    }
  }
  return null;
}
function normalizeIdLZ(val){ // remueve ceros a la izquierda (si es numérico)
  const s = String(val == null ? "" : val).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return s.replace(/^0+/, "") || "0";
  return s;
}
function getVal(obj, candidates){
  const k = pickKey(obj, candidates);
  return k ? obj[k] : null;
}

// --------------------------- Estado
let projection, path, geoComunas, csvComunasMap;

// puestos
let puestosGeoFeatures = null;
let puestosCsvMap = null;
let nodes = [];
let rScale = null;
let simulation = null;
const PTS_R_STEP4 = 5.2;
const COLL_PAD    = 1.2;
// --- Capa de eje X para el paso 8
let gAxis = null;
let xMarginScale = null;

function ensureAxisLayer(){
  if (!gAxis) {
    gAxis = svg.append("g")
      .attr("class", "x-axis-margin")
      .style("pointer-events","none")
      .style("display","none");
  }
}

// Dibuja/actualiza el eje (ticks abajo) + línea vertical en 0%
function showXAxisForMargin(scale){
  ensureAxisLayer();
  xMarginScale = scale;

  const axisY = height - 22;              // altura del eje (pegado abajo)
  const x0 = xMarginScale(0);

  gAxis.style("display", null).raise();

  // eje abajo (ticks y %)
  const axis = d3.axisBottom(xMarginScale)
    .ticks(6)
    .tickFormat(d3.format(".0%"));

  const gx = gAxis.selectAll("g.axis").data([null]);
  gx.enter().append("g").attr("class","axis")
     .merge(gx)
     .attr("transform", `translate(0,${axisY})`)
     .call(axis);

  // línea vertical en 0%
  const v = gAxis.selectAll("line.zero").data([null]);
  v.enter().append("line").attr("class","zero")
    .merge(v)
    .attr("x1", x0).attr("x2", x0)
    .attr("y1", 56).attr("y2", axisY-8)   // desde arriba del área hasta el eje
    .attr("stroke", "#111").attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3").attr("opacity", .8);

  // etiquetas “Ortiz” a la izquierda y “Eder” a la derecha
  const labels = [
    {x: xMarginScale.range()[0], txt: "Ortiz", anchor:"start"},
    {x: xMarginScale.range()[1], txt: "Eder",  anchor:"end"}
  ];
  const gl = gAxis.selectAll("text.side-label").data(labels);
  gl.enter().append("text").attr("class","side-label")
    .merge(gl)
    .attr("x", d=>d.x).attr("y", axisY+16)
    .attr("text-anchor", d=>d.anchor)
    .attr("font-size", 12).attr("fill", "#374151")
    .text(d=>d.txt);
  gl.exit().remove();
}

function hideXAxis(){
  if (gAxis) gAxis.style("display","none");
}



// --------------------------- INIT
export async function init(){
  const [geojson, rows] = await Promise.all([
    d3.json(PATHS.geoComunas),
    d3.csv(PATHS.csvComunas)
  ]);

  geoComunas = geojson;
  csvComunasMap = new Map(rows.map(r => [normalizeTxt(r["Nombre Comuna"]), r]));

  // métricas por comuna
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

  // proyección
  projection = d3.geoMercator().fitSize([width, height], geoComunas);
  path = d3.geoPath(projection);

  // base
  drawHero();
  drawMapSkeleton();
  clearLegends(); gUI.style("display","none");
}

// --------------------------- HERO (Step 0)
function drawHero(){
  gHero.style("display", null).attr("opacity", 1);

  const r = Math.min(width, height) * 0.22;
  const cx1 = width * 0.36, cy = height * 0.52;
  const cx2 = width * 0.64;

  const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
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

// --------------------------- MAPA (Steps 1..3)
function drawMapSkeleton(){
  const feat = gMap.selectAll("path").data(geoComunas.features, d => d.properties.id);
  feat.enter().append("path")
    .attr("d", path)
    .attr("stroke", "#1b1b1bff")
    .attr("fill", "none");
}
function winnerColorOnlyEderOrtiz(winner){
  const w = normalizeTxt(winner);
  if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return COLOR_EDER;
  if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA"))       return COLOR_ORTIZ;
  return "#d1d5db";
}

// ---- Leyendas
function clearLegends(){ gUI.selectAll("*").remove(); }

// Leyenda pro con MÁRGENES DISCRETOS
function drawLegendsPro({ showWinner=true, showMargins=false } = {}){
  clearLegends();
  gUI.style("display", null).raise();
  const wrap = gUI.append("g").attr("transform", `translate(14,14)`);

  // (1) categórica: ganador
  if (showWinner){
    const winnerScale = d3.scaleOrdinal()
      .domain(["Eder","Ortiz","Otros"])
      .range([COLOR_EDER, COLOR_ORTIZ, "#d1d5db"]);

    wrap.append("text")
      .attr("x", 0).attr("y", 0).attr("dy", "0em")
      .attr("font-size", 12).attr("fill", "#374151")
      .text("Ganador por comuna");

    const lgWinner = d3.legendColor()
      .shapeWidth(18).shapeHeight(12).shapePadding(6)
      .labelOffset(6).orient("vertical")
      .scale(winnerScale);

    wrap.append("g")
      .attr("transform","translate(0,14)")
      .call(lgWinner)
      .selectAll("rect").attr("stroke","#333").attr("stroke-width",0.3);
  }

  // (2) discreta: márgenes por bins 0–10–20–40–60–80–100
  if (showMargins){
    const y0 = showWinner ? 96 : 4;      // más separación del bloque de ganador
    const bins = [0,10,20,40,60,80,100];
    const binMids = bins.slice(0,-1).map((b,i)=> (b + bins[i+1]) / 200);
    const w = 22, h = 12, gap = 6;

    const makeRow = (label, colors, rowIdx) => {
      const yRow = y0 + rowIdx * 48;     // 48px entre filas → no se pisan
      const g = wrap.append("g").attr("transform", `translate(0, ${yRow})`);
      g.append("text").attr("x",0).attr("y",-8).attr("font-size",12)
        .attr("fill","#374151").text(label);

      const boxes = g.append("g").attr("transform","translate(64,0)"); // desplaza cajitas a la derecha
      binMids.forEach((m,i)=>{
        boxes.append("rect")
          .attr("x", i*(w+gap)).attr("y", 0)
          .attr("width", w).attr("height", h)
          .attr("fill", colors(m)).attr("stroke","#888").attr("stroke-width",0.5);
        g.append("text")
          .attr("x", 64 + i*(w+gap) + w/2).attr("y", h+12)
          .attr("text-anchor","middle").attr("font-size",10).attr("fill","#111827")
          .text(`${bins[i]}–${bins[i+1]}%`);
      });
    };

    makeRow("Margen Eder",  m => mixEder(m), 0);
    makeRow("Margen Ortiz", m => mixOrtiz(m), 1);
  }
}
function showLegendWinnerOnly(){ drawLegendsPro({ showWinner:true, showMargins:false }); }
function showLegendWinnerAndMargins(){ drawLegendsPro({ showWinner:true, showMargins:true }); }

// ---- Steps mapa
export function toHero(){
  gHero.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.transition().duration(300).attr("opacity", 0.08);
  gPts.transition().duration(300).attr("opacity", 0);
  hideXAxis();
if (simulation) simulation.force("sideLock", null); 
  clearLegends(); gUI.style("display","none");
}
export function toOutline(){
  gHero.transition().duration(300).attr("opacity", 0).on("end", ()=> gHero.style("display","none"));
  gMap.style("display", null).transition().duration(500).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(500)
    .attr("fill","none").attr("stroke","#aaa").attr("pointer-events","none");
  gPts.transition().duration(250).attr("opacity", 0);
  clearLegends(); gUI.style("display","none");
  hideXAxis();
if (simulation) simulation.force("sideLock", null); 
}
export function toChoroplethSimple(){
  gMap.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(500)
    .attr("stroke","#999")
    .attr("fill", d => {
      const m = d.properties.metrics;
      return m ? winnerColorOnlyEderOrtiz(m.winner) : "#eee";
    })
    .attr("fill-opacity", 1)
    .attr("pointer-events","none");      // evita tapar puntos
  showLegendWinnerOnly();
  hideXAxis();
if (simulation) simulation.force("sideLock", null);
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
      const m = (d.properties.metrics || {}).margin || 0;
      // opacidad DISCRETA por bins
      return marginBins(m);
      // Si quieres continua, usa: return opacityByMargin(m);
    })
    .attr("pointer-events","none");
  showLegendWinnerAndMargins();
  hideXAxis();
if (simulation) simulation.force("sideLock", null);
}

// --------------------------- PUESTOS (Steps 4..7)
async function ensurePuestosData(){
  if (puestosGeoFeatures && puestosCsvMap) return;

  const [gj, rows] = await Promise.all([
    d3.json(PATHS.puestosGeo),
    d3.csv(PATHS.puestosCsv, d3.autoType)
  ]);

  // CSV id: id | id_puesto | ID_PUESTO
  const csvIdKey = pickKey(rows[0] || {}, ["id","id_puesto","ID_PUESTO"]) || "id";
  puestosCsvMap = new Map();
  for (const r of rows){
    const key = normalizeIdLZ(r[csvIdKey]);
    if (!key) continue;
    puestosCsvMap.set(key, r);
  }

  // GEO id: ID_PUESTO | id | Id | Id_Puesto | ID
  puestosGeoFeatures = (gj && gj.features) ? gj.features : [];
  nodes = [];
  const geoIdCandidates = ["ID_PUESTO","id","Id","Id_Puesto","ID"];

  puestosGeoFeatures.forEach(f => {
    if (!f || !f.geometry) return;
    const props = f.properties || {};
    const gid = normalizeIdLZ(getVal(props, geoIdCandidates));
    if (!gid) return;

    const row = puestosCsvMap.get(gid);
    if (!row) return;

    // proyectar
    let xy = null;
    if (f.geometry.type === "Point") xy = projection(f.geometry.coordinates);
    else if (f.geometry.type === "MultiPoint" && f.geometry.coordinates?.length)
      xy = projection(f.geometry.coordinates[0]);
    if (!xy || !isFinite(xy[0]) || !isFinite(xy[1])) return;

    // métricas (votos, total, winner, margin)
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

    // votos Eder / Ortiz y porcentajes
    const eder  = +row["ALVARO ALEJANDRO EDER GARCES"] || 0;
    const ortiz = +row["ROBERTO ORTIZ URUEÑA"]         || 0;

    const parsePct = v => {
      if (v == null || v === "") return null;
      if (typeof v === "number") return v > 1 ? v/100 : v;
      const s = String(v).trim().replace(",", ".").replace("%","");
      const num = +s;
      return isFinite(num) ? (num > 1 ? num/100 : num) : null;
    };
    const pctEder  = parsePct(row["%_Eder"])  ?? (total ? eder/total : null);
    const pctOrtiz = parsePct(row["%_Ortiz"]) ?? (total ? ortiz/total : null);
    const diffEO    = ((pctEder ?? (total ? eder/total : 0)) - (pctOrtiz ?? (total ? ortiz/total : 0)));
    const absDiffEO = Math.abs(diffEO);
    const signedMargin = (pctEder ?? 0) - (pctOrtiz ?? 0); // negativo = Ortiz, positivo = Eder

    nodes.push({
      id: gid,
      nom_puesto: row.nom_puesto || "",
      territorio: row.territorio || "",
      total, winner, margin,
      ederVotes: eder,
      ortizVotes: ortiz,
      pctEder, pctOrtiz,
      diffEO, absDiffEO,
      signedMargin,                                  // <-- NUEVO
      x: xy[0], y: xy[1],
      x0: xy[0], y0: xy[1]
    });
  });

  // escalas y simulación
  rScale = d3.scaleSqrt()
    .domain([0, d3.max(nodes, d => d.total)||1])
    .range([2, 25]);

  simulation = d3.forceSimulation(nodes)
    .force("collide", d3.forceCollide(() => PTS_R_STEP4 + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.12))
    .force("y", d3.forceY(d => d.y0).strength(0.12))
    .force("box", forceBox(24)) // mantiene dentro del SVG
    .alpha(0)
    .on("tick", () => {
      gPts.selectAll("circle").attr("cx", d => d.x).attr("cy", d => d.y);
    })
    .stop();

  console.log("[puestos] CSV:", rows.length, "key:", csvIdKey,
              "| GEO:", puestosGeoFeatures.length, "| nodos:", nodes.length);
}

// colores puntos
function colorWinner(d){
  const w = normalizeTxt(d.winner);
  if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return COLOR_EDER;
  if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA"))       return COLOR_ORTIZ;
  return "#9aa1a9";
}
function colorByMargin(d){
  const w = normalizeTxt(d.winner);
  // Intensidad discreta para mayor contraste:
  const m = marginBins(clamp(d.margin || 0, 0, 1));
  // Si prefieres continua, cambia la línea anterior por:
  // const m = clamp(d.margin || 0, 0, 1);
  if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return mixEder(m);
  if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA"))         return mixOrtiz(m);
  return d3.interpolateRgb("#e9e5fb", "#5b5bd7")(m*0.9 + 0.1);
}

// tooltips
function bindPointEvents(){
  let tip = d3.select("#vTooltip");
  if (tip.empty()){
    tip = d3.select("body").append("div").attr("id","vTooltip")
      .style("position","fixed").style("z-index","9999").style("pointer-events","none")
      .style("padding","10px 12px").style("background","#111827").style("color","#fff")
      .style("border-radius","8px").style("font-size","12px").style("line-height","1.35")
      .style("box-shadow","0 6px 16px rgba(0,0,0,.25)").style("opacity",0);
  }
  const fmtPct = d3.format(".1%");
  const fmtNum = x => (x==null? "—" : (+x).toLocaleString("es-CO"));

  const barW = 160, barH = 10;

  gPts.selectAll("circle")
    .style("cursor","pointer")
    .on("mousemove", function(){
      const ev = d3.event; // d3 v5
      tip.style("left", (ev.clientX + 14) + "px")
         .style("top",  (ev.clientY + 14) + "px");
    })
    .on("mouseover", function(d){
      // % calculados (fallback si vienen nulos)
      const pctE = (d.pctEder  != null) ? d.pctEder  : (d.total ? d.ederVotes/d.total : 0);
      const pctO = (d.pctOrtiz != null) ? d.pctOrtiz : (d.total ? d.ortizVotes/d.total : 0);
      const mCalc = (pctE - pctO);
      // diferencia firmada Eder - Ortiz
      const diffEO = pctE - pctO;
      const diffAbs = Math.abs(diffEO);
      const dir = diffEO >= 0 ? "Eder" : "Ortiz";

      // ancho de barra para cada candidato
      const wE = Math.max(0, Math.min(1, pctE)) * barW;
      const wO = Math.max(0, Math.min(1, pctO)) * barW;

      const barHTML = `
        <div style="margin-top:6px;margin-bottom:2px">Comparación de porcentaje</div>
        <div style="width:${barW}px;height:${barH}px;background:#374151;border-radius:6px;overflow:hidden">
          <div style="float:left;width:${wE}px;height:${barH}px;background:${COLOR_EDER}"></div>
          <div style="float:left;width:${wO}px;height:${barH}px;background:${COLOR_ORTIZ}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;width:${barW}px;margin-top:2px">
          <span>Eder: <strong>${fmtPct(pctE)}</strong></span>
          <span>Ortiz: <strong>${fmtPct(pctO)}</strong></span>
        </div>
      `;

      const html = `
        <div style="max-width:260px">
          <div style="font-weight:700">${d.nom_puesto || d.id}</div>
          <div style="opacity:.9">${d.territorio || ""}</div>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:8px 0"/>
          <div>Eder: <strong>${fmtNum(d.ederVotes)}</strong></div>
          <div>Ortiz: <strong>${fmtNum(d.ortizVotes)}</strong></div>
          <div>Total: <strong>${fmtNum(d.total)}</strong></div>
          <div>Ganador: <strong>${d.winner || "—"}</strong></div>
          <div>Margen: <strong>${fmtPct(diffAbs)}</strong> a favor de <strong>${dir}</strong></div>
          ${barHTML}
        </div>`;
      tip.html(html).transition().duration(120).style("opacity",0.98);
      d3.select(this).attr("stroke-width",1.4);
    })
    .on("mouseout", function(){
      tip.transition().duration(120).style("opacity",0);
      d3.select(this).attr("stroke-width",0.9);  // baseline coherente
    })
    .on("click", function(d){
      d3.event.stopPropagation();
      selectedTerritory = (selectedTerritory === d.territorio) ? null : d.territorio;
      applyTerritoryFilter();
    })
    .on("touchstart", function(d){
      d3.event.stopPropagation();
      selectedTerritory = (selectedTerritory === d.territorio) ? null : d.territorio;
      applyTerritoryFilter();
    });
}

// ---- Steps puestos
// --- Bandera para no re-crear los círculos y util para resetear
let pointsDrawnOnce = false;

function resetNodesToOrigin() {
  // 1) poner las coordenadas de simulación de vuelta al origen
  nodes.forEach(d => {
    d.x = d.x0;
    d.y = d.y0;
  });

  // 2) actualizar el DOM sin animación (o con una corta)
  gPts.selectAll("circle")
    .interrupt()
    .attr("cx", d => d.x0)
    .attr("cy", d => d.y0)
    .attr("r", PTS_R_STEP4)
    .attr("fill", d => colorWinner(d))
    .attr("fill-opacity", 0.95)
    .attr("stroke", "#111")
    .attr("stroke-opacity", 0.9)
    .attr("stroke-width", 0.9);
}

// ---- Step 4: dibujar puntos (idempotente) y resetear estado
export async function showPointsStep4(){
  await ensurePuestosData();

  // Fondo de mapa en contorno
  gMap.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.selectAll("path")
    .transition().duration(400)
    .attr("fill","none")
    .attr("stroke","#020202ff")
    .attr("pointer-events","none");

  // Capa de puntos visible y por encima del mapa
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();
  gMap.lower();

  // 1) Crear círculos SOLO la primera vez
  if (!pointsDrawnOnce) {
    const sel = gPts.selectAll("circle").data(nodes, d => d.id);

    const ent = sel.enter().append("circle")
      .attr("r", 0)
      .attr("cx", d => d.x0)
      .attr("cy", d => d.y0)
      .attr("fill", d => colorWinner(d))
      .attr("fill-opacity", 0.95)
      .attr("stroke", "#111")
      .attr("stroke-opacity", 0.9)
      .attr("stroke-width", 0.9)
      .style("pointer-events", "all")
      .transition().duration(350)
      .attr("r", PTS_R_STEP4);

    sel.exit().remove();

    // Una sola vez: ligar tooltips/interacciones
    bindPointEvents();

    pointsDrawnOnce = true;
    console.log("[step4] circles enter:", ent.size(), "total:", gPts.selectAll("circle").size());
  } else {
    // Si ya estaban, asegúrate de que están visibles
    gPts.selectAll("circle").interrupt().transition().duration(150).attr("opacity", 1);
  }

  // 2) Detén la simulación y restaura posiciones originales para “puntos”
  if (simulation) {
    simulation.alpha(0);    // sin energía
    simulation.stop();      // NO fuerzas activas en step 4
  }
  resetNodesToOrigin();

  // 3) aplicar filtro por territorio si estuviera activo
  applyTerritoryFilter();

  // 4) leyendas/UI fuera en este step
  clearLegends();
  gUI.style("display","none");
}

export function forceSeparateStep5(){
  if (!simulation) return;

  // Asegura estado visual correcto antes de iniciar fuerzas
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();
  resetNodesToOrigin();

  // Asegura z-order y visibilidad del layer de puntos
  gMap.lower();
  gPts.raise().attr("opacity", 1);

  // ——— Tamaño y color desde Step 5 ———
  gPts.selectAll("circle")
    .interrupt() // evita que se queden con r=0 si hubo transición previa cortada
    .attr("r", d => rScale(d.total))      // tamaño ∝ TOTAL_VOTOS
    .attr("fill", d => colorByMargin(d))  // color por margen (como Step 3)
    .attr("fill-opacity", 0.95)
    .attr("stroke", "#1f1e1eff")
    .attr("stroke-opacity", 0.9)
    .attr("stroke-width", 0.9);

  // Fuerzas: colisión en función del radio actual y anclas a su x0,y0
  simulation
    .force("collide", d3.forceCollide(PTS_R_STEP4 + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.25))
    .force("y", d3.forceY(d => d.y0).strength(0.25))
    .alpha(0.9)
    .restart();

  // Tooltips y filtro por territorio siguen funcionando
  bindPointEvents();
  applyTerritoryFilter();

  // Sin leyendas en este paso
  clearLegends(); 
  gUI.style("display","none");
}
export function bubblesByTotalAndMarginStep6(){
  if (!simulation || !rScale) return;

  gPts.interrupt().style("display", null).attr("opacity", 1).raise();

  // Reafirma tamaño y color (idempotente)
  gPts.selectAll("circle")
    .interrupt()
    .attr("r", d => rScale(d.total))
    .attr("fill", d => colorByMargin(d))
    .attr("fill-opacity", 0.95)
    .attr("stroke", "#111")
    .attr("stroke-opacity", 0.9)
    .attr("stroke-width", 0.9);

  // Un poco más de fuerza para resolver solapes al aumentar radios
  simulation
    .force("collide", d3.forceCollide(d => rScale(d.total) + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.22))
    .force("y", d3.forceY(d => d.y0).strength(0.22))
    .alpha(0.8).restart();

  bindPointEvents();
  applyTerritoryFilter();
}

export function centerAllStep7(){
  if (!simulation) return;
  gMap.transition().duration(500).attr("opacity", 0).on("end", () => gMap.style("display","none"));
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();

  simulation
    .force("x", d3.forceX(width/2).strength(0.20))
    .force("y", d3.forceY(height/2).strength(0.20))
    .alpha(0.8).restart();

  clearLegends(); gUI.style("display","none");
  hideXAxis();
if (simulation) simulation.force("sideLock", null);
}

// --------------------------- DISPOSICIONES EXTRA (Steps 8–10)
let gClusterLabels = null;

export function reorderXByMargin(){
  if (!nodes?.length || !simulation) return;
  hideClusterLabels();

  // dominio simétrico alrededor de 0 (margen con signo)
  const maxAbs = d3.max(nodes, d => Math.abs(d.signedMargin ?? 0)) || 0.001;
  const padSide = 80;
  const x = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([padSide, width-padSide]);

  // Fuerzas: X por margen con signo, ligera Y al centro (evita que crucen “por arriba”)
  simulation
    .velocityDecay(0.4)
    .force("x", d3.forceX(d => x(d.signedMargin || 0)).strength(0.5))
    .force("y", d3.forceY(height/2).strength(0.02))
    // bloqueo de lado según ganador (¡clave!)
    .force("sideLock", forceSideLockFactory(x(0), 6))
    .alpha(0.9).restart();

  // Dibuja/actualiza el eje
  showXAxisForMargin(x);

  bindPointEvents();
}



export function reorderYByTotal(){
  if (!nodes?.length || !simulation) return;
  hideClusterLabels();

  const maxT = d3.max(nodes, d => d.total) || 1;
  const y = d3.scaleSqrt().domain([0, maxT]).range([height-60, 60]);

  simulation
    .force("y", d3.forceY(d => y(d.total)).strength(0.30))
    .alpha(0.9).restart();

  bindPointEvents();
  applyTerritoryFilter();   // <--
  hideXAxis();
//if (simulation) simulation.force("sideLock", null); 
}
export function clusterByWinnerLabeled(){
  if (!nodes?.length || !simulation) return;

  const winners = Array.from(new Set(nodes.map(d => {
    const w = normalizeTxt(d.winner);
    if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return "Eder";
    if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA"))       return "Ortiz";
    return "Otros";
    hideXAxis();
if (simulation) simulation.force("sideLock", null);  
  })));

  const x = d3.scaleBand().domain(winners).range([80, width-80]).padding(0.25);
  const centers = new Map(winners.map(w => [w, x(w) + x.bandwidth()/2]));

  simulation
    .force("x", d3.forceX(d => {
      const w = normalizeTxt(d.winner);
      const key = (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) ? "Eder"
               : (w === normalizeTxt("ROBERTO ORTIZ URUEÑA"))         ? "Ortiz" : "Otros";
      return centers.get(key) ?? width/2;
    }).strength(0.30))
    .force("y", d3.forceY(height/2).strength(0.06))
    .alpha(0.9).restart();

  if (!gClusterLabels) gClusterLabels = svg.append("g").attr("class","cluster-labels");
  const labs = gClusterLabels.selectAll("text").data(winners, d => d);
  labs.enter().append("text")
      .attr("text-anchor","middle")
      .attr("font-size", 14).attr("font-weight", 600).attr("fill", "#374151")
    .merge(labs)
      .attr("x", d => centers.get(d))
      .attr("y", 40)
      .text(d => d);
  labs.exit().remove();

  bindPointEvents();
  applyTerritoryFilter();   // <--
}
export function hideClusterLabels(){
  if (gClusterLabels) gClusterLabels.selectAll("text").remove();
}

svg.on("click", () => {
  selectedTerritory = null;
  applyTerritoryFilter();
});
