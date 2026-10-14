import { useEffect, useMemo, useState } from "react";
import { db } from "../database/db";

const Card = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div>
      <div className="text-white/90 font-semibold">{title}</div>
      {subtitle && <div className="text-white/50 text-sm mt-1">{subtitle}</div>}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

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

export default function DataIntegrityPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [stats, setStats] = useState(null);
  const [samples, setSamples] = useState({
    badSessions: [],
    badReviews: [],
    orphanDocs: [],
    orphanTopics: [],
  });

  async function scan() {
    setBusy(true);
    setMsg("");
    try {
      const [subjects, topics, sessions, reviews, documents] = await Promise.all([
        db.subjects.toArray(),
        db.topics.toArray(),
        db.sessions.toArray(),
        db.review_items.toArray(),
        db.documents.toArray(),
      ]);

      const subjectIds = new Set(subjects.map((s) => s.id));
      const topicIds = new Set(topics.map((t) => t.id));

      // sessions without subject/topic
      const badSessions = sessions.filter((s) => !s.subjectId || !s.topicId);
      // sessions referencing missing entities
      const danglingSessions = sessions.filter(
        (s) =>
          (s.subjectId && !subjectIds.has(s.subjectId)) ||
          (s.topicId && !topicIds.has(s.topicId))
      );

      // reviews without dueAt or subjectId
      const badReviews = reviews.filter((r) => !r.subjectId || !r.dueAt);
      // reviews referencing missing subject
      const danglingReviews = reviews.filter((r) => r.subjectId && !subjectIds.has(r.subjectId));

      // documents referencing missing subject
      const orphanDocs = documents.filter((d) => !d.subjectId || !subjectIds.has(d.subjectId));

      // topics referencing missing subject
      const orphanTopics = topics.filter((t) => !t.subjectId || !subjectIds.has(t.subjectId));

      // subject.activeDocumentId missing doc
      const docIds = new Set(documents.map((d) => d.id));
      const badActive = subjects.filter((s) => s.activeDocumentId && !docIds.has(s.activeDocumentId));

      setStats({
        subjects: subjects.length,
        topics: topics.length,
        sessions: sessions.length,
        reviews: reviews.length,
        documents: documents.length,

        badSessions: badSessions.length,
        danglingSessions: danglingSessions.length,
        badReviews: badReviews.length,
        danglingReviews: danglingReviews.length,
        orphanDocs: orphanDocs.length,
        orphanTopics: orphanTopics.length,
        badActiveDocRefs: badActive.length,
      });

      setSamples({
        badSessions: badSessions.slice(0, 10),
        badReviews: badReviews.slice(0, 10),
        orphanDocs: orphanDocs.slice(0, 10),
        orphanTopics: orphanTopics.slice(0, 10),
      });
    } catch (e) {
      setMsg(`❌ Errore scan: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  async function repair() {
    const ok = window.confirm(
      "Riparazione: rimuove riferimenti orfani e completa campi mancanti quando possibile.\n\nProcedo?"
    );
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      const now = Date.now();

      const [subjects, topics, sessions, reviews, documents] = await Promise.all([
        db.subjects.toArray(),
        db.topics.toArray(),
        db.sessions.toArray(),
        db.review_items.toArray(),
        db.documents.toArray(),
      ]);

      const subjectIds = new Set(subjects.map((s) => s.id));
      const topicIds = new Set(topics.map((t) => t.id));
      const docIds = new Set(documents.map((d) => d.id));

      await db.transaction(
        "rw",
        db.subjects,
        db.topics,
        db.sessions,
        db.review_items,
        db.documents,
        async () => {
          // 1) fix subjects.activeDocumentId that points to nothing
          for (const s of subjects) {
            if (s.activeDocumentId && !docIds.has(s.activeDocumentId)) {
              await db.subjects.update(s.id, { activeDocumentId: null });
            }
          }

          // 2) delete orphan topics (subject missing)
          const orphanTopics = topics.filter((t) => !t.subjectId || !subjectIds.has(t.subjectId));
          if (orphanTopics.length) {
            await db.topics.bulkDelete(orphanTopics.map((t) => t.id));
          }

          // 3) delete orphan documents (subject missing)
          const orphanDocs = documents.filter((d) => !d.subjectId || !subjectIds.has(d.subjectId));
          if (orphanDocs.length) {
            await db.documents.bulkDelete(orphanDocs.map((d) => d.id));
          }

          // 4) sessions:
          // - if missing subject/topic -> delete (because cannot be trusted)
          // - if dangling refs -> delete
          const badSessions = sessions.filter(
            (s) =>
              !s.subjectId ||
              !s.topicId ||
              (s.subjectId && !subjectIds.has(s.subjectId)) ||
              (s.topicId && !topicIds.has(s.topicId))
          );
          if (badSessions.length) {
            await db.sessions.bulkDelete(badSessions.map((s) => s.id));
          }

          // 5) reviews:
          // - if subject missing -> delete
          // - if dueAt missing -> set dueAt = now + 1 day (safe, respects your minimum 1 day)
          const DAY = 24 * 60 * 60 * 1000;

          for (const r of reviews) {
            if (!r.subjectId || !subjectIds.has(r.subjectId)) {
              await db.review_items.delete(r.id);
              continue;
            }
            if (!r.dueAt) {
              await db.review_items.update(r.id, { dueAt: now + DAY, status: r.status || "todo" });
            }
          }
        }
      );

      setMsg("✅ Riparazione completata. Ho rimosso dati orfani e completato scadenze mancanti.");
      await scan();
    } catch (e) {
      setMsg(`❌ Errore repair: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Integrità dati"
        subtitle="Scanner + Ripara. Serve per mantenere stabile DB e statistiche (soprattutto dopo import e upgrade)."
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={scan}
            disabled={busy}
            className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
          >
            Scansiona
          </button>
          <button
            onClick={repair}
            disabled={busy}
            className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm disabled:opacity-40"
          >
            Ripara
          </button>
        </div>

        {msg && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            {msg}
          </div>
        )}

        {stats && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/70 text-sm">Totali</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill>subjects: {stats.subjects}</Pill>
                <Pill>topics: {stats.topics}</Pill>
                <Pill>documents: {stats.documents}</Pill>
                <Pill>sessions: {stats.sessions}</Pill>
                <Pill>reviews: {stats.reviews}</Pill>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/70 text-sm">Problemi trovati</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill>bad sessions: {stats.badSessions}</Pill>
                <Pill>dangling sessions: {stats.danglingSessions}</Pill>
                <Pill>bad reviews: {stats.badReviews}</Pill>
                <Pill>dangling reviews: {stats.danglingReviews}</Pill>
                <Pill>orphan docs: {stats.orphanDocs}</Pill>
                <Pill>orphan topics: {stats.orphanTopics}</Pill>
                <Pill>bad active docs: {stats.badActiveDocRefs}</Pill>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Esempi (debug)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-sm">Sessioni problematiche</div>
            <div className="text-white/45 text-xs mt-1">Prime 10</div>
            <div className="mt-2 space-y-2">
              {samples.badSessions.length === 0 ? (
                <div className="text-white/55 text-sm">Nessuna.</div>
              ) : (
                samples.badSessions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-white/75">
                    id {s.id} • subj {String(s.subjectId)} • topic {String(s.topicId)} • {fmt(s.startedAt)}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-sm">Review problematiche</div>
            <div className="text-white/45 text-xs mt-1">Prime 10</div>
            <div className="mt-2 space-y-2">
              {samples.badReviews.length === 0 ? (
                <div className="text-white/55 text-sm">Nessuna.</div>
              ) : (
                samples.badReviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-white/75">
                    id {r.id} • subj {String(r.subjectId)} • dueAt {String(r.dueAt)} • status {String(r.status)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}