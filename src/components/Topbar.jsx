import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-70">
      <path
        fill="currentColor"
        d="M10 4a6 6 0 1 1 3.7 10.7l4.8 4.8l-1.4 1.4l-4.8-4.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8Z"
      />
    </svg>
  );
}

export default function Topbar({ title = "Dashboard", subtitle = "Academic OS • dark", onOpenSearch }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const isK = e.key.toLowerCase() === "k";
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        onOpenSearch?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenSearch]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <motion.div
          key={title}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="text-white/85 text-sm"
        >
          {title}
        </motion.div>
        <div className="text-white/50 text-xs">{subtitle}</div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSearch}
          className="w-[280px] md:w-[360px] rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70 hover:bg-black/30 transition flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <IconSearch />
            <span>Cerca…</span>
          </span>
          <span className="text-white/35 text-xs border border-white/10 rounded-xl px-2 py-1 bg-white/5">
            Ctrl K
          </span>
        </button>

        <div className="text-white/60 text-sm tabular-nums">
          {now.toLocaleString()}
        </div>
      </div>
    </div>
  );
}