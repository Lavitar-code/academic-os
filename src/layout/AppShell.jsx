import { motion } from "framer-motion";

export default function AppShell({ sidebar, topbar, children }) {
  return (
    <div className="h-full w-full bg-gradient-to-b from-[#0b0f14] via-[#0b0f14] to-[#070a10]">
      {/* subtle background */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-48 -left-48 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-4 py-4">
        <div className="grid grid-cols-12 gap-4">
          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="col-span-12 md:col-span-3"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              {sidebar}
            </div>
          </motion.aside>

          <div className="col-span-12 md:col-span-9 space-y-4">
            <motion.header
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            >
              {topbar}
            </motion.header>

            <motion.main
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 min-h-[520px] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            >
              {children}
            </motion.main>
          </div>
        </div>
      </div>
    </div>
  );
}