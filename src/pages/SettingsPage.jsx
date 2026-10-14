// src/pages/SettingsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { db } from "../database/db";
import {
  exportSettingsPayload,
  loadSettings,
  markBackupNow,
  replaceSettings,
  saveSettings,
} from "../utils/appSettings";

const Card = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div>
      <div className="text-white/90 font-semibold">{title}</div>
      {subtitle && <div className="text-white/50 text-sm mt-1">{subtitle}</div>}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}_${hh}${mm}`;
}

function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function Modal({ open, title, children, onClose }) {
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
            className="relative w-[94%] max-w-[720px] rounded-2xl border border-white/10 bg-[#0b0f14]/95 backdrop-blur p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold">{title}</div>
                <div className="text-white/50 text-sm mt-1">Controlla bene prima di procedere.</div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
              >
                Chiudi
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [counts, setCounts] = useState(null);

  const [settings, setSettings] = useState(loadSettings());

  const [dataFileInfo, setDataFileInfo] = useState(null);
  const [settingsFileInfo, setSettingsFileInfo] = useState(null);
  const [confirmDataOpen, setConfirmDataOpen] = useState(false);
  const [confirmSettingsOpen, setConfirmSettingsOpen] = useState(false);

  const dataFilename = useMemo(() => `academic_os_data_${todayStamp()}.json`, []);
  const settingsFilename = useMemo(() => `academic_os_settings_${todayStamp()}.json`, []);

  const overdueDays = useMemo(() => {
    const d = daysSince(settings.lastBackupAt);
    if (d == null) return null;
    return d;
  }, [settings.lastBackupAt]);

  const shouldRemind = useMemo(() => {
    const d = overdueDays;
    if (d == null) return true; // mai fatto backup -> sì
    return d >= Number(settings.backupReminderDays || 7);
  }, [overdueDays, settings.backupReminderDays]);

  async function refreshCounts() {
    const [
      subjects,
      topics,
      sessions,
      checks,
      doubts,
      plans,
      documents,
      reviewItems,
    ] = await Promise.all([
      db.subjects.count(),
      db.topics.count(),
      db.sessions.count(),
      db.focus_checks.count(),
      db.doubts.count(),
      db.plans.count(),
      db.documents.count(),
      db.review_items.count(),
    ]);

    setCounts({
      subjects,
      topics,
      sessions,
      checks,
      doubts,
      plans,
      documents,
      reviewItems,
    });
  }

  useEffect(() => {
    refreshCounts();
  }, []);

  async function exportData() {
    setBusy(true);
    setMessage("");
    try {
      const [
        subjects,
        topics,
        sessions,
        focus_checks,
        doubts,
        plans,
        documents,
        review_items,
      ] = await Promise.all([
        db.subjects.toArray(),
        db.topics.toArray(),
        db.sessions.toArray(),
        db.focus_checks.toArray(),
        db.doubts.toArray(),
        db.plans.toArray(),
        db.documents.toArray(),
        db.review_items.toArray(),
      ]);

      const payload = {
        type: "data",
        app: "AcademicOS",
        schema: 5,
        exportedAt: new Date().toISOString(),
        tables: {
          subjects,
          topics,
          sessions,
          focus_checks,
          doubts,
          plans,
          documents,
          review_items,
        },
      };

      downloadJSON(payload, dataFilename);

      // ✅ segna ultimo backup
      const next = markBackupNow();
      setSettings(next);

      setMessage("✅ Backup DATI scaricato (include documenti + ripasso).");
    } catch (e) {
      setMessage(`❌ Errore export dati: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportSettings() {
    setBusy(true);
    setMessage("");
    try {
      downloadJSON(exportSettingsPayload(), settingsFilename);
      setMessage("✅ Backup IMPOSTAZIONI scaricato.");
    } catch (e) {
      setMessage(`❌ Errore export impostazioni: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportBoth() {
    await exportData();
    await exportSettings();
  }

  async function readJSONFile(file) {
    const txt = await file.text();
    return JSON.parse(txt);
  }

  function summarizeDataPayload(payload) {
    const t = payload?.tables || {};
    const s = (arr) => (Array.isArray(arr) ? arr.length : 0);
    return {
      subjects: s(t.subjects),
      topics: s(t.topics),
      sessions: s(t.sessions),
      focus_checks: s(t.focus_checks),
      doubts: s(t.doubts),
      plans: s(t.plans),
      documents: s(t.documents),
      review_items: s(t.review_items),
    };
  }

  async function onPickDataFile(file) {
    if (!file) return;
    setMessage("");
    setBusy(true);
    try {
      const payload = await readJSONFile(file);
      if (payload?.type !== "data" || payload?.app !== "AcademicOS") {
        throw new Error("Questo file non sembra un backup DATI di AcademicOS.");
      }
      const summary = summarizeDataPayload(payload);
      setDataFileInfo({ payload, summary, fileName: file.name });
      setConfirmDataOpen(true);
    } catch (e) {
      setMessage(`❌ Import dati: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function applyDataImport(payload) {
    setBusy(true);
    setMessage("");
    try {
      const t = payload.tables || {};

      await db.transaction(
        "rw",
        db.subjects,
        db.topics,
        db.sessions,
        db.focus_checks,
        db.doubts,
        db.plans,
        db.documents,
        db.review_items,
        async () => {
          await Promise.all([
            db.subjects.clear(),
            db.topics.clear(),
            db.sessions.clear(),
            db.focus_checks.clear(),
            db.doubts.clear(),
            db.plans.clear(),
            db.documents.clear(),
            db.review_items.clear(),
          ]);

          await db.subjects.bulkPut(Array.isArray(t.subjects) ? t.subjects : []);
          await db.topics.bulkPut(Array.isArray(t.topics) ? t.topics : []);
          await db.sessions.bulkPut(Array.isArray(t.sessions) ? t.sessions : []);
          await db.focus_checks.bulkPut(Array.isArray(t.focus_checks) ? t.focus_checks : []);
          await db.doubts.bulkPut(Array.isArray(t.doubts) ? t.doubts : []);
          await db.plans.bulkPut(Array.isArray(t.plans) ? t.plans : []);
          await db.documents.bulkPut(Array.isArray(t.documents) ? t.documents : []);
          await db.review_items.bulkPut(Array.isArray(t.review_items) ? t.review_items : []);
        }
      );

      await refreshCounts();
      setMessage("✅ Dati importati. Consigliato: Ricarica app.");
    } catch (e) {
      setMessage(`❌ Errore import dati: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onPickSettingsFile(file) {
    if (!file) return;
    setMessage("");
    setBusy(true);
    try {
      const payload = await readJSONFile(file);
      if (payload?.type !== "settings" || payload?.app !== "AcademicOS") {
        throw new Error("Questo file non sembra un backup IMPOSTAZIONI di AcademicOS.");
      }
      setSettingsFileInfo({ payload, fileName: file.name });
      setConfirmSettingsOpen(true);
    } catch (e) {
      setMessage(`❌ Import impostazioni: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function applySettingsImport(payload) {
    setBusy(true);
    setMessage("");
    try {
      const next = replaceSettings(payload.settings || {});
      setSettings(next);
      setMessage("✅ Impostazioni importate. Consigliato: Ricarica app.");
    } catch (e) {
      setMessage(`❌ Errore import impostazioni: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  function updateSetting(key, value) {
    const next = saveSettings({ [key]: value });
    setSettings(next);
    setMessage("✅ Impostazioni salvate.");
  }

  async function resetAllData() {
    const ok = window.confirm("Vuoi davvero cancellare TUTTI i dati? Operazione irreversibile.");
    if (!ok) return;

    setBusy(true);
    setMessage("");
    try {
      await db.transaction(
        "rw",
        db.subjects,
        db.topics,
        db.sessions,
        db.focus_checks,
        db.doubts,
        db.plans,
        db.documents,
        db.review_items,
        async () => {
          await Promise.all([
            db.subjects.clear(),
            db.topics.clear(),
            db.sessions.clear(),
            db.focus_checks.clear(),
            db.doubts.clear(),
            db.plans.clear(),
            db.documents.clear(),
            db.review_items.clear(),
          ]);
        }
      );
      await refreshCounts();
      setMessage("✅ Database svuotato.");
    } catch (e) {
      setMessage(`❌ Errore reset: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {shouldRemind && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-white/90 font-semibold">Backup consigliato</div>
          <div className="text-white/50 text-sm mt-1">
            {settings.lastBackupAt
              ? `Ultimo backup: ${new Date(settings.lastBackupAt).toLocaleString()} (${overdueDays} giorni fa).`
              : "Non risulta alcun backup recente."}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={exportData}
              disabled={busy}
              className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm disabled:opacity-40"
            >
              Esporta DATI ora
            </button>
            <button
              onClick={exportSettings}
              disabled={busy}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
            >
              Esporta IMPOSTAZIONI
            </button>
            <button
              onClick={() => updateSetting("backupReminderDays", 14)}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Ricordamelo ogni 14g
            </button>
          </div>
        </div>
      )}

      <Card
        title="Backup & Ripristino"
        subtitle="DATI e IMPOSTAZIONI sono separati. DATI include documenti e ripasso."
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportData}
            disabled={busy}
            className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
          >
            Esporta DATI
          </button>

          <button
            onClick={exportSettings}
            disabled={busy}
            className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
          >
            Esporta IMPOSTAZIONI
          </button>

          <button
            onClick={exportBoth}
            disabled={busy}
            className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm disabled:opacity-40"
          >
            Esporta ENTRAMBI
          </button>

          <button
            onClick={() => location.reload()}
            className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
          >
            Ricarica app
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-sm">Import DATI</div>
            <div className="text-white/50 text-xs mt-1">File: academic_os_data_....json</div>

            <label className="mt-3 block cursor-pointer rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition px-3 py-3">
              <div className="text-white/70 text-sm">Seleziona file dati</div>
              <div className="text-white/40 text-xs">.json</div>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => onPickDataFile(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-sm">Import IMPOSTAZIONI</div>
            <div className="text-white/50 text-xs mt-1">File: academic_os_settings_....json</div>

            <label className="mt-3 block cursor-pointer rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition px-3 py-3">
              <div className="text-white/70 text-sm">Seleziona file impostazioni</div>
              <div className="text-white/40 text-xs">.json</div>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => onPickSettingsFile(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        {counts && (
          <div className="mt-4 text-white/60 text-xs">
            DB → materie: <span className="text-white/80">{counts.subjects}</span>, argomenti:{" "}
            <span className="text-white/80">{counts.topics}</span>, sessioni:{" "}
            <span className="text-white/80">{counts.sessions}</span>, check:{" "}
            <span className="text-white/80">{counts.checks}</span>, dubbi:{" "}
            <span className="text-white/80">{counts.doubts}</span>, piani:{" "}
            <span className="text-white/80">{counts.plans}</span>, documenti:{" "}
            <span className="text-white/80">{counts.documents}</span>, ripasso:{" "}
            <span className="text-white/80">{counts.reviewItems}</span>
          </div>
        )}

        {message && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            {message}
          </div>
        )}
      </Card>

      <Card title="Impostazioni principali" subtitle="Import, backup reminder e focus behavior.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-sm">Import mode</div>
            <div className="text-white/40 text-xs mt-1">Pulito = più affidabile • Aggressivo = più estrazione</div>
            <select
              value={settings.importMode}
              onChange={(e) => updateSetting("importMode", e.target.value)}
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="clean">Pulito (consigliato)</option>
              <option value="aggressive">Aggressivo (più titoli)</option>
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-sm">Backup reminder</div>
            <div className="text-white/40 text-xs mt-1">Ogni quanti giorni ricordare</div>
            <select
              value={settings.backupReminderDays}
              onChange={(e) => updateSetting("backupReminderDays", Number(e.target.value))}
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              {[3, 7, 10, 14, 21, 30].map((n) => (
                <option key={n} value={n}>
                  {n} giorni
                </option>
              ))}
            </select>

            <div className="mt-2 text-white/50 text-xs">
              ultimo backup:{" "}
              <span className="text-white/70">
                {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-sm">Check ogni</div>
            <div className="text-white/40 text-xs mt-1">Intervallo toast/check focus</div>
            <select
              value={settings.checkEveryMinutes}
              onChange={(e) => updateSetting("checkEveryMinutes", Number(e.target.value))}
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            >
              {[10, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-white/70 text-sm">Zona pericolosa</div>
          <div className="text-white/40 text-xs mt-1">Fai un backup prima.</div>
          <button
            onClick={resetAllData}
            disabled={busy}
            className="mt-3 rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40"
          >
            Svuota database
          </button>
        </div>
      </Card>

      <Modal open={confirmDataOpen} title="Conferma import DATI" onClose={() => setConfirmDataOpen(false)}>
        {dataFileInfo && (
          <div className="space-y-3">
            <div className="text-white/70 text-sm">
              File: <span className="text-white/85">{dataFileInfo.fileName}</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
              Importerò:
              <div className="mt-2 grid grid-cols-2 gap-2 text-white/70">
                <div>Materie: <span className="text-white/85">{dataFileInfo.summary.subjects}</span></div>
                <div>Argomenti: <span className="text-white/85">{dataFileInfo.summary.topics}</span></div>
                <div>Sessioni: <span className="text-white/85">{dataFileInfo.summary.sessions}</span></div>
                <div>Check: <span className="text-white/85">{dataFileInfo.summary.focus_checks}</span></div>
                <div>Dubbi: <span className="text-white/85">{dataFileInfo.summary.doubts}</span></div>
                <div>Piani: <span className="text-white/85">{dataFileInfo.summary.plans}</span></div>
                <div>Documenti: <span className="text-white/85">{dataFileInfo.summary.documents}</span></div>
                <div>Ripasso: <span className="text-white/85">{dataFileInfo.summary.review_items}</span></div>
              </div>

              <div className="mt-3 text-white/50 text-xs">
                Nota: l’import DATI sostituisce completamente il database attuale.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDataOpen(false)}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  setConfirmDataOpen(false);
                  await applyDataImport(dataFileInfo.payload);
                }}
                className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm"
              >
                Importa dati
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmSettingsOpen} title="Conferma import IMPOSTAZIONI" onClose={() => setConfirmSettingsOpen(false)}>
        {settingsFileInfo && (
          <div className="space-y-3">
            <div className="text-white/70 text-sm">
              File: <span className="text-white/85">{settingsFileInfo.fileName}</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
              Impostazioni trovate:
              <pre className="mt-2 text-xs text-white/70 whitespace-pre-wrap break-words">
                {JSON.stringify(settingsFileInfo.payload.settings, null, 2)}
              </pre>

              <div className="mt-2 text-white/50 text-xs">
                Nota: l’import IMPOSTAZIONI sovrascrive le impostazioni locali.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmSettingsOpen(false)}
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  setConfirmSettingsOpen(false);
                  await applySettingsImport(settingsFileInfo.payload);
                }}
                className="rounded-xl bg-white/15 hover:bg-white/20 transition px-3 py-2 text-sm"
              >
                Importa impostazioni
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}