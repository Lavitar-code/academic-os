// src/utils/importNotes.js

export function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function fileNameToSubject(fileName) {
  const base = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base || "Materia";
}

function getImportMode() {
  // compat: se non troviamo settings, default clean
  try {
    const raw = localStorage.getItem("academic_os_settings_v2");
    if (!raw) return "clean";
    const s = JSON.parse(raw);
    return s?.importMode === "aggressive" ? "aggressive" : "clean";
  } catch {
    return "clean";
  }
}

function cleanLines(rawText) {
  const text = String(rawText || "").replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim());

  let filtered = lines.filter((l) => l.length > 0);

  const isOnlyNumber = (l) => /^[0-9]{1,4}$/.test(l);
  const isSlideLine = (l) =>
    /^(slide|pagina|page)\s*\d{1,4}$/i.test(l) ||
    /^(slide|pagina|page)\s*\d{1,4}\s*(\/|\-)\s*\d{1,4}$/i.test(l);
  const isFooterish = (l) =>
    /(copyright|all rights reserved|universit|dipartimento|anno accademico)/i.test(l);

  filtered = filtered.filter((l) => {
    if (isOnlyNumber(l)) return false;
    if (isSlideLine(l)) return false;
    if (isFooterish(l)) return false;
    if (l.length < 3) return false;
    if (l.length > 220) return false;
    return true;
  });

  // headers ripetuti
  const freq = new Map();
  for (const l of filtered) {
    const k = norm(l);
    freq.set(k, (freq.get(k) || 0) + 1);
  }

  filtered = filtered.filter((l) => {
    const k = norm(l);
    if ((freq.get(k) || 0) >= 10) return false;
    return true;
  });

  // dedup vicino
  const out = [];
  let prev = "";
  for (const l of filtered) {
    const k = norm(l);
    if (k === prev) continue;
    prev = k;
    out.push(l);
  }

  return out;
}

function looksLikeHeading(line, mode) {
  const l = String(line || "").trim();
  if (l.length < 4 || l.length > 140) return false;

  // forte
  if (/^(capitolo|unità|unita|lezione|parte|modulo)\s+\d+/i.test(l)) return true;
  if (/^\d+(\.\d+){0,3}\s*[\)\.\-:]\s*[A-Za-zÀ-ÿ]/.test(l)) return true;

  // all caps
  const letters = l.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length >= 8) {
    const upper = letters.replace(/[^A-ZÀ-ß]/g, "").length;
    if (upper / letters.length > 0.85) return true;
  }

  if (/:$/.test(l) && l.length <= 90) return true;

  // aggressivo: più permissivo (es. frasi brevi con parole-chiave)
  if (mode === "aggressive") {
    if (l.length >= 10 && l.length <= 80) {
      // preferisce righe che sembrano titoli (poche virgole/punteggiatura)
      const punct = (l.match(/[,:;]/g) || []).length;
      if (punct <= 1) return true;
    }
  }

  return false;
}

function looksLikeJunkTopic(line) {
  const l = norm(line);
  if (!l) return true;
  if (/^(indice|contenuti|overview|sommario)$/i.test(l)) return true;
  if (l === "titolo" || l === "argomento") return true;
  if (/^[0-9]+$/.test(l)) return true;
  return false;
}

function dedupTopics(topics) {
  const seen = new Set();
  const out = [];
  for (const t of topics) {
    const k = norm(t.name);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function parseNotes(rawText, fallbackSubjectName = "Materia") {
  const mode = getImportMode(); // ✅ pulito o aggressivo
  const lines = cleanLines(rawText);

  // inferisci materia: primo heading forte
  let inferredSubject = "";
  for (const l of lines.slice(0, 60)) {
    if (looksLikeHeading(l, "clean")) {
      inferredSubject = l.replace(/:$/, "").trim();
      break;
    }
  }
  const subjectName = inferredSubject || fallbackSubjectName || "Materia";

  const rawTopics = [];

  for (const l of lines) {
    if (looksLikeHeading(l, mode) && !looksLikeJunkTopic(l)) {
      rawTopics.push({ name: l.replace(/:$/, "").trim(), difficulty: 3 });
    }
  }

  // fallback bullets
  if (rawTopics.length < 5) {
    for (const l of lines) {
      const m = l.match(/^[•\-\*]\s+(.{4,120})$/);
      if (m && !looksLikeJunkTopic(m[1])) rawTopics.push({ name: m[1].trim(), difficulty: 3 });
    }
  }

  const topics = dedupTopics(rawTopics).slice(0, mode === "aggressive" ? 500 : 300);

  return [{ subjectName, topics }];
}