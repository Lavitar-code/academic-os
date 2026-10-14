import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function FocusCheckModal({
  open,
  onClose,
  onSubmit,
  defaultRating = 3,
}) {
  const [rating, setRating] = useState(defaultRating);
  const [summary, setSummary] = useState("");
  const [unclear, setUnclear] = useState("");

  useEffect(() => {
    if (!open) return;
    setRating(defaultRating);
    setSummary("");
    setUnclear("");
  }, [open, defaultRating]);

  function submit() {
    onSubmit?.({
      rating,
      summary: summary.trim(),
      unclear: unclear.trim(),
    });
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
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />

          {/* panel */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[92%] max-w-[520px] rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Check Focus</div>
                <div className="text-white/50 text-sm">
                  20 secondi per capire se stai andando bene
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm text-white/80"
              >
                Chiudi
              </button>
            </div>

            {/* rating minimal (serve per produttività) */}
            <div className="mt-4">
              <div className="text-white/70 text-sm mb-2">Comprensione (1–5)</div>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={[
                      "w-10 h-10 rounded-xl border transition text-sm",
                      rating === n
                        ? "border-white/30 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-white/70 text-sm mb-2">Riassumi in 1 frase</div>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                placeholder="Es: ho capito come si calcola un limite con..."
              />
            </div>

            <div className="mt-3">
              <div className="text-white/70 text-sm mb-2">Cosa non è chiaro?</div>
              <textarea
                value={unclear}
                onChange={(e) => setUnclear(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                placeholder="Es: non mi è chiaro quando usare..."
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
              >
                Rimanda
              </button>
              <button
                onClick={submit}
                className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm"
              >
                Salva check
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}