import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { db } from "../database/db";

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

export default function DocumentsLibraryModal({
  open,
  subjectId,
  subjectName,
  onClose,
  onOpenDoc, // (doc) => void
}) {
  const [docs, setDocs] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [busy, setBusy] = useState(false);

  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const sid = useMemo(() => Number(subjectId || 0), [subjectId]);

  async function refresh() {
    if (!sid) {
      setDocs([]);
      setActiveDocId(null);
      return;
    }
    const subject = await db.subjects.get(sid);
    const list = await db.documents.where("subjectId").equals(sid).sortBy("createdAt");
    const ordered = list.reverse();
    setDocs(ordered);
    setActiveDocId(subject?.activeDocumentId ?? null);
  }

  useEffect(() => {
    if (!open) return;
    setRenameId(null);
    setRenameValue("");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sid]);

  async function setActive(id) {
    if (!sid) return;
    setBusy(true);
    try {
      await db.subjects.update(sid, { activeDocumentId: id });
      setActiveDocId(id);
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id) {
    const ok = window.confirm("Vuoi eliminare questo documento? (non elimina argomenti)");
    if (!ok) return;

    setBusy(true);
    try {
      await db.documents.delete(id);

      if (activeDocId === id) {
        await db.subjects.update(sid, { activeDocumentId: null });
        setActiveDocId(null);
      }

      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function startRename(d) {
    setRenameId(d.id);
    setRenameValue(d.displayName || d.fileName || `doc#${d.id}`);
  }

  async function applyRename() {
    const id = renameId;
    const name = String(renameValue || "").trim();
    if (!id) return;
    if (!name) return;

    setBusy(true);
    try {
      await db.documents.update(id, { displayName: name });
      setRenameId(null);
      setRenameValue("");
      await refresh();
    } finally {
      setBusy(false);
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
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[96%] max-w-[920px] max-h-[86vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">Documenti</div>
                  <div className="text-white/50 text-sm mt-1">
                    Materia: <span className="text-white/70">{subjectName || "Materia"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill>tot: {docs.length}</Pill>
                    <Pill>attivo: {activeDocId ? String(activeDocId) : "—"}</Pill>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                >
                  Chiudi
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(86vh-140px)]">
              {docs.length === 0 ? (
                <div className="text-white/60 text-sm">
                  Nessun documento salvato per questa materia. Importa un file e conferma.
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((d) => {
                    const isActive = Number(activeDocId) === Number(d.id);
                    const title = d.displayName || d.fileName || `doc#${d.id}`;

                    return (
                      <div
                        key={d.id}
                        className={[
                          "rounded-2xl border p-3 bg-white/5",
                          isActive ? "border-white/25" : "border-white/10",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {isActive && <Pill>ATTIVO</Pill>}
                              <Pill>{d.isTruncated ? "troncato" : "completo"}</Pill>
                              <Pill>outline: {(d.outline || []).length}</Pill>
                            </div>

                            <div className="mt-2 text-white/90 text-sm break-words">{title}</div>
                            <div className="text-white/50 text-xs mt-1">{fmt(d.createdAt)}</div>

                            {renameId === d.id && (
                              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                                <div className="text-white/70 text-xs mb-2">Rinomina documento</div>
                                <input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                                  placeholder="Nome visualizzato"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    disabled={busy}
                                    onClick={() => {
                                      setRenameId(null);
                                      setRenameValue("");
                                    }}
                                    className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
                                  >
                                    Annulla
                                  </button>
                                  <button
                                    disabled={busy}
                                    onClick={applyRename}
                                    className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm disabled:opacity-40"
                                  >
                                    Salva
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              disabled={busy}
                              onClick={() => onOpenDoc?.(d)}
                              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
                            >
                              Apri
                            </button>

                            <button
                              disabled={busy || isActive}
                              onClick={() => setActive(d.id)}
                              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
                            >
                              Imposta attivo
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => startRename(d)}
                              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
                            >
                              Rinomina
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => removeDoc(d.id)}
                              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
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

              <div className="mt-4 text-white/40 text-xs">
                Nota: rinomina cambia solo il nome mostrato, non il file originale. Eliminare un documento non elimina argomenti o sessioni.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}