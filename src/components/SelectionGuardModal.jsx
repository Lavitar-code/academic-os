import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { db } from "../database/db";

export default function SelectionGuardModal({
  open,
  subjects,
  defaultSubjectId = "",
  onCancel,
  onConfirm, // ({subjectId, topicId}) => void
}) {
  const [subjectId, setSubjectId] = useState(defaultSubjectId || "");
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState("");

  // quick create topic
  const [showCreate, setShowCreate] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDifficulty, setNewTopicDifficulty] = useState(3);
  const [busyCreate, setBusyCreate] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubjectId(defaultSubjectId || "");
    setTopicId("");
    setShowCreate(false);
    setNewTopicName("");
    setNewTopicDifficulty(3);
    setBusyCreate(false);
    setErr("");
  }, [open, defaultSubjectId]);

  async function loadTopics(sid) {
    if (!sid) {
      setTopics([]);
      setTopicId("");
      return;
    }
    const t = await db.topics.where("subjectId").equals(Number(sid)).toArray();
    setTopics(t);
    if (t[0]) setTopicId(String(t[0].id));
    else setTopicId("");
  }

  useEffect(() => {
    (async () => {
      if (!open) return;
      await loadTopics(subjectId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subjectId]);

  const canConfirm = useMemo(() => {
    return Boolean(subjectId) && Boolean(topicId);
  }, [subjectId, topicId]);

  async function createTopicNow() {
    setErr("");
    const sid = Number(subjectId || 0);
    if (!sid) {
      setErr("Seleziona prima una materia.");
      return;
    }

    const name = newTopicName.trim();
    if (!name) {
      setErr("Scrivi un nome argomento.");
      return;
    }

    setBusyCreate(true);
    try {
      // dedup per materia (case-insensitive)
      const existing = await db.topics.where("subjectId").equals(sid).toArray();
      const exists = existing.some(
        (x) => String(x.name || "").trim().toLowerCase() === name.toLowerCase()
      );
      if (exists) {
        setErr("Questo argomento esiste già in quella materia.");
        setBusyCreate(false);
        return;
      }

      const id = await db.topics.add({
        subjectId: sid,
        name,
        difficulty: Number(newTopicDifficulty || 3),
      });

      // ricarica topics e seleziona quello appena creato
      await loadTopics(String(sid));
      setTopicId(String(id));

      setShowCreate(false);
      setNewTopicName("");
      setNewTopicDifficulty(3);
    } catch (e) {
      setErr(e?.message || "Errore creazione argomento");
    } finally {
      setBusyCreate(false);
    }
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
          <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[94%] max-w-[720px] rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Dati incompleti</div>
                <div className="text-white/50 text-sm mt-1">
                  Per salvare la sessione devi scegliere{" "}
                  <span className="text-white/70">Materia</span> e{" "}
                  <span className="text-white/70">Argomento</span>.
                </div>
              </div>

              <button
                onClick={onCancel}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="text-white/60 text-xs mb-2">Materia</div>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setShowCreate(false);
                    setErr("");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">(seleziona)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {subjects.length === 0 && (
                  <div className="mt-2 text-white/45 text-xs">
                    Nessuna materia esiste ancora. Creane una in Planner.
                  </div>
                )}
              </div>

              <div>
                <div className="text-white/60 text-xs mb-2">Argomento</div>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  disabled={!subjectId || topics.length === 0}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none disabled:opacity-40"
                >
                  {topics.length === 0 ? (
                    <option value="">(nessun argomento)</option>
                  ) : (
                    topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  )}
                </select>

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      if (!subjectId) {
                        setErr("Seleziona prima una materia.");
                        return;
                      }
                      setShowCreate((v) => !v);
                      setErr("");
                    }}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                  >
                    + Crea argomento al volo
                  </button>

                  <button
                    onClick={async () => {
                      await loadTopics(subjectId);
                    }}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                  >
                    Aggiorna
                  </button>
                </div>
              </div>
            </div>

            {/* quick create panel */}
            {showCreate && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-white/80 text-sm font-semibold">
                  Nuovo argomento (al volo)
                </div>
                <div className="text-white/45 text-xs mt-1">
                  Viene creato nella materia selezionata e poi selezionato automaticamente.
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="Nome argomento (es. Derivate)"
                    className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  />

                  <select
                    value={newTopicDifficulty}
                    onChange={(e) => setNewTopicDifficulty(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        diff {n}/5
                      </option>
                    ))}
                  </select>

                  <div className="md:col-span-3 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowCreate(false);
                        setErr("");
                      }}
                      className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                    >
                      Annulla
                    </button>
                    <button
                      disabled={busyCreate}
                      onClick={createTopicNow}
                      className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Crea
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                    {err}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
              >
                Annulla
              </button>
              <button
                disabled={!canConfirm}
                onClick={() => onConfirm?.({ subjectId, topicId })}
                className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm disabled:opacity-40"
              >
                Salva sessione
              </button>
            </div>

            <div className="mt-3 text-white/40 text-xs">
              Guardrail attivo: evita dati “sporchi” → statistiche, score e ripasso più accurati.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}