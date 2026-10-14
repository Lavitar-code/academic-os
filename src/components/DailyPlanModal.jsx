import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function DailyPlanModal({
  open,
  onClose,
  onSave,
  defaultMinutes = 60,
}) {
  const [minutes, setMinutes] = useState(defaultMinutes);

  useEffect(() => {
    if (!open) return;
    setMinutes(defaultMinutes);
  }, [open, defaultMinutes]);

  function save() {
    const n = Number(minutes || 0);
    onSave?.(Math.max(0, n));
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
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-[92%] max-w-[420px] rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Piano di oggi</div>
                <div className="text-white/50 text-sm">
                  Quanti minuti vuoi pianificare oggi?
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm text-white/80"
              >
                Non ora
              </button>
            </div>

            <div className="mt-4">
              <div className="text-white/70 text-sm mb-2">Minuti pianificati</div>
              <input
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={save}
                className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm"
              >
                Salva piano
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}