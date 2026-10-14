import { useEffect, useMemo, useRef, useState } from "react";
import FocusTimer from "../components/FocusTimer";
import FocusCheckModal from "../components/FocusCheckModal";
import SoftCheckToast from "../components/SoftCheckToast";
import DailyPlanModal from "../components/DailyPlanModal";
import ImportReviewModal from "../components/ImportReviewModal";
import DocumentModal from "../components/DocumentModal";
import SelectionGuardModal from "../components/SelectionGuardModal";
import DocumentsLibraryModal from "../components/DocumentsLibraryModal";

import { db, seedIfEmpty } from "../database/db";
import { fileToText } from "../utils/fileToText";
import { fileNameToSubject, norm, parseNotes } from "../utils/importNotes";
import { daysToExam, nextSchedule } from "../utils/reviewScheduler";

const Card = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="text-white/70 text-sm mb-2">{title}</div>
    {children}
  </div>
);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function daysBetween(aMs, bMs) {
  return Math.floor((bMs - aMs) / (1000 * 60 * 60 * 24));
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

export default function DashboardPage({ onOpenDoubtsForSubject, focusSelection }) {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [sessionType, setSessionType] = useState("teoria");

  useEffect(() => {
    if (!focusSelection?.subjectId || !focusSelection?.topicId) return;
    setSubjectId(String(focusSelection.subjectId));
    setTopicId(String(focusSelection.topicId));
  }, [focusSelection?.subjectId, focusSelection?.topicId]);

  const [timerRunning, setTimerRunning] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const snoozeTimeoutRef = useRef(null);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [plannedMinutes, setPlannedMinutes] = useState(null);

  const [lastSessionId, setLastSessionId] = useState(null);
  const [todayFocusMin, setTodayFocusMin] = useState(0);
  const [todayAvgRating, setTodayAvgRating] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [lastSession, setLastSession] = useState(null);

  // guardrail
  const [guardOpen, setGuardOpen] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);

  // import
  const fileInputRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importBlocks, setImportBlocks] = useState([]);
  const [importRawText, setImportRawText] = useState("");

  // docs
  const [docOpen, setDocOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [currentDoc, setCurrentDoc] = useState(null);

  useEffect(() => {
    if (!timerRunning) setToastOpen(false);
  }, [timerRunning]);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      await reloadSubjects();
      await loadTodayPlan();
      await refreshTodayStats();
      await refreshLastSession();
      await refreshSuggestions();
    })();

    return () => {
      if (snoozeTimeoutRef.current) clearTimeout(snoozeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reloadSubjects() {
    const s = await db.subjects.toArray();
    setSubjects(s);
    if (!subjectId && s[0]) setSubjectId(String(s[0].id));
  }

  useEffect(() => {
    (async () => {
      if (!subjectId) {
        setTopics([]);
        setTopicId("");
        setCurrentDoc(null);
        return;
      }

      const sid = Number(subjectId);

      const t = await db.topics.where("subjectId").equals(sid).toArray();
      setTopics(t);

      if (t.length > 0) {
        const exists = t.some((x) => String(x.id) === String(topicId));
        if (!topicId || !exists) setTopicId(String(t[0].id));
      } else {
        setTopicId("");
      }

      // doc attivo (o ultimo)
      const subj = await db.subjects.get(sid);
      const list = await db.documents.where("subjectId").equals(sid).sortBy("createdAt");
      const newest = list.length ? list[list.length - 1] : null;
      const active = subj?.activeDocumentId ? await db.documents.get(subj.activeDocumentId) : null;

      setCurrentDoc(active || newest || null);

      await refreshSuggestions();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  async function loadTodayPlan() {
    const t = todayKey();
    const p = await db.plans.where("date").equals(t).first();
    if (p?.plannedMinutes != null) {
      setPlannedMinutes(p.plannedMinutes);
    } else {
      setPlannedMinutes(null);
      setPlanModalOpen(true);
    }
  }

  async function saveTodayPlan(minutes) {
    const t = todayKey();
    const existing = await db.plans.where("date").equals(t).first();
    if (existing?.id) await db.plans.update(existing.id, { plannedMinutes: minutes });
    else await db.plans.add({ date: t, plannedMinutes: minutes });
    setPlannedMinutes(minutes);
  }

  async function refreshTodayStats() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();

    const sessions = await db.sessions.where("startedAt").aboveOrEqual(startMs).toArray();
    const sumSec = sessions.reduce((a, s) => a + (s.durationSeconds || 0), 0);
    setTodayFocusMin(Math.round(sumSec / 60));

    const checks = await db.focus_checks.where("createdAt").aboveOrEqual(startMs).toArray();
    if (checks.length) {
      const avg = checks.reduce((a, c) => a + (c.rating || 0), 0) / checks.length;
      setTodayAvgRating(avg);
    } else {
      setTodayAvgRating(null);
    }
  }

  async function refreshLastSession() {
    const s = await db.sessions.orderBy("startedAt").reverse().first();
    if (!s) {
      setLastSession(null);
      return;
    }
    const subj = await db.subjects.get(s.subjectId);
    const top = await db.topics.get(s.topicId);

    setLastSession({
      subjectId: s.subjectId,
      subjectName: subj?.name || "Materia",
      topicName: top?.name || "Argomento",
      minutes: Math.round((s.durationSeconds || 0) / 60),
      sessionType: s.sessionType || "—",
      endedAt: s.endedAt || s.startedAt,
    });
  }

  function handleSoftCheck() {
    if (!timerRunning) return;
    if (checkModalOpen) return;
    if (toastOpen) return;
    setToastOpen(true);
  }

  function snoozeTwoMinutes() {
    setToastOpen(false);
    if (snoozeTimeoutRef.current) clearTimeout(snoozeTimeoutRef.current);
    snoozeTimeoutRef.current = setTimeout(() => {
      if (timerRunning) setToastOpen(true);
    }, 2 * 60 * 1000);
  }

  const plannedEffective = plannedMinutes ?? 60;
  const productivity = useMemo(() => {
    const focusScore = Math.min(60, (todayFocusMin / Math.max(1, plannedEffective)) * 60);
    const planDiff = Math.abs(plannedEffective - todayFocusMin);
    const planScore = planDiff <= 15 ? 20 : todayFocusMin >= plannedEffective ? 15 : 10;
    const ratingScore = todayAvgRating ? (todayAvgRating / 5) * 20 : 0;
    return Math.round(focusScore + planScore + ratingScore);
  }, [todayFocusMin, plannedEffective, todayAvgRating]);

  async function refreshSuggestions() {
    const s = await db.subjects.toArray();
    const t = await db.topics.toArray();
    const sessions = await db.sessions.toArray();
    const now = Date.now();

    const lastByTopic = new Map();
    for (const ses of sessions) {
      const key = ses.topicId;
      const when = ses.endedAt || ses.startedAt;
      if (!key || !when) continue;
      const prev = lastByTopic.get(key) || 0;
      if (when > prev) lastByTopic.set(key, when);
    }

    const subjectById = new Map(s.map((x) => [x.id, x]));

    const scored = t.map((topic) => {
      const subj = subjectById.get(topic.subjectId);

      const difficulty = Number(topic.difficulty || 3);
      const difficultyNorm = (Math.min(5, Math.max(1, difficulty)) - 1) / 4;

      const last = lastByTopic.get(topic.id) || null;
      const daysSince = last ? Math.max(0, daysBetween(last, now)) : 999;
      const recency = Math.min(1, daysSince / 7);

      let urgency = 0;
      let daysToExamVal = null;
      if (subj?.examDate) {
        const examMs = new Date(subj.examDate).getTime();
        daysToExamVal = Math.floor((examMs - now) / (1000 * 60 * 60 * 24));
        urgency = Math.min(1, 14 / Math.max(1, daysToExamVal + 1));
        if (daysToExamVal < 0) urgency = 1;
      }

      const score = 0.45 * urgency + 0.35 * recency + 0.20 * difficultyNorm;

      return { topic, subj, score, difficulty, daysSince: daysSince === 999 ? null : daysSince, daysToExam: daysToExamVal };
    });

    scored.sort((a, b) => b.score - a.score);
    setSuggestions(scored.slice(0, 3));
  }

  function pickSuggestion(sug) {
    if (!sug?.subj?.id || !sug?.topic?.id) return;
    setSubjectId(String(sug.subj.id));
    setTopicId(String(sug.topic.id));
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const text = await fileToText(file);
      setImportRawText(text);

      const fallback = fileNameToSubject(file.name);
      const blocks = parseNotes(text, fallback);

      setImportFileName(file.name);
      setImportBlocks(blocks);
      setImportOpen(true);
    } catch (err) {
      alert(err?.message || "Errore import file");
    }
  }

  const selectedSubjectName = useMemo(() => {
    return subjects.find((s) => String(s.id) === String(subjectId))?.name || "Materia";
  }, [subjects, subjectId]);

  // ✅ get active doc reliably from DB
  async function getActiveDocForSubject(sid) {
    const subj = await db.subjects.get(Number(sid));
    const list = await db.documents.where("subjectId").equals(Number(sid)).sortBy("createdAt");
    const newest = list.length ? list[list.length - 1] : null;
    const active = subj?.activeDocumentId ? await db.documents.get(subj.activeDocumentId) : null;
    return active || newest || null;
  }

  // ✅ auto review always linked to active doc
  async function maybeCreateAutoReviewItem({ rating, summary, unclear }) {
    const r = Number(rating || 0);
    if (r > 2) return;

    const sid = Number(subjectId || 0);
    const tid = Number(topicId || 0);
    if (!sid || !tid) return;

    const subj = await db.subjects.get(sid);
    const topic = await db.topics.get(tid);

    const doc = await getActiveDocForSubject(sid); // ✅ robust
    const docId = doc?.id || null;
    const docFile = doc?.fileName || "";

    const examDays = daysToExam(subj?.examDate || null);
    const now = Date.now();

    const base = `Ripassa: ${subj?.name || "Materia"} — ${topic?.name || "Argomento"}`;
    const extra = (unclear || summary || "").trim();
    const question = extra ? `${base}\nFocus: ${extra}` : base;

    const h = hashStr(question);

    const existing = await db.review_items.where("[subjectId+hash]").equals([sid, h]).first();

    const sched = nextSchedule({
      nowMs: now,
      examDays,
      prevIntervalIndex: existing?.intervalIndex ?? 0,
      prevStreak: existing?.streak ?? 0,
      result: "todo",
    });

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
      source: "focus_check_low_rating",
      ref: extra,
      documentId: docId,
      fileName: docFile,
    };

    if (existing?.id) await db.review_items.update(existing.id, payload);
    else await db.review_items.add(payload);
  }

  async function saveSessionWithIds(session, sid, tid) {
    const id = await db.sessions.add({
      ...session,
      startedAt: session.startedAt || Date.now(),
      subjectId: Number(sid),
      topicId: Number(tid),
      sessionType,
    });
    setLastSessionId(id);
    await refreshTodayStats();
    await refreshLastSession();
    await refreshSuggestions();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden border border-white/10">
        <div className="h-28 bg-gradient-to-r from-sky-500/10 via-white/5 to-transparent" />
        <div className="p-4 bg-black/20">
          <div className="text-xl font-semibold">My Academic OS</div>
          <div className="text-white/60 text-sm">Documenti attivi coerenti • cleanup totale • dati puliti</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Focus Timer">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              {subjects.length === 0 ? (
                <option value="">(Nessuna materia)</option>
              ) : (
                subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>

            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              disabled={!subjectId || topics.length === 0}
            >
              {topics.length === 0 ? (
                <option value="">(Nessun argomento)</option>
              ) : (
                topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>

            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="teoria">Teoria</option>
              <option value="esercizi">Esercizi</option>
              <option value="ripasso">Ripasso</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Importa file
            </button>

            <button
              onClick={() => setDocsOpen(true)}
              disabled={!subjectId}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
            >
              Documenti
            </button>

            <button
              onClick={() => setDocOpen(true)}
              disabled={!currentDoc}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
            >
              Apri documento
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx,.pdf"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                await importFile(f);
              }}
            />
          </div>

          <FocusTimer
            mode="free"
            checkEveryMinutes={20}
            onRunningChange={setTimerRunning}
            onSoftCheck={handleSoftCheck}
            onSessionStop={async (session) => {
              const sid = Number(subjectId || 0);
              const tid = Number(topicId || 0);

              if (!sid || !tid) {
                setPendingSession(session);
                setGuardOpen(true);
                return;
              }

              await saveSessionWithIds(session, sid, tid);
            }}
          />
        </Card>

        <Card title="Cosa studiare prima (auto) — clicca per selezionare">
          {suggestions.length === 0 ? (
            <div className="text-white/60 text-sm">Importa o aggiungi argomenti.</div>
          ) : (
            <ol className="space-y-2 text-sm">
              {suggestions.map((x, i) => (
                <li key={x.topic.id}>
                  <button
                    onClick={() => pickSuggestion(x)}
                    className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/15 transition p-3"
                  >
                    <div className="text-white/90">
                      {i + 1}) {x.subj?.name || "Materia"} — {x.topic.name}
                    </div>
                    <div className="text-white/50 text-xs mt-1">
                      diff {x.difficulty}/5 •{" "}
                      {x.daysSince != null ? `ultimo studio ${x.daysSince}g fa` : "mai studiato"} •{" "}
                      {x.daysToExam != null ? `esame tra ${x.daysToExam}g` : "nessuna data esame"} •
                      score {(x.score * 100).toFixed(0)}/100
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Produttività oggi">
          <div className="text-3xl font-semibold tabular-nums">
            {Math.round(
              Math.min(
                100,
                (todayFocusMin / Math.max(1, plannedMinutes ?? 60)) * 100 +
                  (todayAvgRating ? (todayAvgRating / 5) * 20 : 0)
              )
            )}
          </div>
          <div className="text-xs text-white/60">indicatore rapido</div>

          <div className="mt-3 text-white/60 text-xs">
            Focus oggi: <span className="text-white/80">{todayFocusMin} min</span>
            <br />
            Piano:{" "}
            <span className="text-white/80">
              {plannedMinutes != null ? `${plannedMinutes} min` : "non impostato"}
            </span>
            <br />
            Voto medio:{" "}
            <span className="text-white/80">{todayAvgRating ? todayAvgRating.toFixed(1) : "—"}</span>
          </div>

          <button
            onClick={() => setPlanModalOpen(true)}
            className="mt-3 w-full rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
          >
            Imposta piano di oggi
          </button>
        </Card>
      </div>

      <SelectionGuardModal
        open={guardOpen}
        subjects={subjects}
        defaultSubjectId={subjectId}
        onCancel={() => {
          setGuardOpen(false);
          setPendingSession(null);
        }}
        onConfirm={async ({ subjectId: sid, topicId: tid }) => {
          setGuardOpen(false);
          setSubjectId(String(sid));
          setTopicId(String(tid));

          if (pendingSession) {
            const session = pendingSession;
            setPendingSession(null);
            await saveSessionWithIds(session, sid, tid);
          }
        }}
      />

      <DocumentsLibraryModal
        open={docsOpen}
        subjectId={subjectId}
        subjectName={selectedSubjectName}
        onClose={() => setDocsOpen(false)}
        onOpenDoc={async (doc) => {
          setCurrentDoc(doc);
          if (subjectId && doc?.id) await db.subjects.update(Number(subjectId), { activeDocumentId: doc.id });
          setDocsOpen(false);
          setDocOpen(true);
        }}
      />

      <SoftCheckToast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        onSnooze={() => {
          setToastOpen(false);
          if (snoozeTimeoutRef.current) clearTimeout(snoozeTimeoutRef.current);
          snoozeTimeoutRef.current = setTimeout(() => {
            if (timerRunning) setToastOpen(true);
          }, 2 * 60 * 1000);
        }}
        onOpenCheck={() => {
          setToastOpen(false);
          setCheckModalOpen(true);
        }}
      />

      <FocusCheckModal
        open={checkModalOpen}
        onClose={() => setCheckModalOpen(false)}
        onSubmit={async (data) => {
          setCheckModalOpen(false);

          const sid = Number(subjectId || 0);
          const tid = Number(topicId || 0);

          await db.focus_checks.add({
            createdAt: Date.now(),
            sessionId: lastSessionId,
            subjectId: sid || null,
            topicId: tid || null,
            sessionType,
            rating: data.rating,
            summary: data.summary,
            unclear: data.unclear,
          });

          const txt = (data.unclear || "").trim();
          if (txt.length > 0) {
            await db.doubts.add({
              createdAt: Date.now(),
              subjectId: sid || null,
              topicId: tid || null,
              sessionId: lastSessionId,
              status: "open",
              text: txt,
              sessionType,
            });
          }

          await maybeCreateAutoReviewItem({
            rating: data.rating,
            summary: data.summary,
            unclear: data.unclear,
          });

          await refreshTodayStats();
          await refreshSuggestions();
        }}
      />

      <DailyPlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        defaultMinutes={plannedMinutes ?? 60}
        onSave={async (min) => {
          setPlanModalOpen(false);
          await saveTodayPlan(min);
        }}
      />

      <DocumentModal
        open={docOpen}
        doc={currentDoc}
        subjectName={selectedSubjectName}
        onClose={() => setDocOpen(false)}
      />

      <ImportReviewModal
        open={importOpen}
        fileName={importFileName}
        blocks={importBlocks}
        subjects={subjects}
        onCancel={() => setImportOpen(false)}
        onConfirm={async (plan) => {
          for (const b of plan) {
            let sid = null;

            if (b.targetMode === "existing") sid = Number(b.existingSubjectId || 0);
            else {
              const name = (b.newSubjectName || "").trim();
              if (!name) continue;
              sid = await db.subjects.add({ name, examDate: null, activeDocumentId: null });
            }

            if (!sid) continue;

            const existingTopics = await db.topics.where("subjectId").equals(Number(sid)).toArray();
            const existingSet = new Set(existingTopics.map((x) => norm(x.name)));

            for (const t of b.topics) {
              const nm = String(t.name || "").trim();
              if (!nm) continue;
              if (existingSet.has(norm(nm))) continue;

              await db.topics.add({
                subjectId: Number(sid),
                name: nm,
                difficulty: Number(t.difficulty || 3),
              });

              existingSet.add(norm(nm));
            }

            const MAX_DOC_CHARS = 300000;
            const full = String(importRawText || "");
            const text = full.length > MAX_DOC_CHARS ? full.slice(0, MAX_DOC_CHARS) : full;
            const isTruncated = full.length > MAX_DOC_CHARS;

            const docId = await db.documents.add({
              createdAt: Date.now(),
              subjectId: Number(sid),
              fileName: importFileName,
              text,
              isTruncated,
              outline: b.topics.map((t) => String(t.name || "")).filter(Boolean),
            });

            await db.subjects.update(Number(sid), { activeDocumentId: docId });

            setSubjectId(String(sid));
            setCurrentDoc(await db.documents.get(docId));
          }

          setImportOpen(false);
          await reloadSubjects();
          await refreshSuggestions();
        }}
      />
    </div>
  );
}