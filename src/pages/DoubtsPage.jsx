import { useEffect, useMemo, useState } from "react";
import { db } from "../database/db";
import { daysToExam, nextSchedule } from "../utils/reviewScheduler";

const Card = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="text-white/70 text-sm mb-2">{title}</div>
    {children}
  </div>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
    {children}
  </span>
);

function fmt(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function normalizeStr(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hashStr(str) {
  const s = normalizeStr(str);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export default function DoubtsPage({ subjectIdFilter = null, onClearFilter }) {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);

  const [doubts, setDoubts] = useState([]);

  const [subjectId, setSubjectId] = useState(subjectIdFilter ? String(subjectIdFilter) : "all");
  const [topicId, setTopicId] = useState("all");
  const [status, setStatus] = useState("open"); // open | solved | all

  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (subjectIdFilter) setSubjectId(String(subjectIdFilter));
  }, [subjectIdFilter]);

  async function refreshBase() {
    const s = await db.subjects.toArray();
    const t = await db.topics.toArray();
    setSubjects(s);
    setTopics(t);
  }

  async function refreshDoubts() {
    let list = await db.doubts.orderBy("createdAt").reverse().toArray();

    if (subjectId !== "all") {
      list = list.filter((d) => String(d.subjectId) === String(subjectId));
    }
    if (topicId !== "all") {
      list = list.filter((d) => String(d.topicId) === String(topicId));
    }
    if (status !== "all") {
      list = list.filter((d) => String(d.status || "open") === status);
    }

    setDoubts(list);
  }

  useEffect(() => {
    refreshBase();
  }, []);

  useEffect(() => {
    refreshDoubts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, topicId, status]);

  const topicOptions = useMemo(() => {
    if (subjectId === "all") return topics;
    return topics.filter((t) => String(t.subjectId) === String(subjectId));
  }, [topics, subjectId]);

  const subjectNameById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const topicNameById = useMemo(() => new Map(topics.map((t) => [t.id, t.name])), [topics]);

  async function setDoubtStatus(id, nextStatus) {
    setBusyId(id);
    try {
      await db.doubts.update(id, { status: nextStatus });
      await refreshDoubts();
      setToast(nextStatus === "solved" ? "✅ Segnato come risolto." : "♻️ Riaperto.");
      setTimeout(() => setToast(""), 1000);
    } finally {
      setBusyId(null);
    }
  }

  async function removeDoubt(id) {
    const ok = window.confirm("Eliminare questo dubbio?");
    if (!ok) return;

    setBusyId(id);
    try {
      await db.doubts.delete(id);
      await refreshDoubts();
      setToast("🗑 Dubbio eliminato.");
      setTimeout(() => setToast(""), 1000);
    } finally {
      setBusyId(null);
    }
  }

  // ✅ Trasforma dubbio in review_item (ripasso)
  async function convertToReview(d) {
    setBusyId(d.id);
    try {
      const sid = Number(d.subjectId || 0);
      if (!sid) {
        setToast("❌ Dubbio senza materia: impossibile creare ripasso.");
        setTimeout(() => setToast(""), 1200);
        return;
      }

      const subj = await db.subjects.get(sid);
      const examDays = daysToExam(subj?.examDate || null);
      const now = Date.now();

      const subjectName = subjectNameById.get(sid) || "Materia";
      const topicName = d.topicId ? topicNameById.get(d.topicId) : "";
      const base = topicName ? `${subjectName} — ${topicName}` : `${subjectName}`;

      const question = `Dubbio da ripassare: ${base}\n${String(d.text || "").trim()}`.trim();
      const h = hashStr(question);

      const existing = await db.review_items.where("[subjectId+hash]").equals([sid, h]).first();

      const sched = nextSchedule({
        nowMs: now,
        examDays,
        prevIntervalIndex: existing?.intervalIndex ?? 0,
        prevStreak: existing?.streak ?? 0,
        result: "todo",
      });

      // documento attivo (se esiste) per coerenza
      let docId = null;
      let fileName = "";
      if (subj?.activeDocumentId) {
        const doc = await db.documents.get(subj.activeDocumentId);
        docId = doc?.id || null;
        fileName = doc?.fileName || "";
      }

      const payload = {
        createdAt: existing?.createdAt ?? now,
        lastReviewedAt: now,
        subjectId: sid,
        hash: h,
        status: "todo",
        dueAt: sched.dueAt,
        intervalIndex: 0,
        streak: 0,
        question,
        source: "doubt",
        ref: "",
        documentId: docId,
        fileName,
      };

      if (existing?.id) await db.review_items.update(existing.id, payload);
      else await db.review_items.add(payload);

      // opzionale: segna il dubbio risolto (o lo lasci open?)
      await db.doubts.update(d.id, { status: "solved" });

      await refreshDoubts();
      setToast("➕ Creato ripasso dal dubbio (esame-aware).");
      setTimeout(() => setToast(""), 1200);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Non mi è chiaro (Dubbi)">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-white/85 text-sm">
              Lista dubbi per materia/argomento. Trasformali in ripasso per non dimenticare.
            </div>
            {subjectIdFilter && (
              <button
                onClick={() => {
                  setSubjectId("all");
                  onClearFilter?.();
                }}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
              >
                Rimuovi filtro materia
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId("all");
              }}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">Tutte le materie</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              disabled={topicOptions.length === 0}
            >
              <option value="all">Tutti gli argomenti</option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="open">Aperti</option>
              <option value="solved">Risolti</option>
              <option value="all">Tutti</option>
            </select>

            <button
              onClick={refreshDoubts}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Aggiorna
            </button>
          </div>
        </div>

        {toast && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            {toast}
          </div>
        )}
      </Card>

      <Card title="Lista dubbi">
        {doubts.length === 0 ? (
          <div className="text-white/60 text-sm">Nessun dubbio in questa vista.</div>
        ) : (
          <div className="space-y-2">
            {doubts.map((d) => {
              const sid = d.subjectId;
              const tid = d.topicId;

              const subjName = sid ? subjectNameById.get(sid) : null;
              const topName = tid ? topicNameById.get(tid) : null;

              return (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill>{(d.status || "open") === "solved" ? "RISOLTO" : "APERTO"}</Pill>
                        {subjName && <Pill>{subjName}</Pill>}
                        {topName && <Pill>{topName}</Pill>}
                        {d.sessionType && <Pill>{d.sessionType}</Pill>}
                      </div>

                      <div className="mt-2 text-white/90 text-sm break-words">{d.text}</div>

                      <div className="mt-2 text-white/45 text-xs">
                        {fmt(d.createdAt)} {d.sessionId ? `• session ${d.sessionId}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {(d.status || "open") !== "solved" ? (
                        <button
                          disabled={busyId === d.id}
                          onClick={() => setDoubtStatus(d.id, "solved")}
                          className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs disabled:opacity-40"
                        >
                          ✅ Risolto
                        </button>
                      ) : (
                        <button
                          disabled={busyId === d.id}
                          onClick={() => setDoubtStatus(d.id, "open")}
                          className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs disabled:opacity-40"
                        >
                          ♻️ Riapri
                        </button>
                      )}

                      <button
                        disabled={busyId === d.id}
                        onClick={() => convertToReview(d)}
                        className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs disabled:opacity-40"
                      >
                        ➕ In ripasso
                      </button>

                      <button
                        disabled={busyId === d.id}
                        onClick={() => removeDoubt(d.id)}
                        className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs disabled:opacity-40"
                      >
                        🗑 Elimina
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}