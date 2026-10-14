import { useEffect, useMemo, useRef, useState } from "react";

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FocusTimer({
  mode = "free", // "free" | "pomodoro"
  pomodoroMinutes = 25,
  breakMinutes = 5,
  checkEveryMinutes = 20,
  onSoftCheck, // () => void
  onSessionStop, // (session) => void
  onRunningChange, // (isRunning:boolean) => void
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const [phase, setPhase] = useState("focus"); // "focus" | "break"
  const phaseSecondsLimit = useMemo(() => {
    if (mode !== "pomodoro") return null;
    return (phase === "focus" ? pomodoroMinutes : breakMinutes) * 60;
  }, [mode, phase, pomodoroMinutes, breakMinutes]);

  const startedAtRef = useRef(null);
  const lastCheckAtRef = useRef(null);
  const intervalIdRef = useRef(null);

  // comunica lo stato running al parent (Dashboard)
  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  useEffect(() => {
    if (!isRunning) return;

    if (intervalIdRef.current) clearInterval(intervalIdRef.current);

    intervalIdRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    if (mode === "pomodoro" && phase !== "focus") return;

    const every = Math.max(0, Number(checkEveryMinutes)) * 60;
    if (!every) return;

    if (!lastCheckAtRef.current) lastCheckAtRef.current = Date.now();

    const elapsed = Math.floor((Date.now() - lastCheckAtRef.current) / 1000);
    if (elapsed >= every) {
      lastCheckAtRef.current = Date.now();
      onSoftCheck?.();
    }
  }, [seconds, isRunning, checkEveryMinutes, mode, phase, onSoftCheck]);

  useEffect(() => {
    if (!isRunning) return;
    if (mode !== "pomodoro") return;
    if (phaseSecondsLimit == null) return;

    if (seconds >= phaseSecondsLimit) {
      setSeconds(0);
      setPhase((p) => (p === "focus" ? "break" : "focus"));
      lastCheckAtRef.current = Date.now();
    }
  }, [seconds, isRunning, mode, phaseSecondsLimit]);

  function start() {
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    if (!lastCheckAtRef.current) lastCheckAtRef.current = Date.now();
    setHasStarted(true);
    setIsRunning(true);
  }

  function pause() {
    setIsRunning(false);
  }

  function stop() {
    const canStopNow = hasStarted || seconds > 0;
    if (!canStopNow) return;

    const endedAt = Date.now();
    const startedAt = startedAtRef.current;

    const session = {
      startedAt,
      endedAt,
      durationSeconds: seconds,
      mode,
      phase: mode === "pomodoro" ? phase : "free",
    };

    setIsRunning(false);
    setSeconds(0);
    setPhase("focus");
    setHasStarted(false);

    startedAtRef.current = null;
    lastCheckAtRef.current = null;

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    onSessionStop?.(session);
  }

  const label =
    mode === "pomodoro"
      ? phase === "focus"
        ? "Pomodoro • Focus"
        : "Pomodoro • Pausa"
      : "Focus • Libero";

  const canStop = hasStarted || seconds > 0;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-semibold tabular-nums">
            {formatMMSS(seconds)}
          </div>
          <div className="text-white/50 text-xs">{label}</div>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={start}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Start
            </button>
          ) : (
            <button
              onClick={pause}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm"
            >
              Pausa
            </button>
          )}

          <button
            onClick={stop}
            className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm disabled:opacity-40 disabled:hover:bg-white/10"
            disabled={!canStop}
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}