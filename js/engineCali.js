// engineCali.js — flujo Steps 0..7 + leyendas "pro"
// - 0: Hero con fotos
// - 1: Mapa contornos
// - 2: Choropleth ganador (Eder/Ortiz)
// - 3: Choropleth ganador + opacidad por margen
// - 4: Contornos + puntos por puesto (JOIN robusto)
// - 5: Fuerza de colisión (no se superponen)
// - 6: Burbujas (radio ∝ TOTAL_VOTOS, color por margen)
// - 7: Todas al centro (sin mapa)

const width = 900, height = 640;
const svg = d3.select("#vis").append("svg").attr("viewBox", [0,0,width,height]);

// Capas (orden natural: mapa debajo, puntos encima, UI encima)
const gHero = svg.append("g").attr("class", "hero");
const gMap  = svg.append("g").attr("class", "map");
const gPts  = svg.append("g").attr("class", "points").style("pointer-events","auto");
const gUI   = svg.append("g").attr("class", "ui");

const PATHS = {
  geoComunas: "geo/cali_polygon.geojson",
  csvComunas: "data/votos_comunas.csv",
  puestosGeo: "geo/puestos.geojson",
  puestosCsv: "data/votos_puestos.csv",
  imgEder:  "img/eder.jpeg",
  imgOrtiz: "img/ortiz.jpeg"
};

// Candidatos (cabeceras)
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

// Colores
const COLOR_EDER  = "#f6d32b"; // amarillo
const COLOR_ORTIZ = "#d94841"; // rojo

// -------- utilidades
const normalizeTxt = s => (s||"").toString()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toUpperCase().replace(/[\.\-]/g," ").replace(/\s+/g," ").trim();

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const opacityByMargin = m => clamp(0.35 + (m||0)*0.9, 0.35, 1);
const mixEder  = d3.interpolateRgb("#fff6bf", COLOR_EDER);
const mixOrtiz = d3.interpolateRgb("#ffd9d5", COLOR_ORTIZ);

// helpers de join
function pickKey(obj, candidates){
  for (const k of candidates){
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null){
      const v = String(obj[k]).trim();
      if (v !== "") return k;
    }
  }
  return null;
}
// normaliza ids tolerando ceros a la izquierda (solo numéricos)
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

// -------- estado
let projection, path, geoComunas, csvComunasMap;

// puestos
let puestosGeoFeatures = null;
let puestosCsvMap = null;
let nodes = [];
let rScale = null;
let simulation = null;
const PTS_R_STEP4 = 5.2;
const COLL_PAD    = 1.2;

/* ===========================
   INIT (carga y base)
=========================== */
export async function init(){
  const [geojson, rows] = await Promise.all([
    d3.json(PATHS.geoComunas),
    d3.csv(PATHS.csvComunas)
  ]);

  geoComunas = geojson;
  csvComunasMap = new Map(rows.map(r => [normalizeTxt(r["Nombre Comuna"]), r]));

  // calcula métricas por comuna
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

/* ===========================
   HERO (Step 0)
=========================== */
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
  return "#d1d5db";
}

// ---- Leyendas (pro)
function clearLegends(){ gUI.selectAll("*").remove(); }
function drawLegendsPro({ showWinner=true, showMargins=false } = {}){
  clearLegends();
  gUI.style("display", null).raise();
  const wrap = gUI.append("g").attr("transform", `translate(14,14)`);

  if (showWinner){
    const winnerScale = d3.scaleOrdinal()
      .domain(["Eder","Ortiz","Otros"])
      .range([COLOR_EDER, COLOR_ORTIZ, "#d1d5db"]);
    wrap.append("text")
      .attr("x", 0).attr("y", 0).attr("dy", "0em")
      .attr("font-size", 12).attr("fill", "#374151")
      .text("Ganador por comuna");
    const lgWinner = d3.legendColor()
      .shapeWidth(18).shapeHeight(12)
      .shapePadding(6).labelOffset(6)
      .orient("vertical")
      .scale(winnerScale);
    wrap.append("g")
      .attr("transform","translate(0,14)")
      .call(lgWinner)
      .selectAll("rect").attr("stroke","#333").attr("stroke-width",0.3);
  }

  if (showMargins){
    const y0 = showWinner ? 86 : 0;
    const ramps = [
      {label: "Margen Eder",  from: "#fff6bf", to: COLOR_EDER},
      {label: "Margen Ortiz", from: "#ffd9d5", to: COLOR_ORTIZ}
    ];
    const w = 220, h = 12;
    const gRamps = wrap.append("g").attr("transform", `translate(0, ${y0})`);
    ramps.forEach((r,i)=>{
      const gy = gRamps.append("g").attr("transform", `translate(0, ${i*28})`);
      gy.append("text").attr("x",0).attr("y",-6).attr("font-size",12).attr("fill","#374151").text(r.label);
      const gid = "lg-" + r.label.replace(/\s+/g,"-");
      const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
      const grad = defs.append("linearGradient")
        .attr("id", gid).attr("x1","0%").attr("x2","100%").attr("y1","0%").attr("y2","0%");
      grad.append("stop").attr("offset","0%").attr("stop-color", r.from);
      grad.append("stop").attr("offset","100%").attr("stop-color", r.to);
      gy.append("rect").attr("x",0).attr("y",0).attr("width",w).attr("height",h)
        .attr("fill",`url(#${gid})`).attr("stroke","#aaa").attr("stroke-width",0.5);
      const ticks = [0,25,50,75,100], x = d3.scaleLinear().domain([0,100]).range([0,w]);
      const gt = gy.append("g").attr("transform", `translate(0, ${h+12})`);
      gt.selectAll("line").data(ticks).enter().append("line")
        .attr("x1",d=>x(d)).attr("x2",d=>x(d)).attr("y1",-10).attr("y2",-14).attr("stroke","#888");
      gt.selectAll("text").data(ticks).enter().append("text")
        .attr("x",d=>x(d)).attr("y",0).attr("text-anchor","middle").attr("font-size",10).attr("fill","#111827")
        .text(d=>d+"%");
    });
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
  gMap.selectAll("path").transition().duration(500).attr("fill","none").attr("stroke","#aaa");
  gPts.transition().duration(250).attr("opacity", 0);
  clearLegends(); gUI.style("display","none");
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
    });
  showLegendWinnerAndMargins();
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

    // métricas
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
      x: xy[0], y: xy[1],
      x0: xy[0], y0: xy[1]
    });
  });

  // radio y simulación
  rScale = d3.scaleSqrt()
    .domain([0, d3.max(nodes, d => d.total)||1])
    .range([6, 28]);

  simulation = d3.forceSimulation(nodes)
    .force("collide", d3.forceCollide(() => PTS_R_STEP4 + COLL_PAD))
    .force("x", d3.forceX(d => d.x0).strength(0.12))
    .force("y", d3.forceY(d => d.y0).strength(0.12))
    .alpha(0)
    .on("tick", () => {
      gPts.selectAll("circle").attr("cx", d => d.x).attr("cy", d => d.y);
    })
    .stop();

  console.log("[puestos] CSV:", rows.length, "key:", csvIdKey,
              "| GEO:", puestosGeoFeatures.length, "| nodos:", nodes.length);
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

// tooltips ligeros
function bindPointEvents(){
  let tip = d3.select("#vTooltip");
  if (tip.empty()){
    tip = d3.select("body").append("div").attr("id","vTooltip")
      .style("position","fixed").style("z-index","9999").style("pointer-events","none")
      .style("padding","8px 10px").style("background","#111827").style("color","#fff")
      .style("border-radius","6px").style("font-size","12px").style("line-height","1.35")
      .style("box-shadow","0 2px 8px rgba(0,0,0,.2)").style("opacity",0);
  }
  const fmtPct = d3.format(".1%");
  gPts.selectAll("circle")
    .on("mousemove", function(d){
      const [mx,my] = d3.mouse(document.body);
      tip.style("left",(mx+14)+"px").style("top",(my+14)+"px");
    })
    .on("mouseover", function(d){
      const html = `<strong>${d.nom_puesto || d.id}</strong><br/>
        Votos totales: ${d.total.toLocaleString("es-CO")}<br/>
        Ganador: ${d.winner || "—"}<br/>
        Margen: ${fmtPct(d.margin||0)}`;
      tip.html(html).transition().duration(120).style("opacity",0.95);
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

// ======== DISPOSICIONES EXTRA (pasos 8–10) ========
let gClusterLabels = null;

// 8) Eje X por margen (izq: ajustado, der: contundente)
export function reorderXByMargin(){
  if (!nodes?.length || !simulation) return;
  // quitar etiquetas de cluster si venían del paso 10
  hideClusterLabels();

  const minM = d3.min(nodes, d => d.margin) ?? 0;
  const maxM = d3.max(nodes, d => d.margin) ?? 1e-6;
  const x = d3.scaleLinear().domain([minM, maxM]).range([80, width-80]);

  simulation
    .force("x", d3.forceX(d => x(d.margin)).strength(0.28))
    .alpha(0.9).restart();
}

// 9) Eje Y por total de votos (más votos → más abajo)
export function reorderYByTotal(){
  if (!nodes?.length || !simulation) return;
  hideClusterLabels();

  const maxT = d3.max(nodes, d => d.total) || 1;
  const y = d3.scaleSqrt().domain([0, maxT]).range([height-60, 80]);

  simulation
    .force("y", d3.forceY(d => y(d.total)).strength(0.30))
    .alpha(0.9).restart();
}

// 10) Clusters por ganador con etiquetas
export function clusterByWinnerLabeled(){
  if (!nodes?.length || !simulation) return;

  const winners = Array.from(new Set(nodes.map(d => {
    const w = normalizeTxt(d.winner);
    if (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) return "Eder";
    if (w === normalizeTxt("ROBERTO ORTIZ URUEÑA")) return "Ortiz";
    return "Otros";
  })));

  const x = d3.scaleBand().domain(winners).range([80, width-80]).padding(0.25);
  const centers = new Map(winners.map(w => [w, x(w) + x.bandwidth()/2]));

  simulation
    .force("x", d3.forceX(d => {
      const w = normalizeTxt(d.winner);
      const key = (w === normalizeTxt("ALVARO ALEJANDRO EDER GARCES")) ? "Eder"
               : (w === normalizeTxt("ROBERTO ORTIZ URUEÑA")) ? "Ortiz" : "Otros";
      return centers.get(key) ?? width/2;
    }).strength(0.30))
    .force("y", d3.forceY(height/2).strength(0.06))
    .alpha(0.9).restart();

  // etiquetas
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
}

export function hideClusterLabels(){
  if (gClusterLabels) gClusterLabels.selectAll("text").remove();
}
