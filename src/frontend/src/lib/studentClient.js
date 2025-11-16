import { apiGet, apiPost } from "./apiClient";

// For now we hard code a single demo student id.
const STUDENT_ID = "student-1";

export function getCurrentStudentId() {
  return STUDENT_ID;
}

export async function fetchStudentState() {
  return apiGet(`/student/${STUDENT_ID}/state`);
}

export async function updateStudentState(patch) {
  // patch can contain { name, grade_level, preferred_difficulty } etc.
  return apiPost(`/student/${STUDENT_ID}/state`, patch);
}

/**
 * Create an attempt in the backend.
 * payload shape:
 * {
 *   quizId,
 *   quizType,
 *   unitId,
 *   sectionId,
 *   scorePct,
 *   results: [{ questionId, correct, chosenAnswer, timeSec }]
 * }
 */
export async function createAttempt(payload) {
  return apiPost("/attempts", {
    student_id: STUDENT_ID,
    quiz_id: payload.quizId,
    quiz_type: payload.quizType,
    unit_id: payload.unitId,
    section_id: payload.sectionId || null,
    score_pct: payload.scorePct,
    results: (payload.results || []).map((r) => ({
      question_id: r.questionId,
      correct: Boolean(r.correct),
      chosen_answer: r.chosenAnswer,
      time_sec: r.timeSec ?? 0,
      used_hint: Boolean(r.usedHint),
    }))
  });
}

export async function fetchNextPracticeQuestion({
  unitId,
  sectionId = null,
}) {
  return apiPost("/next-question", {
    student_id: STUDENT_ID,
    unit_id: unitId,
    section_id: sectionId,
  });
}

export async function fetchNextActivity() {
  return apiGet(`/student/${STUDENT_ID}/next-activity`);
}

/**
 * Remember the last learning location so we can resume quickly.
 */
export async function rememberLearningLocation({
  unitId,
  sectionId = null,
  activity = "unit",
}) {
  return updateStudentState({
    last_unit_id: unitId,
    last_section_id: sectionId,
    last_activity: activity,
  });
}
