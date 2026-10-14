// src/utils/appSettings.js
const KEY = "academic_os_settings_v2";

export const DEFAULT_SETTINGS = {
  checkEveryMinutes: 20,
  defaultSessionType: "teoria",
  defaultPlannedMinutes: 60,
  language: "it",

  // ✅ backup reminder
  backupReminderDays: 7, // ogni quanti giorni ricordare
  lastBackupAt: null, // ISO string

  // ✅ import mode
  importMode: "clean", // "clean" | "aggressive"
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch) {
  const curr = loadSettings();
  const next = { ...curr, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function replaceSettings(allSettings) {
  const next = { ...DEFAULT_SETTINGS, ...(allSettings || {}) };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function exportSettingsPayload() {
  return {
    type: "settings",
    app: "AcademicOS",
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
  };
}

// helper: update last backup timestamp
export function markBackupNow() {
  const now = new Date().toISOString();
  return saveSettings({ lastBackupAt: now });
}