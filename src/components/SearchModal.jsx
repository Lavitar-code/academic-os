import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../database/db";

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

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-60">
      <path
        fill="currentColor"
        d="M13 5l7 7l-7 7l-1.4-1.4l4.6-4.6H4v-2h12.2l-4.6-4.6Z"
      />
    </svg>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
      {children}
    </span>
  );
}

export default function SearchModal({ open, onClose, onSelect }) {
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [subjectMap, setSubjectMap] = useState(new Map());
  const [topicMap, setTopicMap] = useState(new Map());

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [doubts, setDoubts] = useState([]);

  // keyboard nav
  const [activeIndex, setActiveIndex] = useState(0);

  const flatResults = useMemo(() => {
    const out = [];
    subjects.forEach((s) => out.push({ kind: "subject", ...s }));
    topics.forEach((t) => out.push({ kind: "topic", ...t }));
    doubts.forEach((d) => out.push({ kind: "doubt", ...d }));
    return out;
  }, [subjects, topics, doubts]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setSubjects([]);
    setTopics([]);
    setDoubts([]);
    setActiveIndex(0);

    // cache maps for labels
    (async () => {
      const [ss, tt] = await Promise.all([db.subjects.toArray(), db.topics.toArray()]);
      setSubjectMap(new Map(ss.map((x) => [x.id, x])));
      setTopicMap(new Map(tt.map((x) => [x.id, x])));
    })();

    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(flatResults.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") {
        const item = flatResults[activeIndex];
        if (item) {
          e.preventDefault();
          onSelect?.(item);
          onClose?.();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatResults, activeIndex, onClose, onSelect]);

  useEffect(() => {
    if (!open) return;

    const q = query.trim().toLowerCase();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // minimo 2 caratteri per evitare scansioni inutili
    if (q.length < 2) {
      setSubjects([]);
      setTopics([]);
      setDoubts([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);

      // LIMIT: evita liste enormi
      const LIMIT = 8;

      // Subjects
      const foundSubjects = await db.subjects
        .filter((s) => String(s.name || "").toLowerCase().includes(q))
        .limit(LIMIT)
        .toArray();

      // Topics
      const foundTopicsRaw = await db.topics
        .filter((t) => String(t.name || "").toLowerCase().includes(q))
        .limit(LIMIT)
        .toArray();

      const foundTopics = foundTopicsRaw.map((t) => {
        const subj = subjectMap.get(t.subjectId);
        return {
          id: t.id,
          subjectId: t.subjectId,
          title: t.name,
          subtitle: subj?.name || "Materia",
          difficulty: t.difficulty || 3,
        };
      });

      // Doubts (text)
      const foundDoubtsRaw = await db.doubts
        .filter((d) => String(d.text || "").toLowerCase().includes(q))
        .limit(LIMIT)
        .toArray();

      const foundDoubts = foundDoubtsRaw.map((d) => {
        const subj = subjectMap.get(d.subjectId);
        const top = topicMap.get(d.topicId);
        return {
          id: d.id,
          subjectId: d.subjectId,
          topicId: d.topicId,
          title: d.text,
          subtitle: `${subj?.name || "Materia"} • ${top?.name || "Argomento"}`,
          status: d.status || "open",
          sessionType: d.sessionType || "—",
        };
      });

      setSubjects(
        foundSubjects.map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: s.examDate ? `esame: ${s.examDate}` : "nessuna data esame",
        }))
      );
      setTopics(foundTopics);
      setDoubts(foundDoubts);

      setActiveIndex(0);
      setLoading(false);
    }, 160);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, subjectMap, topicMap]);

  function Row({ item, index }) {
    const active = index === activeIndex;

    const kindLabel =
      item.kind === "subject" ? "Materia" : item.kind === "topic" ? "Argomento" : "Dubbio";

    return (
      <motion.button
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => {
          onSelect?.(item);
          onClose?.();
        }}
        whileTap={{ scale: 0.99 }}
        className={[
          "w-full text-left rounded-2xl border p-3 transition",
          active
            ? "border-white/25 bg-white/10"
            : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/15",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{kindLabel}</Badge>

              {item.kind === "topic" && <Badge>diff {item.difficulty}/5</Badge>}
              {item.kind === "doubt" && <Badge>{item.status}</Badge>}

              <div className="text-white/90 text-sm break-words">
                {item.title}
              </div>
            </div>

            <div className="text-white/50 text-xs mt-1 break-words">
              {item.subtitle}
            </div>
          </div>

          <div className="shrink-0 text-white/70">
            <IconArrow />
          </div>
        </div>
      </motion.button>
    );
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
            className="relative w-[94%] max-w-[820px] max-h-[82vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          >
            {/* header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">Search</div>
                  <div className="text-white/50 text-sm">
                    Cerca materie, argomenti, dubbi — Enter per aprire, Esc per chiudere
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
                >
                  Chiudi
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-white/70">
                  <IconSearch />
                </div>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Scrivi per cercare… (min 2 caratteri)"
                  className="w-full bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35"
                />
                <div className="text-white/35 text-xs border border-white/10 rounded-xl px-2 py-1 bg-white/5">
                  Ctrl K
                </div>
              </div>
            </div>

            {/* body */}
            <div className="p-4 overflow-auto max-h-[calc(82vh-140px)]">
              {loading && (
                <div className="text-white/60 text-sm">Ricerca…</div>
              )}

              {!loading && query.trim().length < 2 && (
                <div className="text-white/60 text-sm">
                  Suggerimento: prova “capitolo”, “limiti”, “derivate”, o una parola di un dubbio.
                </div>
              )}

              {!loading && query.trim().length >= 2 && flatResults.length === 0 && (
                <div className="text-white/60 text-sm">Nessun risultato.</div>
              )}

              {!loading && flatResults.length > 0 && (
                <div className="space-y-2">
                  {flatResults.map((item, idx) => (
                    <Row key={`${item.kind}-${item.id}`} item={item} index={idx} />
                  ))}
                </div>
              )}
            </div>

            {/* footer */}
            <div className="px-4 py-3 border-t border-white/10 text-white/45 text-xs flex items-center justify-between">
              <div>↑ ↓ per muoversi • Enter per aprire</div>
              <div>Modal OS-like • animazioni Framer Motion</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}