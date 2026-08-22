/* ============================================================
   rag-copilot :: application controller
   Wires the retrieval engine to the industrial UI: query
   handling, live charts, SCADA/PLC log stream, RAG pipeline
   trace, and the factory-floor feedback module.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const POSToken = "am"; // amber accent used for live metrics

const scadaLog = $("scada-log");
const ragLog = $("rag-log");
const startTime = Date.now();
const latencyHist = [];
const tokenHist = [];
let chunksClassified = 0;
let woCounter = 4812;

const SCADA_TAGS = ["PLC1.L3.CONV", "DRV_G120_A1", "ATV320_B2", "FANUC_SV1", "PF525_C3", "MES_ORDER", "SCADA_GW", "SAFETY_K1"];
const SCADA_MSGS = [
  ["INFO", "heartbeat ok, cycle {n}"],
  ["INFO", "setpoint {n} Hz applied"],
  ["INFO", "batch {n} started"],
  ["WARN", "photoeye drift, count off by {n}"],
  ["WARN", "Vdc controller engaged, regen active"],
  ["ERR", "fault F001 latched on drive"],
  ["ERR", "comms timeout, scanner watchdog"],
  ["INFO", "reset issued by operator"],
  ["INFO", "cycle complete, parts {n}"],
  ["WARN", "motor temp {n} C above nominal"]
];

// ---------------- helpers ----------------
function now() {
  const d = new Date();
  return d.toLocaleTimeString("en-GB", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}
function logLine(container, level, src, msg, max = 140) {
  const row = document.createElement("div");
  row.className = "log-row " + level.toLowerCase();
  const t = document.createElement("span"); t.className = "log-t"; t.textContent = now();
  const l = document.createElement("span"); l.className = "log-l"; l.textContent = level;
  const s = document.createElement("span"); s.className = "log-s"; s.textContent = src;
  const m = document.createElement("span"); m.className = "log-m"; m.textContent = msg;
  row.append(t, l, s, m);
  container.appendChild(row);
  while (container.children.length > max) container.removeChild(container.firstChild);
  container.scrollTop = container.scrollHeight;
}
function scadaPush() {
  const [lvl, tpl] = SCADA_MSGS[Math.floor(Math.random() * SCADA_MSGS.length)];
  const tag = SCADA_TAGS[Math.floor(Math.random() * SCADA_TAGS.length)];
  const msg = tpl.replace("{n}", String(Math.floor(Math.random() * 900) + 10));
  logLine(scadaLog, lvl, tag, msg);
}

function highlight(text, matched) {
  const wrap = document.createElement("div");
  const parts = text.split(/(\b[\w]+\b)/g);
  parts.forEach(p => {
    if (matched.has(p.toLowerCase()) && /[a-z0-9]/.test(p.toLowerCase())) {
      const mk = document.createElement("mark"); mk.textContent = p; wrap.appendChild(mk);
    } else {
      wrap.appendChild(document.createTextNode(p));
    }
  });
  return wrap;
}

// ---------------- charts ----------------
function sparkline(vals, color) {
  const w = 220, h = 46, pad = 3;
  if (vals.length < 2) return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="spark"></svg>';
  const max = Math.max(...vals), min = Math.min(...vals), span = (max - min) || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const area = `M${pad},${h - pad} L` + pts.replace(/ /g, " L") + ` L${w - pad},${h - pad} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="spark">
    <path d="${area}" fill="${color}26"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/>
  </svg>`;
}
function tokenBars(vals) {
  const max = Math.max(1, ...vals);
  return vals.map((v, i) => {
    const pct = (v / max) * 100;
    return `<div class="hbar"><span class="hbar-l">Q${i + 1}</span><span class="hbar-track"><span class="hbar-fill" style="width:${pct.toFixed(0)}%"></span></span><span class="hbar-v">${v}</span></div>`;
  }).join("");
}
function distBars(counts) {
  const max = Math.max(1, ...Object.values(counts));
  return Object.entries(counts).map(([k, v]) => {
    const pct = (v / max) * 100;
    return `<div class="hbar"><span class="hbar-l">${k}</span><span class="hbar-track"><span class="hbar-fill" style="width:${pct.toFixed(0)}%"></span></span><span class="hbar-v">${v}</span></div>`;
  }).join("");
}
function gauge(conf) {
  const pct = (conf * 100).toFixed(0);
  return `<div class="gauge-row"><span class="gauge-track"><span class="gauge-fill" style="width:${pct}%"></span></span><span class="gauge-v">${pct}%</span></div>`;
}

// ---------------- pipeline ----------------
function buildPipeline() {
  const stages = ["INGEST", "EMBED", "RETRIEVE", "RANK", "GENERATE"];
  $("pipeline").innerHTML = stages.map(s =>
    `<div class="stage" data-s="${s}"><div class="stage-n">${s}</div><div class="stage-t" id="st-${s}">--</div></div>`
  ).join("");
}
function pulsePipeline(embedMs, totalMs) {
  const stages = ["INGEST", "EMBED", "RETRIEVE", "RANK", "GENERATE"];
  stages.forEach((s, i) => {
    const el = document.querySelector(`.stage[data-s="${s}"]`);
    setTimeout(() => {
      el.classList.add("active");
      const tt = s === "EMBED" ? embedMs : (totalMs / stages.length);
      $("st-" + s).textContent = tt.toFixed(1) + "ms";
    }, i * 90);
  });
}

// ---------------- query ----------------
function runQuery(q) {
  q = (q || "").trim();
  if (!q) return;
  const t0 = performance.now();
  const res = RAG.query(q);
  const dt = performance.now() - t0;

  // history
  const h = document.createElement("div");
  h.className = "hist-row";
  h.textContent = "› " + q;
  $("query-history").prepend(h);
  while ($("query-history").children.length > 12) $("query-history").lastChild.remove();

  // retrieved chunks
  const box = $("retrieved");
  box.innerHTML = "";
  if (!res.results.length) {
    box.innerHTML = '<div class="empty">No matching chunk. Refine the fault description.</div>';
    $("ctx-answer").innerHTML = "";
    $("cmms-btn").style.display = "none";
  } else {
    res.results.forEach((r, i) => {
      const card = document.createElement("div");
      card.className = "chunk sev-" + r.doc.sev.toLowerCase().replace(/[^a-z]/g, "");
      const head = document.createElement("div");
      head.className = "chunk-head";
      head.innerHTML = `<span class="chunk-src">${r.doc.mfr} · ${r.doc.device} · ${r.doc.code}</span>
        <span class="chunk-score">${(r.confidence * 100).toFixed(0)}%</span>`;
      const body = document.createElement("div");
      body.className = "chunk-body";
      const sm = highlight("Symptoms: " + r.doc.symptoms.join("; "), new Set(r.matched));
      const cs = highlight("Causes: " + r.doc.causes.join("; "), new Set(r.matched));
      body.appendChild(sm); body.appendChild(cs);
      card.append(head, body);
      box.appendChild(card);
    });

    const top = res.results[0];
    const syn = RAG.synthesize(top);
    const ans = $("ctx-answer");
    ans.innerHTML = "";
    const title = document.createElement("div");
    title.className = "ans-title";
    title.innerHTML = `RETRIEVED PROCEDURE — ${syn.device} ${syn.code} (${syn.title}) · ${syn.sev}`;
    const ol = document.createElement("ol");
    syn.steps.forEach(s => { const li = document.createElement("li"); li.textContent = s; ol.appendChild(li); });
    const meta = document.createElement("div");
    meta.className = "ans-meta";
    meta.innerHTML = `Tools: ${syn.tools.join(", ")} &nbsp;|&nbsp; Source: ${syn.source} &nbsp;|&nbsp; Confidence: ${(top.confidence * 100).toFixed(0)}%`;
    ans.append(title, ol, meta);

    $("cmms-btn").style.display = "inline-block";
    $("cmms-btn").dataset.asset = syn.device + " " + syn.code;
  }

  // metrics + charts
  $("t-latency").textContent = res.latencyMs.toFixed(1);
  $("t-tokens").textContent = res.tokens;
  latencyHist.push(res.latencyMs); if (latencyHist.length > 12) latencyHist.shift();
  tokenHist.push(res.tokens); if (tokenHist.length > 12) tokenHist.shift();
  $("chart-latency").innerHTML = sparkline(latencyHist, "#f59e0b");
  $("chart-tokens").innerHTML = tokenBars(tokenHist);
  $("gauge-confidence").innerHTML = gauge(res.results.length ? res.results[0].confidence : 0);
  chunksClassified += res.results.length;
  $("fb-chunks").textContent = chunksClassified;

  // logs
  logLine(ragLog, "INFO", "EMBED", `query -> 384-d vector (${res.queryTokens.length} tok)`);
  logLine(ragLog, "INFO", "RETRIEVE", `ANN search over ${RAG.vectors} vectors`);
  if (res.results.length) {
    logLine(ragLog, "INFO", "RANK", `top chunk ${res.results[0].doc.id} score ${(res.results[0].confidence * 100).toFixed(0)}%`);
    logLine(ragLog, "INFO", "GEN", `answer synthesized from ${res.results.length} chunk(s), ${res.tokens} tok`);
  } else {
    logLine(ragLog, "WARN", "RANK", "no chunk above threshold");
  }
  pulsePipeline(res.embedMs, res.latencyMs);
}

// ---------------- cmms ----------------
$("cmms-btn").addEventListener("click", () => {
  const asset = $("cmms-btn").dataset.asset || "asset";
  woCounter++;
  const wo = "WO-" + woCounter;
  logLine(ragLog, "INFO", "CMMS", `work order ${wo} opened for ${asset}`);
  logLine(scadaLog, "INFO", "MES_ORDER", `work order ${wo} created (${asset})`);
  showToast(`CMMS: ${wo} opened for ${asset}`);
});

// ---------------- feedback ----------------
function buildFeedback() {
  const counts = RAG.mfrCounts();
  $("chart-dist").innerHTML = distBars(counts);
  const dist = [5, 4, 5, 4, 5];
  const labels = ["5/5", "4/5", "3/5", "2/5", "1/5"];
  const maxv = Math.max(1, ...dist);
  $("rating-bars").innerHTML = dist.map((v, i) =>
    `<div class="hbar"><span class="hbar-l">${labels[i]}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(v / maxv) * 100}%"></span></span><span class="hbar-v">${v}</span></div>`
  ).join("");
  const rev = $("reviews");
  REVIEWS.forEach(r => {
    const row = document.createElement("div");
    row.className = "rev";
    row.innerHTML = `<div class="rev-top"><b>${r.op}</b><span class="rev-role">${r.role}</span><span class="rev-stars">${r.rating}/5</span></div>
      <div class="rev-text">${r.text}</div><div class="rev-date">${r.date}</div>`;
    rev.appendChild(row);
  });
}

// ---------------- ui ----------------
function showToast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), 2800);
}

$("query-send").addEventListener("click", () => {
  runQuery($("query-input").value);
  $("query-input").value = "";
});
document.querySelectorAll(".ex").forEach(b => b.addEventListener("click", () => runQuery(b.dataset.q)));

function tickUptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  $("t-uptime").textContent = s;
  const up = (100 - (Math.random() < 0.04 ? Math.random() * 0.2 : 0)).toFixed(1);
  $("fb-uptime").textContent = up + "%";
}

// ---------------- init ----------------
$("t-chunks").textContent = RAG.docs.length;
$("t-embed").textContent = EMBED_DIM;
$("t-temp").textContent = LLM_TEMP.toFixed(2);
$("fb-chunks").textContent = chunksClassified;
buildPipeline();
buildFeedback();
setInterval(scadaPush, 850);
setInterval(tickUptime, 1000);
// seed one query so the dashboard is populated on load
runQuery("Fault F001 on G120 drive, conveyor line 3");
