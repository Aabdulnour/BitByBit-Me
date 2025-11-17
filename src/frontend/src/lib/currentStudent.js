const CURRENT_STUDENT_STORAGE_KEY = "bitbybit_current_student_id";
export const CURRENT_STUDENT_EVENT = "bitbybit:current-student-updated";

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function getCurrentStudentId() {
  const win = safeWindow();
  if (!win) return "student-1";
  return win.localStorage.getItem(CURRENT_STUDENT_STORAGE_KEY) || "student-1";
}

export function setCurrentStudentId(studentId) {
  const win = safeWindow();
  if (!win) return;
  const nextId = studentId || "student-1";
  win.localStorage.setItem(CURRENT_STUDENT_STORAGE_KEY, nextId);
  try {
    win.dispatchEvent(
      new CustomEvent(CURRENT_STUDENT_EVENT, { detail: { studentId: nextId } })
    );
  } catch {
    // no-op if CustomEvent is not supported
    win.dispatchEvent(new Event(CURRENT_STUDENT_EVENT));
  }
}

export function clearCurrentStudentId() {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.removeItem(CURRENT_STUDENT_STORAGE_KEY);
  try {
    win.dispatchEvent(
      new CustomEvent(CURRENT_STUDENT_EVENT, { detail: { studentId: null } })
    );
  } catch {
    win.dispatchEvent(new Event(CURRENT_STUDENT_EVENT));
  }
}
