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
  "WILSON RUIZ ORUEJUELA", "WILSON RUIZ ORUEJUELA"
];

// --------------------------- Colores
const COLOR_EDER  = "#f6d32b"; // amarillo
const COLOR_ORTIZ = "#d94841"; // rojo

// --------------------------- Utilidades
const normalizeTxt = s => (s||"").toString()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toUpperCase().replace(/[\.\-]/g," ").replace(/\s+/g," ").trim();

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const opacityByMargin = m => clamp(0.35 + (m||0)*0.9, 0.35, 1);
const mixEder  = d3.interpolateRgb("#fff6bf", COLOR_EDER);
const mixOrtiz = d3.interpolateRgb("#ffd9d5", COLOR_ORTIZ);

// fuerza de caja para mantener nodos dentro del SVG
function forceBox(pad = 24){
  return function boxForce(){
    for (const d of nodes){
      d.x = clamp(d.x, pad, width - pad);
      d.y = clamp(d.y, pad, height - pad);
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

// --------------------------- INIT
export async function init(){
  const [geojson, rows] = await Promise.all([
    d3.json(PATHS.geoComunas),
    d3.csv(PATHS.csvComunas)
  ]);

  geoComunas = geojson;
  csvComunasMap = new Map(rows.map(r => [normalizeTxt(r["Nombre Comuna"]), r]));

  // métricas por comuna (sin usar %_Eder/%_Ortiz aquí)
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
    .attr("stroke", "#999")
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
    const y0 = showWinner ? 86 : 0;
    const bins = [0,10,20,40,60,80,100]; // %
    const binMids = bins.slice(0,-1).map((b,i)=> (b + bins[i+1]) / 200); // mid 0..1
    const w = 18, h = 12, gap = 4;

    const makeRow = (label, colors) => {
      const g = wrap.append("g").attr("transform", `translate(0, ${label==="Margen Eder"? y0 : y0+30})`);
      g.append("text").attr("x",0).attr("y",-6).attr("font-size",12).attr("fill","#374151").text(label);

      const boxes = g.append("g");
      binMids.forEach((m,i)=>{
        boxes.append("rect")
          .attr("x", i*(w+gap)).attr("y", 0)
          .attr("width", w).attr("height", h)
          .attr("fill", colors(m)).attr("stroke","#aaa").attr("stroke-width",0.5);
        if (i % 2 === 0){
          g.append("text")
            .attr("x", i*(w+gap)+w/2).attr("y", h+12)
            .attr("text-anchor","middle").attr("font-size",10).attr("fill","#111827")
            .text(`${bins[i]}–${bins[i+1]}%`);
        }
      });
    };

    makeRow("Margen Eder",  m => mixEder(m));
    makeRow("Margen Ortiz", m => mixOrtiz(m));
  }
}
function showLegendWinnerOnly(){ drawLegendsPro({ showWinner:true, showMargins:false }); }
function showLegendWinnerAndMargins(){ drawLegendsPro({ showWinner:true, showMargins:true }); }

// ---- Steps mapa
export function toHero(){
  gHero.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.transition().duration(300).attr("opacity", 0.08);
  gPts.transition().duration(300).attr("opacity", 0);
  clearLegends(); gUI.style("display","none");
}
export function toOutline(){
  gHero.transition().duration(300).attr("opacity", 0).on("end", ()=> gHero.style("display","none"));
  gMap.style("display", null).transition().duration(500).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(500).attr("fill","none").attr("stroke","#aaa").attr("pointer-events","none");
  gPts.transition().duration(250).attr("opacity", 0);
  clearLegends(); gUI.style("display","none");
}
export function toChoroplethSimple(){
  gMap.style("display", null).transition().duration(400).attr("opacity", 1).attr("pointer-events","none");
  gMap.selectAll("path").transition().duration(500)
    .attr("stroke","#999")
    .attr("fill", d => {
      const m = d.properties.metrics;
      return m ? winnerColorOnlyEderOrtiz(m.winner) : "#eee";
    })
    .attr("fill-opacity", 1);
  showLegendWinnerOnly();
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
    })
    .attr("pointer-events","none");
  showLegendWinnerAndMargins();
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

    nodes.push({
      id: gid,
      nom_puesto: row.nom_puesto || "",
      territorio: row.territorio || "",
      total, winner, margin,
      ederVotes: eder,
      ortizVotes: ortiz,
      pctEder, pctOrtiz,
      x: xy[0], y: xy[1],
      x0: xy[0], y0: xy[1]
    });
  });

  // escalas y simulación
  rScale = d3.scaleSqrt()
    .domain([0, d3.max(nodes, d => d.total)||1])
    .range([6, 28]);

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
  const m = clamp(d.margin || 0, 0, 1);
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
    .style("cursor","pointer") // UX
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
          <div>Margen: <strong>${fmtPct(Math.max(-1, Math.min(1, mCalc)))}</strong></div>
          ${barHTML}
        </div>`;
      tip.html(html).transition().duration(120).style("opacity",0.98);
      d3.select(this).attr("stroke-width",1.4);
    })
    .on("mouseout", function(){
      tip.transition().duration(120).style("opacity",0);
      d3.select(this).attr("stroke-width",0.7);
    });
}

// ---- Steps puestos
export async function showPointsStep4(){
  await ensurePuestosData();

  gPts.interrupt().style("display", null).attr("opacity", 1).raise();
  gMap.lower();

  gMap.style("display", null).transition().duration(400).attr("opacity", 1);
  gMap.selectAll("path").transition().duration(400).attr("fill","none").attr("stroke","#bbb") .attr("pointer-events","none"); 

  const sel = gPts.selectAll("circle").data(nodes, d => d.id);
  sel.enter().append("circle")
    .attr("r", 0)
    .attr("cx", d => d.x0).attr("cy", d => d.y0)
    .attr("fill", d => colorWinner(d))
    .attr("stroke", "#fff").attr("stroke-width", 0.7)
    .style("pointer-events","all")
    .attr("fill-opacity", 0.95)
    .transition().duration(350)
    .attr("r", PTS_R_STEP4);
  sel.transition().duration(250).attr("opacity", 1);

  bindPointEvents();
  clearLegends(); gUI.style("display","none");
}
export function forceSeparateStep5(){
  if (!simulation) return;
  gPts.interrupt().style("display", null).attr("opacity", 1).raise();
  simulation
    .force("collide", d3.forceCollide(PTS_R_STEP4 + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.25))
    .force("y", d3.forceY(d => d.y0).strength(0.25))
    .alpha(0.9).restart();
}
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

  bindPointEvents();
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
}

// --------------------------- DISPOSICIONES EXTRA (Steps 8–10)
let gClusterLabels = null;

export function reorderXByMargin(){
  if (!nodes?.length || !simulation) return;
  hideClusterLabels();

  const minM = d3.min(nodes, d => d.margin) ?? 0;
  const maxM = d3.max(nodes, d => d.margin) ?? 1e-6;
  const x = d3.scaleLinear().domain([minM, maxM]).range([60, width-60]);

  simulation
    .force("x", d3.forceX(d => x(d.margin)).strength(0.28))
    .alpha(0.9).restart();

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
}
export function clusterByWinnerLabeled(){
  if (!nodes?.length || !simulation) return;

  const winners = Array.from(new Set(nodes.map(d => {
    const w = normalizeTxt(d.winner);
    if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return "Eder";
    if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA"))       return "Ortiz";
    return "Otros";
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
}
export function hideClusterLabels(){
  if (gClusterLabels) gClusterLabels.selectAll("text").remove();
}
