/* ============================================================
   rag-copilot :: retrieval engine
   Deterministic TF-weighted retrieval over the authored
   corpus. No randomness in ranking - scores come from real
   term-frequency overlap plus manufacturer / code boosts,
   so the same query always returns the same evidence.
   ============================================================ */

const STOP = new Set([
  "the", "a", "an", "on", "of", "to", "for", "and", "with", "in", "is", "are",
  "fault", "error", "defaut", "analyze", "show", "please", "what", "how", "line",
  "the", "une", "le", "la", "de", "du", "sur", "my", "from", "at", "by", "this",
  "that", "it", "we", "i", "need", "help", "find", "procedure", "troubleshoot"
]);

function tokenize(s) {
  return (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w));
}

function countTokens(s) {
  // whitespace + punctuation tokenizer, close to a BPE word count
  return (String(s).match(/[a-z0-9]+/gi) || []).length;
}

const RAG = (() => {
  const docs = CORPUS.map(d => {
    const text = [
      d.code, d.mfr, d.device, d.title, d.cat, d.sev,
      ...d.symptoms, ...d.causes, ...d.procedure, ...d.tools
    ].join(" ");
    const tf = {};
    tokenize(text).forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    return { d, text: text.toLowerCase(), tf };
  });

  const totalTokens = docs.reduce((a, x) => a + countTokens(x.text), 0);
  const vectors = docs.length * EMBED_DIM;

  function mfrCounts() {
    const m = {};
    CORPUS.forEach(d => { m[d.mfr] = (m[d.mfr] || 0) + 1; });
    return m;
  }

  // returns { results:[{doc,score,confidence,matched:[...]}], tokens, latencyMs, embedMs }
  function query(q) {
    const t0 = performance.now();
    const qt = tokenize(q);
    const embedMs = 6 + qt.length * 0.6 + Math.min(8, qt.length); // modeled embed cost

    const scored = docs.map(x => {
      let raw = 0;
      const matched = new Set();
      qt.forEach(tok => {
        if (x.tf[tok]) {
          raw += 1 + Math.log(1 + x.tf[tok]); // TF weighting
          matched.add(tok);
        }
      });
      // structured boosts
      if (x.d.code.toLowerCase() === qt.join("")) raw += 2.0;          // exact code like f001
      if (qt.includes(x.d.mfr.toLowerCase())) raw += 0.8;             // manufacturer named
      if (qt.includes(x.d.device.toLowerCase().replace(/[^a-z0-9]/g, ""))) raw += 0.6;
      const confidence = raw > 0 ? Math.min(0.99, raw / (raw + 0.9)) : 0;
      return { doc: x.d, raw, confidence, matched: [...matched] };
    });

    const results = scored
      .filter(r => r.raw > 0)
      .sort((a, b) => b.raw - a.raw)
      .slice(0, 5);

    const ctxTokens = results.reduce((a, r) =>
      a + countTokens([r.doc.procedure.join(" "), r.doc.causes.join(" "), r.doc.symptoms.join(" ")].join(" ")), 0);

    const latencyMs = performance.now() - t0 + embedMs;
    return {
      results, tokens: ctxTokens, latencyMs, embedMs,
      queryTokens: qt
    };
  }

  function synthesize(top) {
    if (!top) return null;
    return {
      device: top.doc.mfr + " " + top.doc.device,
      code: top.doc.code,
      title: top.doc.title,
      sev: top.doc.sev,
      steps: top.doc.procedure,
      tools: top.doc.tools,
      source: top.doc.manual + ", p." + top.doc.page,
      confidence: top.confidence
    };
  }

  return { query, synthesize, mfrCounts, totalTokens, vectors, docs: CORPUS };
})();
