import type { AttemptRecord } from "../types/attempts";

export function normalizeAttempts(raw: any[]): AttemptRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any) => ({
      id: a.id,
      unitId: a.unit_id,
      quizId: a.quiz_id,
      quizType: a.quiz_type,
      sectionId: a.section_id,
      scorePct: Math.round(a.score_pct ?? 0),
      createdAt: a.created_at,
      results: (a.results || []).map((r: any) => ({
        questionId: r.question_id,
        correct: Boolean(r.correct),
        chosenAnswer: r.chosen_answer,
        usedHint: Boolean(r.used_hint),
        timeSec: typeof r.time_sec === "number" ? r.time_sec : undefined,
      })),
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
