const DAY = 24 * 60 * 60 * 1000;

// base spaced repetition (giorni)
const BASE = [1, 3, 7, 14, 30];

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export function daysToExam(examDateIso) {
  if (!examDateIso) return null;
  const examMs = new Date(examDateIso).getTime();
  if (!Number.isFinite(examMs)) return null;
  const now = Date.now();
  return Math.floor((examMs - now) / DAY);
}

// scala intervalli: più l'esame è vicino, più riduco
export function examScale(days) {
  if (days == null) return 1;
  if (days <= 7) return 0.35;
  if (days <= 14) return 0.5;
  if (days <= 30) return 0.75;
  return 1;
}

export function nextSchedule({
  nowMs,
  examDays,
  prevIntervalIndex = 0,
  prevStreak = 0,
  result, // "done" | "todo"
}) {
  const scale = examScale(examDays);

  if (result === "todo") {
    const intervalIndex = 0;
    const streak = 0;
    const days = Math.max(1, Math.round(BASE[intervalIndex] * scale));
    return {
      status: "todo",
      intervalIndex,
      streak,
      dueAt: nowMs + days * DAY,
    };
  }

  // done
  const intervalIndex = clamp(prevIntervalIndex + 1, 0, BASE.length - 1);
  const streak = prevStreak + 1;
  const days = Math.max(1, Math.round(BASE[intervalIndex] * scale));
  return {
    status: "done",
    intervalIndex,
    streak,
    dueAt: nowMs + days * DAY,
  };
}

// utility: se un item è scaduto, deve tornare "todo"
export function normalizeDueStatus(item, nowMs) {
  const dueAt = item?.dueAt ?? 0;
  if (dueAt && dueAt <= nowMs && item.status === "done") {
    return { ...item, status: "todo" };
  }
  return item;
}