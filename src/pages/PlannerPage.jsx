import { useEffect, useMemo, useState } from "react";
import { db } from "../database/db";

const Card = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="text-white/70 text-sm mb-2">{title}</div>
    {children}
  </div>
);

function daysBetween(aMs, bMs) {
  return Math.floor((bMs - aMs) / (1000 * 60 * 60 * 24));
}

export default function PlannerPage({ initialSubjectId = null }) {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  useEffect(() => {
    if (initialSubjectId) setSelectedSubjectId(String(initialSubjectId));
  }, [initialSubjectId]);

  // add subject
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectExamDate, setNewSubjectExamDate] = useState("");

  // add topic
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDifficulty, setNewTopicDifficulty] = useState(3);

  async function refreshAll() {
    const s = await db.subjects.toArray();
    const ses = await db.sessions.toArray();
    setSubjects(s);
    setSessions(ses);

    if (!selectedSubjectId && s[0]) setSelectedSubjectId(String(s[0].id));

    if (selectedSubjectId) {
      const t = await db.topics.where("subjectId").equals(Number(selectedSubjectId)).toArray();
      setTopics(t);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedSubjectId) return;
      const t = await db.topics.where("subjectId").equals(Number(selectedSubjectId)).toArray();
      setTopics(t);
    })();
  }, [selectedSubjectId]);

  const lastByTopic = useMemo(() => {
    const m = new Map();
    for (const ses of sessions) {
      const key = ses.topicId;
      const when = ses.endedAt || ses.startedAt;
      if (!key || !when) continue;
      const prev = m.get(key) || 0;
      if (when > prev) m.set(key, when);
    }
    return m;
  }, [sessions]);

  const selectedSubject = useMemo(() => {
    return subjects.find((s) => String(s.id) === String(selectedSubjectId)) || null;
  }, [subjects, selectedSubjectId]);

  async function addSubject() {
    const name = newSubjectName.trim();
    if (!name) return;

    const id = await db.subjects.add({
      name,
      examDate: newSubjectExamDate || null,
      activeDocumentId: null,
    });

    setNewSubjectName("");
    setNewSubjectExamDate("");

    await refreshAll();
    setSelectedSubjectId(String(id));
  }

  async function updateExamDate(examDate) {
    if (!selectedSubjectId) return;
    await db.subjects.update(Number(selectedSubjectId), { examDate: examDate || null });
    await refreshAll();
  }

  // ✅ DELETE SUBJECT = CLEANUP TOTALE
  async function deleteSubjectTotal() {
    if (!selectedSubjectId) return;

    const sid = Number(selectedSubjectId);
    const subj = await db.subjects.get(sid);

    const ok = window.confirm(
      `Eliminare "${subj?.name || "Materia"}" e TUTTI i dati collegati?\n\n` +
        `• Argomenti\n• Documenti\n• Ripasso (review)\n• Sessioni\n• Focus check\n• Dubbi\n\n` +
        `Operazione irreversibile.`
    );

    if (!ok) return;

    await db.transaction(
      "rw",
      db.subjects,
      db.topics,
      db.documents,
      db.review_items,
      db.sessions,
      db.focus_checks,
      db.doubts,
      async () => {
        // 1) topics
        const t = await db.topics.where("subjectId").equals(sid).toArray();
        const topicIds = t.map((x) => x.id);

        // 2) documents
        const docs = await db.documents.where("subjectId").equals(sid).toArray();
        const docIds = docs.map((x) => x.id);

        // 3) review items
        const reviews = await db.review_items.where("subjectId").equals(sid).toArray();
        const reviewIds = reviews.map((x) => x.id);

        // 4) sessions
        const ses = await db.sessions.where("subjectId").equals(sid).toArray();
        const sessionIds = ses.map((x) => x.id);

        // 5) focus checks
        const checks = await db.focus_checks.where("subjectId").equals(sid).toArray();
        const checkIds = checks.map((x) => x.id);

        // 6) doubts
        const doubts = await db.doubts.where("subjectId").equals(sid).toArray();
        const doubtIds = doubts.map((x) => x.id);

        // delete in bulk where possible
        if (topicIds.length) await db.topics.bulkDelete(topicIds);
        if (docIds.length) await db.documents.bulkDelete(docIds);
        if (reviewIds.length) await db.review_items.bulkDelete(reviewIds);
        if (sessionIds.length) await db.sessions.bulkDelete(sessionIds);
        if (checkIds.length) await db.focus_checks.bulkDelete(checkIds);
        if (doubtIds.length) await db.doubts.bulkDelete(doubtIds);

        // finally subject
        await db.subjects.delete(sid);
      }
    );

    // reset selection and reload
    setSelectedSubjectId("");
    setTopics([]);
    await refreshAll();
  }

  async function addTopic() {
    if (!selectedSubjectId) return;
    const name = newTopicName.trim();
    if (!name) return;

    await db.topics.add({
      subjectId: Number(selectedSubjectId),
      name,
      difficulty: Number(newTopicDifficulty || 3),
    });

    setNewTopicName("");
    setNewTopicDifficulty(3);

    const t = await db.topics.where("subjectId").equals(Number(selectedSubjectId)).toArray();
    setTopics(t);
  }

  async function updateTopicDifficulty(topicId, difficulty) {
    await db.topics.update(topicId, { difficulty: Number(difficulty) });
    const t = await db.topics.where("subjectId").equals(Number(selectedSubjectId)).toArray();
    setTopics(t);
  }

  async function deleteTopic(topicId) {
    await db.topics.delete(topicId);
    const t = await db.topics.where("subjectId").equals(Number(selectedSubjectId)).toArray();
    setTopics(t);
  }

  return (
    <div className="space-y-4">
      <Card title="Materie">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <div className="text-white/60 text-xs mb-2">Seleziona materia</div>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
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

            <div className="mt-4 text-white/60 text-xs mb-2">Aggiungi materia</div>
            <input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Nome materia (es. Analisi 1)"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            />
            <input
              type="date"
              value={newSubjectExamDate}
              onChange={(e) => setNewSubjectExamDate(e.target.value)}
              className="w-full mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              title="Data esame (opzionale)"
            />
            <button
              onClick={addSubject}
              className="w-full mt-2 rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              + Aggiungi
            </button>
          </div>

          <div className="md:col-span-2">
            {!selectedSubject ? (
              <div className="text-white/60 text-sm">Nessuna materia selezionata.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold text-lg">{selectedSubject.name}</div>
                    <div className="text-white/50 text-xs mt-1">
                      Imposta data esame e difficoltà. Eliminazione = cleanup totale.
                    </div>
                  </div>

                  <button
                    onClick={deleteSubjectTotal}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                    title="Elimina materia e tutti i dati collegati"
                  >
                    Elimina materia (totale)
                  </button>
                </div>

                <div className="mt-3">
                  <div className="text-white/60 text-xs mb-2">Data esame</div>
                  <input
                    type="date"
                    value={selectedSubject.examDate || ""}
                    onChange={(e) => updateExamDate(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="text-white/70 text-sm mb-2">Argomenti</div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                    <input
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="Nuovo argomento (es. Limiti notevoli)"
                      className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                    />
                    <select
                      value={newTopicDifficulty}
                      onChange={(e) => setNewTopicDifficulty(Number(e.target.value))}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          Difficoltà {n}/5
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={addTopic}
                      className="md:col-span-3 rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                    >
                      + Aggiungi argomento
                    </button>
                  </div>

                  <div className="space-y-2">
                    {topics.map((t) => {
                      const last = lastByTopic.get(t.id) || null;
                      const days = last ? Math.max(0, daysBetween(last, Date.now())) : null;

                      return (
                        <div
                          key={t.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-white/90">{t.name}</div>
                            <div className="text-white/45 text-xs mt-1">
                              {days == null ? "mai studiato" : `ultimo studio: ${days} giorni fa`}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={t.difficulty || 3}
                              onChange={(e) => updateTopicDifficulty(t.id, e.target.value)}
                              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}/5
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => deleteTopic(t.id)}
                              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                            >
                              Elimina
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {topics.length === 0 && (
                      <div className="text-white/60 text-sm">
                        Nessun argomento ancora. Aggiungine uno sopra o importane da file.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}