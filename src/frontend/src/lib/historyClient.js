import { apiGet } from "./apiClient";
import { getCurrentStudentId } from "./studentClient";

export async function fetchAttempts() {
  const id = getCurrentStudentId();
  return apiGet(`/attempts/${id}`);
}
