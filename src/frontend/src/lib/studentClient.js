import { apiGet, apiPost } from "./apiClient";
import { getCurrentStudentId as readStudentId } from "./currentStudent";

export { getCurrentStudentId } from "./currentStudent";

export async function fetchStudentState() {
  const studentId = readStudentId();
  return apiGet(`/student/${studentId}/state`);
}

export async function updateStudentState(patch) {
  // patch can contain { name, grade_level, preferred_difficulty } etc.
  const studentId = readStudentId();
  return apiPost(`/student/${studentId}/state`, patch);
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
  const studentId = readStudentId();
  return apiPost("/attempts", {
    student_id: studentId,
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
  const studentId = readStudentId();
  return apiPost("/next-question", {
    student_id: studentId,
    unit_id: unitId,
    section_id: sectionId,
  });
}

export async function fetchNextActivity() {
  const studentId = readStudentId();
  return apiGet(`/student/${studentId}/next-activity`);
}

export async function fetchDiagnosticResults(unitId) {
  const studentId = readStudentId();
  return apiGet(`/student/${studentId}/diagnostic-results/${unitId}`);
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
