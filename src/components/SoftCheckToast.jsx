import { AnimatePresence, motion } from "framer-motion";

export default function SoftCheckToast({
  open,
  onOpenCheck,
  onSnooze,
  onClose,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="fixed right-6 top-6 z-50 w-[320px] rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur p-3 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white/90 text-sm font-semibold">
                Check focus
              </div>
              <div className="text-white/55 text-xs">
                Vuoi salvare un riassunto + cosa non è chiaro?
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-2 py-1 text-xs text-white/80"
            >
              X
            </button>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={onSnooze}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
            >
              Rimanda 2 min
            </button>
            <button
              onClick={onOpenCheck}
              className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-xs"
            >
              Apri check
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}