import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../database/db";
import { daysToExam, nextSchedule, normalizeDueStatus } from "../utils/reviewScheduler";

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
      {children}
    </span>
  );
}

function mmss(sec) {
  const s = Math.max(0, sec);
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

export default function ReviewSessionModal({
  open,
  durationMinutes = 10,
  subjectIdFilter = null, // string or null
  subjects = [],
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);

  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);

  const [doneCount, setDoneCount] = useState(0);
  const [todoCount, setTodoCount] = useState(0);

  const sid = subjectIdFilter ? Number(subjectIdFilter) : null;
  const subjectName = useMemo(() => {
    if (!sid) return "Tutte le materie";
    return subjects.find((s) => Number(s.id) === sid)?.name || "Materia";
  }, [sid, subjects]);

  useEffect(() => {
    if (!open) return;
    setTimeLeft(durationMinutes * 60);
    setIdx(0);
    setItems([]);
    setDoneCount(0);
    setTodoCount(0);
    startedAtRef.current = Date.now();

    (async () => {
      setLoading(true);
      const now = Date.now();

      let list = [];
      if (sid) {
        list = await db.review_items.where("subjectId").equals(sid).toArray();
        list = list
          .map((x) => normalizeDueStatus(x, now))
          .filter((x) => !x.dueAt || x.dueAt <= now);
      } else {
        // query per dueAt se presente (più veloce), poi fallback per null dueAt
        const due = await db.review_items.where("dueAt").belowOrEqual(now).toArray();
        const all = await db.review_items.toArray();
        const nullDue = all.filter((x) => !x.dueAt);
        list = [...due, ...nullDue].map((x) => normalizeDueStatus(x, now));
      }

      // aggiorna nel DB gli item scaduti che erano "done" -> "todo"
      const toFix = list.filter((x) => x.status === "todo");
      if (toFix.length) {
        // best effort: non serve transazione qui
        for (const it of toFix) {
          if (it?.id) await db.review_items.update(it.id, { status: "todo" });
        }
      }

      list.sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));

      // limit per sessione
      setItems(list.slice(0, 50));
      setLoading(false);
    })();
  }, [open, durationMinutes, sid]);

  useEffect(() => {
    if (!open) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (timeLeft > 0) return;
    finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, open]);

  const current = items[idx] || null;

  async function grade(result) {
    if (!current) return;

    const now = Date.now();
    const subject = await db.subjects.get(current.subjectId);
    const examDays = daysToExam(subject?.examDate || null);

    const sched = nextSchedule({
      nowMs: now,
      examDays,
      prevIntervalIndex: current.intervalIndex ?? 0,
      prevStreak: current.streak ?? 0,
      result, // done | todo
    });

    await db.review_items.update(current.id, {
      status: sched.status,
      dueAt: sched.dueAt,
      intervalIndex: sched.intervalIndex,
      streak: sched.streak,
      lastReviewedAt: now,
    });

    if (result === "done") setDoneCount((x) => x + 1);
    else setTodoCount((x) => x + 1);

    // prossimo item
    setIdx((i) => i + 1);
  }

  async function finishSession() {
    if (!open) return;

    // salva una sessione "ripasso"
    const startedAt = startedAtRef.current || Date.now();
    const endedAt = Date.now();
    const elapsedSec = Math.max(0, Math.floor((endedAt - startedAt) / 1000));

    await db.sessions.add({
      startedAt,
      endedAt,
      durationSeconds: elapsedSec,
      subjectId: sid || null,
      topicId: null,
      sessionType: "ripasso",
      mode: "review",
    });

    onClose?.();
  }

  const finished = !loading && (idx >= items.length);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={finishSession} />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[96%] max-w-[860px] rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">Sessione Ripasso</div>
                  <div className="text-white/50 text-sm mt-1">
                    {subjectName} • {durationMinutes} min
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>tempo: {mmss(timeLeft)}</Badge>
                    <Badge>fatto: {doneCount}</Badge>
                    <Badge>da rifare: {todoCount}</Badge>
                    <Badge>
                      {items.length ? `progress: ${Math.min(idx + 1, items.length)}/${items.length}` : "nessun item"}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={finishSession}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                  >
                    Termina
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="text-white/60 text-sm">Caricamento items in scadenza…</div>
              ) : items.length === 0 ? (
                <div className="text-white/60 text-sm">
                  Nessun ripasso in scadenza adesso. Segna domande nel documento (❌ Da rifare) e riprova.
                </div>
              ) : finished ? (
                <div className="text-white/80 text-sm">
                  Sessione completata ✅
                  <div className="text-white/50 text-xs mt-2">
                    Puoi fare un’altra sessione o tornare alla Dashboard.
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/60 text-xs mb-2">
                    item #{idx + 1} • materia:{" "}
                    <span className="text-white/80">
                      {subjects.find((s) => Number(s.id) === Number(current.subjectId))?.name || "Materia"}
                    </span>
                  </div>

                  <div className="text-white/90 text-base break-words">
                    {current.question}
                  </div>

                  {current.ref ? (
                    <div className="mt-3 text-white/50 text-xs break-words">
                      riferimento: {current.ref}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => grade("done")}
                      className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                    >
                      ✅ So rispondere
                    </button>
                    <button
                      onClick={() => grade("todo")}
                      className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                    >
                      ❌ Non so / da rifare
                    </button>
                    <button
                      onClick={() => setIdx((i) => i + 1)}
                      className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                    >
                      Salta
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-white/10 text-white/45 text-xs flex items-center justify-between">
              <div>Algoritmo: scadenze adattate alla data esame.</div>
              <div>Review session • minimal • office dark</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}