import { motion } from "framer-motion";

const Item = ({ label, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ x: 2 }}
    whileTap={{ scale: 0.98 }}
    className={[
      "relative w-full text-left px-3 py-2 rounded-xl transition",
      active
        ? "bg-white/10 text-white"
        : "text-white/70 hover:bg-white/5 hover:text-white",
    ].join(" ")}
  >
    {active && (
      <motion.span
        layoutId="active-pill"
        className="absolute left-2 top-2 bottom-2 w-1 rounded-full bg-sky-400/60"
      />
    )}
    <span className="ml-2">{label}</span>
  </motion.button>
);

export default function Sidebar({ page, onNavigate }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-white font-semibold text-lg">Academic OS</div>
        <div className="text-white/50 text-sm">Dashboard studio</div>
      </div>

      <div className="space-y-1">
        <Item label="Dashboard" active={page === "dashboard"} onClick={() => onNavigate("dashboard")} />
        <Item label="Planner" active={page === "planner"} onClick={() => onNavigate("planner")} />
        <Item label="Non mi è chiaro" active={page === "doubts"} onClick={() => onNavigate("doubts")} />
        <Item label="Dimentico" active={page === "review"} onClick={() => onNavigate("review")} />
        <Item label="Statistiche" active={page === "stats"} onClick={() => onNavigate("stats")} />
        <Item label="Impostazioni" active={page === "settings"} onClick={() => onNavigate("settings")} />
        <Item label="Integrità (debug)" active={page === "integrity"} onClick={() => onNavigate("integrity")} />
      </div>
    </div>
  );
}