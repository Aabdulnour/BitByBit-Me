import type { AttemptRecord } from "../../../types/attempts";

export const MASTERY_QUIZ_TYPES = ["mini_quiz", "unit_test"] as const;

export function filterAttemptsByType(
  records: AttemptRecord[],
  allowedTypes: string[] = [...MASTERY_QUIZ_TYPES]
) {
  if (!records.length) return records;
  if (!allowedTypes || allowedTypes.length === 0) return records;
  return records.filter((attempt) =>
    allowedTypes.includes(attempt.quizType || "")
  );
}

export type UnitAttemptIndex = Record<
  string,
  {
    attempts: AttemptRecord[];
    bySection: Record<string, AttemptRecord[]>;
  }
>;

export function buildUnitAttemptIndex(
  attempts: AttemptRecord[]
): UnitAttemptIndex {
  return attempts.reduce<UnitAttemptIndex>((acc, attempt) => {
    if (!attempt.unitId) return acc;
    if (!acc[attempt.unitId]) {
      acc[attempt.unitId] = { attempts: [], bySection: {} };
    }
    acc[attempt.unitId].attempts.push(attempt);
    if (attempt.sectionId) {
      if (!acc[attempt.unitId].bySection[attempt.sectionId]) {
        acc[attempt.unitId].bySection[attempt.sectionId] = [];
      }
      acc[attempt.unitId].bySection[attempt.sectionId].push(attempt);
    }
    return acc;
  }, {});
}

export function calcAverageScore(
  records: AttemptRecord[],
  allowedTypes?: string[]
): number {
  const scoped = allowedTypes ? filterAttemptsByType(records, allowedTypes) : records;
  if (!scoped.length) return 0;
  const total = scoped.reduce((sum, a) => sum + (a.scorePct || 0), 0);
  return Math.round(total / scoped.length);
}

export function calcMasteryScore(records: AttemptRecord[]) {
  // Mastery is computed from mini quizzes and unit tests only. Practice and diagnostics are excluded.
  return calcAverageScore(records, [...MASTERY_QUIZ_TYPES]);
}

export function getSectionStats(
  unitId: string,
  sectionId: string,
  index: UnitAttemptIndex
) {
  const sectionAttempts =
    index[unitId]?.bySection[sectionId] ?? ([] as AttemptRecord[]);
  const mastery = calcMasteryScore(sectionAttempts);
  let status: "Not started" | "In progress" | "Mastered" = "Not started";
  if (mastery >= 67) status = "Mastered";
  else if (mastery >= 34) status = "In progress";
  return {
    mastery,
    attempts: filterAttemptsByType(sectionAttempts, [...MASTERY_QUIZ_TYPES])
      .length,
    status,
  };
}

export function hasDiagnosticAttempt(
  unitId: string,
  index: UnitAttemptIndex
) {
  return (
    index[unitId]?.attempts.some(
      (a) => a.quizType === "diagnostic"
    ) ?? false
  );
}

export function classifyPlacement(scorePct: number | null | undefined) {
  if (scorePct == null) return null;
  if (scorePct < 34) return "Foundations";
  if (scorePct < 67) return "On track";
  return "Advanced";
}

export type PlacementLabel = ReturnType<typeof classifyPlacement>;

export function describePlacement(level: PlacementLabel) {
  switch (level) {
    case "Foundations":
      return "We will start you at early sections and ramp up as you master the basics.";
    case "On track":
      return "You are on track. We will mix in both practice and mini quizzes to keep you growing.";
    case "Advanced":
      return "You are advanced. You will see more challenging items sooner.";
    default:
      return "Complete the diagnostic to see your personalized starting point.";
  }
}
