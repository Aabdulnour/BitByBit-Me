import { useEffect, useState } from "react";

type ProgressShape = { diagnosticsTaken: Record<string, boolean> };
const KEY = "bb_progress";

function load(): ProgressShape {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null");
    if (stored && typeof stored === "object") {
      // migrate legacy key
      if (stored.diagnosticsTaken) return stored as ProgressShape;
      if (stored.diagnosticsPassed) {
        return {
          diagnosticsTaken: stored.diagnosticsPassed,
        };
      }
    }
  } catch {
    // ignore parse issues
  }
  return { diagnosticsTaken: {} };
}
function save(p: ProgressShape) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function useProgress() {
  const [progress, setProgress] = useState<ProgressShape>(() => load());
  useEffect(() => {
    save(progress);
  }, [progress]);

  const markDiagnosticTaken = (unitId: string) =>
    setProgress((p) => ({
      ...p,
      diagnosticsTaken: { ...p.diagnosticsTaken, [unitId]: true },
    }));

  const hasTakenDiagnostic = (unitId: string) =>
    !!progress.diagnosticsTaken[unitId];

  return {
    progress,
    hasTakenDiagnostic,
    markDiagnosticTaken,
    // backward compatible aliases
    isDiagnosticPassed: hasTakenDiagnostic,
    markDiagnosticPassed: markDiagnosticTaken,
  };
}
