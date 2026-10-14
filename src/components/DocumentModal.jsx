// src/components/DocumentModal.jsx
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../database/db";
import { daysToExam, nextSchedule } from "../utils/reviewScheduler";

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
      {children}
    </span>
  );
}

function cut(s, n) {
  const str = String(s || "");
  if (str.length <= n) return str;
  return str.slice(0, n) + "…";
}

function normalize(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hashStr(str) {
  const s = normalize(str);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function makeSnippets(text, q, limit = 25) {
  const t = String(text || "");
  const query = String(q || "").trim();
  if (query.length < 2) return [];
  const lowT = t.toLowerCase();
  const lowQ = query.toLowerCase();

  const out = [];
  let idx = 0;
  while (out.length < limit) {
    const pos = lowT.indexOf(lowQ, idx);
    if (pos === -1) break;

    const start = Math.max(0, pos - 120);
    const end = Math.min(t.length, pos + lowQ.length + 120);
    out.push({ pos, snippet: t.slice(start, end) });

    idx = pos + lowQ.length;
  }
  return out;
}

function generateQuestions({ outline = [], text = "" }, n = 5) {
  const out = [];
  const used = new Set();

  const clean = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .replace(/^[•\-\*]\s+/, "")
      .trim();

  const pushQ = (q, source = "auto", ref = "") => {
    const key = normalize(q);
    if (used.has(key)) return;
    used.add(key);
    out.push({ q, source, ref });
  };

  const ol = (outline || []).map(clean).filter((x) => x.length >= 6 && x.length <= 120);
  for (let i = 0; i < ol.length && out.length < n; i++) {
    const t = ol[i];
    if (out.length % 3 === 0) pushQ(`Spiega in modo semplice: "${t}".`, "outline", t);
    else if (out.length % 3 === 1) pushQ(`Fai un esempio pratico su: "${t}".`, "outline", t);
    else pushQ(`Qual è l’idea chiave di: "${t}"?`, "outline", t);
  }

  // definizioni “X è …”
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 20 && l.length <= 180);

  const defRe = /^(.{3,70}?)\s+(è|sono)\s+(.{8,200})$/i;
  for (let i = 0; i < lines.length && out.length < n; i++) {
    const m = lines[i].match(defRe);
    if (!m) continue;
    const left = clean(m[1]);
    const right = clean(m[3]);
    if (left.length < 3) continue;
    pushQ(`Che cos’è "${left}"?`, "definizione", `${left} è ${cut(right, 140)}`);
  }

  while (out.length < n) pushQ("Quali sono i 3 concetti più importanti di questo documento?", "fallback");
  return out.slice(0, n);
}

// ✅ Virtualized text renderer (line-based)
function VirtualText({ text }) {
  const containerRef = useRef(null);

  const lines = useMemo(() => String(text || "").split(/\r?\n/), [text]);

  // fixed row height makes it fast
  const ROW = 22; // px
  const OVERSCAN = 20;

  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      setHeight(el.clientHeight);
    });
    ro.observe(el);
    setHeight(el.clientHeight);

    return () => ro.disconnect();
  }, []);

  const totalHeight = lines.length * ROW;

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const endIdx = Math.min(lines.length, Math.ceil((scrollTop + height) / ROW) + OVERSCAN);

  const visible = lines.slice(startIdx, endIdx);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-white/10 bg-black/20 p-3 overflow-auto"
      style={{ maxHeight: "calc(86vh - 260px)" }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${startIdx * ROW}px)` }}>
          {visible.map((l, i) => (
            <div
              key={startIdx + i}
              style={{ height: ROW, whiteSpace: "pre-wrap" }}
              className="text-white/80 text-sm leading-5"
            >
              {l === "" ? " " : l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DocumentModal({ open, doc, subjectName, onClose }) {
  const [tab, setTab] = useState("quiz"); // quiz | results | full
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const [quiz, setQuiz] = useState([]);
  const [metaMap, setMetaMap] = useState(new Map()); // hash -> {status,dueAt}
  const [toast, setToast] = useState("");

  const text = doc?.text || "";
  const outline = Array.isArray(doc?.outline) ? doc.outline : [];
  const subjectId = doc?.subjectId ? Number(doc.subjectId) : null;

  useEffect(() => {
    if (!open) return;
    setTab("quiz");
    setQuery("");
    setActiveIdx(0);
    setQuiz([]);
    setMetaMap(new Map());
    setToast("");
  }, [open, doc?.id]);

  const snippets = useMemo(() => makeSnippets(text, query, 30), [text, query]);

  function copyAll() {
    navigator.clipboard?.writeText(text);
    setToast("Testo copiato.");
    setTimeout(() => setToast(""), 1000);
  }

  function copySnippet(sn) {
    navigator.clipboard?.writeText(sn?.snippet || "");
    setToast("Snippet copiato.");
    setTimeout(() => setToast(""), 1000);
  }

  async function refreshMeta(forQuiz) {
    if (!subjectId) return;
    const m = new Map();
    for (const q of forQuiz) {
      const h = hashStr(q.q);
      const existing = await db.review_items.where("[subjectId+hash]").equals([subjectId, h]).first();
      if (existing) m.set(h, { status: existing.status, dueAt: existing.dueAt || null });
    }
    setMetaMap(m);
  }

  async function generateQuiz() {
    const q = generateQuestions({ outline, text }, 5);
    setQuiz(q);
    setTab("quiz");
    await refreshMeta(q);
    setToast("Domande generate.");
    setTimeout(() => setToast(""), 900);
  }

  async function grade(questionObj, result) {
    if (!subjectId) return;
    const subj = await db.subjects.get(subjectId);
    const examDays = daysToExam(subj?.examDate || null);

    const now = Date.now();
    const h = hashStr(questionObj.q);

    const existing = await db.review_items.where("[subjectId+hash]").equals([subjectId, h]).first();

    const sched = nextSchedule({
      nowMs: now,
      examDays,
      prevIntervalIndex: existing?.intervalIndex ?? 0,
      prevStreak: existing?.streak ?? 0,
      result,
    });

    const payload = {
      createdAt: existing?.createdAt ?? now,
      lastReviewedAt: now,
      subjectId,
      hash: h,

      status: sched.status,
      dueAt: sched.dueAt,
      intervalIndex: sched.intervalIndex,
      streak: sched.streak,

      question: questionObj.q,
      source: questionObj.source,
      ref: questionObj.ref || "",
      documentId: doc?.id || null,
      fileName: doc?.fileName || "",
    };

    if (existing?.id) await db.review_items.update(existing.id, payload);
    else await db.review_items.add(payload);

    setMetaMap((prev) => {
      const next = new Map(prev);
      next.set(h, { status: sched.status, dueAt: sched.dueAt });
      return next;
    });

    setToast(result === "done" ? "✅ FATTO (ripasso programmato)" : "❌ DA RIFARE (ripasso ravvicinato)");
    setTimeout(() => setToast(""), 1200);
  }

  function metaLabel(q) {
    const h = hashStr(q.q);
    const m = metaMap.get(h);
    if (!m) return null;
    const due = m.dueAt ? new Date(m.dueAt).toLocaleDateString() : "—";
    return `${m.status === "done" ? "FATTO" : "DA RIFARE"} • due ${due}`;
  }

  function useOutlineItem(item) {
    setQuery(String(item || "").slice(0, 60));
    setTab("results");
    setActiveIdx(0);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[96%] max-w-[1100px] max-h-[86vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-semibold">Documento</div>
                  <div className="text-white/50 text-sm mt-1 break-words">
                    {doc?.fileName || "file"} • <span className="text-white/70">{subjectName || "Materia"}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{doc?.isTruncated ? "testo troncato" : "testo completo"}</Badge>
                    <Badge>{outline.length} outline</Badge>
                    <Badge>virtual scroll</Badge>
                  </div>

                  {doc?.isTruncated && (
                    <div className="mt-2 text-white/45 text-xs">
                      Testo troncato per performance (normale con file enormi).
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={generateQuiz}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                  >
                    Genera domande
                  </button>
                  <button
                    onClick={copyAll}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                  >
                    Copia testo
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                  >
                    Chiudi
                  </button>
                </div>
              </div>

              {toast && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                  {toast}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setTab("quiz")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm border transition",
                    tab === "quiz"
                      ? "border-white/20 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  ].join(" ")}
                >
                  Domande
                </button>

                <button
                  onClick={() => setTab("results")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm border transition",
                    tab === "results"
                      ? "border-white/20 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  ].join(" ")}
                >
                  Cerca
                </button>

                <button
                  onClick={() => setTab("full")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm border transition",
                    tab === "full"
                      ? "border-white/20 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  ].join(" ")}
                >
                  Testo
                </button>

                {tab === "results" && (
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cerca nel testo (min 2 caratteri)…"
                    className="ml-auto w-full md:w-[420px] rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/25"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-0">
              <div className="col-span-12 md:col-span-3 border-r border-white/10 bg-black/20 p-3 max-h-[calc(86vh-210px)] overflow-auto">
                <div className="text-white/60 text-xs mb-2">Outline / Capitoli</div>
                {outline.length === 0 ? (
                  <div className="text-white/50 text-sm">Nessuna outline salvata.</div>
                ) : (
                  <div className="space-y-2">
                    {outline.slice(0, 200).map((it, idx) => (
                      <button
                        key={idx}
                        onClick={() => useOutlineItem(it)}
                        className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs text-white/80"
                        title="Clicca per cercare questo titolo nel testo"
                      >
                        {cut(it, 80)}
                      </button>
                    ))}
                    {outline.length > 200 && (
                      <div className="text-white/40 text-xs">(mostrate prime 200 voci)</div>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-12 md:col-span-9 p-3 max-h-[calc(86vh-210px)] overflow-auto">
                {tab === "quiz" && (
                  <div className="space-y-3">
                    {quiz.length === 0 ? (
                      <div className="text-white/60 text-sm">
                        Premi “Genera domande”. Poi usa ✅/❌ per creare scadenze.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {quiz.map((x, i) => {
                          const meta = metaLabel(x);
                          return (
                            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 text-white/85 text-xs mb-1">
                                    <span>domanda #{i + 1}</span>
                                    <span className="text-white/50">• {x.source}</span>
                                    {meta && <Badge>{meta}</Badge>}
                                  </div>
                                  <div className="text-white/90 text-sm break-words">{x.q}</div>
                                  {x.ref ? (
                                    <div className="mt-2 text-white/50 text-xs break-words">
                                      riferimento: {cut(x.ref, 180)}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-col gap-2 shrink-0">
                                  <button
                                    onClick={() => grade(x, "done")}
                                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                                  >
                                    ✅ Fatto
                                  </button>
                                  <button
                                    onClick={() => grade(x, "todo")}
                                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                                  >
                                    ❌ Da rifare
                                  </button>
                                  <button
                                    onClick={() => navigator.clipboard?.writeText(x.q)}
                                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                                  >
                                    Copia
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="text-white/40 text-xs">
                      Scadenza minima 1 giorno (scelta tua). Virtual scroll attivo nel tab Testo.
                    </div>
                  </div>
                )}

                {tab === "results" && (
                  <>
                    {query.trim().length < 2 ? (
                      <div className="text-white/60 text-sm">Scrivi almeno 2 caratteri.</div>
                    ) : snippets.length === 0 ? (
                      <div className="text-white/60 text-sm">Nessun risultato.</div>
                    ) : (
                      <div className="space-y-2">
                        {snippets.map((sn, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveIdx(i)}
                            className={[
                              "w-full text-left rounded-2xl border p-3 transition",
                              i === activeIdx
                                ? "border-white/25 bg-white/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/15",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-white/85 text-xs mb-1">match #{i + 1}</div>
                                <div className="text-white/80 text-sm break-words">{sn.snippet}</div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copySnippet(sn);
                                }}
                                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs shrink-0"
                              >
                                Copia
                              </button>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {tab === "full" && <VirtualText text={text} />}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-white/10 text-white/45 text-xs flex items-center justify-between">
              <div>Outline + Search + Ripasso + Virtual scroll.</div>
              <div>Office dark • stabile</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}