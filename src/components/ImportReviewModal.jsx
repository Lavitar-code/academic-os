import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

function normalizeTopics(topics) {
  return (topics || [])
    .map((t) => {
      if (typeof t === "string") return { name: t, difficulty: 3 };
      return { name: t?.name || "", difficulty: Number(t?.difficulty || 3) };
    })
    .filter((x) => x.name.trim().length > 0);
}

export default function ImportReviewModal({
  open,
  fileName,
  blocks,
  subjects, // existing subjects [{id,name}]
  onCancel,
  onConfirm, // (plan) => void
}) {
  const initialPlan = useMemo(() => {
    // default: NEW subject (così puoi rinominare subito se il titolo non va bene)
    return (blocks || []).map((b) => {
      const subjName = String(b?.subjectName || "").trim();

      return {
        sourceSubjectName: subjName || "Senza titolo",
        targetMode: "new", // ✅ default new per facilitare rinomina
        existingSubjectId: "",
        newSubjectName: subjName || "",
        topics: normalizeTopics(b?.topics),
      };
    });
  }, [blocks]);

  const [plan, setPlan] = useState([]);

  // default difficulty controls
  const [defaultDifficulty, setDefaultDifficulty] = useState(3);

  useEffect(() => {
    if (!open) return;
    setPlan(initialPlan);
    setDefaultDifficulty(3);
  }, [open, initialPlan]);

  function updateBlock(i, patch) {
    setPlan((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function updateTopic(i, j, patch) {
    setPlan((prev) =>
      prev.map((b, idx) => {
        if (idx !== i) return b;
        const topics = b.topics.map((t, tIdx) => (tIdx === j ? { ...t, ...patch } : t));
        return { ...b, topics };
      })
    );
  }

  function removeTopic(i, j) {
    setPlan((prev) =>
      prev.map((b, idx) => {
        if (idx !== i) return b;
        const topics = b.topics.filter((_, tIdx) => tIdx !== j);
        return { ...b, topics };
      })
    );
  }

  // ✅ mass apply
  function applyDifficultyAll(mode) {
    setPlan((prev) =>
      prev.map((b) => ({
        ...b,
        topics: b.topics.map((t) => {
          if (mode === "only-default-3" && Number(t.difficulty) !== 3) return t;
          return { ...t, difficulty: defaultDifficulty };
        }),
      }))
    );
  }

  function confirm() {
    const cleaned = plan
      .map((b) => ({
        targetMode: b.targetMode,
        existingSubjectId: b.existingSubjectId,
        newSubjectName: (b.newSubjectName || "").trim(),
        topics: (b.topics || [])
          .map((t) => ({
            name: (t.name || "").trim(),
            difficulty: Math.min(5, Math.max(1, Number(t.difficulty || 3))),
          }))
          .filter((t) => t.name.length > 0),
      }))
      .filter((b) => b.topics.length > 0);

    onConfirm?.(cleaned);
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
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[94%] max-w-[900px] max-h-[82vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur shadow-xl"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">Importa file</div>
                  <div className="text-white/50 text-sm mt-1">
                    Preview prima di salvare — {fileName || "file"}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onCancel}
                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={confirm}
                    className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm"
                  >
                    Conferma import
                  </button>
                </div>
              </div>

              {/* ✅ default difficulty controls */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="text-white/60 text-sm">Difficoltà default:</div>
                <select
                  value={defaultDifficulty}
                  onChange={(e) => setDefaultDifficulty(Number(e.target.value))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}/5
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => applyDifficultyAll("only-default-3")}
                  className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                  title="Imposta la difficoltà solo agli argomenti che sono ancora 3/5"
                >
                  Applica ai 3/5
                </button>

                <button
                  onClick={() => applyDifficultyAll("all")}
                  className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                  title="Sovrascrive tutte le difficoltà"
                >
                  Applica a tutti
                </button>

                <div className="text-white/40 text-xs">
                  (Poi puoi sempre rifinire in Planner)
                </div>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(82vh-140px)] space-y-3">
              {plan.length === 0 && (
                <div className="text-white/60 text-sm">
                  Non ho trovato argomenti importabili in questo file.
                </div>
              )}

              {plan.map((b, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-white/85 text-sm font-semibold">
                      Materia trovata: <span className="text-white">{b.sourceSubjectName}</span>
                    </div>

                    <div className="flex gap-2">
                      <select
                        value={b.targetMode}
                        onChange={(e) => updateBlock(i, { targetMode: e.target.value })}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                      >
                        <option value="existing">Usa materia esistente</option>
                        <option value="new">Crea / Rinomina materia</option>
                      </select>

                      {b.targetMode === "existing" ? (
                        <select
                          value={b.existingSubjectId}
                          onChange={(e) => updateBlock(i, { existingSubjectId: e.target.value })}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                        >
                          <option value="">(seleziona)</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={b.newSubjectName}
                          onChange={(e) => updateBlock(i, { newSubjectName: e.target.value })}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          placeholder="Nome materia (puoi modificarlo)"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {b.topics.map((t, j) => (
                      <div
                        key={j}
                        className="rounded-2xl border border-white/10 bg-black/20 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-white/90 break-words">{t.name}</div>
                          <div className="text-white/50 text-xs mt-1">
                            difficoltà: {t.difficulty}/5
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={t.difficulty}
                            onChange={(e) => updateTopic(i, j, { difficulty: Number(e.target.value) })}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n}/5
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => removeTopic(i, j)}
                            className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                          >
                            Rimuovi
                          </button>
                        </div>
                      </div>
                    ))}

                    {b.topics.length === 0 && (
                      <div className="text-white/60 text-sm">Nessun argomento in questo blocco.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}