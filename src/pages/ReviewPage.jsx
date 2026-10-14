import { useEffect, useMemo, useState } from "react";
import { db } from "../database/db";
import { daysToExam, normalizeDueStatus } from "../utils/reviewScheduler";
import ReviewSessionModal from "../components/ReviewSessionModal";

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

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function fmt(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function recommendedFocusPerDay(examDays) {
  if (examDays == null) return 45;
  if (examDays <= 7) return 120;
  if (examDays <= 14) return 90;
  if (examDays <= 30) return 60;
  return 45;
}

export default function ReviewPage() {
  const [subjects, setSubjects] = useState([]);
  const [items, setItems] = useState([]);

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("todo"); // todo | done | all

  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(10);

  const [focusMin7BySubject, setFocusMin7BySubject] = useState(new Map());
  const [subjectScoreRows, setSubjectScoreRows] = useState([]);

  async function refreshAll() {
    const now = Date.now();
    const s = await db.subjects.toArray();
    let list = await db.review_items.orderBy("createdAt").reverse().toArray();

    // normalizza scaduti
    const normalized = list.map((x) => normalizeDueStatus(x, now));
    for (const it of normalized) {
      const prev = list.find((z) => z.id === it.id);
      if (prev && prev.status !== it.status) await db.review_items.update(it.id, { status: it.status });
    }
    list = normalized;

    // filtri vista
    let view = list;
    if (subjectFilter !== "all") view = view.filter((x) => String(x.subjectId) === String(subjectFilter));
    if (statusFilter !== "all") view = view.filter((x) => x.status === statusFilter);

    setSubjects(s);
    setItems(view);

    // focus 7 giorni
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();

    const sessions = await db.sessions.where("startedAt").aboveOrEqual(startMs).toArray();
    const map = new Map();
    for (const ses of sessions) {
      const sid = ses.subjectId;
      if (!sid) continue;
      const min = Math.round((ses.durationSeconds || 0) / 60);
      map.set(sid, (map.get(sid) || 0) + min);
    }
    setFocusMin7BySubject(map);

    // score rows
    const allReview = normalized;
    const rows = s.map((subj) => {
      const subList = allReview.filter((x) => Number(x.subjectId) === Number(subj.id));
      const total = subList.length;
      const now2 = Date.now();

      const dueNow = subList.filter((x) => x.status === "todo" && (!x.dueAt || x.dueAt <= now2)).length;
      const todoTotal = subList.filter((x) => x.status === "todo").length;
      const doneTotal = subList.filter((x) => x.status === "done").length;

      const examDays = daysToExam(subj.examDate || null);
      const urgency = examDays == null ? 0 : clamp((30 - examDays) / 30, 0, 1);

      const focusMin7 = map.get(subj.id) || 0;
      const focusScore = Math.min(20, (focusMin7 / 120) * 20);

      const completion = total ? doneTotal / total : 0;
      const completionScore = completion * 30;

      const duePenaltyPer = 5 + Math.round(10 * urgency); // 5..15
      const duePenalty = dueNow * duePenaltyPer;

      const backlogPenalty = Math.max(0, todoTotal - doneTotal) * 1;

      let score = 50 + completionScore + focusScore;
      score -= duePenalty + backlogPenalty;
      score = Math.round(clamp(score, 0, 100));

      // piano fino all'esame
      const daysLeft = examDays == null ? 14 : Math.max(1, examDays);
      const reviewPerDay = clamp(Math.ceil(Math.max(1, todoTotal) / daysLeft), 1, 25);
      const focusPerDay = recommendedFocusPerDay(examDays);

      return {
        id: subj.id,
        name: subj.name,
        examDate: subj.examDate || null,
        examDays,
        score,
        total,
        dueNow,
        todoTotal,
        doneTotal,
        focusMin7,
        plan: { reviewPerDay, focusPerDay, daysLeft },
      };
    });

    rows.sort((a, b) => b.score - a.score);
    setSubjectScoreRows(rows);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectFilter, statusFilter]);

  async function setStatus(id, status) {
    await db.review_items.update(id, { status, lastReviewedAt: Date.now() });
    await refreshAll();
  }

  async function remove(id) {
    await db.review_items.delete(id);
    await refreshAll();
  }

  return (
    <div className="space-y-4">
      <ReviewSessionModal
        open={sessionOpen}
        durationMinutes={sessionMinutes}
        subjectIdFilter={subjectFilter === "all" ? null : subjectFilter}
        subjects={subjects}
        onClose={async () => {
          setSessionOpen(false);
          await refreshAll();
        }}
      />

      <Card title="Dimentico (Ripasso) • piano fino all’esame • score per materia">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-white/85 text-sm">
              Piano: ripassi/giorno e focus consigliato, adattato alla data d’esame.
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill>filtro: {subjectFilter === "all" ? "tutte" : "materia"}</Pill>
              <Pill>stato: {statusFilter}</Pill>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="todo">Da rifare (due)</option>
              <option value="done">Fatto (programmato)</option>
              <option value="all">Tutti</option>
            </select>

            <button
              onClick={() => {
                setSessionMinutes(10);
                setSessionOpen(true);
              }}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Sessione 10 min
            </button>

            <button
              onClick={() => {
                setSessionMinutes(15);
                setSessionOpen(true);
              }}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Sessione 15 min
            </button>

            <button
              onClick={refreshAll}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Aggiorna
            </button>
          </div>
        </div>
      </Card>

      <Card title="Materie • Score + Piano fino all’esame">
        {subjectScoreRows.length === 0 ? (
          <div className="text-white/60 text-sm">
            Nessuna materia. Importa un documento → genera domande → segna ❌/✅.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {subjectScoreRows.map((r) => (
              <button
                key={r.id}
                onClick={() => setSubjectFilter(String(r.id))}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/15 transition p-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white/90 font-semibold">{r.name}</div>
                    <div className="text-white/50 text-xs mt-1">
                      due: {r.dueNow} • todo: {r.todoTotal} • done: {r.doneTotal} • focus 7g: {r.focusMin7}m
                      {r.examDate ? ` • esame: ${r.examDate}` : ""}
                      {r.examDays != null ? ` (${r.examDays}g)` : ""}
                    </div>

                    <div className="mt-2 text-white/70 text-xs">
                      piano: <span className="text-white/85">{r.plan.reviewPerDay} ripassi/giorno</span>{" "}
                      + <span className="text-white/85">{r.plan.focusPerDay} min focus/giorno</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div className="text-white text-xl font-semibold tabular-nums">{r.score}</div>
                    <div className="text-white/40 text-xs text-right">/ 100</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title="Items di ripasso">
        {items.length === 0 ? (
          <div className="text-white/60 text-sm">
            Nessun item in questa vista.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const subj = subjects.find((s) => String(s.id) === String(it.subjectId));
              const due = it.dueAt ? new Date(it.dueAt).toLocaleString() : "—";
              return (
                <div key={it.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill>{it.status === "done" ? "FATTO" : "DA RIFARE"}</Pill>
                        <Pill>{subj?.name || "Materia"}</Pill>
                        <Pill>due: {due}</Pill>
                        <Pill>{it.source || "auto"}</Pill>
                      </div>

                      <div className="mt-2 text-white/90 text-sm break-words">{it.question}</div>

                      <div className="mt-2 text-white/45 text-xs">
                        creato: {fmt(it.createdAt)} • ultimo: {fmt(it.lastReviewedAt)}
                        {it.fileName ? ` • file: ${it.fileName}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {it.status !== "done" ? (
                        <button
                          onClick={() => setStatus(it.id, "done")}
                          className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                        >
                          ✅ Segna fatto
                        </button>
                      ) : (
                        <button
                          onClick={() => setStatus(it.id, "todo")}
                          className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                        >
                          ❌ Da rifare
                        </button>
                      )}

                      <button
                        onClick={() => remove(it.id)}
                        className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                      >
                        Elimina
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