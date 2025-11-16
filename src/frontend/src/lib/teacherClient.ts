import { apiGet } from "./apiClient";

export type TeacherStudentSummary = {
  student_id: string;
  name: string;
  overall_mastery: number;
  questions_answered: number;
  attempt_count: number;
  last_activity_at: string | null;
};

export type TeacherUnitSummary = {
  unit_id: string;
  unit_name: string;
  average_mastery: number;
  attempt_count: number;
  student_count: number;
};

export type TeacherOverviewResponse = {
  students: TeacherStudentSummary[];
  units: TeacherUnitSummary[];
};

export type TeacherUnitMasteryEntry = {
  unit_id: string;
  unit_name: string;
  mastery: number;
};

export type TeacherStudentDetailResponse = {
  student: {
    student_id: string;
    name: string;
    grade_level?: string;
    preferred_difficulty?: string;
  };
  attempts: any[];
  unit_mastery: TeacherUnitMasteryEntry[];
};

export async function fetchTeacherOverview(): Promise<TeacherOverviewResponse> {
  return apiGet("/teacher/overview");
}

export async function fetchTeacherStudentDetail(
  studentId: string
): Promise<TeacherStudentDetailResponse> {
  return apiGet(`/teacher/students/${studentId}`);
}
